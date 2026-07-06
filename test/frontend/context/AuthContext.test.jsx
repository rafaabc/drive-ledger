import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext.jsx';

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), reset: vi.fn() },
}));

vi.mock('@/services/apiService.js', () => ({
  authApi: {
    updateCurrency: vi.fn(),
    updateLanguage: vi.fn(),
  },
}));

vi.mock('@/i18n/index.js', () => ({
  default: { changeLanguage: vi.fn() },
}));

vi.mock('@/constants/currencies.js', () => ({
  DEFAULT_CURRENCY: 'BRL',
}));

const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

function makeToken(payload) {
  return `h.${btoa(JSON.stringify(payload))}.s`;
}

function Consumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authed">{String(auth.isAuthed)}</span>
      <span data-testid="username">{auth.username ?? 'none'}</span>
      <span data-testid="currency">{auth.currency}</span>
      <span data-testid="role">{auth.role ?? 'none'}</span>
      <button onClick={auth.logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockRouterPush.mockReset();
});

describe('AuthProvider', () => {
  it('should report isAuthed false when no token in localStorage', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('should report isAuthed true and decode username when token is stored', async () => {
    const token = makeToken({ id: '1', username: 'alice', currency: 'USD', language: 'en' });
    localStorage.setItem('token', token);
    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authed').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('alice');
    expect(screen.getByTestId('currency').textContent).toBe('USD');
  });

  it('should store token and update state on login', async () => {
    function LoginConsumer() {
      const { login, isAuthed } = useAuth();
      return (
        <>
          <span data-testid="authed">{String(isAuthed)}</span>
          <button
            onClick={() =>
              login(makeToken({ id: '2', username: 'bob', currency: 'EUR', language: 'pt-BR' }))
            }
          >
            login
          </button>
        </>
      );
    }
    await act(async () => {
      render(
        <AuthProvider>
          <LoginConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authed').textContent).toBe('false');
    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });
    expect(screen.getByTestId('authed').textContent).toBe('true');
    expect(localStorage.getItem('token')).toBeTruthy();
  });

  it('should apply language from token payload when no i18nextLng in localStorage', async () => {
    const i18n = (await import('@/i18n/index.js')).default;
    const token = makeToken({ id: '3', username: 'carol', currency: 'USD', language: 'en' });
    function LoginConsumer() {
      const { login } = useAuth();
      return <button onClick={() => login(token)}>login</button>;
    }
    await act(async () => {
      render(
        <AuthProvider>
          <LoginConsumer />
        </AuthProvider>,
      );
    });
    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('should not override language from token when i18nextLng already set', async () => {
    const i18n = (await import('@/i18n/index.js')).default;
    localStorage.setItem('i18nextLng', 'pt-BR');
    const token = makeToken({ id: '4', username: 'dan', currency: 'USD', language: 'en' });
    function LoginConsumer() {
      const { login } = useAuth();
      return <button onClick={() => login(token)}>login</button>;
    }
    await act(async () => {
      render(
        <AuthProvider>
          <LoginConsumer />
        </AuthProvider>,
      );
    });
    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  it('should remove token and redirect on logout', async () => {
    const token = makeToken({ id: '5', username: 'eve', currency: 'BRL', language: 'pt-BR' });
    localStorage.setItem('token', token);
    function LogoutConsumer() {
      const { logout, isAuthed } = useAuth();
      return (
        <>
          <span data-testid="authed">{String(isAuthed)}</span>
          <button onClick={logout}>logout</button>
        </>
      );
    }
    await act(async () => {
      render(
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authed').textContent).toBe('true');
    await act(async () => {
      screen.getByRole('button', { name: 'logout' }).click();
    });
    expect(screen.getByTestId('authed').textContent).toBe('false');
    expect(localStorage.getItem('token')).toBeNull();
    expect(mockRouterPush).toHaveBeenCalledWith('/login?loggedOut=1');
  });

  it('should clear token and set expiredBanner on auth:logout event', async () => {
    const token = makeToken({ id: '6', username: 'frank', currency: 'BRL', language: 'pt-BR' });
    localStorage.setItem('token', token);
    function BannerConsumer() {
      const { isAuthed, expiredBanner } = useAuth();
      return (
        <>
          <span data-testid="authed">{String(isAuthed)}</span>
          <span data-testid="banner">{String(expiredBanner)}</span>
        </>
      );
    }
    await act(async () => {
      render(
        <AuthProvider>
          <BannerConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authed').textContent).toBe('true');
    await act(async () => {
      globalThis.dispatchEvent(new Event('auth:logout'));
    });
    expect(screen.getByTestId('authed').textContent).toBe('false');
    expect(screen.getByTestId('banner').textContent).toBe('true');
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('should update token after updateCurrency', async () => {
    const { authApi } = await import('@/services/apiService.js');
    const newToken = makeToken({ id: '7', username: 'grace', currency: 'USD', language: 'en' });
    authApi.updateCurrency.mockResolvedValue({ token: newToken });
    const initial = makeToken({ id: '7', username: 'grace', currency: 'BRL', language: 'en' });
    localStorage.setItem('token', initial);
    function CurrencyConsumer() {
      const { currency, updateCurrency } = useAuth();
      return (
        <>
          <span data-testid="currency">{currency}</span>
          <button onClick={() => updateCurrency('USD')}>update</button>
        </>
      );
    }
    await act(async () => {
      render(
        <AuthProvider>
          <CurrencyConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('currency').textContent).toBe('BRL');
    await act(async () => {
      screen.getByRole('button', { name: 'update' }).click();
    });
    expect(authApi.updateCurrency).toHaveBeenCalledWith({ currency: 'USD' });
    expect(localStorage.getItem('token')).toBe(newToken);
  });

  it('should update token and change language after updateLanguage', async () => {
    const i18n = (await import('@/i18n/index.js')).default;
    const { authApi } = await import('@/services/apiService.js');
    const newToken = makeToken({ id: '8', username: 'henry', currency: 'BRL', language: 'en' });
    authApi.updateLanguage.mockResolvedValue({ token: newToken });
    const initial = makeToken({ id: '8', username: 'henry', currency: 'BRL', language: 'pt-BR' });
    localStorage.setItem('token', initial);
    function LangConsumer() {
      const { updateLanguage } = useAuth();
      return <button onClick={() => updateLanguage('en')}>update-lang</button>;
    }
    await act(async () => {
      render(
        <AuthProvider>
          <LangConsumer />
        </AuthProvider>,
      );
    });
    await act(async () => {
      screen.getByRole('button', { name: 'update-lang' }).click();
    });
    expect(authApi.updateLanguage).toHaveBeenCalledWith({ language: 'en' });
    expect(localStorage.getItem('i18nextLng')).toBe('en');
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('should update emailVerified when another tab sets a new token via storage event', async () => {
    const initialToken = makeToken({
      id: '9',
      username: 'ivan',
      currency: 'BRL',
      language: 'pt-BR',
      emailVerified: false,
    });
    localStorage.setItem('token', initialToken);

    function VerifiedConsumer() {
      const { emailVerified } = useAuth();
      return <span data-testid="verified">{String(emailVerified)}</span>;
    }

    await act(async () => {
      render(
        <AuthProvider>
          <VerifiedConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('verified').textContent).toBe('false');

    const newToken = makeToken({
      id: '9',
      username: 'ivan',
      currency: 'BRL',
      language: 'pt-BR',
      emailVerified: true,
    });
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: newToken }));
    });

    expect(screen.getByTestId('verified').textContent).toBe('true');
  });

  it('should derive role from token, defaulting to user when absent', async () => {
    function RoleConsumer() {
      const { role } = useAuth();
      return <span data-testid="role">{role}</span>;
    }

    const tokenWithRole = makeToken({
      id: '10',
      username: 'admin_user',
      currency: 'BRL',
      language: 'pt-BR',
      role: 'admin',
    });
    localStorage.setItem('token', tokenWithRole);
    await act(async () => {
      render(
        <AuthProvider>
          <RoleConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('role').textContent).toBe('admin');
  });

  it('should derive role=user when token does not include role field', async () => {
    function RoleConsumer() {
      const { role } = useAuth();
      return <span data-testid="role">{role}</span>;
    }

    const tokenWithoutRole = makeToken({
      id: '11',
      username: 'regular_user',
      currency: 'BRL',
      language: 'pt-BR',
    });
    localStorage.setItem('token', tokenWithoutRole);
    await act(async () => {
      render(
        <AuthProvider>
          <RoleConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('role').textContent).toBe('user');
  });
});

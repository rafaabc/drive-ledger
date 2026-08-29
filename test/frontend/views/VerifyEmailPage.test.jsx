import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VerifyEmailPage from '@/views/VerifyEmailPage.jsx';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/components/ErrorBanner.jsx', () => ({
  default: ({ message, type }) => (
    <div role="alert" data-type={type ?? 'error'}>
      {message}
    </div>
  ),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => '/verify-email',
}));

const mockLogin = vi.fn();
vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  authApi: {
    verifyEmail: (data) => mockVerifyEmail(data),
    resendVerification: () => mockResendVerification(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'));
});

describe('VerifyEmailPage', () => {
  it('should show verifying state while request is in-flight', () => {
    mockVerifyEmail.mockReturnValue(new Promise(() => {}));
    render(<VerifyEmailPage />);
    expect(screen.getByText('auth.verifyEmail.verifying')).toBeInTheDocument();
  });

  it('should call verifyEmail with token from query string', async () => {
    mockVerifyEmail.mockResolvedValue({ token: 'newTok' });
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    expect(mockVerifyEmail).toHaveBeenCalledWith({ token: 'abc123' });
  });

  it('should strip the token from the address bar so analytics never see it', () => {
    mockVerifyEmail.mockResolvedValue({ token: 'newTok' });
    render(<VerifyEmailPage />);
    expect(mockReplace).toHaveBeenCalledWith('/verify-email');
  });

  it('should not call replace when there is no token to strip', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    render(<VerifyEmailPage />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should call login and show success state on valid token', async () => {
    mockVerifyEmail.mockResolvedValue({ token: 'newTok' });
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    expect(mockLogin).toHaveBeenCalledWith('newTok');
    expect(screen.getByRole('alert')).toHaveTextContent('auth.verifyEmail.success');
    expect(screen.getByRole('alert').dataset.type).toBe('success');
  });

  it('should navigate to /dashboard when go-to-dashboard button is clicked', async () => {
    mockVerifyEmail.mockResolvedValue({ token: 'newTok' });
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'auth.verifyEmail.goToDashboard' }));
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('should show error state and resend button when token is invalid', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Token expired'));
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Token expired');
    expect(screen.getByRole('button', { name: 'auth.verifyEmail.resend' })).toBeInTheDocument();
  });

  it('should show error when no token in query string', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('auth.verifyEmail.invalid');
  });

  it('should call resendVerification and show success banner on resend', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('expired'));
    mockResendVerification.mockResolvedValue({});
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'auth.verifyEmail.resend' }));
    });
    expect(mockResendVerification).toHaveBeenCalled();
    const successAlerts = screen
      .getAllByRole('alert')
      .filter((el) => el.dataset.type === 'success');
    expect(successAlerts.length).toBeGreaterThan(0);
    expect(successAlerts[0]).toHaveTextContent('auth.verifyEmail.resendSuccess');
  });

  it('should show resend error banner when resend fails', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('expired'));
    mockResendVerification.mockRejectedValue(new Error('resend failed'));
    await act(async () => {
      render(<VerifyEmailPage />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'auth.verifyEmail.resend' }));
    });
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => el.textContent === 'resend failed')).toBe(true);
  });

  it('should disable resend button while loading', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('expired'));
    let resolveResend;
    mockResendVerification.mockReturnValue(
      new Promise((r) => {
        resolveResend = r;
      }),
    );
    render(<VerifyEmailPage />);
    const resendButton = await screen.findByRole('button', { name: 'auth.verifyEmail.resend' });
    act(() => {
      fireEvent.click(resendButton);
    });
    expect(screen.getByRole('button', { name: 'auth.verifyEmail.resending' })).toBeDisabled();
    await act(async () => {
      resolveResend({});
    });
  });
});

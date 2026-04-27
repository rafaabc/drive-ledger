import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/context/AuthContext.jsx';

jest.mock('../../src/utils/decodeJwt.js');
import { decodeJwt } from '../../src/utils/decodeJwt.js';

function makeToken(username) {
  return `header.${btoa(JSON.stringify({ username }))}.sig`;
}

function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="isAuthed">{String(auth.isAuthed)}</span>
      <span data-testid="username">{auth.username ?? ''}</span>
      <span data-testid="expiredBanner">{String(auth.expiredBanner)}</span>
      <button onClick={() => auth.login(makeToken('bob'))}>Login</button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={() => auth.clearExpiredBanner()}>ClearBanner</button>
    </div>
  );
}

function renderAuth(initialEntries = ['/app']) {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true }} initialEntries={initialEntries}>
      <AuthProvider>
        <TestConsumer />
        <LocationDisplay />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    decodeJwt.mockReset();
  });

  test('should start with isAuthed=false and no username when localStorage is empty', () => {
    // Arrange
    decodeJwt.mockReturnValue(null);
    // Act
    renderAuth();
    // Assert
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(screen.getByTestId('username')).toHaveTextContent('');
  });

  test('should hydrate token from localStorage on mount and expose decoded username', () => {
    // Arrange
    localStorage.setItem('token', makeToken('alice'));
    decodeJwt.mockReturnValue({ username: 'alice' });
    // Act
    renderAuth();
    // Assert
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('true');
    expect(screen.getByTestId('username')).toHaveTextContent('alice');
  });

  test('should update state and write localStorage on login()', async () => {
    // Arrange
    decodeJwt.mockReturnValue({ username: 'bob' });
    renderAuth();
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });
    // Assert
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('true');
    expect(localStorage.getItem('token')).not.toBeNull();
  });

  test('should clear localStorage and set isAuthed=false on logout()', async () => {
    // Arrange
    localStorage.setItem('token', makeToken('alice'));
    decodeJwt.mockReturnValue({ username: 'alice' });
    renderAuth(['/app']);
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });
    // Assert
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/login');
  });

  test('should set expiredBanner=true and navigate to /login on auth:logout event', async () => {
    // Arrange
    decodeJwt.mockReturnValue(null);
    renderAuth(['/app']);
    // Act
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { expired: true } }));
    });
    // Assert
    expect(screen.getByTestId('expiredBanner')).toHaveTextContent('true');
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/login');
  });

  test('should reset expiredBanner on clearExpiredBanner()', async () => {
    // Arrange
    decodeJwt.mockReturnValue(null);
    renderAuth(['/app']);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { expired: true } }));
    });
    expect(screen.getByTestId('expiredBanner')).toHaveTextContent('true');
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ClearBanner' }));
    });
    // Assert
    expect(screen.getByTestId('expiredBanner')).toHaveTextContent('false');
  });
});

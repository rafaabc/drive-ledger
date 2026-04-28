import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage.jsx';
import { authApi } from '../../src/services/apiService.js';
import { useAuth } from '../../src/context/AuthContext.jsx';

jest.mock('../../src/services/apiService.js', () => ({
  authApi: { login: jest.fn() },
}));
jest.mock('../../src/context/AuthContext.jsx');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderLoginPage({ locationState = null, expiredBanner = false } = {}) {
  const login = jest.fn();
  const clearExpiredBanner = jest.fn();
  useAuth.mockReturnValue({ login, expiredBanner, clearExpiredBanner });
  const result = render(
    <MemoryRouter future={{ v7_relativeSplatPath: true }} initialEntries={[{ pathname: '/login', state: locationState }]}>
      <LoginPage />
    </MemoryRouter>
  );
  return { login, clearExpiredBanner, ...result };
}

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call authApi.login, store token, and navigate to / on success', async () => {
    // Arrange
    authApi.login.mockResolvedValue({ token: 'a.b.c' });
    const { login, container } = renderLoginPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'alice' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret123' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ username: 'alice', password: 'secret123' });
      expect(login).toHaveBeenCalledWith('a.b.c');
      expect(mockNavigate).toHaveBeenCalledWith('/', { state: { justLoggedIn: true } });
    });
  });

  test('should display error message when login API returns an error', async () => {
    // Arrange
    authApi.login.mockRejectedValue(new Error('Invalid credentials'));
    const { container } = renderLoginPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'alice' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'wrong' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    await screen.findByText('Invalid credentials');
  });

  test('should show session expired banner when expiredBanner is true', () => {
    // Arrange + Act
    renderLoginPage({ expiredBanner: true });
    // Assert
    expect(screen.getByText('Your session expired. Please log in again.')).toBeInTheDocument();
  });

  test('should show registration success banner when justRegistered state is set', () => {
    // Arrange + Act
    renderLoginPage({ locationState: { justRegistered: true } });
    // Assert
    expect(screen.getByText('Account created — please log in.')).toBeInTheDocument();
  });

  test('should show loading text on the submit button while request is in flight', async () => {
    // Arrange
    let resolveLogin;
    authApi.login.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    const { container } = renderLoginPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'alice' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret123' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
    resolveLogin({ token: 'x.y.z' });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../../src/pages/RegisterPage.jsx';
import { authApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  authApi: { register: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderRegisterPage() {
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>);
}

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call authApi.register and navigate to /login on success', async () => {
    // Arrange
    authApi.register.mockResolvedValue({});
    const { container } = renderRegisterPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'newuser' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'password123' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({ username: 'newuser', password: 'password123' });
      expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { justRegistered: true } });
    });
  });

  test('should display error message when registration fails', async () => {
    // Arrange
    authApi.register.mockRejectedValue(new Error('Username already taken'));
    const { container } = renderRegisterPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'existinguser' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'password123' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    await screen.findByText('Username already taken');
  });

  test('should show loading text on the submit button while request is in flight', async () => {
    // Arrange
    let resolveRegister;
    authApi.register.mockReturnValue(new Promise((r) => { resolveRegister = r; }));
    const { container } = renderRegisterPage();
    // Act
    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'user' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'pass1234' } });
    fireEvent.submit(container.querySelector('form'));
    // Assert
    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();
    resolveRegister({});
  });

  test('should have correct HTML5 validation attributes on username input', () => {
    // Arrange + Act
    const { container } = renderRegisterPage();
    const usernameInput = container.querySelector('input[name="username"]');
    // Assert
    expect(usernameInput).toHaveAttribute('minLength', '3');
    expect(usernameInput).toHaveAttribute('maxLength', '50');
    expect(usernameInput).toHaveAttribute('pattern', '[a-zA-Z0-9_]+');
  });
});

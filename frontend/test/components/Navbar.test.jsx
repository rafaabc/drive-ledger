import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../src/components/Navbar.jsx';
import { useAuth } from '../../src/context/AuthContext.jsx';

jest.mock('../../src/context/AuthContext.jsx');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderNavbar() {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true }}>
      <Navbar />
    </MemoryRouter>
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should show Login and Register links when not authenticated', () => {
    // Arrange
    useAuth.mockReturnValue({ isAuthed: false, username: null, logout: jest.fn() });
    // Act
    renderNavbar();
    // Assert
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  test('should show Expenses, Summary, username, and Logout when authenticated', () => {
    // Arrange
    useAuth.mockReturnValue({ isAuthed: true, username: 'alice', logout: jest.fn() });
    // Act
    renderNavbar();
    // Assert
    expect(screen.getByRole('link', { name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  test('should call logout() from context when Logout button is clicked', () => {
    // Arrange
    const logout = jest.fn();
    useAuth.mockReturnValue({ isAuthed: true, username: 'alice', logout });
    renderNavbar();
    // Act
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    // Assert
    expect(logout).toHaveBeenCalledTimes(1);
  });

  test('should navigate to / when the brand button is clicked', () => {
    // Arrange
    useAuth.mockReturnValue({ isAuthed: false, username: null, logout: jest.fn() });
    renderNavbar();
    // Act
    fireEvent.click(screen.getByRole('button', { name: /drive ledger home/i }));
    // Assert
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

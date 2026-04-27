import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../src/routes/ProtectedRoute.jsx';
import { useAuth } from '../../src/context/AuthContext.jsx';

jest.mock('../../src/context/AuthContext.jsx');

function renderProtectedRoute(isAuthed) {
  useAuth.mockReturnValue({ isAuthed });
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true }} initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>}
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  test('should render children when user is authenticated', () => {
    // Arrange + Act
    renderProtectedRoute(true);
    // Assert
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  test('should redirect to /login when user is not authenticated', () => {
    // Arrange + Act
    renderProtectedRoute(false);
    // Assert
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});

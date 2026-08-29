import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ResetPasswordPage from '@/views/ResetPasswordPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/views/LoginPage.module.css', () => ({ default: {} }));
vi.mock('@/components/AuthBrandPanel.jsx', () => ({ default: () => <div data-testid="brand" /> }));

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseRouter = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => '/reset-password',
}));

const mockResetPassword = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  authApi: { resetPassword: () => mockResetPassword() },
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush, replace: mockReplace });
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'));
    mockResetPassword.mockResolvedValue({});
  });

  it('should render new password and confirm fields when token present', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText('auth.resetPassword.newPassword')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.resetPassword.confirm')).toBeInTheDocument();
  });

  it('should redirect to /forgot-password when no token', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(''));
    await act(async () => {
      render(<ResetPasswordPage />);
    });
    expect(mockReplace).toHaveBeenCalledWith('/forgot-password');
  });

  it('should strip the token from the address bar so analytics never see it', () => {
    render(<ResetPasswordPage />);
    expect(mockReplace).toHaveBeenCalledWith('/reset-password');
  });

  it('should show mismatch error when passwords differ', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('auth.resetPassword.newPassword'), {
      target: { value: 'pass0001', name: 'newPassword' },
    });
    fireEvent.change(screen.getByLabelText('auth.resetPassword.confirm'), {
      target: { value: 'pass0002', name: 'confirmPassword' },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' }).closest('form'),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent('errors.passwordMismatch');
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('should call resetPassword and redirect to /login?passwordChanged=1 on success', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('auth.resetPassword.newPassword'), {
      target: { value: 'newpass1', name: 'newPassword' },
    });
    fireEvent.change(screen.getByLabelText('auth.resetPassword.confirm'), {
      target: { value: 'newpass1', name: 'confirmPassword' },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' }).closest('form'),
      );
    });
    expect(mockResetPassword).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/login?passwordChanged=1');
  });

  it('should show error banner when resetPassword throws', async () => {
    mockResetPassword.mockRejectedValue(new Error('token expired'));
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('auth.resetPassword.newPassword'), {
      target: { value: 'newpass1', name: 'newPassword' },
    });
    fireEvent.change(screen.getByLabelText('auth.resetPassword.confirm'), {
      target: { value: 'newpass1', name: 'confirmPassword' },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' }).closest('form'),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent('token expired');
  });
});

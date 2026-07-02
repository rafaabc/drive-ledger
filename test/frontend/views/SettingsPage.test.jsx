import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SettingsPage from '@/views/SettingsPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/views/SettingsPage.module.css', () => ({ default: {} }));
vi.mock('@/components/GoogleSignInButton.jsx', () => ({
  default: ({ onSuccess }) => <button onClick={onSuccess}>google-link</button>,
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUpdateCurrency = vi.fn();
const mockUpdateLanguage = vi.fn();
let mockAuthState = {
  username: 'alice',
  currency: 'BRL',
  language: 'en',
  updateCurrency: null,
  updateLanguage: null,
};
let mockEmailVerified = true;
const mockLogout = vi.fn();

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    ...mockAuthState,
    updateCurrency: mockUpdateCurrency,
    updateLanguage: mockUpdateLanguage,
    logout: mockLogout,
    login: vi.fn(),
    emailVerified: mockEmailVerified,
  }),
}));

const mockGetProviders = vi.fn();
const mockUnlinkGoogle = vi.fn();
const mockExportData = vi.fn();
const mockDeleteAccount = vi.fn();
const mockResendVerification = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  authApi: {
    getProviders: () => mockGetProviders(),
    unlinkGoogle: () => mockUnlinkGoogle(),
    exportData: () => mockExportData(),
    deleteAccount: (...args) => mockDeleteAccount(...args),
    resendVerification: () => mockResendVerification(),
  },
}));

describe('SettingsPage', () => {
  const renderPage = () =>
    act(async () => {
      render(<SettingsPage />);
    });
  const openDeleteModal = async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'settings.myData.deleteAccount' }));
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailVerified = true;
    mockUpdateCurrency.mockResolvedValue({});
    mockUpdateLanguage.mockResolvedValue({});
    mockUnlinkGoogle.mockResolvedValue({});
    mockGetProviders.mockResolvedValue({ authProviders: ['google'], hasPassword: true });
    mockExportData.mockResolvedValue({ user: {}, expenses: [] });
    mockDeleteAccount.mockResolvedValue({});
    mockResendVerification.mockResolvedValue({});
  });

  it('should render heading and username', async () => {
    await renderPage();
    expect(screen.getByText('settings.heading')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('should render currency select', async () => {
    await renderPage();
    expect(screen.getByLabelText('settings.currency.label')).toBeInTheDocument();
  });

  it('should call updateCurrency on currency form submit', async () => {
    await renderPage();
    const select = screen.getByLabelText('settings.currency.label');
    fireEvent.change(select, { target: { value: 'USD' } });
    const forms = document.querySelectorAll('form');
    await act(async () => {
      fireEvent.submit(forms[0]);
    });
    expect(mockUpdateCurrency).toHaveBeenCalledWith('USD');
  });

  it('should call updateLanguage on language form submit', async () => {
    await renderPage();
    const select = screen.getByLabelText('settings.language.label');
    fireEvent.change(select, { target: { value: 'pt-BR' } });
    const forms = document.querySelectorAll('form');
    await act(async () => {
      fireEvent.submit(forms[1]);
    });
    expect(mockUpdateLanguage).toHaveBeenCalledWith('pt-BR');
  });

  it('should show disconnect button when google is linked', async () => {
    await renderPage();
    expect(screen.getByText('settings.disconnectGoogle')).toBeInTheDocument();
  });

  it('should call unlinkGoogle and update providers on disconnect', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByText('settings.disconnectGoogle'));
    });
    expect(mockUnlinkGoogle).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('settings.googleDisconnected');
  });

  it('should show google link button when google is not linked', async () => {
    mockGetProviders.mockResolvedValue({ authProviders: [], hasPassword: true });
    await renderPage();
    expect(screen.getByText('google-link')).toBeInTheDocument();
  });

  it('should render change-password link', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: /settings\.changePassword/ })).toHaveAttribute(
      'href',
      '/change-password',
    );
  });

  it('should render export data button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: 'settings.myData.export' })).toBeInTheDocument();
  });

  it('should render delete account button', async () => {
    await renderPage();
    expect(
      screen.getByRole('button', { name: 'settings.myData.deleteAccount' }),
    ).toBeInTheDocument();
  });

  it('should show delete modal when delete account button is clicked', async () => {
    await openDeleteModal();
    expect(screen.getByText('settings.deleteAccount.heading')).toBeInTheDocument();
  });

  it('should show error banner when unlinkGoogle fails', async () => {
    mockUnlinkGoogle.mockRejectedValue(new Error('unlink failed'));
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByText('settings.disconnectGoogle'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('unlink failed');
  });

  it('should trigger file download on export data', async () => {
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();

    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'settings.myData.export' }));
    });

    expect(mockExportData).toHaveBeenCalled();
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should show export error when exportData fails', async () => {
    mockExportData.mockRejectedValue(new Error('export error'));
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'settings.myData.export' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('export error');
  });

  it('should call deleteAccount, logout and redirect on confirmed delete', async () => {
    await openDeleteModal();
    const passwordInput = screen.getByLabelText('settings.deleteAccount.passwordLabel');
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'settings.deleteAccount.confirm' }));
    });
    expect(mockDeleteAccount).toHaveBeenCalledWith({ password: 'secret' });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/login?deleted=1');
  });

  it('should show delete error when deleteAccount fails', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('delete failed'));
    await openDeleteModal();
    const passwordInput = screen.getByLabelText('settings.deleteAccount.passwordLabel');
    fireEvent.change(passwordInput, { target: { value: 'bad' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'settings.deleteAccount.confirm' }));
    });
    expect(screen.getByText('delete failed')).toBeInTheDocument();
  });

  describe('when emailVerified is false', () => {
    beforeEach(() => {
      mockEmailVerified = false;
    });

    it('should show resend verification button', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: 'auth.verifyEmail.resend' })).toBeInTheDocument();
    });

    it('should call resendVerification when resend button is clicked', async () => {
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'auth.verifyEmail.resend' }));
      });
      expect(mockResendVerification).toHaveBeenCalled();
    });

    it('should show resend success banner after successful resend', async () => {
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'auth.verifyEmail.resend' }));
      });
      expect(screen.getByRole('alert')).toHaveTextContent('auth.verifyEmail.resendSuccess');
    });
  });

  it('should close delete modal when cancel button is clicked', async () => {
    await openDeleteModal();
    expect(screen.getByText('settings.deleteAccount.heading')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    });
    expect(screen.queryByText('settings.deleteAccount.heading')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import SettingsPage from '@/views/SettingsPage.jsx';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));
vi.mock('@/i18n/index.js', () => ({
  default: { t: (k) => k, changeLanguage: vi.fn(), language: 'en' },
}));
vi.mock('@/services/apiService.js', () => ({
  authApi: { getProviders: vi.fn().mockResolvedValue({ authProviders: [], hasPassword: true }) },
  billingApi: {
    checkout: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/fake' }),
    portal: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/fake' }),
  },
}));

const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext.jsx', () => ({ useAuth: () => mockUseAuth() }));

describe('SettingsPage — billing section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      username: 'freeuser',
      currency: 'USD',
      language: 'en',
      updateCurrency: vi.fn(),
      updateLanguage: vi.fn(),
      emailVerified: true,
      logout: vi.fn(),
      plan: 'free',
      reminderEmailsEnabled: true,
      updateNotificationPrefs: vi.fn(),
    });
    useSearchParams.mockReturnValue(new URLSearchParams());
    vi.stubGlobal('location', { href: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an "Upgrade to Pro" button for a free-plan user and redirects to the checkout url', async () => {
    render(<SettingsPage />);
    const upgradeBtn = await screen.findByRole('button', { name: 'settings.billing.upgrade' });
    fireEvent.click(upgradeBtn);
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/fake'));
  });

  it('shows a "Manage billing" button for a pro-plan user and redirects to the portal url', async () => {
    mockUseAuth.mockReturnValue({
      username: 'prouser',
      currency: 'USD',
      language: 'en',
      updateCurrency: vi.fn(),
      updateLanguage: vi.fn(),
      emailVerified: true,
      logout: vi.fn(),
      plan: 'pro',
      reminderEmailsEnabled: true,
      updateNotificationPrefs: vi.fn(),
    });
    render(<SettingsPage />);
    const manageBtn = await screen.findByRole('button', { name: 'settings.billing.manage' });
    fireEvent.click(manageBtn);
    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/fake'));
  });

  it('calls refreshPlan once when redirected back from a successful checkout', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('?checkout=success'));
    const refreshPlan = vi.fn().mockResolvedValue();
    mockUseAuth.mockReturnValue({
      username: 'freeuser',
      currency: 'USD',
      language: 'en',
      updateCurrency: vi.fn(),
      updateLanguage: vi.fn(),
      emailVerified: true,
      logout: vi.fn(),
      plan: 'free',
      reminderEmailsEnabled: true,
      updateNotificationPrefs: vi.fn(),
      refreshPlan,
    });

    render(<SettingsPage />);
    await waitFor(() => expect(refreshPlan).toHaveBeenCalledTimes(1));
  });
});

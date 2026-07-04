import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '@/views/LandingPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/views/LandingPage.module.css', () => ({ default: {} }));

describe('LandingPage', () => {
  it('should render the primary CTA linking to /register', () => {
    render(<LandingPage />);
    const link = screen.getByText('landing.hero.ctaPrimary').closest('a');
    expect(link).toHaveAttribute('href', '/register');
  });

  it('should render the secondary CTA linking to /login', () => {
    render(<LandingPage />);
    const link = screen.getByText('landing.hero.ctaSecondary').closest('a');
    expect(link).toHaveAttribute('href', '/login');
  });

  it('should render feature card i18n keys', () => {
    render(<LandingPage />);
    expect(screen.getByText('landing.features.multiVehicle.title')).toBeInTheDocument();
    expect(screen.getByText('landing.features.multiVehicle.blurb')).toBeInTheDocument();
  });

  it('should not render PricingTeaser when stripe is not enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_ENABLED', undefined);
    render(<LandingPage />);
    expect(screen.queryByText('landing.pricing.heading')).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it('should render PricingTeaser when stripe is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_ENABLED', 'true');
    render(<LandingPage />);
    expect(screen.getByText('landing.pricing.heading')).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});

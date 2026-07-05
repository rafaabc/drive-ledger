import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LandingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.page.goto('/');
  }

  // Scoped to the hero's action group (LandingHero.jsx `styles.heroActions`):
  // PricingTeaser also renders an `a[href="/register"]` (when
  // NEXT_PUBLIC_STRIPE_ENABLED=true) and LandingFooter also renders an
  // `a[href="/login"]`, so an unscoped locator would not be unique.
  get ctaPrimary() {
    return this.page.locator('[class*="heroActions"] a[href="/register"]');
  }

  get ctaSecondary() {
    return this.page.locator('[class*="heroActions"] a[href="/login"]');
  }
}

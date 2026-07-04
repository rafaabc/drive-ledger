import { test, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { createAndLoginUser } from '../../fixtures/api';

test.describe('Landing Page', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
  });

  test('should show the landing page with CTAs for a logged-out visitor', async ({ page }) => {
    await landingPage.navigate();

    await expect(page).toHaveURL('/');
    await expect(landingPage.ctaPrimary).toBeVisible();
    await expect(landingPage.ctaSecondary).toBeVisible();
  });

  test('primary CTA should navigate to /register', async ({ page }) => {
    await landingPage.navigate();

    await landingPage.ctaPrimary.click();

    await expect(page).toHaveURL('/register');
  });

  test('secondary CTA should navigate to /login', async ({ page }) => {
    await landingPage.navigate();

    await landingPage.ctaSecondary.click();

    await expect(page).toHaveURL('/login');
  });

  test('should redirect a logged-in visitor to /dashboard', async ({ page, request }) => {
    const { token } = await createAndLoginUser(request, 'landing');
    await page.addInitScript((t: string) => {
      localStorage.setItem('token', t);
      localStorage.setItem('i18nextLng', 'en');
    }, token);

    await landingPage.navigate();

    await expect(page).toHaveURL('/dashboard');
  });
});

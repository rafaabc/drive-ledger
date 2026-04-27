import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { createAndLoginUser } from '../../fixtures/api';
import { DEFAULT_PASSWORD } from '../../fixtures/test-data';

test.describe('US-02: User Login', () => {
  let loginPage: LoginPage;
  let registeredUsername: string;

  test.beforeAll(async ({ request }) => {
    const user = await createAndLoginUser(request, 'login');
    registeredUsername = user.username;
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  // TC-02-01
  test('[TC-02-01] should redirect to /expenses and show username in navbar after valid login', async ({ page }) => {
    await loginPage.login(registeredUsername, DEFAULT_PASSWORD);

    await expect(page).toHaveURL('/expenses');
    await expect(page.getByText(registeredUsername)).toBeVisible();
  });

  // TC-02-02
  test('[TC-02-02] should show error banner when password is incorrect', async ({ page }) => {
    await loginPage.login(registeredUsername, 'WrongPass99');

    await expect(page).toHaveURL('/login');
    await expect(loginPage.errorBanner).toContainText('Invalid credentials');
  });

  // TC-02-07 — access protected route without token
  test('[TC-02-07] should redirect to /login when navigating to /expenses without a token', async ({ page }) => {
    await page.goto('/expenses');

    await expect(page).toHaveURL('/login');
  });
});

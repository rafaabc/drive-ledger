import { test, expect } from '@playwright/test';
import { createAndLoginUser } from '../../fixtures/api';

test.describe('Logout and Session Expiry', () => {
  // TC-02-06 — simulate expired/invalid token
  test('[TC-02-06] should redirect to /login with "session expired" banner when token is invalid', async ({ page }) => {
    // Set a structurally valid but cryptographically invalid JWT so
    // AuthContext treats the user as authenticated, but the backend rejects it
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6InRlc3QiLCJpZCI6OTk5fQ.invalid_signature';

    await page.addInitScript((t) => localStorage.setItem('token', t), fakeToken);
    await page.goto('/expenses');

    // API returns 403 → auth:logout event → AuthContext navigates to /login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.alert-info')).toContainText('Your session expired. Please log in again.');
  });

  // Logout flow
  test('should clear session and show Login/Register links after logout', async ({ page, request }) => {
    const { token } = await createAndLoginUser(request, 'logout');

    await page.addInitScript((t) => localStorage.setItem('token', t), token);
    await page.goto('/expenses');
    await expect(page).toHaveURL('/expenses');

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL('/login');
    // Scope to nav to avoid matching the "No account? Register" link in the page body
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Register' })).toBeVisible();
  });
});

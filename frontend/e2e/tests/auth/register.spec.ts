import { test, expect } from '@playwright/test';
import { RegisterPage } from '../../pages/RegisterPage';
import { createAndLoginUser } from '../../fixtures/api';
import { uniqueUsername, DEFAULT_PASSWORD } from '../../fixtures/test-data';

test.describe('US-01: User Registration', () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.navigate();
  });

  // TC-01-01
  test('[TC-01-01] should redirect to /login with success banner after valid registration', async ({ page }) => {
    const username = uniqueUsername('reg');

    await registerPage.register(username, DEFAULT_PASSWORD);

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.alert-success')).toContainText('Account created — please log in.');
  });

  // TC-01-02 / TC-01-03
  test('[TC-01-02/03] should show error banner when username is already taken', async ({ page, request }) => {
    const username = uniqueUsername('dup');

    // First registration succeeds
    await request.post('/api/auth/register', {
      data: { username, password: DEFAULT_PASSWORD },
    });

    // Attempt second registration with same username via UI
    await registerPage.register(username, DEFAULT_PASSWORD);

    await expect(page).toHaveURL('/register');
    await expect(registerPage.errorBanner).toContainText('username already taken');
  });

  // TC-01-09 — username too short (HTML5 minLength=3)
  test('[TC-01-09] should not submit when username is shorter than 3 characters', async ({ page }) => {
    await registerPage.usernameInput.fill('ab');
    await registerPage.passwordInput.fill(DEFAULT_PASSWORD);
    await registerPage.submitButton.click();

    await expect(page).toHaveURL('/register');
    await expect(registerPage.errorBanner).not.toBeVisible();
    const valid = await registerPage.usernameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  // TC-01-11 — username contains spaces (HTML5 pattern=[a-zA-Z0-9_]+)
  test('[TC-01-11] should not submit when username contains a space', async ({ page }) => {
    await registerPage.usernameInput.fill('user name');
    await registerPage.passwordInput.fill(DEFAULT_PASSWORD);
    await registerPage.submitButton.click();

    await expect(page).toHaveURL('/register');
    await expect(registerPage.errorBanner).not.toBeVisible();
    const valid = await registerPage.usernameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  // TC-01-12 — username contains special chars (HTML5 pattern)
  test('[TC-01-12] should not submit when username contains special characters', async ({ page }) => {
    await registerPage.usernameInput.fill('user@name');
    await registerPage.passwordInput.fill(DEFAULT_PASSWORD);
    await registerPage.submitButton.click();

    await expect(page).toHaveURL('/register');
    await expect(registerPage.errorBanner).not.toBeVisible();
    const valid = await registerPage.usernameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  // TC-01-05 — missing password (HTML5 required)
  test('[TC-01-05] should not submit when password is missing', async ({ page }) => {
    await registerPage.usernameInput.fill(uniqueUsername());
    await registerPage.submitButton.click();

    await expect(page).toHaveURL('/register');
    await expect(registerPage.errorBanner).not.toBeVisible();
  });
});

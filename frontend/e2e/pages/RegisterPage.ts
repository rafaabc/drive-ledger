import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.page.goto('/register');
  }

  async register(username: string, password: string) {
    await this.page.locator('[name="username"]').fill(username);
    await this.page.locator('[name="password"]').fill(password);
    await this.page.getByRole('button', { name: 'Create account' }).click();
  }

  get usernameInput(): Locator {
    return this.page.locator('[name="username"]');
  }

  get passwordInput(): Locator {
    return this.page.locator('[name="password"]');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Create account' });
  }
}

import { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async navigate(path = '/') {
    await this.page.goto(path);
  }

  get errorBanner(): Locator {
    return this.page.locator('.alert-error');
  }

  get successBanner(): Locator {
    return this.page.locator('.alert-success');
  }

  get infoBanner(): Locator {
    return this.page.locator('.alert-info');
  }

  get spinner(): Locator {
    return this.page.locator('.spinner');
  }

  async clickLogout() {
    await this.page.getByRole('button', { name: 'Logout' }).click();
  }
}

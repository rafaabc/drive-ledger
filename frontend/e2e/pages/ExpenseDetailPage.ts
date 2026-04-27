import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExpenseDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(id: number | string) {
    await this.page.goto(`/expenses/${id}`);
  }

  async clickEdit() {
    await this.page.getByRole('button', { name: 'Edit' }).click();
  }

  async clickDelete() {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }

  async clickBack() {
    await this.page.getByRole('button', { name: 'Back' }).click();
  }

  getCategoryBadge(category: string): Locator {
    return this.page.locator(`.badge[data-cat="${category}"]`);
  }

  get title(): Locator {
    return this.page.getByText('Expense detail');
  }
}

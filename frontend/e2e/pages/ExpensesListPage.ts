import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExpensesListPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.page.goto('/expenses');
  }

  async clickNewExpense() {
    await this.page.getByRole('button', { name: /new expense/i }).click();
  }

  async filterByCategory(category: string) {
    await this.page.locator('select[name="category"]').selectOption(category);
  }

  async filterByYear(year: string) {
    await this.page.locator('select[name="year"]').selectOption(year);
  }

  async filterByMonth(monthValue: string) {
    await this.page.locator('select[name="month"]').selectOption(monthValue);
  }

  async clearFilters() {
    await this.page.getByRole('button', { name: 'Clear' }).click();
  }

  get emptyState(): Locator {
    return this.page.getByText(/no expenses/i);
  }

  get tableRows(): Locator {
    return this.page.locator('tbody tr');
  }

  async deleteFirstRow() {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.locator('tbody tr').first().getByRole('button', { name: /delete/i }).click();
  }

  async clickEditInFirstRow() {
    await this.page.locator('tbody tr').first().getByRole('button', { name: /edit/i }).click();
  }

  waitForTableLoad() {
    return this.page.locator('.spinner').waitFor({ state: 'hidden' });
  }
}

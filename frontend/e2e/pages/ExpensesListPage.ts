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
    await this.page.locator('input[name="year"]').fill(year);
    await this.page.locator('input[name="year"]').press('Tab');
  }

  async filterByMonth(monthValue: string) {
    await this.page.locator('select[name="month"]').selectOption(monthValue);
  }

  async clearFilters() {
    await this.page.getByRole('button', { name: 'Clear' }).click();
  }

  get emptyState(): Locator {
    return this.page.getByText('No expenses found.');
  }

  get tableRows(): Locator {
    return this.page.locator('tbody tr');
  }

  async deleteFirstRow() {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.locator('tbody tr').first().getByRole('button', { name: 'Delete' }).click();
  }

  async clickEditInFirstRow() {
    await this.page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click();
  }

  waitForTableLoad() {
    return this.page.locator('.spinner').waitFor({ state: 'hidden' });
  }
}

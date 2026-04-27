import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class SummaryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.page.goto('/summary');
  }

  async setYear(year: string) {
    const input = this.page.locator('input[name="year"]');
    await input.fill(year);
    await input.press('Tab');
  }

  async filterByCategory(category: string) {
    await this.page.locator('select[name="category"]').selectOption(category);
  }

  async clearCategoryFilter() {
    await this.page.locator('select[name="category"]').selectOption('');
  }

  get table(): Locator {
    return this.page.getByRole('table');
  }

  get footerRow(): Locator {
    return this.page.locator('tfoot tr');
  }

  getMonthRow(monthName: string): Locator {
    return this.page.locator('tbody tr').filter({ hasText: monthName });
  }

  emptyStateFor(year: string | number): Locator {
    return this.page.getByText(`No expenses found for ${year}.`);
  }
}

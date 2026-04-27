import { test, expect } from '@playwright/test';
import { ExpensesListPage } from '../../pages/ExpensesListPage';
import { createAndLoginUser, createExpenseViaApi } from '../../fixtures/api';
import { currentYear } from '../../fixtures/test-data';

let token: string;

test.beforeAll(async ({ request }) => {
  ({ token } = await createAndLoginUser(request, 'filter'));

  await createExpenseViaApi(request, token, { category: 'Fuel', litres: 20, price_per_litre: 5 });
  await createExpenseViaApi(request, token, { category: 'Maintenance', amount: 200 });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('token', t), token);
});

test('should show only Fuel expenses when filtered by Fuel category', async ({ page }) => {
  const listPage = new ExpensesListPage(page);
  await listPage.navigate();
  await expect(listPage.tableRows).toHaveCount(2);

  await listPage.filterByCategory('Fuel');

  await expect(listPage.tableRows).toHaveCount(1);
  await expect(page.locator('[data-cat="Fuel"]')).toBeVisible();
  await expect(page.locator('[data-cat="Maintenance"]')).not.toBeVisible();
});

test('should show only Maintenance expenses when filtered by Maintenance category', async ({ page }) => {
  const listPage = new ExpensesListPage(page);
  await listPage.navigate();
  await expect(listPage.tableRows).toHaveCount(2);

  await listPage.filterByCategory('Maintenance');

  await expect(listPage.tableRows).toHaveCount(1);
  await expect(page.locator('[data-cat="Maintenance"]')).toBeVisible();
  await expect(page.locator('[data-cat="Fuel"]')).not.toBeVisible();
});

test('should show empty state when no expenses match the selected category', async ({ page }) => {
  const listPage = new ExpensesListPage(page);
  await listPage.navigate();
  await expect(listPage.tableRows).toHaveCount(2);

  await listPage.filterByCategory('Tax');

  await expect(listPage.emptyState).toBeVisible();
  await expect(listPage.tableRows).toHaveCount(0);
});

test('should restore all expenses after clearing filters', async ({ page }) => {
  const listPage = new ExpensesListPage(page);
  await listPage.navigate();

  await listPage.filterByCategory('Fuel');
  await expect(listPage.tableRows).toHaveCount(1);

  await listPage.clearFilters();

  await expect(listPage.tableRows).toHaveCount(2);
});

test('should filter by current year and show all expenses', async ({ page }) => {
  const listPage = new ExpensesListPage(page);
  await listPage.navigate();

  await listPage.filterByYear(String(currentYear()));

  await expect(listPage.tableRows).toHaveCount(2);
});

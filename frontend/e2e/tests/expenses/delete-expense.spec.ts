import { test, expect } from '@playwright/test';
import { ExpensesListPage } from '../../pages/ExpensesListPage';
import { ExpenseDetailPage } from '../../pages/ExpenseDetailPage';
import { createAndLoginUser, createExpenseViaApi } from '../../fixtures/api';

let token: string;

test.beforeAll(async ({ request }) => {
  ({ token } = await createAndLoginUser(request, 'deleteexp'));
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('token', t), token);
});

// TC-03-15 — delete from list
test('[TC-03-15] should remove expense from list after deletion', async ({ page, request }) => {
  await createExpenseViaApi(request, token, { category: 'Tax', amount: 300 });

  const listPage = new ExpensesListPage(page);
  await listPage.navigate();

  await expect(listPage.tableRows).toHaveCount(1);

  await listPage.deleteFirstRow();

  await expect(listPage.tableRows).toHaveCount(0);
  await expect(listPage.emptyState).toBeVisible();
});

// TC-03-15 — delete from detail page
test('[TC-03-15] should redirect to /expenses after deleting from detail page', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, { category: 'Parking', amount: 20 });

  const detailPage = new ExpenseDetailPage(page);
  await detailPage.navigate(expense.id);
  await detailPage.clickDelete();

  await expect(page).toHaveURL('/expenses');
});

// TC-03-05 — duplicate expenses are independent
test('[TC-03-05] should allow two identical expenses and delete them independently', async ({ page, request }) => {
  await createExpenseViaApi(request, token, { category: 'Other', amount: 50 });
  await createExpenseViaApi(request, token, { category: 'Other', amount: 50 });

  const listPage = new ExpensesListPage(page);
  await listPage.navigate();

  await expect(listPage.tableRows).toHaveCount(2);

  await listPage.deleteFirstRow();

  await expect(listPage.tableRows).toHaveCount(1);
  await expect(page.locator('[data-cat="Other"]')).toBeVisible();
});

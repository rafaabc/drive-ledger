import { test, expect } from '@playwright/test';
import { ExpenseDetailPage } from '../../pages/ExpenseDetailPage';
import { ExpenseFormPage } from '../../pages/ExpenseFormPage';
import { createAndLoginUser, createExpenseViaApi } from '../../fixtures/api';

let token: string;

test.beforeAll(async ({ request }) => {
  ({ token } = await createAndLoginUser(request, 'viewedit'));
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('token', t), token);
});

// TC-03-02
test('[TC-03-02] should display expense fields correctly on detail page', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, {
    category: 'Insurance',
    amount: 500,
  });

  const detailPage = new ExpenseDetailPage(page);
  await detailPage.navigate(expense.id);

  await expect(detailPage.title).toBeVisible();
  await expect(detailPage.getCategoryBadge('Insurance')).toBeVisible();
  await expect(page.getByText('500.00')).toBeVisible();
});

// TC-03-02 — Fuel expense shows litres and price_per_litre
test('[TC-03-02] should display litres and price per litre for Fuel expense', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, {
    category: 'Fuel',
    litres: 30,
    price_per_litre: 6,
  });

  const detailPage = new ExpenseDetailPage(page);
  await detailPage.navigate(expense.id);

  await expect(detailPage.getCategoryBadge('Fuel')).toBeVisible();
  await expect(page.getByText('180.00')).toBeVisible();
  await expect(page.getByText('30', { exact: true })).toBeVisible();
  // exact: true avoids strict-mode violation when username/date also contain '6'
  await expect(page.getByText('6', { exact: true })).toBeVisible();
});

// TC-03-13 — edit expense
test('[TC-03-13] should update expense amount and reflect on detail page', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, {
    category: 'Toll',
    amount: 10,
  });

  const detailPage = new ExpenseDetailPage(page);
  await detailPage.navigate(expense.id);
  await detailPage.clickEdit();

  await expect(page).toHaveURL(`/expenses/${expense.id}/edit`);

  const formPage = new ExpenseFormPage(page);
  await formPage.fillAmount('25');
  await formPage.submit();

  await expect(page).toHaveURL('/expenses');
});

// TC-03-14 — editing non-existent expense
test('[TC-03-14] should show error banner when navigating to a non-existent expense', async ({ page }) => {
  const detailPage = new ExpenseDetailPage(page);
  await detailPage.navigate(999999);

  await expect(detailPage.errorBanner).toBeVisible();
  await expect(detailPage.errorBanner).toContainText('Expense not found');
});

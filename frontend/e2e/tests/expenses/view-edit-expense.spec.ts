import { test, expect } from '@playwright/test';
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
test('[TC-03-02] should display expense fields correctly on edit form', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, {
    category: 'Insurance',
    amount: 500,
  });

  await page.goto(`/expenses/${expense.id}/edit`);

  const formPage = new ExpenseFormPage(page);
  await expect(formPage.amountInput).toHaveValue('500');
  await expect(page.locator('select[name="category"]')).toHaveValue('Insurance');
});

// TC-03-13 — edit expense
test('[TC-03-13] should update expense amount and redirect to expenses list', async ({ page, request }) => {
  const expense = await createExpenseViaApi(request, token, {
    category: 'Toll',
    amount: 10,
  });

  await page.goto(`/expenses/${expense.id}/edit`);

  const formPage = new ExpenseFormPage(page);
  await formPage.fillAmount('25');
  await formPage.submit();

  await expect(page).toHaveURL('/expenses');
});

// TC-03-14 — editing non-existent expense
test('[TC-03-14] should show error banner when navigating to a non-existent expense', async ({ page }) => {
  await page.goto('/expenses/999999/edit');

  const formPage = new ExpenseFormPage(page);
  await expect(formPage.errorBanner).toBeVisible();
  await expect(formPage.errorBanner).toContainText('Expense not found');
});

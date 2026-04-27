import { test, expect } from '@playwright/test';
import { createAndLoginUser, createExpenseViaApi } from '../../fixtures/api';

// TC-03-17
test('[TC-03-17] should show error when User B navigates to an expense owned by User A', async ({
  page,
  request,
}) => {
  const userA = await createAndLoginUser(request, 'usera');
  const expense = await createExpenseViaApi(request, userA.token, {
    category: 'Maintenance',
    amount: 100,
  });

  const userB = await createAndLoginUser(request, 'userb');

  await page.addInitScript((t) => localStorage.setItem('token', t), userB.token);
  await page.goto(`/expenses/${expense.id}`);

  await expect(page.locator('.alert-error')).toBeVisible();
  await expect(page.locator('.alert-error')).toContainText('Expense not found');
});

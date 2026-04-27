import { test, expect } from '@playwright/test';
import { ExpenseFormPage } from '../../pages/ExpenseFormPage';
import { createAndLoginUser } from '../../fixtures/api';

let token: string;

test.beforeAll(async ({ request }) => {
  ({ token } = await createAndLoginUser(request, 'createexp'));
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('token', t), token);
});

// TC-03-01 — create non-Fuel expense
test('[TC-03-01] should create a Maintenance expense and return to the list', async ({ page }) => {
  const formPage = new ExpenseFormPage(page);
  await formPage.navigateNew();

  await formPage.selectCategory('Maintenance');
  await formPage.fillAmount('150.00');
  await formPage.submit();

  await expect(page).toHaveURL('/expenses');
  await expect(page.locator('tbody [data-cat="Maintenance"]').first()).toBeVisible();
});

// TC-03-06 — Fuel expense with auto-computed amount
test('[TC-03-06] should display computed amount for Fuel and create expense with correct total', async ({ page }) => {
  const formPage = new ExpenseFormPage(page);
  await formPage.navigateNew();

  await formPage.selectCategory('Fuel');
  await formPage.fillLitres('40');
  await formPage.fillPricePerLitre('5.5');

  await expect(formPage.computedAmountDisplay).toContainText('220.00');

  await formPage.submit();

  await expect(page).toHaveURL('/expenses');
  await expect(page.locator('tbody [data-cat="Fuel"]').first()).toBeVisible();
  await expect(page.locator('tbody').getByText('220.00').first()).toBeVisible();
});


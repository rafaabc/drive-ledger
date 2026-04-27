import { test, expect } from '@playwright/test';
import { ExpenseFormPage } from '../../pages/ExpenseFormPage';
import { createAndLoginUser } from '../../fixtures/api';
import { CATEGORIES, tomorrowISO } from '../../fixtures/test-data';

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

// TC-03-03 — all 7 categories accepted (parameterised)
for (const category of CATEGORIES) {
  test(`[TC-03-03] should accept category "${category}"`, async ({ page }) => {
    const formPage = new ExpenseFormPage(page);
    await formPage.navigateNew();

    await formPage.selectCategory(category);

    if (category === 'Fuel') {
      await formPage.fillLitres('10');
      await formPage.fillPricePerLitre('2');
    } else {
      await formPage.fillAmount('50');
    }

    await formPage.submit();

    await expect(page).toHaveURL('/expenses');
    // Check that at least one row with this category exists (shared user accumulates rows)
    await expect(page.locator(`tbody [data-cat="${category}"]`).first()).toBeVisible();
  });
}

// Category switch: Fuel → Maintenance clears fuel fields and shows Amount
test('should show Amount field and hide Fuel fields after switching category', async ({ page }) => {
  const formPage = new ExpenseFormPage(page);
  await formPage.navigateNew();

  await formPage.selectCategory('Fuel');
  await expect(formPage.litresInput).toBeVisible();
  await expect(formPage.pricePerLitreInput).toBeVisible();
  await expect(formPage.amountInput).not.toBeVisible();

  await formPage.selectCategory('Maintenance');
  await expect(formPage.amountInput).toBeVisible();
  await expect(formPage.litresInput).not.toBeVisible();
  await expect(formPage.pricePerLitreInput).not.toBeVisible();
});

// Submit button disabled when no category selected
test('should disable submit button when no category is selected', async ({ page }) => {
  const formPage = new ExpenseFormPage(page);
  await formPage.navigateNew();

  await expect(formPage.submitButton).toBeDisabled();
});

// TC-03-09 — future date rejected by backend
test('[TC-03-09] should show error banner when expense date is in the future', async ({ page }) => {
  const formPage = new ExpenseFormPage(page);
  await formPage.navigateNew();

  await formPage.selectCategory('Parking');
  await formPage.fillAmount('10');

  // Remove the max attribute to bypass the HTML5 date constraint so the backend rejects the request
  await page.locator('input[name="date"]').evaluate((el: HTMLInputElement) => {
    el.removeAttribute('max');
  });
  await formPage.fillDate(tomorrowISO());
  await formPage.submit();

  await expect(formPage.errorBanner).toContainText('date cannot be in the future');
});

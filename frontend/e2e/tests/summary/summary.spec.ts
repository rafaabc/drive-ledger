import { test, expect } from '@playwright/test';
import { SummaryPage } from '../../pages/SummaryPage';
import { createAndLoginUser, createExpenseViaApi } from '../../fixtures/api';
import { currentYear } from '../../fixtures/test-data';

const YEAR = String(currentYear());

// TC-04-01 — summary by year shows per-category columns
test('[TC-04-01] should display category columns for expenses in the given year', async ({
  page,
  request,
}) => {
  const { token } = await createAndLoginUser(request, 'sum01');
  await createExpenseViaApi(request, token, { category: 'Fuel', litres: 40, price_per_litre: 5.5 });
  await createExpenseViaApi(request, token, { category: 'Maintenance', amount: 150 });

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();
  await summaryPage.setYear(YEAR);

  await expect(summaryPage.table).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fuel' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Maintenance' })).toBeVisible();
});

// TC-04-02 — monthly breakdown shows expense in the correct month row
test('[TC-04-02] should show the expense amount in the correct month row', async ({
  page,
  request,
}) => {
  const { token } = await createAndLoginUser(request, 'sum02');
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  await createExpenseViaApi(request, token, { category: 'Insurance', amount: 500 });

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();
  await summaryPage.setYear(YEAR);

  await expect(summaryPage.table).toBeVisible();
  await expect(summaryPage.getMonthRow(monthName)).toContainText('500.00');
});

// TC-04-03 — footer shows grand total
test('[TC-04-03] should show the grand total in the footer row', async ({ page, request }) => {
  const { token } = await createAndLoginUser(request, 'sum03');
  await createExpenseViaApi(request, token, { category: 'Fuel', litres: 40, price_per_litre: 5.5 });
  await createExpenseViaApi(request, token, { category: 'Maintenance', amount: 150 });

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();
  await summaryPage.setYear(YEAR);

  await expect(summaryPage.table).toBeVisible();
  // 40 × 5.5 = 220.00 + 150.00 = 370.00
  await expect(summaryPage.footerRow).toContainText('370.00');
});

// TC-04-05 — single category filter
test('[TC-04-05] should show only the filtered category column', async ({ page, request }) => {
  const { token } = await createAndLoginUser(request, 'sum05');
  await createExpenseViaApi(request, token, { category: 'Fuel', litres: 40, price_per_litre: 5.5 });
  await createExpenseViaApi(request, token, { category: 'Maintenance', amount: 150 });

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();
  await summaryPage.setYear(YEAR);
  await expect(summaryPage.table).toBeVisible();

  await summaryPage.filterByCategory('Fuel');

  await expect(page.getByRole('columnheader', { name: 'Fuel' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Maintenance' })).not.toBeVisible();
});

// TC-04-08/10 — future year: client-side guard keeps expenses empty, shows empty state
test('[TC-04-08/10] should show empty state message when year is in the future', async ({
  page,
  request,
}) => {
  // Fresh user with no expenses — avoids stale data being shown when fetchData returns early
  const { token } = await createAndLoginUser(request, 'sum10');

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();

  const futureYear = String(currentYear() + 1);
  await summaryPage.setYear(futureYear);

  // SummaryPage.fetchData returns early when year > currentYear (no API call).
  // Since there are no previous expenses loaded, hasData stays false → empty state shows.
  await expect(summaryPage.table).not.toBeVisible();
  await expect(summaryPage.emptyStateFor(futureYear)).toBeVisible();
});

// No expenses → empty state message
test('should show empty state message when there are no expenses for the year', async ({
  page,
  request,
}) => {
  const { token } = await createAndLoginUser(request, 'sum_empty');

  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const summaryPage = new SummaryPage(page);
  await summaryPage.navigate();
  await summaryPage.setYear(YEAR);

  await expect(summaryPage.emptyStateFor(YEAR)).toBeVisible();
  await expect(summaryPage.table).not.toBeVisible();
});

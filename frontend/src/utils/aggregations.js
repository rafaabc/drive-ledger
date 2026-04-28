/**
 * Pure helper functions that compute dashboard KPIs and chart data
 * from a flat array of expense objects.
 *
 * Expense shape:
 *   { id, category, amount, date, description, litres?, price_per_litre? }
 */

/**
 * Groups expenses by calendar month (YYYY-MM).
 * Returns an array of { month: string, total: number } sorted chronologically.
 * total is rounded to 2 decimals.
 */
export function aggregateByMonth(expenses) {
  const map = new Map();

  for (const expense of expenses) {
    const month = expense.date.slice(0, 7); // "YYYY-MM"
    map.set(month, (map.get(month) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
}

/**
 * Groups expenses by category.
 * Returns an array of { category: string, total: number } sorted by total descending.
 * total is rounded to 2 decimals.
 */
export function aggregateByCategory(expenses) {
  const map = new Map();

  for (const expense of expenses) {
    map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }));
}

/**
 * Returns the sum of amount for all expenses in the current calendar month
 * (year + month match now). now defaults to new Date() but is injectable for testing.
 * Returns 0 if no expenses match. Result rounded to 2 decimals.
 */
export function computeMtd(expenses, now = new Date()) {
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const total = expenses.reduce(
    (sum, expense) => (expense.date.startsWith(nowYM) ? sum + expense.amount : sum),
    0,
  );

  return Math.round(total * 100) / 100;
}

/**
 * Returns the sum of amount for all expenses in the current calendar year
 * (year matches now). now defaults to new Date() but is injectable for testing.
 * Returns 0 if no expenses match. Result rounded to 2 decimals.
 */
export function computeYtd(expenses, now = new Date()) {
  const nowYear = String(now.getFullYear());

  const total = expenses.reduce(
    (sum, expense) => (expense.date.startsWith(nowYear) ? sum + expense.amount : sum),
    0,
  );

  return Math.round(total * 100) / 100;
}

/**
 * Returns the percentage of total spend that is Fuel category.
 * Formula: (fuelTotal / grandTotal) * 100, rounded to 1 decimal.
 * Returns 0 if grandTotal === 0.
 */
export function computeFuelShare(expenses) {
  let grandTotal = 0;
  let fuelTotal = 0;

  for (const expense of expenses) {
    grandTotal += expense.amount;
    if (expense.category === 'Fuel') {
      fuelTotal += expense.amount;
    }
  }

  if (grandTotal === 0) return 0;
  return Math.round((fuelTotal / grandTotal) * 1000) / 10;
}

/**
 * Returns the average monthly spend across all entries in monthlyData.
 * monthlyData is an array of { month, total } objects (output of aggregateByMonth).
 * Returns 0 if the array is empty. Result rounded to 2 decimals.
 */
export function computeAvgMonthly(monthlyData) {
  if (!monthlyData.length) return 0;
  const total = monthlyData.reduce((sum, d) => sum + d.total, 0);
  return Math.round((total / monthlyData.length) * 100) / 100;
}

/**
 * Returns the total spend for the previous calendar month.
 * Uses local calendar time to match computeMtd/computeYtd behaviour.
 * now defaults to new Date() but is injectable for testing.
 * Returns 0 if no expenses match. Result rounded to 2 decimals.
 */
export function computePrevMonthTotal(expenses, now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const total = expenses.reduce(
    (sum, e) => (e.date.startsWith(prevYM) ? sum + e.amount : sum),
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Converts "YYYY-MM" to a short human-readable label, e.g. "2025-03" → "Mar 2025".
 * Uses Intl.DateTimeFormat with UTC to avoid local-timezone month shifts.
 */
export function monthLabel(isoMonth) {
  // Append "-01" to make a valid date string for the first day of that month
  const date = new Date(`${isoMonth}-01T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

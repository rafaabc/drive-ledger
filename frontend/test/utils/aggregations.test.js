import {
  aggregateByMonth,
  aggregateByCategory,
  computeMtd,
  computeYtd,
  computeFuelShare,
  computeAvgMonthly,
  computePrevMonthTotal,
  monthLabel,
} from '../../src/utils/aggregations.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Expenses spanning two months and three categories */
const MIXED_EXPENSES = [
  { id: '1', category: 'Fuel',        amount: 50.00, date: '2025-03-10' },
  { id: '2', category: 'Fuel',        amount: 30.50, date: '2025-03-25' },
  { id: '3', category: 'Maintenance', amount: 120.00, date: '2025-03-18' },
  { id: '4', category: 'Parking',     amount: 15.00, date: '2025-04-05' },
  { id: '5', category: 'Fuel',        amount: 45.75, date: '2025-04-20' },
];

// ---------------------------------------------------------------------------
// aggregateByMonth
// ---------------------------------------------------------------------------

describe('aggregateByMonth', () => {
  test('should return empty array when expenses is empty', () => {
    expect(aggregateByMonth([])).toEqual([]);
  });

  test('should return single entry for a single expense', () => {
    const expenses = [{ id: '1', category: 'Fuel', amount: 42.50, date: '2025-06-15' }];
    expect(aggregateByMonth(expenses)).toEqual([{ month: '2025-06', total: 42.50 }]);
  });

  test('should group multiple expenses in the same month and sum their amounts', () => {
    const expenses = [
      { id: '1', category: 'Fuel',        amount: 50.00, date: '2025-03-10' },
      { id: '2', category: 'Maintenance', amount: 120.00, date: '2025-03-18' },
    ];
    expect(aggregateByMonth(expenses)).toEqual([{ month: '2025-03', total: 170.00 }]);
  });

  test('should return entries sorted chronologically', () => {
    const result = aggregateByMonth(MIXED_EXPENSES);
    expect(result.map(r => r.month)).toEqual(['2025-03', '2025-04']);
  });

  test('should correctly total each month', () => {
    const result = aggregateByMonth(MIXED_EXPENSES);
    // March: 50.00 + 30.50 + 120.00 = 200.50
    // April: 15.00 + 45.75 = 60.75
    expect(result).toEqual([
      { month: '2025-03', total: 200.50 },
      { month: '2025-04', total: 60.75 },
    ]);
  });

  test('should round totals to 2 decimal places', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 10.005, date: '2025-01-01' },
      { id: '2', category: 'Fuel', amount: 10.005, date: '2025-01-15' },
    ];
    const result = aggregateByMonth(expenses);
    // 10.005 + 10.005 = 20.01 after rounding
    expect(result[0].total).toBe(20.01);
  });
});

// ---------------------------------------------------------------------------
// aggregateByCategory
// ---------------------------------------------------------------------------

describe('aggregateByCategory', () => {
  test('should return empty array when expenses is empty', () => {
    expect(aggregateByCategory([])).toEqual([]);
  });

  test('should return single entry for a single expense', () => {
    const expenses = [{ id: '1', category: 'Tax', amount: 200.00, date: '2025-01-01' }];
    expect(aggregateByCategory(expenses)).toEqual([{ category: 'Tax', total: 200.00 }]);
  });

  test('should sum amounts within the same category', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 50.00, date: '2025-03-10' },
      { id: '2', category: 'Fuel', amount: 30.50, date: '2025-03-25' },
    ];
    expect(aggregateByCategory(expenses)).toEqual([{ category: 'Fuel', total: 80.50 }]);
  });

  test('should sort by total descending', () => {
    const result = aggregateByCategory(MIXED_EXPENSES);
    // Fuel: 50+30.50+45.75 = 126.25, Maintenance: 120, Parking: 15
    expect(result.map(r => r.category)).toEqual(['Fuel', 'Maintenance', 'Parking']);
  });

  test('should correctly compute totals for each category', () => {
    const result = aggregateByCategory(MIXED_EXPENSES);
    expect(result).toEqual([
      { category: 'Fuel',        total: 126.25 },
      { category: 'Maintenance', total: 120.00 },
      { category: 'Parking',     total: 15.00 },
    ]);
  });

  test('should round totals to 2 decimal places', () => {
    const expenses = [
      { id: '1', category: 'Toll', amount: 1.005, date: '2025-01-01' },
      { id: '2', category: 'Toll', amount: 1.005, date: '2025-02-01' },
    ];
    const result = aggregateByCategory(expenses);
    expect(result[0].total).toBe(2.01);
  });
});

// ---------------------------------------------------------------------------
// computeMtd
// ---------------------------------------------------------------------------

describe('computeMtd', () => {
  const now = new Date('2025-04-15T12:00:00Z'); // April 2025

  test('should return 0 for empty expenses array', () => {
    expect(computeMtd([], now)).toBe(0);
  });

  test('should return 0 when no expenses fall in the current month', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 50.00, date: '2025-03-10' },
    ];
    expect(computeMtd(expenses, now)).toBe(0);
  });

  test('should sum only expenses in the current month', () => {
    // MIXED_EXPENSES has April entries: Parking 15.00 + Fuel 45.75 = 60.75
    expect(computeMtd(MIXED_EXPENSES, now)).toBe(60.75);
  });

  test('should include expenses at the start and end of the current month', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 10.00, date: '2025-04-01' },
      { id: '2', category: 'Fuel', amount: 20.00, date: '2025-04-30' },
    ];
    expect(computeMtd(expenses, now)).toBe(30.00);
  });

  test('should return 0 when expenses are in a different year same month', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 50.00, date: '2024-04-10' },
    ];
    expect(computeMtd(expenses, now)).toBe(0);
  });

  test('should round result to 2 decimal places', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 10.005, date: '2025-04-10' },
      { id: '2', category: 'Fuel', amount: 10.005, date: '2025-04-20' },
    ];
    expect(computeMtd(expenses, now)).toBe(20.01);
  });
});

// ---------------------------------------------------------------------------
// computeYtd
// ---------------------------------------------------------------------------

describe('computeYtd', () => {
  const now = new Date('2025-06-01T00:00:00Z'); // year 2025

  test('should return 0 for empty expenses array', () => {
    expect(computeYtd([], now)).toBe(0);
  });

  test('should return 0 when no expenses fall in the current year', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 50.00, date: '2024-12-31' },
    ];
    expect(computeYtd(expenses, now)).toBe(0);
  });

  test('should sum all expenses in the current year across multiple months', () => {
    // MIXED_EXPENSES: all are in 2025 → total = 50+30.50+120+15+45.75 = 261.25
    expect(computeYtd(MIXED_EXPENSES, now)).toBe(261.25);
  });

  test('should exclude expenses from other years', () => {
    const expenses = [
      { id: '1', category: 'Fuel',   amount: 100.00, date: '2025-01-10' },
      { id: '2', category: 'Fuel',   amount: 200.00, date: '2024-12-31' },
      { id: '3', category: 'Parking', amount: 50.00, date: '2026-01-01' },
    ];
    expect(computeYtd(expenses, now)).toBe(100.00);
  });

  test('should round result to 2 decimal places', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 0.005, date: '2025-01-01' },
      { id: '2', category: 'Fuel', amount: 0.005, date: '2025-06-15' },
    ];
    expect(computeYtd(expenses, now)).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// computeFuelShare
// ---------------------------------------------------------------------------

describe('computeFuelShare', () => {
  test('should return 0 when expenses is empty (grandTotal is 0)', () => {
    expect(computeFuelShare([])).toBe(0);
  });

  test('should return 0 when no Fuel expenses exist', () => {
    const expenses = [
      { id: '1', category: 'Maintenance', amount: 100.00, date: '2025-01-01' },
      { id: '2', category: 'Parking',     amount: 50.00,  date: '2025-01-05' },
    ];
    expect(computeFuelShare(expenses)).toBe(0);
  });

  test('should return 100 when all expenses are Fuel', () => {
    const expenses = [
      { id: '1', category: 'Fuel', amount: 60.00, date: '2025-01-01' },
      { id: '2', category: 'Fuel', amount: 40.00, date: '2025-01-10' },
    ];
    expect(computeFuelShare(expenses)).toBe(100.0);
  });

  test('should correctly compute fuel share percentage for mixed expenses', () => {
    // Fuel: 126.25, grand total: 261.25
    // 126.25 / 261.25 * 100 ≈ 48.3%
    const result = computeFuelShare(MIXED_EXPENSES);
    expect(result).toBe(48.3);
  });

  test('should return result rounded to 1 decimal place', () => {
    const expenses = [
      { id: '1', category: 'Fuel',        amount: 1.00, date: '2025-01-01' },
      { id: '2', category: 'Maintenance', amount: 2.00, date: '2025-01-02' },
    ];
    // 1/3 * 100 = 33.333... → 33.3
    expect(computeFuelShare(expenses)).toBe(33.3);
  });
});

// ---------------------------------------------------------------------------
// computeAvgMonthly
// ---------------------------------------------------------------------------

describe('computeAvgMonthly', () => {
  test('should return 0 when monthlyData is empty', () => {
    expect(computeAvgMonthly([])).toBe(0);
  });

  test('should return the total when there is a single month entry', () => {
    const monthlyData = [{ month: '2025-03', total: 150.00 }];
    expect(computeAvgMonthly(monthlyData)).toBe(150.00);
  });

  test('should return the average across multiple months', () => {
    const monthlyData = [
      { month: '2025-01', total: 100.00 },
      { month: '2025-02', total: 200.00 },
      { month: '2025-03', total: 300.00 },
    ];
    // (100 + 200 + 300) / 3 = 200
    expect(computeAvgMonthly(monthlyData)).toBe(200.00);
  });

  test('should round result to 2 decimal places', () => {
    const monthlyData = [
      { month: '2025-01', total: 100.00 },
      { month: '2025-02', total: 200.00 },
    ];
    // (100 + 200) / 2 = 150 — clean result; use uneven division for rounding check
    const monthlyDataUneven = [
      { month: '2025-01', total: 10.00 },
      { month: '2025-02', total: 20.00 },
      { month: '2025-03', total: 30.01 },
    ];
    // (60.01) / 3 = 20.003333... → 20.00
    expect(computeAvgMonthly(monthlyDataUneven)).toBe(20.00);
  });
});

// ---------------------------------------------------------------------------
// computePrevMonthTotal
// ---------------------------------------------------------------------------

describe('computePrevMonthTotal', () => {
  test('should return 0 when expenses is empty', () => {
    const now = new Date('2025-04-15T12:00:00');
    expect(computePrevMonthTotal([], now)).toBe(0);
  });

  test('should sum only expenses from the previous calendar month', () => {
    const now = new Date('2025-04-15T12:00:00');
    const expenses = [
      { id: '1', category: 'Fuel', amount: 50.00, date: '2025-03-10' },
      { id: '2', category: 'Fuel', amount: 30.00, date: '2025-03-25' },
      { id: '3', category: 'Fuel', amount: 45.00, date: '2025-04-05' }, // current month — excluded
    ];
    expect(computePrevMonthTotal(expenses, now)).toBe(80.00);
  });

  test('should return 0 when all expenses are in the current month only', () => {
    const now = new Date('2025-04-15T12:00:00');
    const expenses = [
      { id: '1', category: 'Fuel', amount: 60.00, date: '2025-04-10' },
    ];
    expect(computePrevMonthTotal(expenses, now)).toBe(0);
  });

  test('should handle January→December rollback correctly', () => {
    // now = January 2026, so prev month = December 2025
    const now = new Date('2026-01-10T12:00:00');
    const expenses = [
      { id: '1', category: 'Fuel', amount: 75.00, date: '2025-12-20' },
      { id: '2', category: 'Fuel', amount: 25.00, date: '2026-01-05' }, // current month — excluded
    ];
    expect(computePrevMonthTotal(expenses, now)).toBe(75.00);
  });

  test('should round result to 2 decimal places', () => {
    const now = new Date('2025-04-15T12:00:00');
    const expenses = [
      { id: '1', category: 'Fuel', amount: 10.005, date: '2025-03-10' },
      { id: '2', category: 'Fuel', amount: 10.005, date: '2025-03-20' },
    ];
    expect(computePrevMonthTotal(expenses, now)).toBe(20.01);
  });
});

// ---------------------------------------------------------------------------
// monthLabel
// ---------------------------------------------------------------------------

describe('monthLabel', () => {
  test('should format March correctly', () => {
    expect(monthLabel('2025-03')).toBe('Mar 2025');
  });

  test('should format January correctly (month index 0)', () => {
    expect(monthLabel('2025-01')).toBe('Jan 2025');
  });

  test('should format December correctly (month index 11)', () => {
    expect(monthLabel('2024-12')).toBe('Dec 2024');
  });

  test('should format June correctly', () => {
    expect(monthLabel('2026-06')).toBe('Jun 2026');
  });

  test('should not shift months due to timezone issues', () => {
    // Months at UTC midnight should not become the previous month in any timezone
    expect(monthLabel('2025-01')).toMatch(/Jan/);
    expect(monthLabel('2025-12')).toMatch(/Dec/);
  });
});

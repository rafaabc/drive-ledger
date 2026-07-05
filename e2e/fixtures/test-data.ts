// Must clear passwordPolicy's strength + HIBP breach checks (register/change/reset
// password all run through it now) — a simple word+digits pattern like the old
// 'Password123' scores too low and is a known-breached password.
export const DEFAULT_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Qk4Wr9Ln2Vp8Mz5x'; // NOSONAR

export function uniqueUsername(prefix = 'user'): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999)}`;
}

export const CATEGORIES = [
  'Fuel',
  'Maintenance',
  'Insurance',
  'Parking',
  'Toll',
  'Tax',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export const sampleExpenses = {
  fuel: {
    category: 'Fuel' as const,
    litres: 40,
    pricePerLitre: 5.5,
    expectedAmount: '220.00',
  },
  maintenance: {
    category: 'Maintenance' as const,
    amount: 150.0,
  },
  insurance: {
    category: 'Insurance' as const,
    amount: 500.0,
  },
  parking: {
    category: 'Parking' as const,
    amount: 20.0,
  },
};

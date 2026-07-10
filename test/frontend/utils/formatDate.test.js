import { describe, it, expect, vi } from 'vitest';

const { mockI18n } = vi.hoisted(() => {
  const mockI18n = { language: 'en', t: (k) => k, changeLanguage: vi.fn() };
  return { mockI18n };
});

vi.mock('@/i18n/index.js', () => ({ default: mockI18n }));

import { formatDate, todayISO, currentYear } from '@/utils/formatDate.js';

describe('formatDate', () => {
  it('should return empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('should format date in en-US format (MM/DD/YYYY) when language is en', () => {
    mockI18n.language = 'en';
    expect(formatDate('2024-06-15')).toBe('06/15/2024');
  });

  it('should format date in pt-BR format (DD/MM/YYYY) when language is pt-BR', () => {
    mockI18n.language = 'pt-BR';
    expect(formatDate('2024-06-15')).toBe('15/06/2024');
  });

  it('should use UTC to avoid timezone shifts', () => {
    mockI18n.language = 'en';
    expect(formatDate('2024-01-01')).toBe('01/01/2024');
  });
});

describe('todayISO', () => {
  it('should return a string in YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should use local date parts, not UTC (avoids off-by-one near UTC midnight)', () => {
    // 2026-07-10 23:30 local time is already 2026-07-11 in UTC for any zone east of
    // local, and still 2026-07-10 in UTC for zones west of local (e.g. Brazil, UTC-3
    // relative to a UTC-based clock). todayISO must report the *local* calendar date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 23, 30, 0)); // local: Jul 10, 2026, 23:30
    expect(todayISO()).toBe('2026-07-10');
    vi.useRealTimers();
  });
});

describe('currentYear', () => {
  it('should return the current year as a number', () => {
    expect(currentYear()).toBe(new Date().getFullYear());
  });
});

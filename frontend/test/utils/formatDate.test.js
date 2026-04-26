import { todayISO, formatDate, currentYear } from '../../src/utils/formatDate.js';

describe('formatDate utils', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('todayISO', () => {
    test('should return current UTC date as YYYY-MM-DD', () => {
      expect(todayISO()).toBe('2026-04-26');
    });
  });

  describe('currentYear', () => {
    test('should return current year as a number', () => {
      expect(currentYear()).toBe(2026);
    });
  });

  describe('formatDate', () => {
    test('should return a non-empty string for a valid date', () => {
      const result = formatDate('2026-01-15');
      expect(result).toBeTruthy();
      expect(result).toMatch(/2026/);
    });

    test('should return empty string for empty input', () => {
      expect(formatDate('')).toBe('');
    });

    test('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });

    test('should return empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });
  });
});

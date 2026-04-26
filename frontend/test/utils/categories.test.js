import { CATEGORIES } from '../../src/utils/categories.js';

describe('CATEGORIES', () => {
  test('should contain all 7 valid expense categories in correct order', () => {
    // Arrange + Act (static export)
    // Assert
    expect(CATEGORIES).toEqual(['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other']);
  });

  test('should have exactly 7 categories', () => {
    expect(CATEGORIES).toHaveLength(7);
  });
});

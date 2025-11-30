import { formatDate, calculatePrice } from './testUtils';

describe('Utility Functions', () => {
  it('should format date correctly', () => {
    const date = new Date('2025-11-29T10:00:00Z');
    expect(formatDate(date)).toBe('2025-11-29');
  });

  it('should calculate price correctly', () => {
    expect(calculatePrice(100, 20)).toBe(80);
  });
});

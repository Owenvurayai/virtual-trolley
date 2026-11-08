import { describe, expect, it } from 'vitest';
import { duration, kg, money } from './format';

describe('format', () => {
  it('formats money like the backend receipts', () => {
    expect(money(0)).toBe('R0.00');
    expect(money(1799)).toBe('R17.99');
    expect(money(134260)).toBe('R1,342.60');
  });

  it('formats weight in kilograms with one decimal', () => {
    expect(kg(12500)).toBe('12.5 kg');
    expect(kg(800)).toBe('0.8 kg');
  });

  it('formats durations as seconds, then minutes:seconds', () => {
    expect(duration(2400)).toBe('2.4 s');
    expect(duration(59_900)).toBe('59.9 s');
    expect(duration(75_000)).toBe('1:15');
    expect(duration(125_000)).toBe('2:05');
  });
});

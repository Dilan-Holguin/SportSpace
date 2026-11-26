import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { isValidIsoDate, shiftIsoDate, todayInBogota, formatTimeBogota, formatDateTimeBogota, formatIntervalBogota, isoDayOfWeek, mondayOfWeek, formatDayLabel, formatWeekRange } from './dates';
afterEach(() => { jest.useRealTimers(); });
describe('Bogota calendar', () => {
  it.each([['2024-02-29', true], ['2025-02-29', false], ['2026-13-01', false], ['2026-04-31', false], ['2026-1-1', false], ['invalid', false]])('validates %s', (date, valid) => { expect(isValidIsoDate(date)).toBe(valid); });
  it('uses the Colombian day across UTC midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T02:00:00Z'));
    expect(todayInBogota()).toBe('2026-11-25');
    expect(formatTimeBogota('2026-11-26T02:00:00Z')).toBe('21:00');
    expect(formatDateTimeBogota('2026-11-26T02:00:00Z')).toContain('25/11/2026');
    expect(formatIntervalBogota('2026-11-26T02:00:00Z', '2026-11-26T03:00:00Z')).toContain('22:00');
  });
  it('shifts dates across year and leap boundaries', () => {
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(isoDayOfWeek('2026-11-29')).toBe(7);
    expect(isoDayOfWeek('2026-11-23')).toBe(1);
    expect(mondayOfWeek('2026-11-29')).toBe('2026-11-23');
    expect(formatDayLabel('2026-11-23')).toContain('lunes');
    expect(formatWeekRange('2026-11-23', '2026-11-29')).toContain('domingo');
  });
});

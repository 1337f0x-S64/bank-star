/**
 * @file calendar.test.js
 * @description Dedicated unit tests for local calendar boundaries and temporal utilities.
 * @standards SRS Alignment: NFR-05, Section 1.4, Section 6.2
 */

import {
  parseLocalDate,
  getWeeklyBoundary,
  addDays,
} from '../../src/utils/calendar';

describe('Calendar Boundary Calculations (Dedicated Suite)', () => {
  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD into local date without UTC day-shift', () => {
      const d = parseLocalDate('2026-11-26');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(10); // Nov
      expect(d.getDate()).toBe(26);
    });

    it('clones Date instance', () => {
      const orig = new Date(2026, 5, 10);
      const cloned = parseLocalDate(orig);
      expect(cloned.getTime()).toBe(orig.getTime());
      expect(cloned).not.toBe(orig);
    });

    it('throws on invalid date string or unsupported type', () => {
      expect(() => parseLocalDate('invalid-date')).toThrow();
      expect(() => parseLocalDate(true)).toThrow();
    });
  });

  describe('addDays', () => {
    it('adds and subtracts days correctly', () => {
      const base = new Date(2026, 10, 26);
      const future = addDays(base, 5);
      expect(future.getDate()).toBe(1); // Dec 1
      expect(future.getMonth()).toBe(11);

      const past = addDays(base, -6);
      expect(past.getDate()).toBe(20);
    });

    it('throws if days is not an integer', () => {
      expect(() => addDays(new Date(), 2.5)).toThrow();
    });
  });

  describe('Monday-Sunday weekly boundary (100% pass guarantee)', () => {
    it('always anchors start to Monday and end to Sunday for any day of the week', () => {
      // Nov 23 (Mon) through Nov 29 (Sun) 2026
      for (let day = 23; day <= 29; day++) {
        const ref = new Date(2026, 10, day, 12, 0, 0);
        const { start, end, startDate, endDate } = getWeeklyBoundary(ref);

        expect(start.getDay()).toBe(1); // Monday
        expect(end.getDay()).toBe(0);   // Sunday
        expect(startDate).toBe('2026-11-23');
        expect(endDate).toBe('2026-11-29');
      }
    });
  });
});

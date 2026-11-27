/**
 * @file MoneyMath.test.js
 * @description Unit tests for MoneyMath (precision, integer arithmetic, zero float drift)
 *              and Calendar boundary calculations (Monday-Sunday boundaries, daily, monthly, yearly).
 * @standards SRS Alignment: NFR-05, Section 1.4, Section 6.2
 */

/* eslint-disable import/no-named-as-default-member */

import MoneyMath, {
  toMinorUnits,
  toMajorUnits,
  assertIntegerMinor,
  add,
  addMinor,
  subtract,
  subtractMinor,
  sum,
  sumMinor,
  compare,
} from '../../src/domain/calculations/MoneyMath';

import CalendarUtils, {
  getDailyBoundary,
  getWeeklyBoundary,
  getMonthlyBoundary,
  getYearlyBoundary,
  getPeriodBoundary,
  formatLocalDate,
  formatLocalIso,
  isSameWeek,
  isSameDay,
  isSameMonth,
  isSameYear,
  isDateInRange,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from '../../src/utils/calendar';

describe('MoneyMath Domain Calculation Engine', () => {
  describe('assertIntegerMinor(minor)', () => {
    it('accepts valid non-negative integer minor units', () => {
      expect(() => assertIntegerMinor(0)).not.toThrow();
      expect(() => assertIntegerMinor(1)).not.toThrow();
      expect(() => assertIntegerMinor(100)).not.toThrow();
      expect(() => assertIntegerMinor(1055)).not.toThrow();
      expect(() => assertIntegerMinor(999999999)).not.toThrow();
    });

    it('throws Error for negative numbers', () => {
      expect(() => assertIntegerMinor(-1)).toThrow(/Amount must be a non-negative integer minor unit/);
      expect(() => assertIntegerMinor(-100)).toThrow();
      expect(() => assertIntegerMinor(-0.01)).toThrow();
    });

    it('throws Error for floating-point / fractional numbers', () => {
      expect(() => assertIntegerMinor(10.5)).toThrow(/Amount must be a non-negative integer minor unit/);
      expect(() => assertIntegerMinor(0.1)).toThrow();
      expect(() => assertIntegerMinor(100.0001)).toThrow();
    });

    it('throws Error for non-finite numbers', () => {
      expect(() => assertIntegerMinor(NaN)).toThrow();
      expect(() => assertIntegerMinor(Infinity)).toThrow();
      expect(() => assertIntegerMinor(-Infinity)).toThrow();
    });

    it('throws Error for non-numeric types', () => {
      expect(() => assertIntegerMinor('100')).toThrow();
      expect(() => assertIntegerMinor(null)).toThrow();
      expect(() => assertIntegerMinor(undefined)).toThrow();
      expect(() => assertIntegerMinor({})).toThrow();
      expect(() => assertIntegerMinor([])).toThrow();
      expect(() => assertIntegerMinor(true)).toThrow();
    });
  });

  describe('toMinorUnits(dollars)', () => {
    it('converts standard integer dollars to cents', () => {
      expect(toMinorUnits(0)).toBe(0);
      expect(toMinorUnits(1)).toBe(100);
      expect(toMinorUnits(10)).toBe(1000);
      expect(toMinorUnits(100)).toBe(10000);
    });

    it('converts standard fractional dollars with 2 decimals to cents', () => {
      expect(toMinorUnits(0.01)).toBe(1);
      expect(toMinorUnits(0.05)).toBe(5);
      expect(toMinorUnits(0.5)).toBe(50);
      expect(toMinorUnits(0.99)).toBe(99);
      expect(toMinorUnits(10.55)).toBe(1055);
      expect(toMinorUnits(1234.56)).toBe(123456);
    });

    it('handles numeric strings properly', () => {
      expect(toMinorUnits('0')).toBe(0);
      expect(toMinorUnits('1.00')).toBe(100);
      expect(toMinorUnits('10.55')).toBe(1055);
      expect(toMinorUnits('  25.75  ')).toBe(2575);
    });

    it('guarantees zero floating-point drift on notorious float calculations', () => {
      // In standard JS: 0.1 + 0.2 === 0.30000000000000004
      const floatSum = 0.1 + 0.2;
      expect(floatSum).not.toBe(0.3); // Proves raw float drift exists
      expect(toMinorUnits(floatSum)).toBe(30); // Eliminated drift: exactly 30 cents

      // 19.99 * 100 in raw float can be 1998.9999999999998
      expect(toMinorUnits(19.99)).toBe(1999);

      // Rounding sub-cent amounts properly
      expect(toMinorUnits(10.554)).toBe(1055); // Rounds down
      expect(toMinorUnits(10.556)).toBe(1056); // Rounds up
      expect(toMinorUnits(0.005)).toBe(1);     // Rounds half up
    });

    it('throws Error on negative input', () => {
      expect(() => toMinorUnits(-1)).toThrow(/cannot be negative/);
      expect(() => toMinorUnits(-0.01)).toThrow(/cannot be negative/);
      expect(() => toMinorUnits('-50')).toThrow(/cannot be negative/);
    });

    it('throws Error on non-numeric or non-finite inputs', () => {
      expect(() => toMinorUnits(NaN)).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits(Infinity)).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits(-Infinity)).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits('abc')).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits('')).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits(null)).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits(undefined)).toThrow(/Expected a finite number/);
      expect(() => toMinorUnits({})).toThrow(/Expected a finite number/);
    });
  });

  describe('toMajorUnits(minor)', () => {
    it('formats integer minor units to 2-decimal string', () => {
      expect(toMajorUnits(0)).toBe('0.00');
      expect(toMajorUnits(1)).toBe('0.01');
      expect(toMajorUnits(5)).toBe('0.05');
      expect(toMajorUnits(50)).toBe('0.50');
      expect(toMajorUnits(99)).toBe('0.99');
      expect(toMajorUnits(100)).toBe('1.00');
      expect(toMajorUnits(1055)).toBe('10.55');
      expect(toMajorUnits(123456)).toBe('1234.56');
      expect(toMajorUnits(999999999)).toBe('9999999.99');
    });

    it('throws Error if minor is not an integer or negative', () => {
      expect(() => toMajorUnits(-100)).toThrow();
      expect(() => toMajorUnits(10.5)).toThrow();
      expect(() => toMajorUnits('100')).toThrow();
      expect(() => toMajorUnits(null)).toThrow();
      expect(() => toMajorUnits(undefined)).toThrow();
    });
  });

  describe('Safe Integer Arithmetic: add / subtract / sum / compare', () => {
    it('adds two minor unit amounts safely', () => {
      expect(add(100, 200)).toBe(300);
      expect(add(0, 0)).toBe(0);
      expect(add(1055, 45)).toBe(1100);
      expect(addMinor(500, 250)).toBe(750);
    });

    it('throws Error on add when arguments are invalid minor units', () => {
      expect(() => add(-5, 10)).toThrow();
      expect(() => add(10, -5)).toThrow();
      expect(() => add(10.5, 20)).toThrow();
      expect(() => add('100', 200)).toThrow();
    });

    it('subtracts two minor unit amounts safely', () => {
      expect(subtract(500, 200)).toBe(300);
      expect(subtract(100, 100)).toBe(0);
      expect(subtract(1055, 55)).toBe(1000);
      expect(subtractMinor(1000, 250)).toBe(750);
    });

    it('throws Error on subtract if result would be negative', () => {
      expect(() => subtract(100, 200)).toThrow(/Subtraction result cannot be negative minor units/);
      expect(() => subtract(0, 1)).toThrow(/Subtraction result cannot be negative minor units/);
    });

    it('throws Error on subtract when arguments are invalid minor units', () => {
      expect(() => subtract(-10, 5)).toThrow();
      expect(() => subtract(10, -5)).toThrow();
      expect(() => subtract(15.5, 5)).toThrow();
    });

    it('sums arrays or argument lists of minor units', () => {
      expect(sum([])).toBe(0);
      expect(sum([100, 200, 300])).toBe(600);
      expect(sum(100, 200, 300, 400)).toBe(1000);
      expect(sumMinor([50, 50, 100])).toBe(200);
    });

    it('compares two minor amounts', () => {
      expect(compare(100, 200)).toBe(-1);
      expect(compare(200, 100)).toBe(1);
      expect(compare(100, 100)).toBe(0);
    });

    it('default export MoneyMath provides all methods', () => {
      expect(MoneyMath.toMinorUnits(10.55)).toBe(1055);
      expect(MoneyMath.toMajorUnits(1055)).toBe('10.55');
      expect(MoneyMath.add(100, 50)).toBe(150);
      expect(MoneyMath.subtract(100, 50)).toBe(50);
    });
  });
});

describe('Calendar Boundary Calculations & Monday-Sunday Week Verification', () => {
  describe('Daily Boundary', () => {
    it('sets start of day to local 00:00:00.000 and end of day to 23:59:59.999', () => {
      const ref = new Date(2026, 10, 26, 15, 30, 45); // Nov 26, 2026 15:30:45
      const { start, end, startDate, endDate, startTime, endTime } = getDailyBoundary(ref);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(10);
      expect(start.getDate()).toBe(26);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(10);
      expect(end.getDate()).toBe(26);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);

      expect(startDate).toBe('2026-11-26');
      expect(endDate).toBe('2026-11-26');
      expect(startTime).toBe('00:00:00');
      expect(endTime).toBe('23:59:59');
    });

    it('startOfDay and endOfDay helpers match daily boundary', () => {
      const ref = new Date(2026, 4, 15, 10, 20);
      const s = startOfDay(ref);
      const e = endOfDay(ref);

      expect(s.getHours()).toBe(0);
      expect(s.getMinutes()).toBe(0);
      expect(s.getSeconds()).toBe(0);
      expect(e.getHours()).toBe(23);
      expect(e.getMinutes()).toBe(59);
      expect(e.getSeconds()).toBe(59);
    });
  });

  describe('Weekly Boundary: Strict Monday through Sunday Verification (100% Pass Rate Target)', () => {
    // Week: Monday Nov 23, 2026 through Sunday Nov 29, 2026
    // Monday = Nov 23, Tuesday = Nov 24, Wednesday = Nov 25, Thursday = Nov 26,
    // Friday = Nov 27, Saturday = Nov 28, Sunday = Nov 29

    const daysOfWeek = [
      { name: 'Monday', dayIndex: 1, date: new Date(2026, 10, 23, 8, 0, 0) },
      { name: 'Tuesday', dayIndex: 2, date: new Date(2026, 10, 24, 12, 30, 0) },
      { name: 'Wednesday', dayIndex: 3, date: new Date(2026, 10, 25, 16, 45, 0) },
      { name: 'Thursday', dayIndex: 4, date: new Date(2026, 10, 26, 10, 15, 0) },
      { name: 'Friday', dayIndex: 5, date: new Date(2026, 10, 27, 21, 0, 0) },
      { name: 'Saturday', dayIndex: 6, date: new Date(2026, 10, 28, 14, 20, 0) },
      { name: 'Sunday', dayIndex: 0, date: new Date(2026, 10, 29, 23, 10, 0) },
    ];

    daysOfWeek.forEach(({ name, dayIndex, date }) => {
      it(`calculates identical Monday-Sunday bounds when reference date is ${name} (day ${dayIndex})`, () => {
        const bounds = getWeeklyBoundary(date);

        // Start must always be Monday Nov 23, 2026 at 00:00:00.000
        expect(bounds.start.getDay()).toBe(1); // 1 = Monday
        expect(bounds.start.getFullYear()).toBe(2026);
        expect(bounds.start.getMonth()).toBe(10);
        expect(bounds.start.getDate()).toBe(23);
        expect(bounds.start.getHours()).toBe(0);
        expect(bounds.start.getMinutes()).toBe(0);
        expect(bounds.start.getSeconds()).toBe(0);
        expect(bounds.start.getMilliseconds()).toBe(0);

        // End must always be Sunday Nov 29, 2026 at 23:59:59.999
        expect(bounds.end.getDay()).toBe(0); // 0 = Sunday
        expect(bounds.end.getFullYear()).toBe(2026);
        expect(bounds.end.getMonth()).toBe(10);
        expect(bounds.end.getDate()).toBe(29);
        expect(bounds.end.getHours()).toBe(23);
        expect(bounds.end.getMinutes()).toBe(59);
        expect(bounds.end.getSeconds()).toBe(59);
        expect(bounds.end.getMilliseconds()).toBe(999);

        // String formatting
        expect(bounds.startDate).toBe('2026-11-23');
        expect(bounds.endDate).toBe('2026-11-29');
      });
    });

    it('correctly handles week straddling a month boundary (Nov 30, 2026 to Dec 6, 2026)', () => {
      // Nov 30, 2026 is Monday
      // Dec 6, 2026 is Sunday
      const mondayRef = new Date(2026, 10, 30, 9, 0, 0); // Mon Nov 30
      const wednesdayRef = new Date(2026, 11, 2, 14, 0, 0); // Wed Dec 2
      const sundayRef = new Date(2026, 11, 6, 20, 0, 0); // Sun Dec 6

      const boundsMon = getWeeklyBoundary(mondayRef);
      const boundsWed = getWeeklyBoundary(wednesdayRef);
      const boundsSun = getWeeklyBoundary(sundayRef);

      expect(boundsMon.startDate).toBe('2026-11-30');
      expect(boundsMon.endDate).toBe('2026-12-06');
      expect(boundsMon.start.getDay()).toBe(1); // Monday
      expect(boundsMon.end.getDay()).toBe(0); // Sunday

      // All three must produce identical week boundaries
      expect(boundsWed.startDate).toBe('2026-11-30');
      expect(boundsWed.endDate).toBe('2026-12-06');

      expect(boundsSun.startDate).toBe('2026-11-30');
      expect(boundsSun.endDate).toBe('2026-12-06');
    });

    it('correctly handles week straddling a year boundary (Dec 28, 2020 to Jan 3, 2021)', () => {
      // Dec 28, 2020 was Monday
      // Jan 1, 2021 was Friday
      // Jan 3, 2021 was Sunday
      const fridayNewYear = new Date(2021, 0, 1, 10, 0, 0);
      const bounds = getWeeklyBoundary(fridayNewYear);

      expect(bounds.startDate).toBe('2020-12-28');
      expect(bounds.endDate).toBe('2021-01-03');
      expect(bounds.start.getFullYear()).toBe(2020);
      expect(bounds.start.getMonth()).toBe(11);
      expect(bounds.start.getDate()).toBe(28);
      expect(bounds.start.getDay()).toBe(1); // Monday

      expect(bounds.end.getFullYear()).toBe(2021);
      expect(bounds.end.getMonth()).toBe(0);
      expect(bounds.end.getDate()).toBe(3);
      expect(bounds.end.getDay()).toBe(0); // Sunday
    });

    it('correctly handles leap year week boundary (Feb 26, 2024 to Mar 3, 2024)', () => {
      // 2024 was a leap year (Feb had 29 days).
      // Feb 26, 2024 was Monday.
      // Feb 29, 2024 was Thursday.
      // Mar 3, 2024 was Sunday.
      const leapDayRef = new Date(2024, 1, 29, 12, 0, 0);
      const bounds = getWeeklyBoundary(leapDayRef);

      expect(bounds.startDate).toBe('2024-02-26');
      expect(bounds.endDate).toBe('2024-03-03');
      expect(bounds.start.getDay()).toBe(1); // Monday
      expect(bounds.end.getDay()).toBe(0); // Sunday
    });

    it('supports iterable destructuring for getWeeklyBoundary', () => {
      const [start, end] = getWeeklyBoundary(new Date(2026, 10, 26));
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start.getDay()).toBe(1);
      expect(end.getDay()).toBe(0);
    });

    it('startOfWeek and endOfWeek helpers return proper dates', () => {
      const ref = new Date(2026, 10, 26);
      const s = startOfWeek(ref);
      const e = endOfWeek(ref);

      expect(s.getDay()).toBe(1); // Monday
      expect(s.getHours()).toBe(0);
      expect(e.getDay()).toBe(0); // Sunday
      expect(e.getHours()).toBe(23);
      expect(e.getMinutes()).toBe(59);
      expect(e.getSeconds()).toBe(59);
    });
  });

  describe('Monthly Boundary: First day to last day of local calendar month', () => {
    it('calculates 31-day month boundaries (January)', () => {
      const ref = new Date(2026, 0, 15); // Jan 15, 2026
      const { start, end, startDate, endDate } = getMonthlyBoundary(ref);

      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);

      expect(end.getDate()).toBe(31);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);

      expect(startDate).toBe('2026-01-01');
      expect(endDate).toBe('2026-01-31');
    });

    it('calculates 30-day month boundaries (April)', () => {
      const ref = new Date(2026, 3, 10); // Apr 10, 2026
      const { start, end, startDate, endDate } = getMonthlyBoundary(ref);

      expect(startDate).toBe('2026-04-01');
      expect(endDate).toBe('2026-04-30');
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(30);
    });

    it('calculates 28-day February in non-leap year (2025)', () => {
      const ref = new Date(2025, 1, 14); // Feb 14, 2025
      const { startDate, endDate, end } = getMonthlyBoundary(ref);

      expect(startDate).toBe('2025-02-01');
      expect(endDate).toBe('2025-02-28');
      expect(end.getDate()).toBe(28);
    });

    it('calculates 29-day February in leap year (2024)', () => {
      const ref = new Date(2024, 1, 10); // Feb 10, 2024
      const { startDate, endDate, end } = getMonthlyBoundary(ref);

      expect(startDate).toBe('2024-02-01');
      expect(endDate).toBe('2024-02-29');
      expect(end.getDate()).toBe(29);
    });

    it('startOfMonth and endOfMonth helpers return correct dates', () => {
      const ref = new Date(2026, 10, 15);
      const s = startOfMonth(ref);
      const e = endOfMonth(ref);

      expect(s.getDate()).toBe(1);
      expect(e.getDate()).toBe(30);
    });
  });

  describe('Yearly Boundary: Jan 1 to Dec 31 of local calendar year', () => {
    it('calculates yearly bounds from Jan 1 through Dec 31', () => {
      const ref = new Date(2026, 6, 20); // July 20, 2026
      const { start, end, startDate, endDate } = getYearlyBoundary(ref);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(11); // December
      expect(end.getDate()).toBe(31);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);

      expect(startDate).toBe('2026-01-01');
      expect(endDate).toBe('2026-12-31');
    });

    it('startOfYear and endOfYear helpers match yearly boundary', () => {
      const ref = new Date(2026, 5, 1);
      const s = startOfYear(ref);
      const e = endOfYear(ref);

      expect(s.getMonth()).toBe(0);
      expect(s.getDate()).toBe(1);
      expect(e.getMonth()).toBe(11);
      expect(e.getDate()).toBe(31);
    });
  });

  describe('getPeriodBoundary(periodType, date)', () => {
    const ref = new Date(2026, 10, 26);

    it('dispatches to daily boundary', () => {
      const bounds = getPeriodBoundary('daily', ref);
      expect(bounds.startDate).toBe('2026-11-26');
      expect(bounds.endDate).toBe('2026-11-26');
    });

    it('dispatches to weekly boundary', () => {
      const bounds = getPeriodBoundary('weekly', ref);
      expect(bounds.startDate).toBe('2026-11-23');
      expect(bounds.endDate).toBe('2026-11-29');
    });

    it('dispatches to monthly boundary', () => {
      const bounds = getPeriodBoundary('monthly', ref);
      expect(bounds.startDate).toBe('2026-11-01');
      expect(bounds.endDate).toBe('2026-11-30');
    });

    it('dispatches to yearly boundary', () => {
      const bounds = getPeriodBoundary('yearly', ref);
      expect(bounds.startDate).toBe('2026-01-01');
      expect(bounds.endDate).toBe('2026-12-31');
    });

    it('is case-insensitive and trims whitespace', () => {
      const bounds = getPeriodBoundary('  WEEKLY  ', ref);
      expect(bounds.startDate).toBe('2026-11-23');
      expect(bounds.endDate).toBe('2026-11-29');
    });

    it('throws on unsupported period type', () => {
      expect(() => getPeriodBoundary('quarterly', ref)).toThrow(/Unsupported period type/);
      expect(() => getPeriodBoundary(123, ref)).toThrow(/periodType must be a string/);
    });
  });

  describe('Calendar Formatting and Comparison Helpers', () => {
    it('formatLocalDate formats to YYYY-MM-DD', () => {
      expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(formatLocalDate(new Date(2026, 11, 25))).toBe('2026-12-25');
    });

    it('formatLocalIso formats to YYYY-MM-DDTHH:mm:ss', () => {
      const d = new Date(2026, 10, 26, 9, 5, 8);
      expect(formatLocalIso(d)).toBe('2026-11-26T09:05:08');
    });

    it('isSameDay accurately tests local day matching', () => {
      const d1 = new Date(2026, 10, 26, 8, 0, 0);
      const d2 = new Date(2026, 10, 26, 23, 0, 0);
      const d3 = new Date(2026, 10, 27, 0, 0, 0);

      expect(isSameDay(d1, d2)).toBe(true);
      expect(isSameDay(d1, d3)).toBe(false);
    });

    it('isSameWeek accurately tests Monday-Sunday week matching', () => {
      const mon = new Date(2026, 10, 23, 1, 0, 0);
      const sun = new Date(2026, 10, 29, 23, 0, 0);
      const nextMon = new Date(2026, 10, 30, 0, 0, 0);

      expect(isSameWeek(mon, sun)).toBe(true);
      expect(isSameWeek(sun, nextMon)).toBe(false);
    });

    it('isSameMonth accurately tests month matching', () => {
      expect(isSameMonth(new Date(2026, 10, 1), new Date(2026, 10, 30))).toBe(true);
      expect(isSameMonth(new Date(2026, 10, 30), new Date(2026, 11, 1))).toBe(false);
    });

    it('isSameYear accurately tests year matching', () => {
      expect(isSameYear(new Date(2026, 0, 1), new Date(2026, 11, 31))).toBe(true);
      expect(isSameYear(new Date(2025, 11, 31), new Date(2026, 0, 1))).toBe(false);
    });

    it('isDateInRange checks interval inclusively', () => {
      const start = '2026-11-01';
      const end = '2026-11-30';

      expect(isDateInRange('2026-11-15', start, end)).toBe(true);
      expect(isDateInRange('2026-11-01', start, end)).toBe(true);
      expect(isDateInRange('2026-11-30', start, end)).toBe(true);
      expect(isDateInRange('2026-10-31', start, end)).toBe(false);
      expect(isDateInRange('2026-12-01', start, end)).toBe(false);
    });

    it('CalendarUtils default export has all functions', () => {
      expect(typeof CalendarUtils.getDailyBoundary).toBe('function');
      expect(typeof CalendarUtils.getWeeklyBoundary).toBe('function');
      expect(typeof CalendarUtils.getMonthlyBoundary).toBe('function');
      expect(typeof CalendarUtils.getYearlyBoundary).toBe('function');
      expect(typeof CalendarUtils.getPeriodBoundary).toBe('function');
    });
  });
});

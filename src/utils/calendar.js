/**
 * @file calendar.js
 * @description Local calendar boundary computations and temporal utilities.
 * @standards SRS Alignment: NFR-05, Section 1.4, Section 6.2
 * @constitutional-mandates
 *   1. Zero Floating-Point Drift: Integer time calculations where applicable.
 *   2. Calendar Boundaries:
 *      - Daily: Local start of day (00:00:00) through end of day (23:59:59).
 *      - Weekly: Strict Monday 00:00:00 through Sunday 23:59:59.
 *      - Monthly: First day of month (00:00:00) through last day of month (23:59:59).
 *      - Yearly: Jan 1 (00:00:00) through Dec 31 (23:59:59).
 */

'use strict';

/**
 * Parses an input value (Date instance, timestamp number, or string) into a valid local Date.
 * Properly guards against UTC midnight shifts when given 'YYYY-MM-DD' strings.
 *
 * @param {Date|number|string} [inputDate] - The input date representation. Defaults to current date/time.
 * @throws {Error} If input cannot be parsed into a valid Date.
 * @returns {Date} A valid Date instance.
 */
export function parseLocalDate(inputDate = new Date()) {
  if (inputDate === null || inputDate === undefined) {
    return new Date();
  }

  if (inputDate instanceof Date) {
    if (isNaN(inputDate.getTime())) {
      throw new Error(`Invalid Date instance provided: ${inputDate}`);
    }
    return new Date(inputDate.getTime());
  }

  if (typeof inputDate === 'string') {
    const trimmed = inputDate.trim();
    if (!trimmed) {
      throw new Error('Empty date string provided.');
    }

    // Match YYYY-MM-DD specifically to construct local Date and prevent UTC date-shifting
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10) - 1; // 0-indexed
      const day = parseInt(dateOnlyMatch[3], 10);
      const d = new Date(year, month, day, 0, 0, 0, 0);
      if (
        isNaN(d.getTime()) ||
        d.getFullYear() !== year ||
        d.getMonth() !== month ||
        d.getDate() !== day
      ) {
        throw new Error(`Invalid calendar date string: ${inputDate}`);
      }
      return d;
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date string provided: ${inputDate}`);
    }
    return parsed;
  }

  if (typeof inputDate === 'number') {
    if (!Number.isFinite(inputDate)) {
      throw new Error(`Invalid timestamp provided: ${inputDate}`);
    }
    const parsed = new Date(inputDate);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid timestamp provided: ${inputDate}`);
    }
    return parsed;
  }

  throw new Error(`Unsupported date input type: ${typeof inputDate}`);
}

/**
 * Formats a Date to 'YYYY-MM-DD' in local calendar time.
 *
 * @param {Date|number|string} [date] - Input date.
 * @returns {string} Formatted local date string 'YYYY-MM-DD'.
 */
export function formatLocalDate(date = new Date()) {
  const d = parseLocalDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date to 'YYYY-MM-DDTHH:mm:ss' in local calendar time.
 *
 * @param {Date|number|string} [date] - Input date.
 * @returns {string} Formatted local ISO-like string.
 */
export function formatLocalIso(date = new Date()) {
  const d = parseLocalDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Helper to construct a standardized boundary result object.
 *
 * @private
 * @param {Date} start - Start boundary date (00:00:00.000).
 * @param {Date} end - End boundary date (23:59:59.999).
 * @returns {Object} Frozen boundary object supporting both object and tuple destructuring.
 */
function createBoundaryResult(start, end) {
  const boundary = {
    start,
    end,
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    startTime: '00:00:00',
    endTime: '23:59:59',
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startTimestamp: start.getTime(),
    endTimestamp: end.getTime(),
  };

  // Enable tuple destructuring: const [start, end] = getWeeklyBoundary(date);
  Object.defineProperty(boundary, Symbol.iterator, {
    enumerable: false,
    value: function* () {
      yield this.start;
      yield this.end;
    },
  });

  return Object.freeze(boundary);
}

/**
 * Computes the daily boundary for a given local date:
 * Local start of day (00:00:00) through end of day (23:59:59).
 *
 * @param {Date|number|string} [inputDate] - Reference date. Defaults to current date.
 * @returns {Object} Daily boundary result { start, end, startDate, endDate, ... }.
 */
export function getDailyBoundary(inputDate = new Date()) {
  const d = parseLocalDate(inputDate);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return createBoundaryResult(start, end);
}

export const getDayBoundary = getDailyBoundary;
export const getDailyBounds = getDailyBoundary;
export const getDayBounds = getDailyBoundary;

/**
 * Computes the weekly boundary for a given local date:
 * Strict Monday 00:00:00 through Sunday 23:59:59.
 *
 * In standard JavaScript Date:
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * For a Monday-Sunday week:
 * - Monday through Saturday: diffToMonday is (1 - day)
 * - Sunday: diffToMonday is -6
 *
 * @param {Date|number|string} [inputDate] - Reference date. Defaults to current date.
 * @returns {Object} Weekly boundary result { start, end, startDate, endDate, ... }.
 */
export function getWeeklyBoundary(inputDate = new Date()) {
  const d = parseLocalDate(inputDate);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + diffToMonday,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    23,
    59,
    59,
    999
  );

  return createBoundaryResult(start, end);
}

export const getWeekBoundary = getWeeklyBoundary;
export const getWeeklyBounds = getWeeklyBoundary;
export const getWeekBounds = getWeeklyBoundary;

/**
 * Computes the monthly boundary for a given local date:
 * First day of month (00:00:00) through last day of month (23:59:59).
 * Accurately handles leap years and variable month lengths (28, 29, 30, 31).
 *
 * @param {Date|number|string} [inputDate] - Reference date. Defaults to current date.
 * @returns {Object} Monthly boundary result { start, end, startDate, endDate, ... }.
 */
export function getMonthlyBoundary(inputDate = new Date()) {
  const d = parseLocalDate(inputDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  // In JavaScript Date, day 0 of month + 1 corresponds to the last day of month
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return createBoundaryResult(start, end);
}

export const getMonthBoundary = getMonthlyBoundary;
export const getMonthlyBounds = getMonthlyBoundary;
export const getMonthBounds = getMonthlyBoundary;

/**
 * Computes the yearly boundary for a given local date:
 * Jan 1 (00:00:00) through Dec 31 (23:59:59) of the local calendar year.
 *
 * @param {Date|number|string} [inputDate] - Reference date. Defaults to current date.
 * @returns {Object} Yearly boundary result { start, end, startDate, endDate, ... }.
 */
export function getYearlyBoundary(inputDate = new Date()) {
  const d = parseLocalDate(inputDate);
  const year = d.getFullYear();

  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  return createBoundaryResult(start, end);
}

export const getYearBoundary = getYearlyBoundary;
export const getYearlyBounds = getYearlyBoundary;
export const getYearBounds = getYearlyBoundary;

/**
 * Computes calendar boundary for any specified period type:
 * 'daily' | 'weekly' | 'monthly' | 'yearly'.
 *
 * @param {string} periodType - One of 'daily', 'weekly', 'monthly', 'yearly' (case-insensitive).
 * @param {Date|number|string} [inputDate] - Reference date. Defaults to current date.
 * @throws {Error} If periodType is unknown or invalid.
 * @returns {Object} Boundary result { start, end, startDate, endDate, ... }.
 */
export function getPeriodBoundary(periodType, inputDate = new Date()) {
  if (typeof periodType !== 'string') {
    throw new Error(
      `periodType must be a string, received: ${typeof periodType}`
    );
  }

  const normalized = periodType.trim().toLowerCase();

  switch (normalized) {
    case 'daily':
    case 'day':
      return getDailyBoundary(inputDate);
    case 'weekly':
    case 'week':
      return getWeeklyBoundary(inputDate);
    case 'monthly':
    case 'month':
      return getMonthlyBoundary(inputDate);
    case 'yearly':
    case 'year':
      return getYearlyBoundary(inputDate);
    default:
      throw new Error(
        `Unsupported period type '${periodType}'. Expected one of: 'daily', 'weekly', 'monthly', 'yearly'.`
      );
  }
}

export const getPeriodBounds = getPeriodBoundary;

/**
 * Returns the local start of day (00:00:00.000) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function startOfDay(date = new Date()) {
  return getDailyBoundary(date).start;
}

/**
 * Returns the local end of day (23:59:59.999) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function endOfDay(date = new Date()) {
  return getDailyBoundary(date).end;
}

/**
 * Returns the local start of week (Monday 00:00:00.000) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function startOfWeek(date = new Date()) {
  return getWeeklyBoundary(date).start;
}

/**
 * Returns the local end of week (Sunday 23:59:59.999) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function endOfWeek(date = new Date()) {
  return getWeeklyBoundary(date).end;
}

/**
 * Returns the local start of month (Day 1 00:00:00.000) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function startOfMonth(date = new Date()) {
  return getMonthlyBoundary(date).start;
}

/**
 * Returns the local end of month (Last Day 23:59:59.999) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function endOfMonth(date = new Date()) {
  return getMonthlyBoundary(date).end;
}

/**
 * Returns the local start of year (Jan 1 00:00:00.000) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function startOfYear(date = new Date()) {
  return getYearlyBoundary(date).start;
}

/**
 * Returns the local end of year (Dec 31 23:59:59.999) for a given date.
 *
 * @param {Date|number|string} [date]
 * @returns {Date}
 */
export function endOfYear(date = new Date()) {
  return getYearlyBoundary(date).end;
}

/**
 * Checks whether two dates fall on the exact same local calendar day.
 *
 * @param {Date|number|string} date1
 * @param {Date|number|string} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Checks whether two dates fall within the same Monday-Sunday week.
 *
 * @param {Date|number|string} date1
 * @param {Date|number|string} date2
 * @returns {boolean}
 */
export function isSameWeek(date1, date2) {
  const b1 = getWeeklyBoundary(date1);
  const d2 = parseLocalDate(date2);
  return d2.getTime() >= b1.start.getTime() && d2.getTime() <= b1.end.getTime();
}

/**
 * Checks whether two dates fall within the same local calendar month and year.
 *
 * @param {Date|number|string} date1
 * @param {Date|number|string} date2
 * @returns {boolean}
 */
export function isSameMonth(date1, date2) {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

/**
 * Checks whether two dates fall within the same local calendar year.
 *
 * @param {Date|number|string} date1
 * @param {Date|number|string} date2
 * @returns {boolean}
 */
export function isSameYear(date1, date2) {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return d1.getFullYear() === d2.getFullYear();
}

/**
 * Checks whether a target date falls inclusively between start and end boundaries.
 *
 * @param {Date|number|string} targetDate - Date to check.
 * @param {Date|number|string} startDate - Lower bound.
 * @param {Date|number|string} endDate - Upper bound.
 * @returns {boolean} True if targetDate is between startDate and endDate.
 */
export function isDateInRange(targetDate, startDate, endDate) {
  const target = parseLocalDate(targetDate).getTime();
  const start = parseLocalDate(startDate).getTime();
  const end = parseLocalDate(endDate).getTime();
  return target >= start && target <= end;
}

/**
 * Adds an integer number of days to a date, returning a new Date.
 *
 * @param {Date|number|string} date - Base date.
 * @param {number} days - Number of days to add (can be negative).
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = parseLocalDate(date);
  if (!Number.isInteger(days)) {
    throw new Error(`days must be an integer, received: ${days}`);
  }
  const result = new Date(d.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Default export bundling all calendar utilities.
 */
const CalendarUtils = Object.freeze({
  parseLocalDate,
  formatLocalDate,
  formatLocalIso,
  getDailyBoundary,
  getDayBoundary,
  getDailyBounds,
  getDayBounds,
  getWeeklyBoundary,
  getWeekBoundary,
  getWeeklyBounds,
  getWeekBounds,
  getMonthlyBoundary,
  getMonthBoundary,
  getMonthlyBounds,
  getMonthBounds,
  getYearlyBoundary,
  getYearBoundary,
  getYearlyBounds,
  getYearBounds,
  getPeriodBoundary,
  getPeriodBounds,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isDateInRange,
  addDays,
});

export default CalendarUtils;

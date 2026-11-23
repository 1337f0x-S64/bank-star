/**
 * @file schemas.js
 * @description Domain models, frozen schemas, runtime validators, and factory functions.
 * @standards SRS Alignment: Section 6.1 (Core Data Entities), 6.2 (Data Rules & Validation), 7.1 (Reactive MVVM)
 * @constitutional-mandates
 *   1. Integer Minor-Unit Math: All amounts must be positive integers representing minor units (cents/centavos).
 *   2. Zero Floating-Point Drift: Floating-point amounts are strictly prohibited.
 *   3. Frozen Data Contracts: All domain objects returned from factories are deeply or shallowly frozen.
 */

'use strict';

// ============================================================================
// 1. CONSTANTS AND ENUMERATIONS
// ============================================================================

/**
 * Supported currency codes for the application.
 * Strictly USD (United States Dollar) and NIO (Nicaraguan Córdoba).
 *
 * @readonly
 * @enum {string}
 */
export const CURRENCIES = Object.freeze({
  USD: 'USD',
  NIO: 'NIO',
});

/**
 * Standard View State machine states required for all reactive MVVM screens.
 *
 * @readonly
 * @enum {string}
 */
export const VIEW_STATES = Object.freeze({
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  OFFLINE: 'offline',
});

/**
 * Calendar period aggregation types for summary and report queries.
 *
 * @readonly
 * @enum {string}
 */
export const PERIOD_TYPES = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
});

/**
 * Monetary boundaries for runtime input validation.
 * Amounts must be positive integers <= 999,999,999 minor units (SRS Section 6.2).
 */
export const MIN_AMOUNT_MINOR = 1;
export const MAX_AMOUNT_MINOR = 999999999;

/**
 * Default preset categories seeded on first database initialization (SRS Section 6.1).
 * Deletion of preset categories is disabled by business rule.
 *
 * @readonly
 * @type {ReadonlyArray<{ id: number, name: string, is_default: boolean }>}
 */
export const DEFAULT_CATEGORIES = Object.freeze([
  Object.freeze({ id: 1, name: 'Food', is_default: true }),
  Object.freeze({ id: 2, name: 'Transportation', is_default: true }),
  Object.freeze({ id: 3, name: 'Shopping', is_default: true }),
  Object.freeze({ id: 4, name: 'Bills', is_default: true }),
  Object.freeze({ id: 5, name: 'Health', is_default: true }),
  Object.freeze({ id: 6, name: 'Entertainment', is_default: true }),
  Object.freeze({ id: 7, name: 'Other', is_default: true }),
]);

// ============================================================================
// 2. JSDOC TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {'USD' | 'NIO'} CurrencyCode
 */

/**
 * @typedef {'loading' | 'success' | 'error' | 'offline'} ViewState
 */

/**
 * @typedef {'daily' | 'weekly' | 'monthly' | 'yearly'} PeriodType
 */

/**
 * @typedef {Object} Expense
 * @property {string|number|null} id - Unique expense identifier (UUID string or SQLite rowid).
 * @property {number} amount_minor - Exact integer minor units (cents / centavos > 0).
 * @property {CurrencyCode} currency_code - ISO-4217 currency code ('USD' or 'NIO').
 * @property {string} expense_date - ISO 8601 calendar date or timestamp (e.g. 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss.sssZ').
 * @property {string} description - Optional notes/description for the expense.
 * @property {string|number|null} category_id - Foreign key referencing Category.id.
 * @property {string} created_at - ISO 8601 record creation timestamp.
 * @property {string} updated_at - ISO 8601 record last update timestamp.
 */

/**
 * @typedef {Object} ExpenseInput
 * @property {string|number} [id] - Optional ID for preexisting expense.
 * @property {number} amount_minor - Mandatory positive integer minor units.
 * @property {CurrencyCode} currency_code - Mandatory 'USD' or 'NIO'.
 * @property {string} expense_date - Mandatory valid ISO 8601 date string.
 * @property {string} [description] - Optional description.
 * @property {string|number|null} [category_id] - Optional category foreign key.
 * @property {string} [created_at] - Optional creation timestamp.
 * @property {string} [updated_at] - Optional last updated timestamp.
 */

/**
 * @typedef {Object} Category
 * @property {string|number|null} id - Category identifier.
 * @property {string} name - Category display name.
 * @property {boolean} is_default - Whether this is a system preset category.
 */

/**
 * @typedef {Object} ExchangeRate
 * @property {string|number|null} id - Exchange rate record ID.
 * @property {CurrencyCode} from_currency - Source currency ('USD' or 'NIO').
 * @property {CurrencyCode} to_currency - Target currency ('USD' or 'NIO').
 * @property {number} rate - Conversion multiplier (> 0).
 * @property {string} source - Origin of rate (e.g. 'manual', 'bcn', 'official').
 * @property {string} effective_at - ISO 8601 timestamp when rate became effective.
 * @property {string} saved_at - ISO 8601 timestamp when rate was recorded locally.
 */

/**
 * @typedef {Object} AppSetting
 * @property {string} key - Setting identifier key.
 * @property {string} value - Serialized setting value.
 */

// ============================================================================
// 3. UTILITY VALIDATORS
// ============================================================================

/**
 * Regular expression matching ISO 8601 dates and timestamps.
 * Accepts:
 *   - YYYY-MM-DD
 *   - YYYY-MM-DDTHH:mm:ssZ
 *   - YYYY-MM-DDTHH:mm:ss.sssZ
 *   - YYYY-MM-DDTHH:mm:ss+HH:MM / -HH:MM
 */
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Validates calendar day bounds (leap years, 28/29/30/31 days).
 *
 * @param {number} year
 * @param {number} month - 1-indexed (1-12)
 * @param {number} day - 1-indexed (1-31)
 * @returns {boolean}
 */
function isValidCalendarDay(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  if ([4, 6, 9, 11].includes(month) && day > 30) {
    return false;
  }
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (day > (isLeap ? 29 : 28)) {
      return false;
    }
  }
  return true;
}

/**
 * Validates whether a value is a valid ISO 8601 date string with valid calendar dates.
 *
 * @param {unknown} dateStr
 * @returns {boolean}
 */
export function isValidIsoDate(dateStr) {
  if (typeof dateStr !== 'string') {
    return false;
  }
  const trimmed = dateStr.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    return false;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const parts = trimmed.split(/[-T :.]/);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return isValidCalendarDay(year, month, day);
}

// ============================================================================
// 4. EXPENSE VALIDATOR & FACTORY
// ============================================================================

/**
 * Validates an expense object against the domain contract.
 * Enforces integer minor-unit arithmetic, supported currencies, and ISO date formatting.
 *
 * @throws {Error} If any validation rule is violated.
 * @param {unknown} expense - Object to validate.
 * @returns {true} Returns true if valid, throws otherwise.
 */
export function validateExpense(expense) {
  if (!expense || typeof expense !== 'object' || Array.isArray(expense)) {
    throw new Error('Expense must be a non-null object.');
  }

  // 1. amount_minor validation (Strict integer minor units)
  if (expense.amount_minor === undefined || expense.amount_minor === null) {
    throw new Error('amount_minor is required.');
  }
  if (!Number.isInteger(expense.amount_minor)) {
    throw new Error(
      `amount_minor must be an integer (minor units), received: ${typeof expense.amount_minor === 'number' ? expense.amount_minor : typeof expense.amount_minor}.`
    );
  }
  if (expense.amount_minor <= 0) {
    throw new Error(
      `amount_minor must be greater than 0, received: ${expense.amount_minor}.`
    );
  }
  if (expense.amount_minor > MAX_AMOUNT_MINOR) {
    throw new Error(
      `amount_minor must not exceed ${MAX_AMOUNT_MINOR}, received: ${expense.amount_minor}.`
    );
  }

  // 2. currency_code validation (Strict USD or NIO)
  if (!expense.currency_code) {
    throw new Error('currency_code is required.');
  }
  if (!Object.values(CURRENCIES).includes(expense.currency_code)) {
    throw new Error(
      `currency_code must be one of [${Object.values(CURRENCIES).join(', ')}], received: ${expense.currency_code}.`
    );
  }

  // 3. expense_date validation (Valid ISO 8601 string)
  if (!expense.expense_date) {
    throw new Error('expense_date is required.');
  }
  if (!isValidIsoDate(expense.expense_date)) {
    throw new Error(
      `expense_date must be a valid ISO 8601 date string, received: ${expense.expense_date}.`
    );
  }

  // 4. Optional / metadata field checks
  if (expense.id !== undefined && expense.id !== null) {
    if (typeof expense.id !== 'string' && typeof expense.id !== 'number') {
      throw new Error('id must be a string or number.');
    }
    if (typeof expense.id === 'string' && expense.id.trim() === '') {
      throw new Error('id cannot be an empty string.');
    }
  }

  if (expense.category_id !== undefined && expense.category_id !== null) {
    if (typeof expense.category_id !== 'string' && typeof expense.category_id !== 'number') {
      throw new Error('category_id must be a string or number.');
    }
  }

  if (expense.description !== undefined && expense.description !== null) {
    if (typeof expense.description !== 'string') {
      throw new Error('description must be a string.');
    }
  }

  if (expense.created_at !== undefined && expense.created_at !== null) {
    if (!isValidIsoDate(expense.created_at)) {
      throw new Error(
        `created_at must be a valid ISO 8601 date string, received: ${expense.created_at}.`
      );
    }
  }

  if (expense.updated_at !== undefined && expense.updated_at !== null) {
    if (!isValidIsoDate(expense.updated_at)) {
      throw new Error(
        `updated_at must be a valid ISO 8601 date string, received: ${expense.updated_at}.`
      );
    }
  }

  return true;
}

/**
 * Non-throwing safe validation helper for UI forms and conditional guards.
 *
 * @param {unknown} expense
 * @returns {boolean} True if valid, false otherwise.
 */
export function isValidExpense(expense) {
  try {
    return validateExpense(expense);
  } catch {
    return false;
  }
}

/**
 * Factory function creating an immutable, validated Expense domain model.
 *
 * @param {ExpenseInput} input - Expense creation parameters.
 * @returns {Readonly<Expense>} Frozen expense model contract.
 */
export function createExpense({
  id = null,
  amount_minor,
  currency_code,
  expense_date,
  description = '',
  category_id = null,
  created_at = null,
  updated_at = null,
}) {
  const now = new Date().toISOString();
  const expense = {
    id,
    amount_minor,
    currency_code,
    expense_date,
    description: typeof description === 'string' ? description.trim() : description,
    category_id,
    created_at: created_at || now,
    updated_at: updated_at || now,
  };

  validateExpense(expense);

  return Object.freeze(expense);
}

// ============================================================================
// 5. CATEGORY VALIDATOR & FACTORY
// ============================================================================

/**
 * Validates a Category model.
 *
 * @throws {Error}
 * @param {unknown} category
 * @returns {true}
 */
export function validateCategory(category) {
  if (!category || typeof category !== 'object' || Array.isArray(category)) {
    throw new Error('Category must be a non-null object.');
  }
  if (!category.name || typeof category.name !== 'string' || category.name.trim() === '') {
    throw new Error('Category name must be a non-empty string.');
  }
  if (category.is_default !== undefined && typeof category.is_default !== 'boolean') {
    throw new Error('Category is_default must be a boolean.');
  }
  return true;
}

/**
 * Factory function creating an immutable Category entity.
 *
 * @param {{ id?: string|number|null, name: string, is_default?: boolean }} input
 * @returns {Readonly<Category>}
 */
export function createCategory({ id = null, name, is_default = false }) {
  const category = {
    id,
    name: typeof name === 'string' ? name.trim() : name,
    is_default: Boolean(is_default),
  };
  validateCategory(category);
  return Object.freeze(category);
}

// ============================================================================
// 6. EXCHANGE RATE VALIDATOR & FACTORY
// ============================================================================

/**
 * Validates an ExchangeRate model.
 *
 * @throws {Error}
 * @param {unknown} exchangeRate
 * @returns {true}
 */
export function validateExchangeRate(exchangeRate) {
  if (!exchangeRate || typeof exchangeRate !== 'object' || Array.isArray(exchangeRate)) {
    throw new Error('ExchangeRate must be a non-null object.');
  }
  if (!exchangeRate.from_currency || !Object.values(CURRENCIES).includes(exchangeRate.from_currency)) {
    throw new Error(
      `from_currency must be one of [${Object.values(CURRENCIES).join(', ')}], received: ${exchangeRate.from_currency}.`
    );
  }
  if (!exchangeRate.to_currency || !Object.values(CURRENCIES).includes(exchangeRate.to_currency)) {
    throw new Error(
      `to_currency must be one of [${Object.values(CURRENCIES).join(', ')}], received: ${exchangeRate.to_currency}.`
    );
  }
  if (
    typeof exchangeRate.rate !== 'number' ||
    !Number.isFinite(exchangeRate.rate) ||
    exchangeRate.rate <= 0
  ) {
    throw new Error(
      `rate must be a positive finite number, received: ${exchangeRate.rate}.`
    );
  }
  if (!exchangeRate.effective_at || !isValidIsoDate(exchangeRate.effective_at)) {
    throw new Error(
      `effective_at must be a valid ISO 8601 date string, received: ${exchangeRate.effective_at}.`
    );
  }
  return true;
}

/**
 * Factory function creating an immutable ExchangeRate model.
 *
 * @param {{
 *   id?: string|number|null,
 *   from_currency: CurrencyCode,
 *   to_currency: CurrencyCode,
 *   rate: number,
 *   source?: string,
 *   effective_at?: string|null,
 *   saved_at?: string|null
 * }} input
 * @returns {Readonly<ExchangeRate>}
 */
export function createExchangeRate({
  id = null,
  from_currency,
  to_currency,
  rate,
  source = 'manual',
  effective_at = null,
  saved_at = null,
}) {
  const now = new Date().toISOString();
  const exchangeRate = {
    id,
    from_currency,
    to_currency,
    rate,
    source: typeof source === 'string' ? source.trim() : source,
    effective_at: effective_at || now,
    saved_at: saved_at || now,
  };
  validateExchangeRate(exchangeRate);
  return Object.freeze(exchangeRate);
}

// ============================================================================
// 7. APP SETTING VALIDATOR & FACTORY
// ============================================================================

/**
 * Validates an AppSetting model.
 *
 * @throws {Error}
 * @param {unknown} setting
 * @returns {true}
 */
export function validateAppSetting(setting) {
  if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
    throw new Error('AppSetting must be a non-null object.');
  }
  if (!setting.key || typeof setting.key !== 'string' || setting.key.trim() === '') {
    throw new Error('AppSetting key must be a non-empty string.');
  }
  if (setting.value === undefined) {
    throw new Error('AppSetting value is required.');
  }
  return true;
}

/**
 * Factory function creating an immutable AppSetting model.
 *
 * @param {{ key: string, value: string }} input
 * @returns {Readonly<AppSetting>}
 */
export function createAppSetting({ key, value }) {
  const setting = {
    key: typeof key === 'string' ? key.trim() : key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  };
  validateAppSetting(setting);
  return Object.freeze(setting);
}

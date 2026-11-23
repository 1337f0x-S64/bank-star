'use strict';

import {
  CURRENCIES,
  VIEW_STATES,
  PERIOD_TYPES,
  DEFAULT_CATEGORIES,
  MIN_AMOUNT_MINOR,
  MAX_AMOUNT_MINOR,
  isValidIsoDate,
  validateExpense,
  isValidExpense,
  createExpense,
  validateCategory,
  createCategory,
  validateExchangeRate,
  createExchangeRate,
  validateAppSetting,
  createAppSetting,
} from '../../../src/domain/models/schemas';

describe('Domain Models & Schemas Contract (SRS Section 6.1, 6.2, 7.1)', () => {
  // ==========================================================================
  // 1. Constants & Enums Integrity
  // ==========================================================================
  describe('Constants & Enums', () => {
    test('CURRENCIES defines frozen USD and NIO keys', () => {
      expect(CURRENCIES).toEqual({
        USD: 'USD',
        NIO: 'NIO',
      });
      expect(Object.isFrozen(CURRENCIES)).toBe(true);
      expect(() => {
        CURRENCIES.EUR = 'EUR';
      }).toThrow();
    });

    test('VIEW_STATES defines 4 explicit reactive MVVM screen states', () => {
      expect(VIEW_STATES).toEqual({
        LOADING: 'loading',
        SUCCESS: 'success',
        ERROR: 'error',
        OFFLINE: 'offline',
      });
      expect(Object.isFrozen(VIEW_STATES)).toBe(true);
      expect(() => {
        VIEW_STATES.CUSTOM = 'custom';
      }).toThrow();
    });

    test('PERIOD_TYPES defines daily, weekly, monthly, and yearly', () => {
      expect(PERIOD_TYPES).toEqual({
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        YEARLY: 'yearly',
      });
      expect(Object.isFrozen(PERIOD_TYPES)).toBe(true);
      expect(() => {
        PERIOD_TYPES.HOURLY = 'hourly';
      }).toThrow();
    });

    test('DEFAULT_CATEGORIES includes 7 preset categories and is frozen', () => {
      expect(DEFAULT_CATEGORIES).toHaveLength(7);
      expect(Object.isFrozen(DEFAULT_CATEGORIES)).toBe(true);
      expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual([
        'Food',
        'Transportation',
        'Shopping',
        'Bills',
        'Health',
        'Entertainment',
        'Other',
      ]);
      expect(DEFAULT_CATEGORIES.every((c) => Object.isFrozen(c) && c.is_default === true)).toBe(true);
    });

    test('monetary bounds align with SRS Section 6.2', () => {
      expect(MIN_AMOUNT_MINOR).toBe(1);
      expect(MAX_AMOUNT_MINOR).toBe(999999999);
    });
  });

  // ==========================================================================
  // 2. ISO Date Validation Helper
  // ==========================================================================
  describe('isValidIsoDate', () => {
    test('accepts valid ISO date formats', () => {
      expect(isValidIsoDate('2026-11-22')).toBe(true);
      expect(isValidIsoDate('2026-11-22T18:00:00Z')).toBe(true);
      expect(isValidIsoDate('2026-11-22T18:00:00.123Z')).toBe(true);
      expect(isValidIsoDate('2026-11-22T18:00:00-06:00')).toBe(true);
    });

    test('rejects invalid strings, numbers, and impossible dates', () => {
      expect(isValidIsoDate('')).toBe(false);
      expect(isValidIsoDate('invalid-date')).toBe(false);
      expect(isValidIsoDate('2026-02-30')).toBe(false); // Feb 30 does not exist
      expect(isValidIsoDate('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidIsoDate('2026-13-01')).toBe(false); // Month 13
      expect(isValidIsoDate(null)).toBe(false);
      expect(isValidIsoDate(undefined)).toBe(false);
      expect(isValidIsoDate(123456789)).toBe(false);
    });
  });

  // ==========================================================================
  // 3. validateExpense Acceptance Criteria
  // ==========================================================================
  describe('validateExpense', () => {
    const validExpense = {
      id: 'exp-123',
      amount_minor: 1550,
      currency_code: 'USD',
      expense_date: '2026-11-22T12:00:00Z',
      description: 'Groceries',
      category_id: 1,
    };

    test('passes for valid expense object in USD and NIO', () => {
      expect(validateExpense(validExpense)).toBe(true);

      const nioExpense = {
        ...validExpense,
        currency_code: 'NIO',
        amount_minor: 50000,
      };
      expect(validateExpense(nioExpense)).toBe(true);
    });

    test('rejects floating-point amounts (zero floating-point drift)', () => {
      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 15.5 });
      }).toThrow(/must be an integer/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 100.01 });
      }).toThrow(/must be an integer/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 0.99 });
      }).toThrow(/must be an integer/i);
    });

    test('rejects negative amounts and zero', () => {
      expect(() => {
        validateExpense({ ...validExpense, amount_minor: -100 });
      }).toThrow(/greater than 0/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: -1 });
      }).toThrow(/greater than 0/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 0 });
      }).toThrow(/greater than 0/i);
    });

    test('rejects strings for amount_minor', () => {
      expect(() => {
        validateExpense({ ...validExpense, amount_minor: '1550' });
      }).toThrow(/must be an integer/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 'abc' });
      }).toThrow(/must be an integer/i);
    });

    test('rejects non-numeric amount_minor (null, undefined, boolean, object, NaN)', () => {
      expect(() => {
        validateExpense({ ...validExpense, amount_minor: null });
      }).toThrow(/amount_minor is required/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: undefined });
      }).toThrow(/amount_minor is required/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: true });
      }).toThrow(/must be an integer/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: NaN });
      }).toThrow(/must be an integer/i);

      expect(() => {
        validateExpense({ ...validExpense, amount_minor: {} });
      }).toThrow(/must be an integer/i);
    });

    test('rejects amounts exceeding MAX_AMOUNT_MINOR (999,999,999)', () => {
      expect(() => {
        validateExpense({ ...validExpense, amount_minor: 1000000000 });
      }).toThrow(/must not exceed 999999999/i);
    });

    test('rejects missing or unsupported currencies', () => {
      expect(() => {
        validateExpense({ ...validExpense, currency_code: undefined });
      }).toThrow(/currency_code is required/i);

      expect(() => {
        validateExpense({ ...validExpense, currency_code: null });
      }).toThrow(/currency_code is required/i);

      expect(() => {
        validateExpense({ ...validExpense, currency_code: '' });
      }).toThrow(/currency_code is required/i);

      expect(() => {
        validateExpense({ ...validExpense, currency_code: 'EUR' });
      }).toThrow(/must be one of \[USD, NIO\]/i);

      expect(() => {
        validateExpense({ ...validExpense, currency_code: 'usd' }); // case-sensitive check
      }).toThrow(/must be one of \[USD, NIO\]/i);
    });

    test('rejects invalid or missing expense_date', () => {
      expect(() => {
        validateExpense({ ...validExpense, expense_date: undefined });
      }).toThrow(/expense_date is required/i);

      expect(() => {
        validateExpense({ ...validExpense, expense_date: 'not-a-date' });
      }).toThrow(/valid ISO 8601 date string/i);

      expect(() => {
        validateExpense({ ...validExpense, expense_date: '2026-02-30' });
      }).toThrow(/valid ISO 8601 date string/i);

      expect(() => {
        validateExpense({ ...validExpense, expense_date: 1234567 });
      }).toThrow(/valid ISO 8601 date string/i);
    });

    test('rejects non-object or null expense', () => {
      expect(() => validateExpense(null)).toThrow(/must be a non-null object/i);
      expect(() => validateExpense(undefined)).toThrow(/must be a non-null object/i);
      expect(() => validateExpense('string')).toThrow(/must be a non-null object/i);
      expect(() => validateExpense([validExpense])).toThrow(/must be a non-null object/i);
    });

    test('rejects invalid optional field types', () => {
      expect(() => {
        validateExpense({ ...validExpense, id: '' });
      }).toThrow(/id cannot be an empty string/i);

      expect(() => {
        validateExpense({ ...validExpense, id: {} });
      }).toThrow(/id must be a string or number/i);

      expect(() => {
        validateExpense({ ...validExpense, description: 123 });
      }).toThrow(/description must be a string/i);

      expect(() => {
        validateExpense({ ...validExpense, category_id: [] });
      }).toThrow(/category_id must be a string or number/i);

      expect(() => {
        validateExpense({ ...validExpense, created_at: 'bad-date' });
      }).toThrow(/created_at must be a valid ISO 8601 date string/i);

      expect(() => {
        validateExpense({ ...validExpense, updated_at: 'bad-date' });
      }).toThrow(/updated_at must be a valid ISO 8601 date string/i);
    });
  });

  // ==========================================================================
  // 4. isValidExpense Safe Guard
  // ==========================================================================
  describe('isValidExpense', () => {
    test('returns true for valid expense and false for any invalid expense', () => {
      expect(
        isValidExpense({
          amount_minor: 2500,
          currency_code: 'USD',
          expense_date: '2026-11-22',
        })
      ).toBe(true);

      expect(
        isValidExpense({
          amount_minor: 25.5, // float rejected
          currency_code: 'USD',
          expense_date: '2026-11-22',
        })
      ).toBe(false);

      expect(
        isValidExpense({
          amount_minor: 2500,
          currency_code: 'CAD', // bad currency
          expense_date: '2026-11-22',
        })
      ).toBe(false);

      expect(isValidExpense(null)).toBe(false);
    });
  });

  // ==========================================================================
  // 5. createExpense Factory & Immutability
  // ==========================================================================
  describe('createExpense', () => {
    test('creates a valid, frozen Expense object', () => {
      const expense = createExpense({
        id: 'exp-1',
        amount_minor: 1299,
        currency_code: CURRENCIES.USD,
        expense_date: '2026-11-22T10:00:00.000Z',
        description: 'Coffee',
        category_id: 1,
      });

      expect(expense.id).toBe('exp-1');
      expect(expense.amount_minor).toBe(1299);
      expect(expense.currency_code).toBe('USD');
      expect(expense.expense_date).toBe('2026-11-22T10:00:00.000Z');
      expect(expense.description).toBe('Coffee');
      expect(expense.category_id).toBe(1);
      expect(typeof expense.created_at).toBe('string');
      expect(typeof expense.updated_at).toBe('string');
      expect(Object.isFrozen(expense)).toBe(true);

      // Verify strict-mode mutation prevention
      expect(() => {
        expense.amount_minor = 9999;
      }).toThrow();
    });

    test('defaults timestamps and trims description', () => {
      const expense = createExpense({
        amount_minor: 500,
        currency_code: CURRENCIES.NIO,
        expense_date: '2026-11-22',
        description: '  Snack  ',
      });

      expect(expense.description).toBe('Snack');
      expect(expense.id).toBeNull();
      expect(isValidIsoDate(expense.created_at)).toBe(true);
      expect(isValidIsoDate(expense.updated_at)).toBe(true);
    });

    test('throws when factory receives invalid inputs', () => {
      expect(() => {
        createExpense({
          amount_minor: -50,
          currency_code: CURRENCIES.USD,
          expense_date: '2026-11-22',
        });
      }).toThrow(/greater than 0/i);

      expect(() => {
        createExpense({
          amount_minor: 500,
          currency_code: 'INVALID',
          expense_date: '2026-11-22',
        });
      }).toThrow(/must be one of \[USD, NIO\]/i);
    });
  });

  // ==========================================================================
  // 6. Category Validator & Factory
  // ==========================================================================
  describe('Category Factory & Validation', () => {
    test('createCategory returns frozen Category entity', () => {
      const cat = createCategory({ id: 10, name: 'Dining', is_default: false });
      expect(cat).toEqual({ id: 10, name: 'Dining', is_default: false });
      expect(Object.isFrozen(cat)).toBe(true);
      expect(() => {
        cat.name = 'Fast Food';
      }).toThrow();
    });

    test('validateCategory rejects empty names or non-objects', () => {
      expect(() => validateCategory({ name: '' })).toThrow(/non-empty string/i);
      expect(() => validateCategory({ name: '   ' })).toThrow(/non-empty string/i);
      expect(() => validateCategory(null)).toThrow(/non-null object/i);
      expect(() => validateCategory({ name: 'Valid', is_default: 'not-bool' })).toThrow(
        /must be a boolean/i
      );
    });
  });

  // ==========================================================================
  // 7. ExchangeRate Validator & Factory
  // ==========================================================================
  describe('ExchangeRate Factory & Validation', () => {
    test('createExchangeRate returns frozen ExchangeRate entity', () => {
      const rate = createExchangeRate({
        id: 'rate-1',
        from_currency: CURRENCIES.USD,
        to_currency: CURRENCIES.NIO,
        rate: 36.6241,
        source: 'bcn',
        effective_at: '2026-11-22T00:00:00Z',
      });

      expect(rate.id).toBe('rate-1');
      expect(rate.from_currency).toBe('USD');
      expect(rate.to_currency).toBe('NIO');
      expect(rate.rate).toBe(36.6241);
      expect(rate.source).toBe('bcn');
      expect(Object.isFrozen(rate)).toBe(true);
      expect(() => {
        rate.rate = 37.0;
      }).toThrow();
    });

    test('validateExchangeRate rejects invalid rates, currencies, or timestamps', () => {
      expect(() =>
        validateExchangeRate({
          from_currency: 'USD',
          to_currency: 'NIO',
          rate: -5,
          effective_at: '2026-11-22',
        })
      ).toThrow(/positive finite number/i);

      expect(() =>
        validateExchangeRate({
          from_currency: 'USD',
          to_currency: 'EUR',
          rate: 1.0,
          effective_at: '2026-11-22',
        })
      ).toThrow(/must be one of \[USD, NIO\]/i);

      expect(() =>
        validateExchangeRate({
          from_currency: 'USD',
          to_currency: 'NIO',
          rate: 36.5,
          effective_at: 'bad-date',
        })
      ).toThrow(/valid ISO 8601 date string/i);
    });
  });

  // ==========================================================================
  // 8. AppSetting Validator & Factory
  // ==========================================================================
  describe('AppSetting Factory & Validation', () => {
    test('createAppSetting returns frozen AppSetting entity', () => {
      const setting = createAppSetting({
        key: 'preferred_currency',
        value: 'USD',
      });

      expect(setting).toEqual({
        key: 'preferred_currency',
        value: 'USD',
      });
      expect(Object.isFrozen(setting)).toBe(true);
      expect(() => {
        setting.value = 'NIO';
      }).toThrow();
    });

    test('createAppSetting serializes non-string values to JSON', () => {
      const setting = createAppSetting({
        key: 'biometric_lock_enabled',
        value: true,
      });

      expect(setting.key).toBe('biometric_lock_enabled');
      expect(setting.value).toBe('true');
    });

    test('validateAppSetting rejects missing keys or undefined values', () => {
      expect(() => validateAppSetting({ key: '', value: 'test' })).toThrow(/non-empty string/i);
      expect(() => validateAppSetting({ key: 'test', value: undefined })).toThrow(
        /value is required/i
      );
      expect(() => validateAppSetting(null)).toThrow(/non-null object/i);
    });
  });
});

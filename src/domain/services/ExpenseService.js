/**
 * @file ExpenseService.js
 * @description Domain coordination service enforcing business rules, data validation, and destructive delete confirmation.
 * @standards SRS Alignment: FR-01 (Create), FR-02 (Validation), FR-03 (View), FR-04 (Edit), FR-05 (Delete), Section 6.2 (Rules)
 * @constitutional-mandates
 *   1. Integer Minor-Unit Math: All amounts are strictly positive integer minor units (cents / centavos).
 *   2. Defensive Safety: Zero floating-point drift, runtime type validation, fail-safe preconditions.
 *   3. Destructive Delete Confirmation: Deletion mandates an explicit matching confirmation ID.
 *   4. Business Rule Coordination: Verify category existence, date formatting, and frozen entity integrity.
 */

'use strict';

import * as Crypto from 'expo-crypto';
import defaultExpenseRepository from '../../data/repositories/ExpenseRepository';
import defaultCategoryRepository from '../../data/repositories/CategoryRepository';
import {
  createExpense,
  isValidIsoDate,
  CURRENCIES,
  MIN_AMOUNT_MINOR,
  MAX_AMOUNT_MINOR,
} from '../models/schemas';
import { assertIntegerMinor } from '../calculations/MoneyMath';

/**
 * Generates an RFC4122 v4 UUID string.
 *
 * @returns {string}
 */
export function generateId() {
  try {
    const id = Crypto?.randomUUID?.();
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  } catch {
    // Fallback
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Domain service coordinating expense workflows, business rules, and repository operations.
 */
export class ExpenseService {
  /**
   * @param {object} [expenseRepository=defaultExpenseRepository] - Data repository for expenses
   * @param {object} [categoryRepository=defaultCategoryRepository] - Data repository for categories
   */
  constructor(expenseRepository = defaultExpenseRepository, categoryRepository = defaultCategoryRepository) {
    this.expenseRepository = expenseRepository;
    this.categoryRepository = categoryRepository;
  }

  /**
   * Creates a new expense after enforcing domain business rules.
   * Complies with SRS FR-01 and FR-02.
   *
   * @param {object} input - Expense creation parameters
   * @param {number} input.amount_minor - Amount in exact integer minor units
   * @param {string} input.currency_code - 'USD' or 'NIO'
   * @param {string} input.expense_date - Valid ISO 8601 date string
   * @param {string} [input.description] - Optional description
   * @param {string|number|null} [input.category_id] - Optional category ID
   * @param {string} [input.id] - Optional custom ID
   * @returns {Promise<import('../models/schemas').Expense>} Created and persisted expense entity
   */
  async createExpense(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Expense input must be a non-null object.');
    }

    // 1. Validate integer minor-unit amount (SRS FR-02, Constitutional Mandate)
    assertIntegerMinor(input.amount_minor);
    if (input.amount_minor < MIN_AMOUNT_MINOR || input.amount_minor > MAX_AMOUNT_MINOR) {
      throw new Error(
        `amount_minor must be between ${MIN_AMOUNT_MINOR} and ${MAX_AMOUNT_MINOR}, received: ${input.amount_minor}.`
      );
    }

    // 2. Validate currency code
    if (!input.currency_code || !Object.values(CURRENCIES).includes(input.currency_code)) {
      throw new Error(
        `Invalid currency_code: ${input.currency_code}. Must be one of [${Object.values(CURRENCIES).join(', ')}].`
      );
    }

    // 3. Validate expense date format
    if (!input.expense_date || !isValidIsoDate(input.expense_date)) {
      throw new Error(
        `expense_date must be a valid ISO 8601 date, received: ${input.expense_date}.`
      );
    }

    // 4. Validate category existence if a category_id is provided
    if (input.category_id !== undefined && input.category_id !== null) {
      const category = await this.categoryRepository.getById(input.category_id);
      if (!category) {
        throw new Error(`Category with ID '${input.category_id}' does not exist.`);
      }
    }

    // 5. Construct immutable domain entity
    const id = input.id || generateId();
    const now = new Date().toISOString();
    const expense = createExpense({
      id,
      amount_minor: input.amount_minor,
      currency_code: input.currency_code,
      expense_date: input.expense_date,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      category_id: input.category_id !== undefined && input.category_id !== null ? input.category_id : null,
      created_at: input.created_at || now,
      updated_at: input.updated_at || now,
    });

    // 6. Persist through repository
    return await this.expenseRepository.create(expense);
  }

  /**
   * Retrieves an expense by its unique identifier.
   *
   * @param {string|number} id
   * @returns {Promise<import('../models/schemas').Expense|null>}
   */
  async getExpenseById(id) {
    if (id === null || id === undefined || String(id).trim() === '') {
      throw new Error('A valid expense ID is required.');
    }
    return await this.expenseRepository.getById(id);
  }

  /**
   * Retrieves all expenses chronologically with pagination.
   * Complies with SRS FR-03.
   *
   * @param {number} [limit=50]
   * @param {number} [offset=0]
   * @returns {Promise<Array<import('../models/schemas').Expense>>}
   */
  async getAllExpenses(limit = 50, offset = 0) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    return await this.expenseRepository.getAllChronological(safeLimit, safeOffset);
  }

  /**
   * Retrieves expenses within a specified ISO date range.
   * Complies with SRS FR-06.
   *
   * @param {string} startDate - Inclusive start date
   * @param {string} endDate - Inclusive end date
   * @returns {Promise<Array<import('../models/schemas').Expense>>}
   */
  async getExpensesByDateRange(startDate, endDate) {
    if (!isValidIsoDate(startDate)) {
      throw new Error(`startDate must be a valid ISO 8601 date, received: ${startDate}`);
    }
    if (!isValidIsoDate(endDate)) {
      throw new Error(`endDate must be a valid ISO 8601 date, received: ${endDate}`);
    }
    if (startDate > endDate) {
      throw new Error(`startDate (${startDate}) cannot be after endDate (${endDate}).`);
    }
    return await this.expenseRepository.getByDateRange(startDate, endDate);
  }

  /**
   * Modifies an existing expense after validating all fields and confirming existence.
   * Complies with SRS FR-04.
   *
   * @param {object} input - Updated expense attributes
   * @param {string|number} input.id - Mandatory expense ID
   * @returns {Promise<import('../models/schemas').Expense>}
   */
  async updateExpense(input) {
    if (!input || typeof input !== 'object' || !input.id) {
      throw new Error('Expense ID is required for update.');
    }

    // 1. Verify target expense currently exists
    const existing = await this.expenseRepository.getById(input.id);
    if (!existing) {
      throw new Error(`Expense with ID '${input.id}' not found.`);
    }

    // 2. Validate amount if provided
    const amountMinor = input.amount_minor !== undefined ? input.amount_minor : existing.amount_minor;
    assertIntegerMinor(amountMinor);
    if (amountMinor < MIN_AMOUNT_MINOR || amountMinor > MAX_AMOUNT_MINOR) {
      throw new Error(
        `amount_minor must be between ${MIN_AMOUNT_MINOR} and ${MAX_AMOUNT_MINOR}, received: ${amountMinor}.`
      );
    }

    // 3. Validate currency
    const currencyCode = input.currency_code || existing.currency_code;
    if (!Object.values(CURRENCIES).includes(currencyCode)) {
      throw new Error(`Invalid currency_code: ${currencyCode}.`);
    }

    // 4. Validate date
    const expenseDate = input.expense_date || existing.expense_date;
    if (!isValidIsoDate(expenseDate)) {
      throw new Error(`expense_date must be a valid ISO 8601 date, received: ${expenseDate}.`);
    }

    // 5. Validate category existence if category_id is updated
    const categoryId = input.category_id !== undefined ? input.category_id : existing.category_id;
    if (categoryId !== null && categoryId !== undefined) {
      const category = await this.categoryRepository.getById(categoryId);
      if (!category) {
        throw new Error(`Category with ID '${categoryId}' does not exist.`);
      }
    }

    const description = input.description !== undefined
      ? (typeof input.description === 'string' ? input.description.trim() : '')
      : existing.description;

    const updatedExpense = createExpense({
      id: existing.id,
      amount_minor: amountMinor,
      currency_code: currencyCode,
      expense_date: expenseDate,
      description,
      category_id: categoryId,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    });

    return await this.expenseRepository.update(updatedExpense);
  }

  /**
   * Destructively deletes an expense.
   * Mandates explicit confirmation matching the target expense ID.
   * Complies with SRS FR-05 and Milestone Acceptance Criteria.
   *
   * @param {string|number} id - Target expense ID
   * @param {string|number} confirmationId - Explicit confirmation ID that must match id
   * @returns {Promise<boolean>} True upon successful deletion
   */
  async deleteExpense(id, confirmationId) {
    if (id === null || id === undefined || String(id).trim() === '') {
      throw new Error('A valid expense ID is required for deletion.');
    }

    // Mandatory explicit confirmation check (Acceptance Criteria)
    if (confirmationId === null || confirmationId === undefined || String(confirmationId) !== String(id)) {
      throw new Error(
        `Destructive delete confirmation failed: confirmationId '${confirmationId}' does not match target expense ID '${id}'.`
      );
    }

    // Verify existence prior to deletion
    const existing = await this.expenseRepository.getById(id);
    if (!existing) {
      throw new Error(`Expense with ID '${id}' not found.`);
    }

    return await this.expenseRepository.delete(id);
  }
}

export default new ExpenseService();

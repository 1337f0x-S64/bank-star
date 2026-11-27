/**
 * @file ExpenseRepository.js
 * @description Data access repository for Expense entities executing parameterized SQL queries with atomic transaction rollback.
 * @standards SRS Alignment: FR-01, FR-03, FR-04, FR-05, FR-30, Section 6.1 (Core Data Entities), Section 6.2 (Validation)
 * @constitutional-mandates
 *   1. Parameterized Queries: All operations strictly execute parameterized statements (?) to prevent SQL injection.
 *   2. Atomic Transactions: All write operations (create, update, delete) execute inside atomic transactions with rollback handlers.
 *   3. Integer Minor-Unit Math: All amounts are strictly integer minor units (cents / centavos).
 *   4. Immutable Contracts: Returned expense entities are frozen domain models.
 */

'use strict';

import * as SqlCipherClient from '../database/SqlCipherClient';
import {
  createExpense,
  validateExpense,
  isValidIsoDate,
} from '../../domain/models/schemas';

/**
 * Normalizes a raw SQLite result row into an immutable Expense domain model.
 *
 * @param {Record<string, unknown>|null} row
 * @returns {import('../../domain/models/schemas').Expense|null}
 */
export function mapRowToExpense(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  return createExpense({
    id: row.id,
    amount_minor: Number(row.amount_minor),
    currency_code: row.currency_code,
    expense_date: row.expense_date,
    description: typeof row.description === 'string' ? row.description : '',
    category_id: row.category_id !== null && row.category_id !== undefined ? row.category_id : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

/**
 * Resolves the database instance to use (injected or singleton).
 *
 * @param {object} [db]
 * @returns {object}
 */
function resolveDb(db) {
  if (db) {
    return db;
  }
  return SqlCipherClient.getDatabase();
}

/**
 * Executes a callback inside an atomic SQLite transaction with an automatic rollback handler on failure.
 * Complies with SRS FR-30 (Safe writes).
 *
 * @template T
 * @param {object} db - SQLite database handle
 * @param {() => Promise<T>} operation - Transactional operation
 * @returns {Promise<T>} Result of the operation
 */
export async function withTransaction(db, operation) {
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await operation();
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK;').catch(() => {});
    throw error;
  }
}

/**
 * Inserts a new expense entity using a parameterized INSERT within an atomic transaction.
 *
 * @param {import('../../domain/models/schemas').ExpenseInput} expense - Validated expense input or model
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<import('../../domain/models/schemas').Expense>} Created expense entity
 */
export async function create(expense, db = null) {
  validateExpense(expense);

  const database = resolveDb(db);
  const now = new Date().toISOString();
  const id = expense.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const createdAt = expense.created_at || now;
  const updatedAt = expense.updated_at || now;
  const description = typeof expense.description === 'string' ? expense.description.trim() : '';
  const categoryId = expense.category_id !== undefined && expense.category_id !== null ? expense.category_id : null;

  await withTransaction(database, async () => {
    await database.runAsync(
      `INSERT INTO expenses (
        id,
        amount_minor,
        currency_code,
        expense_date,
        description,
        category_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        expense.amount_minor,
        expense.currency_code,
        expense.expense_date,
        description,
        categoryId,
        createdAt,
        updatedAt,
      ]
    );
  });

  return createExpense({
    id,
    amount_minor: expense.amount_minor,
    currency_code: expense.currency_code,
    expense_date: expense.expense_date,
    description,
    category_id: categoryId,
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

/**
 * Retrieves a single expense by its unique ID using a parameterized query.
 *
 * @param {string|number} id - Expense ID
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<import('../../domain/models/schemas').Expense|null>}
 */
export async function getById(id, db = null) {
  if (id === null || id === undefined) {
    return null;
  }
  const database = resolveDb(db);
  const row = await database.getFirstAsync(
    `SELECT id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at
     FROM expenses
     WHERE id = ?;`,
    [id]
  );
  return mapRowToExpense(row);
}

/**
 * Retrieves expenses in chronological order (newest first) with parameterized limit and offset pagination.
 * Complies with SRS FR-03 (View expenses).
 *
 * @param {number} [limit=50] - Maximum number of rows to return
 * @param {number} [offset=0] - Offset for pagination
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<Array<import('../../domain/models/schemas').Expense>>}
 */
export async function getAllChronological(limit = 50, offset = 0, db = null) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

  const database = resolveDb(db);
  const rows = await database.getAllAsync(
    `SELECT id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at
     FROM expenses
     ORDER BY expense_date DESC, created_at DESC
     LIMIT ? OFFSET ?;`,
    [safeLimit, safeOffset]
  );
  return (rows || []).map(mapRowToExpense).filter(Boolean);
}

/**
 * Retrieves expenses falling within an inclusive ISO date range using parameterized queries.
 *
 * @param {string} startDate - Inclusive start date (ISO 8601 string)
 * @param {string} endDate - Inclusive end date (ISO 8601 string)
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<Array<import('../../domain/models/schemas').Expense>>}
 */
export async function getByDateRange(startDate, endDate, db = null) {
  if (!isValidIsoDate(startDate)) {
    throw new Error(`startDate must be a valid ISO 8601 date, received: ${startDate}`);
  }
  if (!isValidIsoDate(endDate)) {
    throw new Error(`endDate must be a valid ISO 8601 date, received: ${endDate}`);
  }
  if (startDate > endDate) {
    throw new Error(`startDate (${startDate}) cannot be after endDate (${endDate}).`);
  }

  const database = resolveDb(db);
  const rows = await database.getAllAsync(
    `SELECT id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at
     FROM expenses
     WHERE expense_date >= ? AND expense_date <= ?
     ORDER BY expense_date ASC, created_at ASC;`,
    [startDate, endDate]
  );
  return (rows || []).map(mapRowToExpense).filter(Boolean);
}

/**
 * Updates an existing expense entity inside an atomic transaction.
 * Complies with SRS FR-04 (Edit expense) and FR-30 (Safe writes).
 *
 * @param {import('../../domain/models/schemas').Expense} expense - Updated expense entity
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<import('../../domain/models/schemas').Expense>}
 */
export async function update(expense, db = null) {
  validateExpense(expense);
  if (!expense.id) {
    throw new Error('Expense ID is required for update.');
  }

  const database = resolveDb(db);
  const updatedAt = expense.updated_at || new Date().toISOString();
  const description = typeof expense.description === 'string' ? expense.description.trim() : '';
  const categoryId = expense.category_id !== undefined && expense.category_id !== null ? expense.category_id : null;

  await withTransaction(database, async () => {
    // 1. Check existence to ensure update applies
    const existing = await database.getFirstAsync(
      'SELECT id, created_at FROM expenses WHERE id = ?;',
      [expense.id]
    );
    if (!existing) {
      throw new Error(`Expense with ID '${expense.id}' not found.`);
    }

    // 2. Perform parameterized update
    await database.runAsync(
      `UPDATE expenses
       SET amount_minor = ?,
           currency_code = ?,
           expense_date = ?,
           description = ?,
           category_id = ?,
           updated_at = ?
       WHERE id = ?;`,
      [
        expense.amount_minor,
        expense.currency_code,
        expense.expense_date,
        description,
        categoryId,
        updatedAt,
        expense.id,
      ]
    );
  });

  return createExpense({
    ...expense,
    description,
    category_id: categoryId,
    updated_at: updatedAt,
  });
}

/**
 * Deletes an expense by primary key ID inside an atomic transaction.
 * Complies with SRS FR-05 (Delete expense) and FR-30 (Safe writes).
 *
 * @param {string|number} id - Primary key of the expense to delete
 * @param {object} [db] - Optional SQLite database handle
 * @returns {Promise<boolean>} True if successfully deleted
 */
export async function deleteExpense(id, db = null) {
  if (id === null || id === undefined || String(id).trim() === '') {
    throw new Error('A valid expense ID is required for deletion.');
  }

  const database = resolveDb(db);

  return await withTransaction(database, async () => {
    const existing = await database.getFirstAsync(
      'SELECT id FROM expenses WHERE id = ?;',
      [id]
    );
    if (!existing) {
      throw new Error(`Expense with ID '${id}' not found.`);
    }

    await database.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    return true;
  });
}

/**
 * ExpenseRepository class for dependency injection.
 */
export class ExpenseRepository {
  /**
   * @param {object} [db] - Optional SQLite database handle
   */
  constructor(db = null) {
    this.db = db;
  }

  async create(expense) {
    return create(expense, this.db);
  }

  async getById(id) {
    return getById(id, this.db);
  }

  async getAllChronological(limit = 50, offset = 0) {
    return getAllChronological(limit, offset, this.db);
  }

  async getByDateRange(startDate, endDate) {
    return getByDateRange(startDate, endDate, this.db);
  }

  async update(expense) {
    return update(expense, this.db);
  }

  async delete(id) {
    return deleteExpense(id, this.db);
  }
}

export default {
  create,
  getById,
  getAllChronological,
  getByDateRange,
  update,
  delete: deleteExpense,
  withTransaction,
  mapRowToExpense,
  ExpenseRepository,
};

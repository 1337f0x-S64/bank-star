/**
 * @file index.js
 * @description Database schema migrations and category seeding engine for SQLCipher SQLite.
 * @standards SRS Alignment: FR-18 (Preset categories), FR-30 (Safe writes), FR-31 (Database migration), Section 6.1 (Core Data Entities)
 * @constitutional-mandates
 *   1. Atomic Transactions: All migrations must execute inside BEGIN TRANSACTION / COMMIT with automatic ROLLBACK on failure.
 *   2. Versioned Migrations: Track schema state using PRAGMA user_version to guarantee idempotent execution.
 *   3. Parameterized Queries: Seeding operations must use parameterized statements (?).
 */

'use strict';

import { DEFAULT_CATEGORIES } from '../../domain/models/schemas';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Extracts and normalizes the user_version integer from PRAGMA user_version query result.
 *
 * @param {unknown} versionRow
 * @returns {number}
 */
export function extractUserVersion(versionRow) {
  if (versionRow === null || versionRow === undefined) {
    return 0;
  }
  if (typeof versionRow === 'number') {
    return Number.isInteger(versionRow) ? versionRow : 0;
  }
  if (typeof versionRow === 'object') {
    const rowObj = /** @type {Record<string, unknown>} */ (versionRow);
    if ('user_version' in rowObj) {
      const v = Number(rowObj.user_version);
      return Number.isInteger(v) ? v : 0;
    }
  }
  return 0;
}

/**
 * Retrieves the current schema version from SQLite.
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<number>} Current PRAGMA user_version integer
 */
export async function getSchemaVersion(db) {
  const row = await db.getFirstAsync('PRAGMA user_version;');
  return extractUserVersion(row);
}

/**
 * Updates the SQLite PRAGMA user_version.
 * Note: PRAGMA user_version does not accept parameter placeholders (?).
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {number} version - Positive integer version number
 * @returns {Promise<void>}
 */
export async function setSchemaVersion(db, version) {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid schema version: ${version}. Must be a non-negative integer.`);
  }
  await db.execAsync(`PRAGMA user_version = ${version};`);
}

/**
 * Migration V1: Initial schema creation and default category seeding.
 * Creates:
 *   - categories (id, name, is_default)
 *   - expenses (id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at)
 *   - exchange_rates (id, from_currency, to_currency, rate, source, effective_at, saved_at)
 *   - app_settings (key, value)
 * Seeds:
 *   - 7 preset categories from DEFAULT_CATEGORIES
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<void>}
 */
export async function migrationV1(db) {
  // 1. Create categories table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 2. Create expenses table with foreign key and integrity checks
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 999999999),
      currency_code TEXT NOT NULL CHECK (currency_code IN ('USD', 'NIO')),
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses (currency_code);
  `);

  // 3. Create exchange_rates table with indexes
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY NOT NULL,
      from_currency TEXT NOT NULL CHECK (from_currency IN ('USD', 'NIO')),
      to_currency TEXT NOT NULL CHECK (to_currency IN ('USD', 'NIO')),
      rate REAL NOT NULL CHECK (rate > 0),
      source TEXT NOT NULL DEFAULT 'manual',
      effective_at TEXT NOT NULL,
      saved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates (from_currency, to_currency);
    CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective ON exchange_rates (effective_at);
  `);

  // 4. Create app_settings table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // 5. Seed default categories using parameterized statements
  for (const cat of DEFAULT_CATEGORIES) {
    if (typeof db.runAsync === 'function') {
      await db.runAsync(
        'INSERT OR IGNORE INTO categories (id, name, is_default) VALUES (?, ?, ?);',
        [cat.id, cat.name, cat.is_default ? 1 : 0]
      );
    } else {
      // Fallback for mock environments without runAsync
      const escapedName = cat.name.replace(/'/g, "''");
      await db.execAsync(
        `INSERT OR IGNORE INTO categories (id, name, is_default) VALUES (${cat.id}, '${escapedName}', ${cat.is_default ? 1 : 0});`
      );
    }
  }
}

/**
 * Migration registry ordered chronologically by version number.
 */
export const MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    description: 'Initial core schema and category seeding',
    up: migrationV1,
  }),
]);

/**
 * Executes pending database migrations atomically and sequentially.
 * Enforces foreign keys and wraps each migration inside BEGIN TRANSACTION / COMMIT.
 * Automatically rolls back if any migration step fails.
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db - Encrypted SQLite handle
 * @returns {Promise<{ initialVersion: number, finalVersion: number, appliedCount: number }>}
 */
export async function migrateDatabase(db) {
  if (!db) {
    throw new Error('DatabaseHandleRequired: db instance is required for migrations.');
  }

  // Enforce foreign key constraints
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const initialVersion = await getSchemaVersion(db);
  let currentVersion = initialVersion;
  let appliedCount = 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      // Execute each migration within an atomic transaction
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        await migration.up(db);
        await setSchemaVersion(db, migration.version);
        await db.execAsync('COMMIT;');

        currentVersion = migration.version;
        appliedCount += 1;
        console.log(
          `[Migrations] Successfully applied migration V${migration.version}: ${migration.description}`
        );
      } catch (error) {
        await db.execAsync('ROLLBACK;').catch(() => {});
        const errMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `FATAL: Migration V${migration.version} failed. Transaction rolled back: ${errMessage}`
        );
      }
    }
  }

  return {
    initialVersion,
    finalVersion: currentVersion,
    appliedCount,
  };
}

export default {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  getSchemaVersion,
  setSchemaVersion,
  extractUserVersion,
  migrationV1,
  migrateDatabase,
};

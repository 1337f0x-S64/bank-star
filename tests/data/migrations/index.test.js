/**
 * @file index.test.js
 * @description Unit and atomic transaction verification tests for database migrations (Issue #6).
 * @standards SRS Alignment: FR-18 (Preset categories), FR-30 (Safe writes), FR-31 (Database migration), Section 6.1
 */

'use strict';

import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  extractUserVersion,
  getSchemaVersion,
  setSchemaVersion,
  migrationV1,
  migrateDatabase,
} from '../../../src/data/migrations/index';
import { DEFAULT_CATEGORIES } from '../../../src/domain/models/schemas';

describe('Database Schema Migrations & Seeding (FR-18, FR-30, FR-31, Section 6.1)', () => {
  let mockDb;
  let executedSql;

  beforeEach(() => {
    executedSql = [];

    mockDb = {
      getFirstAsync: jest.fn(),
      execAsync: jest.fn(async (sql) => {
        executedSql.push(sql);
      }),
      runAsync: jest.fn(async (query, params) => {
        executedSql.push({ query, params });
      }),
    };
  });

  // ==========================================================================
  // 1. Version Extraction & Helpers
  // ==========================================================================
  describe('extractUserVersion', () => {
    it('extracts integer from standard PRAGMA user_version row object', () => {
      expect(extractUserVersion({ user_version: 1 })).toBe(1);
      expect(extractUserVersion({ user_version: 5 })).toBe(5);
      expect(extractUserVersion({ user_version: 0 })).toBe(0);
    });

    it('handles numeric input directly', () => {
      expect(extractUserVersion(1)).toBe(1);
      expect(extractUserVersion(0)).toBe(0);
    });

    it('returns 0 for null, undefined, empty, or invalid inputs', () => {
      expect(extractUserVersion(null)).toBe(0);
      expect(extractUserVersion(undefined)).toBe(0);
      expect(extractUserVersion({})).toBe(0);
      expect(extractUserVersion({ user_version: 'invalid' })).toBe(0);
      expect(extractUserVersion(3.14)).toBe(0); // non-integer
    });
  });

  describe('getSchemaVersion & setSchemaVersion', () => {
    it('getSchemaVersion executes PRAGMA user_version query and returns version', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 1 });
      const version = await getSchemaVersion(mockDb);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version;');
      expect(version).toBe(1);
    });

    it('setSchemaVersion executes PRAGMA user_version update', async () => {
      await setSchemaVersion(mockDb, 1);
      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
    });

    it('setSchemaVersion throws on negative or non-integer version', async () => {
      await expect(setSchemaVersion(mockDb, -1)).rejects.toThrow(/Invalid schema version/);
      await expect(setSchemaVersion(mockDb, 1.5)).rejects.toThrow(/Invalid schema version/);
    });
  });

  // ==========================================================================
  // 2. Migration V1 Schema Definition & Seeding
  // ==========================================================================
  describe('migrationV1', () => {
    it('creates all 4 core tables, foreign keys, and indexes', async () => {
      await migrationV1(mockDb);

      const allExecutedSql = executedSql
        .map((entry) => (typeof entry === 'string' ? entry : entry.query))
        .join('\n');

      // 1. categories table
      expect(allExecutedSql).toContain('CREATE TABLE IF NOT EXISTS categories');
      expect(allExecutedSql).toContain('is_default INTEGER NOT NULL DEFAULT 0');

      // 2. expenses table & integrity constraints
      expect(allExecutedSql).toContain('CREATE TABLE IF NOT EXISTS expenses');
      expect(allExecutedSql).toContain('amount_minor INTEGER NOT NULL');
      expect(allExecutedSql).toContain('currency_code TEXT NOT NULL CHECK');
      expect(allExecutedSql).toContain('FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT');
      expect(allExecutedSql).toContain('CREATE INDEX IF NOT EXISTS idx_expenses_date');
      expect(allExecutedSql).toContain('CREATE INDEX IF NOT EXISTS idx_expenses_category');
      expect(allExecutedSql).toContain('CREATE INDEX IF NOT EXISTS idx_expenses_currency');

      // 3. exchange_rates table & indexes
      expect(allExecutedSql).toContain('CREATE TABLE IF NOT EXISTS exchange_rates');
      expect(allExecutedSql).toContain('CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies');
      expect(allExecutedSql).toContain('CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective');

      // 4. app_settings table
      expect(allExecutedSql).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    });

    it('seeds 7 default categories matching DEFAULT_CATEGORIES using parameterized queries (FR-18)', async () => {
      await migrationV1(mockDb);

      expect(mockDb.runAsync).toHaveBeenCalledTimes(7);
      for (const cat of DEFAULT_CATEGORIES) {
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          'INSERT OR IGNORE INTO categories (id, name, is_default) VALUES (?, ?, ?);',
          [cat.id, cat.name, cat.is_default ? 1 : 0]
        );
      }
    });

    it('falls back to execAsync if runAsync is not present', async () => {
      const fallbackDb = {
        execAsync: jest.fn().mockResolvedValue(),
      };
      await migrationV1(fallbackDb);

      expect(fallbackDb.execAsync).toHaveBeenCalled();
      const calls = fallbackDb.execAsync.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => c.includes("INSERT OR IGNORE INTO categories (id, name, is_default) VALUES (1, 'Food', 1)"))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Atomic Migration Engine & Rollback Verification (FR-30, FR-31)
  // ==========================================================================
  describe('migrateDatabase', () => {
    it('executes clean install migration from version 0 to 1 atomically', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });

      const result = await migrateDatabase(mockDb);

      // Verify foreign keys enabled
      expect(executedSql[0]).toBe('PRAGMA foreign_keys = ON;');

      // Verify atomic transaction boundaries: BEGIN TRANSACTION -> Migration V1 -> user_version update -> COMMIT
      expect(executedSql[1]).toBe('BEGIN TRANSACTION;');
      expect(executedSql).toContain('PRAGMA user_version = 1;');
      expect(executedSql[executedSql.length - 1]).toBe('COMMIT;');

      expect(result).toEqual({
        initialVersion: 0,
        finalVersion: 1,
        appliedCount: 1,
      });
    });

    it('is idempotent: skips migration if database is already at current schema version', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: CURRENT_SCHEMA_VERSION });

      const result = await migrateDatabase(mockDb);

      // Foreign keys enabled, but no transaction or migration statements executed
      expect(executedSql).toEqual(['PRAGMA foreign_keys = ON;']);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
      expect(result).toEqual({
        initialVersion: CURRENT_SCHEMA_VERSION,
        finalVersion: CURRENT_SCHEMA_VERSION,
        appliedCount: 0,
      });
    });

    it('interrupted migration rolls back completely without leaving corrupted tables (FR-30)', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });

      // Simulate a failure during migration execution (e.g., disk I/O or syntax fault)
      mockDb.runAsync.mockRejectedValueOnce(new Error('Disk full error during category seeding'));

      await expect(migrateDatabase(mockDb)).rejects.toThrow(
        /FATAL: Migration V1 failed. Transaction rolled back: Disk full error during category seeding/
      );

      // Verify atomic rollback was invoked
      expect(executedSql).toContain('BEGIN TRANSACTION;');
      expect(executedSql).toContain('ROLLBACK;');
      expect(executedSql).not.toContain('COMMIT;');
    });

    it('throws error when database handle is null or undefined', async () => {
      await expect(migrateDatabase(null)).rejects.toThrow(/db instance is required/);
      await expect(migrateDatabase(undefined)).rejects.toThrow(/db instance is required/);
    });
  });

  // ==========================================================================
  // 4. MIGRATIONS Registry Structure
  // ==========================================================================
  describe('MIGRATIONS registry', () => {
    it('defines frozen migrations list with sequential version numbers', () => {
      expect(Object.isFrozen(MIGRATIONS)).toBe(true);
      expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
      expect(MIGRATIONS[0].version).toBe(1);
      expect(typeof MIGRATIONS[0].up).toBe('function');
      expect(typeof MIGRATIONS[0].description).toBe('string');
    });
  });
});

/**
 * @file CategoryRepository.js
 * @description Data access repository for Category entities using parameterized SQL queries.
 * @standards SRS Alignment: FR-01 (Category reference), FR-18 (Preset categories), FR-30 (Safe writes), Section 6.1 (Core Data Entities)
 * @constitutional-mandates
 *   1. Parameterized Queries: All database lookups strictly utilize parameterized statements (?) to eliminate SQL injection.
 *   2. Immutable Contracts: Returned category models are validated and frozen domain entities.
 */

'use strict';

import * as SqlCipherClient from '../database/SqlCipherClient';
import { createCategory } from '../../domain/models/schemas';

/**
 * Normalizes a database row to a frozen Category domain entity.
 *
 * @param {Record<string, unknown>|null} row - Raw SQLite result row
 * @returns {import('../../domain/models/schemas').Category|null}
 */
export function mapRowToCategory(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  return createCategory({
    id: row.id,
    name: typeof row.name === 'string' ? row.name : String(row.name || ''),
    is_default: Boolean(row.is_default),
  });
}

/**
 * Resolves the database instance to use (provided handle or singleton).
 *
 * @param {object} [db] - Optional SQLite database handle
 * @returns {object} Open SQLite database instance
 */
function resolveDb(db) {
  if (db) {
    return db;
  }
  return SqlCipherClient.getDatabase();
}

/**
 * Retrieves all categories ordered by ID ascending.
 *
 * @param {object} [db] - Optional SQLite database handle for dependency injection
 * @returns {Promise<Array<import('../../domain/models/schemas').Category>>}
 */
export async function getAll(db = null) {
  const database = resolveDb(db);
  const rows = await database.getAllAsync(
    'SELECT id, name, is_default FROM categories ORDER BY id ASC;'
  );
  return (rows || []).map(mapRowToCategory).filter(Boolean);
}

/**
 * Retrieves a single category by its primary key ID using a parameterized query.
 *
 * @param {string|number} id - Category ID
 * @param {object} [db] - Optional SQLite database handle for dependency injection
 * @returns {Promise<import('../../domain/models/schemas').Category|null>}
 */
export async function getById(id, db = null) {
  if (id === null || id === undefined) {
    return null;
  }
  const database = resolveDb(db);
  const row = await database.getFirstAsync(
    'SELECT id, name, is_default FROM categories WHERE id = ?;',
    [id]
  );
  return mapRowToCategory(row);
}

/**
 * CategoryRepository class for object-oriented or dependency-injected consumers.
 */
export class CategoryRepository {
  /**
   * @param {object} [db] - Optional SQLite database handle
   */
  constructor(db = null) {
    this.db = db;
  }

  /**
   * Retrieves all categories.
   *
   * @returns {Promise<Array<import('../../domain/models/schemas').Category>>}
   */
  async getAll() {
    return getAll(this.db);
  }

  /**
   * Retrieves a category by ID.
   *
   * @param {string|number} id
   * @returns {Promise<import('../../domain/models/schemas').Category|null>}
   */
  async getById(id) {
    return getById(id, this.db);
  }
}

export default {
  getAll,
  getById,
  mapRowToCategory,
  CategoryRepository,
};

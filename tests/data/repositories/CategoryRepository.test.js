/**
 * @file CategoryRepository.test.js
 * @description Unit tests for CategoryRepository verifying parameterized SQL queries and domain normalization.
 * @standards SRS Alignment: FR-18, FR-30, Section 6.1
 */

import {
  getAll,
  getById,
  mapRowToCategory,
  CategoryRepository,
} from '../../../src/data/repositories/CategoryRepository';
import * as SqlCipherClient from '../../../src/data/database/SqlCipherClient';

describe('CategoryRepository (FR-18, FR-30)', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
      execAsync: jest.fn().mockResolvedValue(),
    };
  });

  describe('mapRowToCategory', () => {
    it('maps valid database row to frozen Category domain model', () => {
      const row = { id: 1, name: 'Food', is_default: 1 };
      const category = mapRowToCategory(row);

      expect(category).toEqual({
        id: 1,
        name: 'Food',
        is_default: true,
      });
      expect(Object.isFrozen(category)).toBe(true);
    });

    it('returns null for null, undefined, or non-object rows', () => {
      expect(mapRowToCategory(null)).toBeNull();
      expect(mapRowToCategory(undefined)).toBeNull();
      expect(mapRowToCategory('string')).toBeNull();
    });

    it('correctly maps is_default = 0 to false', () => {
      const category = mapRowToCategory({ id: 99, name: 'Custom', is_default: 0 });
      expect(category.is_default).toBe(false);
    });
  });

  describe('getAll', () => {
    it('retrieves all categories ordered by ID using parameterized query', async () => {
      const rows = [
        { id: 1, name: 'Food', is_default: 1 },
        { id: 2, name: 'Transportation', is_default: 1 },
      ];
      mockDb.getAllAsync.mockResolvedValueOnce(rows);

      const result = await getAll(mockDb);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT id, name, is_default FROM categories ORDER BY id ASC;'
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Food');
      expect(result[0].is_default).toBe(true);
      expect(result[1].name).toBe('Transportation');
    });

    it('returns empty array when database returns empty or null', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      const result = await getAll(mockDb);
      expect(result).toEqual([]);

      mockDb.getAllAsync.mockResolvedValueOnce(null);
      const resultNull = await getAll(mockDb);
      expect(resultNull).toEqual([]);
    });

    it('falls back to SqlCipherClient.getDatabase() when db is omitted', async () => {
      const spy = jest.spyOn(SqlCipherClient, 'getDatabase').mockReturnValueOnce(mockDb);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      await getAll();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('retrieves category by ID with parameterized placeholder (?)', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 3,
        name: 'Shopping',
        is_default: 1,
      });

      const result = await getById(3, mockDb);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT id, name, is_default FROM categories WHERE id = ?;',
        [3]
      );
      expect(result).toEqual({
        id: 3,
        name: 'Shopping',
        is_default: true,
      });
    });

    it('returns null if category is not found', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getById(999, mockDb);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT id, name, is_default FROM categories WHERE id = ?;',
        [999]
      );
      expect(result).toBeNull();
    });

    it('returns null without querying if id is null or undefined', async () => {
      const resultNull = await getById(null, mockDb);
      expect(resultNull).toBeNull();
      expect(mockDb.getFirstAsync).not.toHaveBeenCalled();

      const resultUndef = await getById(undefined, mockDb);
      expect(resultUndef).toBeNull();
      expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    });
  });

  describe('CategoryRepository class wrapper', () => {
    it('delegates getAll and getById using injected database handle', async () => {
      const repo = new CategoryRepository(mockDb);

      mockDb.getAllAsync.mockResolvedValueOnce([{ id: 1, name: 'Food', is_default: 1 }]);
      const all = await repo.getAll();
      expect(all).toHaveLength(1);

      mockDb.getFirstAsync.mockResolvedValueOnce({ id: 1, name: 'Food', is_default: 1 });
      const one = await repo.getById(1);
      expect(one.name).toBe('Food');
    });
  });
});

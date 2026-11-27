/**
 * @file ExpenseRepository.test.js
 * @description Unit tests for ExpenseRepository verifying parameterized CRUD and atomic transaction rollbacks.
 * @standards SRS Alignment: FR-01, FR-03, FR-04, FR-05, FR-30, Section 6.1
 */

import {
  create,
  getById,
  getAllChronological,
  getByDateRange,
  update,
  deleteExpense,
  withTransaction,
  ExpenseRepository,
} from '../../../src/data/repositories/ExpenseRepository';

describe('ExpenseRepository (FR-01, FR-03, FR-04, FR-05, FR-30)', () => {
  let mockDb;

  const validExpenseInput = {
    id: 'exp-1234-uuid',
    amount_minor: 2550,
    currency_code: 'USD',
    expense_date: '2026-11-27',
    description: 'Groceries at Walmart',
    category_id: 1,
    created_at: '2026-11-27T12:00:00.000Z',
    updated_at: '2026-11-27T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn().mockResolvedValue([]),
      execAsync: jest.fn().mockResolvedValue(),
    };
  });

  describe('withTransaction (FR-30 Safe writes)', () => {
    it('executes BEGIN TRANSACTION, executes operation, and commits on success', async () => {
      const op = jest.fn().mockResolvedValueOnce('operation-result');

      const result = await withTransaction(mockDb, op);

      expect(mockDb.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(op).toHaveBeenCalled();
      expect(mockDb.execAsync).toHaveBeenNthCalledWith(2, 'COMMIT;');
      expect(result).toBe('operation-result');
    });

    it('rolls back completely and rethrows error if operation fails (FR-30)', async () => {
      const op = jest.fn().mockRejectedValueOnce(new Error('Disk write error'));

      await expect(withTransaction(mockDb, op)).rejects.toThrow('Disk write error');

      expect(mockDb.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockDb.execAsync).toHaveBeenNthCalledWith(2, 'ROLLBACK;');
    });
  });

  describe('create (FR-01, FR-30)', () => {
    it('inserts expense using parameterized query inside atomic transaction', async () => {
      const created = await create(validExpenseInput, mockDb);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION;');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO expenses'),
        [
          'exp-1234-uuid',
          2550,
          'USD',
          '2026-11-27',
          'Groceries at Walmart',
          1,
          '2026-11-27T12:00:00.000Z',
          '2026-11-27T12:00:00.000Z',
        ]
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');

      expect(created.id).toBe('exp-1234-uuid');
      expect(created.amount_minor).toBe(2550);
      expect(created.currency_code).toBe('USD');
      expect(Object.isFrozen(created)).toBe(true);
    });

    it('rolls back transaction if insert fails', async () => {
      mockDb.runAsync.mockRejectedValueOnce(new Error('UNIQUE constraint failed: expenses.id'));

      await expect(create(validExpenseInput, mockDb)).rejects.toThrow(
        'UNIQUE constraint failed: expenses.id'
      );

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    });

    it('rejects invalid expense input before running SQL', async () => {
      await expect(create({ amount_minor: -100 }, mockDb)).rejects.toThrow();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('retrieves single expense using parameterized query (?)', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'exp-1234-uuid',
        amount_minor: 2550,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        description: 'Groceries at Walmart',
        category_id: 1,
        created_at: '2026-11-27T12:00:00.000Z',
        updated_at: '2026-11-27T12:00:00.000Z',
      });

      const expense = await getById('exp-1234-uuid', mockDb);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, amount_minor'),
        ['exp-1234-uuid']
      );
      expect(expense.id).toBe('exp-1234-uuid');
      expect(expense.amount_minor).toBe(2550);
    });

    it('returns null if expense is not found', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getById('non-existent', mockDb);
      expect(result).toBeNull();
    });

    it('returns null if id is null or undefined without querying', async () => {
      const resNull = await getById(null, mockDb);
      expect(resNull).toBeNull();
      expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    });
  });

  describe('getAllChronological (FR-03)', () => {
    it('retrieves expenses with parameterized LIMIT and OFFSET ordered chronologically', async () => {
      const rows = [
        {
          id: 'exp-1',
          amount_minor: 1000,
          currency_code: 'USD',
          expense_date: '2026-11-27',
          description: 'Lunch',
          category_id: 1,
          created_at: '2026-11-27T13:00:00.000Z',
          updated_at: '2026-11-27T13:00:00.000Z',
        },
      ];
      mockDb.getAllAsync.mockResolvedValueOnce(rows);

      const result = await getAllChronological(25, 10, mockDb);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY expense_date DESC, created_at DESC'),
        [25, 10]
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('exp-1');
    });

    it('uses default limit=50 and offset=0 when omitted or invalid', async () => {
      await getAllChronological(undefined, undefined, mockDb);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        [50, 0]
      );
    });
  });

  describe('getByDateRange', () => {
    it('executes parameterized date range query', async () => {
      const rows = [
        {
          id: 'exp-range',
          amount_minor: 500,
          currency_code: 'NIO',
          expense_date: '2026-11-15',
          description: 'Taxi',
          category_id: 2,
          created_at: '2026-11-15T10:00:00.000Z',
          updated_at: '2026-11-15T10:00:00.000Z',
        },
      ];
      mockDb.getAllAsync.mockResolvedValueOnce(rows);

      const result = await getByDateRange('2026-11-01', '2026-11-30', mockDb);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE expense_date >= ? AND expense_date <= ?'),
        ['2026-11-01', '2026-11-30']
      );
      expect(result).toHaveLength(1);
      expect(result[0].amount_minor).toBe(500);
      expect(result[0].currency_code).toBe('NIO');
    });

    it('rejects invalid date parameters or inverted ranges', async () => {
      await expect(getByDateRange('invalid-date', '2026-11-30', mockDb)).rejects.toThrow();
      await expect(getByDateRange('2026-11-30', '2026-11-01', mockDb)).rejects.toThrow(
        'cannot be after endDate'
      );
    });
  });

  describe('update (FR-04, FR-30)', () => {
    it('updates expense using parameterized query inside atomic transaction', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ id: 'exp-1234-uuid', created_at: '2026-11-27T10:00:00.000Z' });

      const updated = await update(
        {
          ...validExpenseInput,
          amount_minor: 3500,
          description: 'Updated Description',
        },
        mockDb
      );

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION;');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE expenses'),
        expect.arrayContaining([3500, 'Updated Description', 'exp-1234-uuid'])
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');
      expect(updated.amount_minor).toBe(3500);
      expect(updated.description).toBe('Updated Description');
    });

    it('throws error and rolls back if target expense is not found', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      await expect(
        update({ ...validExpenseInput, id: 'missing-id' }, mockDb)
      ).rejects.toThrow("Expense with ID 'missing-id' not found.");

      expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    });
  });

  describe('delete (FR-05, FR-30)', () => {
    it('deletes expense by ID inside atomic transaction', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ id: 'exp-1234-uuid' });

      const result = await deleteExpense('exp-1234-uuid', mockDb);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION;');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM expenses WHERE id = ?;',
        ['exp-1234-uuid']
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');
      expect(result).toBe(true);
    });

    it('throws error and rolls back if expense to delete does not exist', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      await expect(deleteExpense('missing-id', mockDb)).rejects.toThrow(
        "Expense with ID 'missing-id' not found."
      );

      expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    });

    it('rejects null or empty ID without executing SQL', async () => {
      await expect(deleteExpense('', mockDb)).rejects.toThrow();
      await expect(deleteExpense(null, mockDb)).rejects.toThrow();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('ExpenseRepository class wrapper', () => {
    it('delegates CRUD methods to module functions with injected database', async () => {
      const repo = new ExpenseRepository(mockDb);

      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'exp-class',
        amount_minor: 100,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        description: '',
        category_id: null,
        created_at: '2026-11-27',
        updated_at: '2026-11-27',
      });

      const exp = await repo.getById('exp-class');
      expect(exp.id).toBe('exp-class');
    });
  });
});

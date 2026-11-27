/**
 * @file ExpenseService.test.js
 * @description Unit tests for ExpenseService verifying business rules, validations, and destructive delete confirmation.
 * @standards SRS Alignment: FR-01, FR-02, FR-03, FR-04, FR-05, Section 6.2
 */

import { ExpenseService, generateId } from '../../../src/domain/services/ExpenseService';

describe('ExpenseService (FR-01, FR-02, FR-03, FR-04, FR-05)', () => {
  let mockExpenseRepo;
  let mockCategoryRepo;
  let service;

  const sampleExpense = {
    id: 'exp-uuid-1',
    amount_minor: 1500,
    currency_code: 'USD',
    expense_date: '2026-11-27',
    description: 'Coffee',
    category_id: 1,
    created_at: '2026-11-27T10:00:00.000Z',
    updated_at: '2026-11-27T10:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockExpenseRepo = {
      create: jest.fn().mockImplementation((exp) => Promise.resolve(exp)),
      getById: jest.fn(),
      getAllChronological: jest.fn().mockResolvedValue([]),
      getByDateRange: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation((exp) => Promise.resolve(exp)),
      delete: jest.fn().mockResolvedValue(true),
    };

    mockCategoryRepo = {
      getById: jest.fn().mockResolvedValue({ id: 1, name: 'Food', is_default: true }),
      getAll: jest.fn().mockResolvedValue([]),
    };

    service = new ExpenseService(mockExpenseRepo, mockCategoryRepo);
  });

  describe('generateId', () => {
    it('generates a valid UUID string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe('createExpense (FR-01, FR-02)', () => {
    it('creates expense with valid input and verifies category existence', async () => {
      const input = {
        amount_minor: 2500,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        description: 'Dinner',
        category_id: 1,
      };

      const result = await service.createExpense(input);

      expect(mockCategoryRepo.getById).toHaveBeenCalledWith(1);
      expect(mockExpenseRepo.create).toHaveBeenCalled();
      expect(result.amount_minor).toBe(2500);
      expect(result.currency_code).toBe('USD');
      expect(result.description).toBe('Dinner');
      expect(result.id).toBeDefined();
    });

    it('rejects floating-point or non-integer amounts (FR-02, Constitutional Mandate)', async () => {
      await expect(
        service.createExpense({
          amount_minor: 15.5,
          currency_code: 'USD',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow('Amount must be a non-negative integer minor unit');

      await expect(
        service.createExpense({
          amount_minor: '1500',
          currency_code: 'USD',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow();
    });

    it('rejects non-positive, zero, or out-of-range amounts (FR-02)', async () => {
      await expect(
        service.createExpense({
          amount_minor: 0,
          currency_code: 'USD',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow('between 1 and 999999999');

      await expect(
        service.createExpense({
          amount_minor: -500,
          currency_code: 'USD',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow();

      await expect(
        service.createExpense({
          amount_minor: 1000000000,
          currency_code: 'USD',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow('between 1 and 999999999');
    });

    it('rejects unsupported currencies', async () => {
      await expect(
        service.createExpense({
          amount_minor: 1000,
          currency_code: 'EUR',
          expense_date: '2026-11-27',
        })
      ).rejects.toThrow('Invalid currency_code: EUR');
    });

    it('rejects invalid or malformed dates', async () => {
      await expect(
        service.createExpense({
          amount_minor: 1000,
          currency_code: 'NIO',
          expense_date: 'not-a-date',
        })
      ).rejects.toThrow('expense_date must be a valid ISO 8601 date');
    });

    it('rejects nonexistent category IDs', async () => {
      mockCategoryRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.createExpense({
          amount_minor: 1000,
          currency_code: 'USD',
          expense_date: '2026-11-27',
          category_id: 999,
        })
      ).rejects.toThrow("Category with ID '999' does not exist.");
    });
  });

  describe('getExpenseById', () => {
    it('returns expense by ID', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(sampleExpense);

      const result = await service.getExpenseById('exp-uuid-1');

      expect(mockExpenseRepo.getById).toHaveBeenCalledWith('exp-uuid-1');
      expect(result).toEqual(sampleExpense);
    });

    it('throws error if ID is empty or missing', async () => {
      await expect(service.getExpenseById('')).rejects.toThrow('A valid expense ID is required.');
      await expect(service.getExpenseById(null)).rejects.toThrow('A valid expense ID is required.');
    });
  });

  describe('getAllExpenses (FR-03)', () => {
    it('delegates to repository with sanitized limit and offset', async () => {
      mockExpenseRepo.getAllChronological.mockResolvedValueOnce([sampleExpense]);

      const result = await service.getAllExpenses(20, 5);

      expect(mockExpenseRepo.getAllChronological).toHaveBeenCalledWith(20, 5);
      expect(result).toHaveLength(1);
    });
  });

  describe('getExpensesByDateRange', () => {
    it('validates dates and returns expenses within range', async () => {
      mockExpenseRepo.getByDateRange.mockResolvedValueOnce([sampleExpense]);

      const result = await service.getExpensesByDateRange('2026-11-01', '2026-11-30');

      expect(mockExpenseRepo.getByDateRange).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
      expect(result).toHaveLength(1);
    });

    it('rejects invalid dates or inverted ranges', async () => {
      await expect(service.getExpensesByDateRange('bad-date', '2026-11-30')).rejects.toThrow();
      await expect(service.getExpensesByDateRange('2026-11-30', '2026-11-01')).rejects.toThrow(
        'cannot be after endDate'
      );
    });
  });

  describe('updateExpense (FR-04)', () => {
    it('updates expense after validating existence and attributes', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(sampleExpense);

      const updated = await service.updateExpense({
        id: 'exp-uuid-1',
        amount_minor: 1800,
        description: 'Specialty Coffee',
      });

      expect(mockExpenseRepo.update).toHaveBeenCalled();
      expect(updated.amount_minor).toBe(1800);
      expect(updated.description).toBe('Specialty Coffee');
    });

    it('throws error if target expense to update is not found', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.updateExpense({ id: 'missing-id', amount_minor: 1000 })
      ).rejects.toThrow("Expense with ID 'missing-id' not found.");
    });

    it('validates updated category exists', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(sampleExpense);
      mockCategoryRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.updateExpense({ id: 'exp-uuid-1', category_id: 888 })
      ).rejects.toThrow("Category with ID '888' does not exist.");
    });
  });

  describe('deleteExpense with Explicit ID Confirmation (FR-05 & Acceptance Criteria)', () => {
    it('successfully deletes expense when confirmation ID strictly matches target ID', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(sampleExpense);

      const result = await service.deleteExpense('exp-uuid-1', 'exp-uuid-1');

      expect(mockExpenseRepo.getById).toHaveBeenCalledWith('exp-uuid-1');
      expect(mockExpenseRepo.delete).toHaveBeenCalledWith('exp-uuid-1');
      expect(result).toBe(true);
    });

    it('rejects deletion when confirmation ID is missing or null', async () => {
      await expect(service.deleteExpense('exp-uuid-1', null)).rejects.toThrow(
        'Destructive delete confirmation failed'
      );
      await expect(service.deleteExpense('exp-uuid-1', undefined)).rejects.toThrow(
        'Destructive delete confirmation failed'
      );
      expect(mockExpenseRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects deletion when confirmation ID does not match target ID', async () => {
      await expect(service.deleteExpense('exp-uuid-1', 'exp-uuid-WRONG')).rejects.toThrow(
        "confirmationId 'exp-uuid-WRONG' does not match target expense ID 'exp-uuid-1'"
      );
      expect(mockExpenseRepo.delete).not.toHaveBeenCalled();
    });

    it('throws error if expense to delete does not exist', async () => {
      mockExpenseRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.deleteExpense('exp-nonexistent', 'exp-nonexistent')
      ).rejects.toThrow("Expense with ID 'exp-nonexistent' not found.");
      expect(mockExpenseRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects invalid or blank target ID', async () => {
      await expect(service.deleteExpense('', '')).rejects.toThrow(
        'A valid expense ID is required for deletion.'
      );
    });
  });
});

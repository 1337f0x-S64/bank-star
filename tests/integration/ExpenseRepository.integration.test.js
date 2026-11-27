/**
 * @file ExpenseRepository.integration.test.js
 * @description Integration tests verifying creating, reading, updating, deleting expenses and atomic rollback handlers.
 * @standards SRS Alignment: FR-01, FR-03, FR-04, FR-05, FR-30, Section 6.1, Section 6.2
 */

import {
  withTransaction,
  ExpenseRepository,
} from '../../src/data/repositories/ExpenseRepository';
import {
  CategoryRepository,
} from '../../src/data/repositories/CategoryRepository';
import { ExpenseService } from '../../src/domain/services/ExpenseService';

/**
 * Creates an in-memory transactional database engine that behaves like SQLite
 * with table stores, parameterized query execution, constraints, and atomic transactions.
 */
function createInMemoryDatabase() {
  let categories = [
    { id: 1, name: 'Food', is_default: 1 },
    { id: 2, name: 'Transportation', is_default: 1 },
    { id: 3, name: 'Shopping', is_default: 1 },
    { id: 4, name: 'Bills', is_default: 1 },
    { id: 5, name: 'Health', is_default: 1 },
    { id: 6, name: 'Entertainment', is_default: 1 },
    { id: 7, name: 'Other', is_default: 1 },
  ];
  let expenses = [];
  let transactionSnapshot = null;

  return {
    async execAsync(sql) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('BEGIN TRANSACTION')) {
        transactionSnapshot = {
          categories: JSON.parse(JSON.stringify(categories)),
          expenses: JSON.parse(JSON.stringify(expenses)),
        };
      } else if (trimmed.startsWith('COMMIT')) {
        transactionSnapshot = null;
      } else if (trimmed.startsWith('ROLLBACK')) {
        if (transactionSnapshot) {
          categories = transactionSnapshot.categories;
          expenses = transactionSnapshot.expenses;
          transactionSnapshot = null;
        }
      }
    },

    async runAsync(sql, params = []) {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      if (cleanSql.startsWith('INSERT INTO expenses')) {
        const [id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at] = params;

        // Check primary key uniqueness
        if (expenses.some((e) => e.id === id)) {
          throw new Error(`UNIQUE constraint failed: expenses.id = ${id}`);
        }

        // Check foreign key constraint
        if (category_id !== null && category_id !== undefined) {
          if (!categories.some((c) => c.id === category_id)) {
            throw new Error(`FOREIGN KEY constraint failed: category_id = ${category_id}`);
          }
        }

        expenses.push({
          id,
          amount_minor,
          currency_code,
          expense_date,
          description: description || '',
          category_id,
          created_at,
          updated_at,
        });

        return { changes: 1 };
      }

      if (cleanSql.startsWith('UPDATE expenses')) {
        if (cleanSql.includes('SET category_id = ? WHERE id = ?')) {
          const [catId, expId] = params;
          if (catId !== null && catId !== undefined && !categories.some((c) => c.id === catId)) {
            throw new Error(`FOREIGN KEY constraint failed: category_id = ${catId}`);
          }
          const index = expenses.findIndex((e) => e.id === expId);
          if (index !== -1) {
            expenses[index].category_id = catId;
          }
          return { changes: index !== -1 ? 1 : 0 };
        }

        const [amount_minor, currency_code, expense_date, description, category_id, updated_at, id] = params;
        const index = expenses.findIndex((e) => e.id === id);

        if (index === -1) {
          return { changes: 0 };
        }

        if (category_id !== null && category_id !== undefined) {
          if (!categories.some((c) => c.id === category_id)) {
            throw new Error(`FOREIGN KEY constraint failed: category_id = ${category_id}`);
          }
        }

        expenses[index] = {
          ...expenses[index],
          amount_minor,
          currency_code,
          expense_date,
          description: description || '',
          category_id,
          updated_at,
        };

        return { changes: 1 };
      }

      if (cleanSql.startsWith('DELETE FROM expenses')) {
        const [id] = params;
        const initialLength = expenses.length;
        expenses = expenses.filter((e) => e.id !== id);
        return { changes: initialLength - expenses.length };
      }

      return { changes: 0 };
    },

    async getFirstAsync(sql, params = []) {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      if (cleanSql.includes('FROM categories WHERE id = ?')) {
        const [id] = params;
        return categories.find((c) => String(c.id) === String(id)) || null;
      }

      if (cleanSql.includes('FROM expenses WHERE id = ?')) {
        const [id] = params;
        const row = expenses.find((e) => String(e.id) === String(id));
        return row ? { ...row } : null;
      }

      return null;
    },

    async getAllAsync(sql, params = []) {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      if (cleanSql.includes('FROM categories')) {
        return [...categories].sort((a, b) => a.id - b.id);
      }

      if (cleanSql.includes('FROM expenses')) {
        let results = [...expenses];

        // Date range filter
        if (cleanSql.includes('expense_date >= ? AND expense_date <= ?')) {
          const [startDate, endDate] = params;
          results = results.filter(
            (e) => e.expense_date >= startDate && e.expense_date <= endDate
          );
          results.sort((a, b) => {
            if (a.expense_date !== b.expense_date) {
              return a.expense_date.localeCompare(b.expense_date);
            }
            return (a.created_at || '').localeCompare(b.created_at || '');
          });
          return results.map((r) => ({ ...r }));
        }

        // Chronological order (newest first)
        results.sort((a, b) => {
          if (a.expense_date !== b.expense_date) {
            return b.expense_date.localeCompare(a.expense_date);
          }
          return (b.created_at || '').localeCompare(a.created_at || '');
        });

        if (cleanSql.includes('LIMIT ? OFFSET ?')) {
          const [limit, offset] = params;
          results = results.slice(offset, offset + limit);
        }

        return results.map((r) => ({ ...r }));
      }

      return [];
    },

    _getExpensesCount() {
      return expenses.length;
    },
  };
}

describe('Expense & Category Integration Tests (Acceptance Criteria)', () => {
  let db;
  let expenseRepo;
  let categoryRepo;
  let expenseService;

  beforeEach(() => {
    db = createInMemoryDatabase();
    expenseRepo = new ExpenseRepository(db);
    categoryRepo = new CategoryRepository(db);
    expenseService = new ExpenseService(expenseRepo, categoryRepo);
  });

  describe('Integration: Category Retrieval', () => {
    it('retrieves seeded categories and looks up specific category by ID', async () => {
      const all = await categoryRepo.getAll();
      expect(all.length).toBe(7);
      expect(all[0].name).toBe('Food');
      expect(all[0].is_default).toBe(true);

      const food = await categoryRepo.getById(1);
      expect(food).not.toBeNull();
      expect(food.name).toBe('Food');

      const nonExistent = await categoryRepo.getById(999);
      expect(nonExistent).toBeNull();
    });
  });

  describe('Integration: Complete Expense Lifecycle (Create, Read, Update, Delete)', () => {
    it('verifies creating, reading, updating, and deleting an expense end-to-end', async () => {
      // 1. CREATE
      const created = await expenseService.createExpense({
        amount_minor: 4500,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        description: 'Team Lunch',
        category_id: 1,
      });

      expect(created.id).toBeDefined();
      expect(created.amount_minor).toBe(4500);
      expect(created.currency_code).toBe('USD');
      expect(created.description).toBe('Team Lunch');
      expect(created.category_id).toBe(1);

      // 2. READ by ID
      const fetched = await expenseService.getExpenseById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched.id).toBe(created.id);
      expect(fetched.amount_minor).toBe(4500);

      // READ chronological list
      const list = await expenseService.getAllExpenses();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);

      // 3. UPDATE
      const updated = await expenseService.updateExpense({
        id: created.id,
        amount_minor: 5200,
        description: 'Team Lunch & Coffee',
        category_id: 1,
      });

      expect(updated.amount_minor).toBe(5200);
      expect(updated.description).toBe('Team Lunch & Coffee');

      // Verify update persisted
      const fetchedUpdated = await expenseService.getExpenseById(created.id);
      expect(fetchedUpdated.amount_minor).toBe(5200);
      expect(fetchedUpdated.description).toBe('Team Lunch & Coffee');

      // 4. DESTRUCTIVE DELETE WITH EXPLICIT CONFIRMATION
      // Fails if confirmation ID does not match
      await expect(
        expenseService.deleteExpense(created.id, 'wrong-id')
      ).rejects.toThrow('Destructive delete confirmation failed');

      // Still exists
      expect(await expenseService.getExpenseById(created.id)).not.toBeNull();

      // Succeeds when confirmation ID matches
      const deleteResult = await expenseService.deleteExpense(created.id, created.id);
      expect(deleteResult).toBe(true);

      // Verify expense no longer exists in database
      const fetchedAfterDelete = await expenseService.getExpenseById(created.id);
      expect(fetchedAfterDelete).toBeNull();
      expect(await expenseService.getAllExpenses()).toHaveLength(0);
    });
  });

  describe('Integration: Chronological Ordering & Date Range Filtering', () => {
    it('orders multiple expenses chronologically (newest first) and filters by range', async () => {
      await expenseService.createExpense({
        amount_minor: 1000,
        currency_code: 'USD',
        expense_date: '2026-11-10',
        description: 'Early Nov',
      });
      await expenseService.createExpense({
        amount_minor: 2000,
        currency_code: 'USD',
        expense_date: '2026-11-20',
        description: 'Mid Nov',
      });
      await expenseService.createExpense({
        amount_minor: 3000,
        currency_code: 'USD',
        expense_date: '2026-11-25',
        description: 'Late Nov',
      });

      // Chronological: newest first
      const all = await expenseService.getAllExpenses();
      expect(all).toHaveLength(3);
      expect(all[0].description).toBe('Late Nov');
      expect(all[1].description).toBe('Mid Nov');
      expect(all[2].description).toBe('Early Nov');

      // Date range filtering
      const midRange = await expenseService.getExpensesByDateRange('2026-11-15', '2026-11-22');
      expect(midRange).toHaveLength(1);
      expect(midRange[0].description).toBe('Mid Nov');
    });
  });

  describe('Integration: Atomic Transactions & Rollback Handlers (FR-30)', () => {
    it('rolls back database state completely when an operation fails inside transaction', async () => {
      // 1. Add valid initial expense
      const initial = await expenseService.createExpense({
        amount_minor: 1500,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        description: 'Safe expense',
      });
      expect(db._getExpensesCount()).toBe(1);

      // 2. Attempt transactional write that fails midway (e.g. duplicate PK)
      const duplicateWrite = async () => {
        await withTransaction(db, async () => {
          await db.runAsync(
            'INSERT INTO expenses (id, amount_minor, currency_code, expense_date, description, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
            [initial.id, 9999, 'USD', '2026-11-27', 'Duplicate', null, '2026-11-27', '2026-11-27']
          );
        });
      };

      await expect(duplicateWrite()).rejects.toThrow('UNIQUE constraint failed');

      // Verify that database remained in consistent state with only initial expense
      expect(db._getExpensesCount()).toBe(1);
      const retrieved = await expenseRepo.getById(initial.id);
      expect(retrieved.amount_minor).toBe(1500);
    });

    it('rolls back update if foreign key constraint is violated', async () => {
      const exp = await expenseService.createExpense({
        amount_minor: 1000,
        currency_code: 'USD',
        expense_date: '2026-11-27',
        category_id: 1,
      });

      // Attempt manual update with non-existent foreign key
      await expect(
        withTransaction(db, async () => {
          await db.runAsync(
            'UPDATE expenses SET category_id = ? WHERE id = ?;',
            [999, exp.id]
          );
        })
      ).rejects.toThrow('FOREIGN KEY constraint failed');

      // Verify original category is intact
      const intact = await expenseRepo.getById(exp.id);
      expect(intact.category_id).toBe(1);
    });
  });
});

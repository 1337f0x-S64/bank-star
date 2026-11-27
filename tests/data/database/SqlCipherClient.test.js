/**
 * @file SqlCipherClient.test.js
 * @description Unit & security verification tests for SqlCipherClient.
 * @standards SRS Alignment: FR-26, FR-27, FR-28, NFR-01, NFR-02, TC-08
 */

import {
  initializeDatabase,
  getDatabase,
  getCipherVersion,
  isInitialized,
  closeDatabase,
  extractCipherVersion,
} from '../../../src/data/database/SqlCipherClient';

describe('SqlCipherClient (FR-26, FR-28, TC-08)', () => {
  let mockDb;
  let mockKeyManager;
  let consoleLogSpy;

  beforeEach(async () => {
    await closeDatabase();
    jest.clearAllMocks();

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockDb = {
      getFirstAsync: jest.fn(),
      execAsync: jest.fn().mockResolvedValue(),
      closeAsync: jest.fn().mockResolvedValue(),
    };

    mockKeyManager = {
      getOrCreateDatabaseKey: jest.fn().mockResolvedValue('a'.repeat(64)),
    };
  });

  afterEach(async () => {
    await closeDatabase();
    consoleLogSpy.mockRestore();
  });

  describe('extractCipherVersion', () => {
    it('extracts version from object with cipher_version property', () => {
      expect(extractCipherVersion({ cipher_version: '4.5.7 community' })).toBe('4.5.7 community');
      expect(extractCipherVersion({ cipher_version: '4.6.1' })).toBe('4.6.1');
    });

    it('extracts version from string', () => {
      expect(extractCipherVersion('4.5.7')).toBe('4.5.7');
    });

    it('returns null for empty, null, or undefined results', () => {
      expect(extractCipherVersion(null)).toBeNull();
      expect(extractCipherVersion(undefined)).toBeNull();
      expect(extractCipherVersion('')).toBeNull();
      expect(extractCipherVersion('   ')).toBeNull();
      expect(extractCipherVersion({})).toBeNull();
      expect(extractCipherVersion({ cipher_version: '' })).toBeNull();
    });
  });

  describe('Successful Initialization & Key Application', () => {
    it('retrieves key from KeyManager, checks PRAGMA cipher_version, and applies PRAGMA key', async () => {
      const validKey = 'e'.repeat(64);
      mockKeyManager.getOrCreateDatabaseKey.mockResolvedValueOnce(validKey);

      mockDb.getFirstAsync
        .mockResolvedValueOnce({ cipher_version: '4.5.7' }) // PRAGMA cipher_version
        .mockResolvedValueOnce({ count: 0 }); // SELECT count(*) FROM sqlite_master

      const openFn = jest.fn().mockResolvedValue(mockDb);

      const db = await initializeDatabase({
        databaseName: 'custom_bank.db',
        keyManager: mockKeyManager,
        openDatabaseAsync: openFn,
      });

      expect(mockKeyManager.getOrCreateDatabaseKey).toHaveBeenCalled();
      expect(openFn).toHaveBeenCalledWith('custom_bank.db');

      // 1. Verify PRAGMA cipher_version was checked
      expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(1, 'PRAGMA cipher_version;');

      // 2. Verify PRAGMA key was applied
      expect(mockDb.execAsync).toHaveBeenCalledWith(`PRAGMA key = '${validKey}';`);

      // 3. Verify probe query was executed
      expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(2, 'SELECT count(*) FROM sqlite_master;');

      // 4. Verify runtime console confirmation (contains cipher_version, does not leak key)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('PRAGMA cipher_version: 4.5.7'));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining(validKey));

      expect(db).toBe(mockDb);
      expect(isInitialized()).toBe(true);
      expect(getCipherVersion()).toBe('4.5.7');
      expect(getDatabase()).toBe(mockDb);
    });
  });

  describe('Test Case TC-08: Security & Fail-Closed Mandates', () => {
    it('TC-08: aborts immediately and fails closed if PRAGMA cipher_version returns null (missing SQLCipher)', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null); // No SQLCipher extension detected
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): SQLCipher is missing, inactive, or unverified/);

      // Verify fail-closed security: PRAGMA key was NEVER executed on unverified DB
      expect(mockDb.execAsync).not.toHaveBeenCalled();

      // Verify connection was closed immediately to prevent plaintext usage
      expect(mockDb.closeAsync).toHaveBeenCalled();
      expect(isInitialized()).toBe(false);
    });

    it('TC-08: aborts immediately if PRAGMA cipher_version returns an empty string', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ cipher_version: '   ' });
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): SQLCipher is missing, inactive, or unverified/);

      expect(mockDb.execAsync).not.toHaveBeenCalled();
      expect(mockDb.closeAsync).toHaveBeenCalled();
    });

    it('TC-08: fails closed if PRAGMA cipher_version query execution throws an error', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('Syntax error on cipher pragma'));
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): Failed to execute PRAGMA cipher_version/);

      expect(mockDb.execAsync).not.toHaveBeenCalled();
      expect(mockDb.closeAsync).toHaveBeenCalled();
    });

    it('TC-08: fails closed if KeyManager fails to return a valid key', async () => {
      mockKeyManager.getOrCreateDatabaseKey.mockResolvedValueOnce(null);
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): Database encryption key is missing/);

      expect(openFn).not.toHaveBeenCalled();
      expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    });

    it('TC-08: fails closed and closes connection if PRAGMA key execution fails', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ cipher_version: '4.5.7' });
      mockDb.execAsync.mockRejectedValueOnce(new Error('Error setting pragma key'));
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): Failed to apply PRAGMA key/);

      expect(mockDb.closeAsync).toHaveBeenCalled();
    });

    it('TC-08: fails closed if key authentication fails during database decryption probe', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ cipher_version: '4.5.7' })
        .mockRejectedValueOnce(new Error('file is not a database')); // SQLCipher decryption failure
      const openFn = jest.fn().mockResolvedValue(mockDb);

      await expect(
        initializeDatabase({
          keyManager: mockKeyManager,
          openDatabaseAsync: openFn,
        })
      ).rejects.toThrow(/FATAL \(TC-08\): Database key authentication failed/);

      expect(mockDb.closeAsync).toHaveBeenCalled();
    });
  });

  describe('Connection Lifecycle', () => {
    it('throws DatabaseNotInitializedError when getDatabase is called before initialize', () => {
      expect(() => getDatabase()).toThrow(/DatabaseNotInitializedError/);
    });

    it('closeDatabase cleans up references and resets initialized state', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ cipher_version: '4.5.7' })
        .mockResolvedValueOnce({ count: 0 });

      await initializeDatabase({
        keyManager: mockKeyManager,
        openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
      });

      expect(isInitialized()).toBe(true);

      await closeDatabase();

      expect(mockDb.closeAsync).toHaveBeenCalled();
      expect(isInitialized()).toBe(false);
      expect(getCipherVersion()).toBeNull();
    });
  });

  describe('Schema Migrations Integration', () => {
    it('executes migrateDatabase when runMigrations is true', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ cipher_version: '4.5.7' })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ user_version: 0 }); // for getSchemaVersion

      await initializeDatabase({
        keyManager: mockKeyManager,
        openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
        runMigrations: true,
      });

      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');
    });
  });
});

/**
 * @file SqlCipherClient.js
 * @description Encrypted SQLite database client using SQLCipher and hardware-backed KeyStore.
 * @standards SRS Alignment: FR-26 (Encrypted DB), FR-27 (Key Management), FR-28 (SQLCipher Verification), NFR-01, NFR-02, TC-08
 * @constitutional-mandates
 *   1. Hardware Key Isolation: Retrieve database encryption keys strictly from KeyManager (expo-secure-store).
 *   2. Fail-Closed Security: Abort immediately if PRAGMA cipher_version is null or empty. Plaintext fallback is strictly prohibited.
 *   3. Zero Secrets Leakage: Plaintext keys are never output to console.log, error telemetry, or storage.
 */

import * as SQLite from 'expo-sqlite';
import KeyManager from '../security/KeyManager';

export const DEFAULT_DATABASE_NAME = 'bankstar.db';

let activeDatabase = null;
let activeCipherVersion = null;

/**
 * Validates the retrieved SQLCipher version string.
 *
 * @param {any} versionResult - Result row from PRAGMA cipher_version;
 * @returns {string|null} Sanitized version string or null if absent/invalid
 */
export function extractCipherVersion(versionResult) {
  if (!versionResult) {
    return null;
  }
  if (typeof versionResult === 'string' && versionResult.trim().length > 0) {
    return versionResult.trim();
  }
  if (typeof versionResult === 'object' && versionResult.cipher_version) {
    const v = String(versionResult.cipher_version).trim();
    return v.length > 0 ? v : null;
  }
  return null;
}

/**
 * Initializes and opens the SQLCipher encrypted database.
 * Enforces mandatory fail-closed verification before queries or migrations.
 *
 * @param {object} [options] - Configuration and dependency injection options
 * @param {string} [options.databaseName=DEFAULT_DATABASE_NAME] - Database file name
 * @param {object} [options.keyManager=KeyManager] - Key manager instance
 * @param {Function} [options.openDatabaseAsync=SQLite.openDatabaseAsync] - Database opener
 * @returns {Promise<SQLite.SQLiteDatabase>} Open and verified encrypted database handle
 * @throws {Error} If key retrieval fails, cipher_version is missing/empty, or key authentication fails
 */
export async function initializeDatabase(options = {}) {
  const {
    databaseName = DEFAULT_DATABASE_NAME,
    keyManager = KeyManager,
    openDatabaseAsync = SQLite.openDatabaseAsync,
  } = options;

  // 1. Retrieve 256-bit encryption key from KeyStore
  const key = await keyManager.getOrCreateDatabaseKey();
  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error('FATAL (TC-08): Database encryption key is missing or could not be retrieved from SecureStore.');
  }

  // 2. Open SQLite handle
  let db;
  try {
    db = await openDatabaseAsync(databaseName);
  } catch (error) {
    throw new Error(`FATAL (TC-08): Failed to open database file handle: ${error.message}`);
  }

  // 3. Execute PRAGMA cipher_version to verify SQLCipher compilation
  let rawVersionRow;
  try {
    rawVersionRow = await db.getFirstAsync('PRAGMA cipher_version;');
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw new Error(`FATAL (TC-08): Failed to execute PRAGMA cipher_version: ${error.message}`);
  }

  const cipherVersion = extractCipherVersion(rawVersionRow);

  // 4. Enforce fail-closed check: if cipher version is null or empty, abort immediately
  if (!cipherVersion) {
    await db.closeAsync().catch(() => {});
    throw new Error(
      'FATAL (TC-08): SQLCipher is missing, inactive, or unverified. ' +
      'PRAGMA cipher_version returned null/empty. Plaintext SQLite opening is strictly prohibited.'
    );
  }

  // 5. Apply PRAGMA key = '<key>';
  try {
    await db.execAsync(`PRAGMA key = '${key}';`);
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw new Error(`FATAL (TC-08): Failed to apply PRAGMA key: ${error.message}`);
  }

  // 6. Verify encryption key by executing a fast schema probe
  try {
    await db.getFirstAsync('SELECT count(*) FROM sqlite_master;');
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw new Error(
      `FATAL (TC-08): Database key authentication failed. Database file could not be decrypted: ${error.message}`
    );
  }

  // 7. Log confirmed runtime SQLCipher version without leaking keys
  console.log(`[SqlCipherClient] PRAGMA cipher_version: ${cipherVersion}`);

  activeDatabase = db;
  activeCipherVersion = cipherVersion;

  return db;
}

/**
 * Returns the currently active initialized database handle.
 * Throws if the database has not been initialized.
 *
 * @returns {SQLite.SQLiteDatabase}
 */
export function getDatabase() {
  if (!activeDatabase) {
    throw new Error('DatabaseNotInitializedError: Call SqlCipherClient.initializeDatabase() first.');
  }
  return activeDatabase;
}

/**
 * Returns the active SQLCipher version string.
 *
 * @returns {string|null}
 */
export function getCipherVersion() {
  return activeCipherVersion;
}

/**
 * Checks if the database is currently open and initialized.
 *
 * @returns {boolean}
 */
export function isInitialized() {
  return Boolean(activeDatabase);
}

/**
 * Closes the active database connection and resets client state.
 *
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (activeDatabase) {
    try {
      await activeDatabase.closeAsync();
    } catch {
      // Ignored during shutdown
    } finally {
      activeDatabase = null;
      activeCipherVersion = null;
    }
  }
}

export default {
  initializeDatabase,
  getDatabase,
  getCipherVersion,
  isInitialized,
  closeDatabase,
  extractCipherVersion,
  DEFAULT_DATABASE_NAME,
};

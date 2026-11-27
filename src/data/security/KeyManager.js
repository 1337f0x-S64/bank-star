/**
 * @file KeyManager.js
 * @description Hardware-backed encryption key manager for SQLCipher database.
 * @standards SRS Alignment: FR-27 (Key Management), NFR-02 (Key Protection), TC-08, TC-11
 * @constitutional-mandates
 *   1. Hardware KeyStore Isolation: Store keys exclusively in expo-secure-store (Keychain/Keystore).
 *   2. Cryptographically Secure PRNG: Generate 256-bit keys using native CSPRNG (expo-crypto).
 *   3. Zero Secrets Leakage: Plaintext keys are NEVER hardcoded, logged, or written to plain disk.
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

export const SECURE_STORE_KEY_ALIAS = 'bankstar_sqlcipher_encryption_key_v1';
export const KEY_BYTE_LENGTH = 32; // 256 bits
export const KEY_HEX_LENGTH = 64; // 32 bytes in hexadecimal

/**
 * Platform secure store options ensuring key isolation.
 * On iOS, prevents syncing across devices or iCloud backups.
 */
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * Checks whether the 256-bit database key exists in SecureStore.
 *
 * @returns {Promise<boolean>} True if key exists and has valid 256-bit length
 */
export async function hasDatabaseKey() {
  try {
    const existingKey = await SecureStore.getItemAsync(
      SECURE_STORE_KEY_ALIAS,
      SECURE_STORE_OPTIONS
    );
    return Boolean(
      existingKey &&
      typeof existingKey === 'string' &&
      existingKey.length === KEY_HEX_LENGTH &&
      /^[0-9a-fA-F]{64}$/.test(existingKey)
    );
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure 256-bit (32 bytes) random hex key via expo-crypto.
 *
 * @returns {Promise<string>} 64-character hexadecimal key string
 */
export async function generateCryptographicKey() {
  const randomBytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
  if (!randomBytes || randomBytes.length !== KEY_BYTE_LENGTH) {
    throw new Error('FATAL: Native CSPRNG failed to generate 256-bit entropy.');
  }

  let hexString = '';
  for (let i = 0; i < randomBytes.length; i++) {
    hexString += randomBytes[i].toString(16).padStart(2, '0');
  }

  return hexString;
}

/**
 * Retrieves the 256-bit database encryption key from SecureStore.
 * If absent, generates a new 256-bit random key via expo-crypto,
 * stores it in SecureStore, and returns it.
 *
 * @returns {Promise<string>} The 256-bit hex key
 */
export async function getOrCreateDatabaseKey() {
  try {
    const existingKey = await SecureStore.getItemAsync(
      SECURE_STORE_KEY_ALIAS,
      SECURE_STORE_OPTIONS
    );

    if (
      existingKey &&
      typeof existingKey === 'string' &&
      existingKey.length === KEY_HEX_LENGTH &&
      /^[0-9a-fA-F]{64}$/.test(existingKey)
    ) {
      return existingKey;
    }

    const newKey = await generateCryptographicKey();
    await SecureStore.setItemAsync(
      SECURE_STORE_KEY_ALIAS,
      newKey,
      SECURE_STORE_OPTIONS
    );

    return newKey;
  } catch (error) {
    throw new Error(`KeyManager error: Failed to access or generate database key: ${error.message}`);
  }
}

/**
 * Retrieves existing key without creating a new one.
 * Returns null if key does not exist.
 *
 * @returns {Promise<string|null>}
 */
export async function getDatabaseKey() {
  const existingKey = await SecureStore.getItemAsync(
    SECURE_STORE_KEY_ALIAS,
    SECURE_STORE_OPTIONS
  );
  if (
    existingKey &&
    typeof existingKey === 'string' &&
    existingKey.length === KEY_HEX_LENGTH &&
    /^[0-9a-fA-F]{64}$/.test(existingKey)
  ) {
    return existingKey;
  }
  return null;
}

/**
 * Explicitly purges the encryption key from hardware storage.
 * Intended for test environments, complete data wipes, or reset flows.
 *
 * @returns {Promise<void>}
 */
export async function deleteDatabaseKey() {
  await SecureStore.deleteItemAsync(
    SECURE_STORE_KEY_ALIAS,
    SECURE_STORE_OPTIONS
  );
}

/**
 * Sets a database key directly in SecureStore.
 * Validates 256-bit hex format.
 *
 * @param {string} key - 64-character hex key string
 * @returns {Promise<void>}
 */
export async function setDatabaseKey(key) {
  if (
    !key ||
    typeof key !== 'string' ||
    key.length !== KEY_HEX_LENGTH ||
    !/^[0-9a-fA-F]{64}$/.test(key)
  ) {
    throw new Error('KeyManager error: Invalid key format. Must be a 64-character hex string (256 bits).');
  }
  await SecureStore.setItemAsync(
    SECURE_STORE_KEY_ALIAS,
    key,
    SECURE_STORE_OPTIONS
  );
}

export default {
  hasDatabaseKey,
  generateCryptographicKey,
  getOrCreateDatabaseKey,
  getDatabaseKey,
  deleteDatabaseKey,
  setDatabaseKey,
  SECURE_STORE_KEY_ALIAS,
  KEY_BYTE_LENGTH,
  KEY_HEX_LENGTH,
};

/**
 * @file KeyManager.test.js
 * @description Unit tests for KeyManager hardware-backed encryption key management.
 * @standards SRS Alignment: FR-27, NFR-02, TC-08, TC-11
 */

import {
  generateCryptographicKey,
  hasDatabaseKey,
  getOrCreateDatabaseKey,
  deleteDatabaseKey,
  setDatabaseKey,
  SECURE_STORE_KEY_ALIAS,
  KEY_HEX_LENGTH,
  KEY_BYTE_LENGTH,
} from '../../../src/data/security/KeyManager';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

jest.mock('expo-secure-store');
jest.mock('expo-crypto');

describe('KeyManager (FR-27, NFR-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCryptographicKey', () => {
    it('generates a 256-bit (64-character) hexadecimal key using native CSPRNG', async () => {
      const mockBytes = new Uint8Array(KEY_BYTE_LENGTH);
      for (let i = 0; i < KEY_BYTE_LENGTH; i++) {
        mockBytes[i] = i; // 0x00, 0x01, ..., 0x1f
      }
      Crypto.getRandomBytesAsync.mockResolvedValueOnce(mockBytes);

      const key = await generateCryptographicKey();

      expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(KEY_BYTE_LENGTH);
      expect(key).toHaveLength(KEY_HEX_LENGTH);
      expect(/^[0-9a-fA-F]{64}$/.test(key)).toBe(true);
      expect(key.startsWith('00010203')).toBe(true);
    });

    it('throws fatal error if CSPRNG returns invalid byte count', async () => {
      Crypto.getRandomBytesAsync.mockResolvedValueOnce(new Uint8Array(16)); // only 16 bytes

      await expect(generateCryptographicKey()).rejects.toThrow(
        /Native CSPRNG failed to generate 256-bit entropy/
      );
    });
  });

  describe('hasDatabaseKey', () => {
    it('returns true when valid 64-character hex key exists in SecureStore', async () => {
      const validKey = 'a'.repeat(64);
      SecureStore.getItemAsync.mockResolvedValueOnce(validKey);

      const exists = await hasDatabaseKey();
      expect(exists).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_KEY_ALIAS,
        expect.objectContaining({
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })
      );
    });

    it('returns false when key is absent in SecureStore', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const exists = await hasDatabaseKey();
      expect(exists).toBe(false);
    });

    it('returns false when key in SecureStore has invalid length or format', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('too-short-key');

      const exists = await hasDatabaseKey();
      expect(exists).toBe(false);
    });

    it('handles SecureStore errors safely and returns false', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Hardware Keystore unavailable'));

      const exists = await hasDatabaseKey();
      expect(exists).toBe(false);
    });
  });

  describe('getOrCreateDatabaseKey', () => {
    it('returns existing key without generating a new one if key is present', async () => {
      const existingKey = 'b'.repeat(64);
      SecureStore.getItemAsync.mockResolvedValueOnce(existingKey);

      const key = await getOrCreateDatabaseKey();

      expect(key).toBe(existingKey);
      expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('generates, saves, and returns a new 256-bit key when key is absent', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const mockBytes = new Uint8Array(KEY_BYTE_LENGTH).fill(0xcc);
      Crypto.getRandomBytesAsync.mockResolvedValueOnce(mockBytes);
      SecureStore.setItemAsync.mockResolvedValueOnce();

      const key = await getOrCreateDatabaseKey();

      const expectedKey = 'cc'.repeat(32);
      expect(key).toBe(expectedKey);
      expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(KEY_BYTE_LENGTH);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_KEY_ALIAS,
        expectedKey,
        expect.objectContaining({
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })
      );
    });

    it('throws wrapped error if SecureStore set fails', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);
      const mockBytes = new Uint8Array(KEY_BYTE_LENGTH).fill(0xee);
      Crypto.getRandomBytesAsync.mockResolvedValueOnce(mockBytes);
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Keystore write permission denied'));

      await expect(getOrCreateDatabaseKey()).rejects.toThrow(
        /Failed to access or generate database key/
      );
    });
  });

  describe('deleteDatabaseKey', () => {
    it('calls SecureStore.deleteItemAsync with key alias', async () => {
      SecureStore.deleteItemAsync.mockResolvedValueOnce();

      await deleteDatabaseKey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_KEY_ALIAS,
        expect.any(Object)
      );
    });
  });

  describe('setDatabaseKey', () => {
    it('stores valid 64-hex character key into SecureStore', async () => {
      const validKey = 'f'.repeat(64);
      SecureStore.setItemAsync.mockResolvedValueOnce();

      await setDatabaseKey(validKey);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_KEY_ALIAS,
        validKey,
        expect.any(Object)
      );
    });

    it('rejects invalid key lengths or formats', async () => {
      await expect(setDatabaseKey('short')).rejects.toThrow(/Invalid key format/);
      await expect(setDatabaseKey(null)).rejects.toThrow(/Invalid key format/);
    });
  });
});

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 32 bytes for AES-256
const SALT_LENGTH = 16; // 16 bytes salt
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive an encryption key from a password using PBKDF2
 * @param {string} password - The password to derive the key from
 * @param {Buffer} salt - The salt to use (should be random)
 * @returns {Buffer} - The derived key
 */
export function deriveKeyFromPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt data using AES-256-GCM
 * @param {Buffer} data - The data to encrypt
 * @param {string} password - The password to encrypt with
 * @returns {Buffer} - Encrypted data with salt and IV prepended
 */
export function encryptData(data, password) {
  if (!password || password.length === 0) {
    throw new Error('Password is required for encryption');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKeyFromPassword(password, salt);
  const iv = crypto.randomBytes(16); // 16 bytes for GCM IV
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Prepend: salt (16 bytes) + iv (16 bytes) + authTag (16 bytes) + encrypted data
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Buffer} encryptedData - The encrypted data (with salt, IV, authTag prepended)
 * @param {string} password - The password to decrypt with
 * @returns {Buffer} - Decrypted data
 */
export function decryptData(encryptedData, password) {
  if (!password || password.length === 0) {
    throw new Error('Password is required for decryption');
  }

  // Extract salt, IV, authTag, and encrypted data
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + 16);
  const authTag = encryptedData.subarray(SALT_LENGTH + 16, SALT_LENGTH + 32);
  const encrypted = encryptedData.subarray(SALT_LENGTH + 32);
  
  const key = deriveKeyFromPassword(password, salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}





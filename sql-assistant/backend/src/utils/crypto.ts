import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

// Retrieve encryption key from env, ensure it is exactly 32 bytes
const getEncryptionKey = (): Buffer => {
  const key = process.env.DB_ENCRYPTION_KEY || 'default-fallback-32-byte-key-assistant';
  // Pad or truncate to ensure exactly 32 bytes (256 bits)
  return Buffer.from(key.padEnd(32, '0').substring(0, 32), 'utf8');
};

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns the result in the format "iv_hex:ciphertext_hex"
 */
export const encrypt = (text: string): string => {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts a ciphertext string formatted as "iv_hex:ciphertext_hex" back to plaintext.
 */
export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    // If it's not in the encrypted format, return as is (for backwards compatibility if any exist)
    return encryptedText;
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

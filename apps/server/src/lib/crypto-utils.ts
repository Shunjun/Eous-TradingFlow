import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const TAG_LENGTH = 16 // 128 bits for GCM tag

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - Text to encrypt
 * @param keyHex - Encryption key in hex (64 characters for 256-bit key)
 * @returns Object with ciphertext and IV in hex
 */
export function encrypt(
  plaintext: string,
  keyHex: string
): { ciphertext: string; iv: string } {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Append auth tag to ciphertext
  const authTag = cipher.getAuthTag()
  const ciphertext = encrypted + authTag.toString('hex')

  return {
    ciphertext,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertext - Encrypted text in hex
 * @param iv - Initialization vector in hex
 * @param keyHex - Encryption key in hex
 * @returns Decrypted plaintext
 */
export function decrypt(
  ciphertext: string,
  iv: string,
  keyHex: string
): string {
  const key = Buffer.from(keyHex, 'hex')
  const ivBuffer = Buffer.from(iv, 'hex')

  // Extract auth tag from the end of ciphertext
  const authTag = Buffer.from(ciphertext.slice(-TAG_LENGTH * 2), 'hex')
  const encryptedText = ciphertext.slice(0, -TAG_LENGTH * 2)

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Get encryption key from environment or generate a new one
 * @returns Encryption key in hex
 */
export function getEncryptionKey(): string {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32\n' +
        'Then add it to your .env file as ENCRYPTION_KEY=<key>'
    )
  }
  if (keyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyHex.length}`
    )
  }
  return keyHex
}
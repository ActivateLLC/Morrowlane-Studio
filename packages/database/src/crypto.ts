import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Social access tokens are the most sensitive rows in the system: they let anyone
 * holding them post as the customer. They are encrypted before they reach the database
 * so a leaked backup or a mistaken `select *` does not hand them over.
 */

const ALGORITHM = 'aes-256-gcm';
const SALT = 'morrowlane-connection-tokens';

function keyFrom(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plaintext: string, secret = process.env['MORROWLANE_ENCRYPTION_KEY']): string {
  if (!secret) {
    throw new Error('MORROWLANE_ENCRYPTION_KEY is required to store social connection tokens.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFrom(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv.tag.ciphertext, all base64, so the payload is one opaque column value.
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string, secret = process.env['MORROWLANE_ENCRYPTION_KEY']): string {
  if (!secret) {
    throw new Error('MORROWLANE_ENCRYPTION_KEY is required to read social connection tokens.');
  }
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('The stored token is not in the expected encrypted format.');
  }
  const decipher = createDecipheriv(ALGORITHM, keyFrom(secret), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8');
}

import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';

const KEY = 'test-encryption-key-please-rotate';

describe('connection token encryption', () => {
  it('round-trips a token', () => {
    expect(decryptSecret(encryptSecret('super-secret-token', KEY), KEY)).toBe('super-secret-token');
  });

  it('produces a different ciphertext each time', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('refuses to decrypt with the wrong key', () => {
    expect(() => decryptSecret(encryptSecret('t', KEY), 'another-key')).toThrow();
  });

  it('detects a tampered payload', () => {
    const payload = encryptSecret('token', KEY);
    const [iv, tag, data] = payload.split('.');
    const tampered = [iv, tag, Buffer.from('different').toString('base64')].join('.');
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('requires a key to be configured', () => {
    expect(() => encryptSecret('token', undefined)).toThrow(/MORROWLANE_ENCRYPTION_KEY/);
  });

  it('rejects a malformed stored value', () => {
    expect(() => decryptSecret('not-encrypted', KEY)).toThrow(/expected encrypted format/);
  });
});

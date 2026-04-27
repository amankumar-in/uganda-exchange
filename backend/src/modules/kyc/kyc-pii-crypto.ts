import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { Logger } from '@nestjs/common';

// AES-256-GCM at-rest encryption for KYC raw payloads (PAN/Aadhaar Sandbox
// responses). The on-disk format is `{ v: 1, iv, tag, ct }` stored in the
// existing Json columns — no schema change required.
//
// Why GCM: AEAD, single-pass auth+encrypt, widely supported, no padding.
// Key derivation: scrypt over KYC_PII_ENCRYPTION_KEY (env). If the env var is
// missing we WARN once and pass through plaintext so dev environments keep
// working — production must set the key.

const ALGO = 'aes-256-gcm';
const KEY_DERIVATION_SALT = 'intuition-kyc-pii-v1';
const VERSION = 1;
const logger = new Logger('KycPiiCrypto');

let cachedKey: Buffer | null = null;
let warnedNoKey = false;

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const raw = process.env.KYC_PII_ENCRYPTION_KEY;
  if (!raw) {
    if (!warnedNoKey) {
      logger.warn(
        'KYC_PII_ENCRYPTION_KEY is not set — KYC raw payloads will be stored UNENCRYPTED. ' +
          'Set this in production for compliance with PMLA at-rest encryption requirements.',
      );
      warnedNoKey = true;
    }
    return null;
  }
  // Derive a 32-byte key. scrypt is overkill for an env-var passphrase but it's
  // a one-time cost at process start (cached after first call).
  cachedKey = scryptSync(raw, KEY_DERIVATION_SALT, 32);
  return cachedKey;
}

interface EncryptedEnvelope {
  v: number;
  iv: string;
  tag: string;
  ct: string;
}

function isEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === VERSION &&
    typeof v.iv === 'string' &&
    typeof v.tag === 'string' &&
    typeof v.ct === 'string'
  );
}

/**
 * Encrypt a JSON-serializable value. Returns an envelope object suitable for
 * storage in Prisma `Json?` columns. If no key is configured returns the
 * original value (dev fallback).
 */
export function encryptJson(value: unknown): unknown {
  const key = getKey();
  if (!key) return value;
  if (value === null || value === undefined) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: EncryptedEnvelope = {
    v: VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  };
  return envelope;
}

/**
 * Decrypt a stored value. Accepts both encrypted envelopes and legacy
 * plaintext (so existing rows continue to read correctly during rollout).
 */
export function decryptJson<T = unknown>(stored: unknown): T | null {
  if (stored === null || stored === undefined) return null;
  if (!isEnvelope(stored)) return stored as T;

  const key = getKey();
  if (!key) {
    logger.error('Cannot decrypt KYC payload: KYC_PII_ENCRYPTION_KEY missing');
    return null;
  }

  try {
    const iv = Buffer.from(stored.iv, 'base64');
    const tag = Buffer.from(stored.tag, 'base64');
    const ct = Buffer.from(stored.ct, 'base64');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch (err) {
    logger.error(`Failed to decrypt KYC payload: ${(err as Error).message}`);
    return null;
  }
}

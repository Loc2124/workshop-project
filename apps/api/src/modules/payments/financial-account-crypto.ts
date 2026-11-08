import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';

function key() {
  const configured = process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY;
  const decoded = configured
    ? Buffer.from(configured, 'base64url')
    : Buffer.alloc(0);
  if (decoded.length !== 32)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa cấu hình bảo vệ tài khoản nhận tiền.',
    );
  return decoded;
}

export function financialAccountEncryptionAvailable() {
  const configured = process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY;
  return Boolean(
    configured && Buffer.from(configured, 'base64url').length === 32,
  );
}

export function encryptFinancialAccount(number: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(number, 'utf8'),
    cipher.final(),
  ]);
  return { encrypted, iv, tag: cipher.getAuthTag() };
}

export function decryptFinancialAccount(
  encrypted: Buffer,
  iv: Buffer,
  tag: Buffer,
) {
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

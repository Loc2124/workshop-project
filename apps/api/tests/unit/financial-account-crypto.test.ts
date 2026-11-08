import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  decryptFinancialAccount,
  encryptFinancialAccount,
} from '../../src/modules/payments/financial-account-crypto.js';

const previous = process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY;
afterEach(() => {
  if (previous === undefined)
    delete process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY;
  else process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY = previous;
});

describe('financial account encryption', () => {
  it('round trips an account without storing the number in the ciphertext', () => {
    process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY =
      randomBytes(32).toString('base64url');
    const number = '012345678901';
    const sealed = encryptFinancialAccount(number);
    expect(sealed.encrypted.toString()).not.toContain(number);
    expect(
      decryptFinancialAccount(sealed.encrypted, sealed.iv, sealed.tag),
    ).toBe(number);
  });
  it('rejects a different key', () => {
    process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY =
      randomBytes(32).toString('base64url');
    const sealed = encryptFinancialAccount('012345678901');
    process.env.FINANCIAL_ACCOUNT_ENCRYPTION_KEY =
      randomBytes(32).toString('base64url');
    expect(() =>
      decryptFinancialAccount(sealed.encrypted, sealed.iv, sealed.tag),
    ).toThrow();
  });
});

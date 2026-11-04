import { beforeEach, describe, expect, it, vi } from 'vitest';
const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }));
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: (fn: (client: unknown) => unknown) => fn(client),
}));
vi.mock('../../src/modules/settings/settings.repository.js', async () => {
  const { defaultSiteSettings } = await import('@workshop/shared');
  return { getSiteSettings: async () => defaultSiteSettings };
});
import { updateStudioEvidence } from '../../src/modules/studios/studios.repository.js';
const current = {
  role: 'owner',
  status: 'approved',
  verifiedAt: '2026-01-01',
  name: 'Studio',
  address: 'Địa chỉ',
  photoIds: ['cover', 'second', 'third'],
  paymentQrImageId: null,
};
const evidence = {
  contactPhone: '0901234567',
  contactEmail: 'studio@example.test',
  photoIds: current.photoIds,
};
beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT sm.role')) return { rows: [current] };
    if (sql.includes('id=ANY'))
      return { rows: current.photoIds.map((id) => ({ id })), rowCount: 3 };
    if (sql.startsWith('SELECT id FROM images'))
      return { rows: [{ id: 'qr' }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
});
describe('sensitive studio profile changes', () => {
  it('keeps approval and verification for contact edits and additional photos', async () => {
    const result = await updateStudioEvidence('studio', 'owner', {
      ...evidence,
      contactEmail: 'new@example.test',
      photoIds: ['cover', 'new-second', 'new-third'],
    });
    expect(result.status).toBe('approved');
    expect(
      client.query.mock.calls.some(([sql]) =>
        sql.includes('studio_verification_history'),
      ),
    ).toBe(false);
  });
  it.each([
    { name: 'Tên studio mới' },
    { address: 'Địa chỉ mới' },
    { photoIds: ['new-cover', 'second', 'third'] },
    { paymentQrImageId: 'qr' },
  ])('queues sensitive edits and revokes verification: %j', async (change) => {
    const result = await updateStudioEvidence('studio', 'owner', {
      ...evidence,
      ...change,
    });
    expect(result.status).toBe('pending');
    expect(
      client.query.mock.calls.some(([sql]) =>
        sql.includes('studio_verification_history'),
      ),
    ).toBe(true);
  });
  it('rejects a QR that is not an owned, confirmed studio image', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT sm.role')) return { rows: [current] };
      if (sql.includes('id=ANY')) return { rows: [], rowCount: 3 };
      return { rows: [], rowCount: 0 };
    });
    await expect(
      updateStudioEvidence('studio', 'owner', {
        ...evidence,
        paymentQrImageId: 'foreign',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(
      client.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE studios')),
    ).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { client, audit } = vi.hoisted(() => ({
  client: { query: vi.fn() },
  audit: vi.fn(),
}));
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: (fn: (client: unknown) => unknown) => fn(client),
}));
vi.mock('../../src/modules/admin/audit-log.js', () => ({
  writeAuditLog: audit,
}));
import {
  createWorkshop,
  updateWorkshop,
} from '../../src/modules/workshops/workshops.repository.js';
import {
  createWorkshopSchema,
  updateWorkshopSchema,
} from '../../src/modules/workshops/workshops.schemas.js';

const input = {
  title: 'Gốm',
  description: 'Tạo hình gốm',
  categoryId: 'ceramics',
  level: 'beginner' as const,
  audience: [],
  durationMinutes: 90,
  basePrice: 10000,
};
beforeEach(() => {
  vi.clearAllMocks();
});
describe('studio self publication', () => {
  it.each(['pending', 'rejected', 'suspended'])(
    'blocks workshop creation for a %s studio',
    async (status) => {
      client.query.mockResolvedValueOnce({
        rows: [{ status, isDraft: false, canCollectDeposit: false }],
      });
      await expect(
        createWorkshop('studio', 'owner', input),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(audit).not.toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledTimes(1);
    },
  );
  it('publishes an approved studio without verification and writes an audit event', async () => {
    client.query.mockResolvedValueOnce({
      rows: [{ status: 'approved', isDraft: false, canCollectDeposit: false }],
    });
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'workshop', title: input.title, status: 'approved' }],
    });
    await createWorkshop('studio', 'owner', input);
    expect(client.query.mock.calls[1][0]).toContain(
      'publication_status, is_simulated',
    );
    expect(client.query.mock.calls[1][0]).toContain('$17, false');
    expect(client.query.mock.calls[1][1].slice(-2)).toEqual([0, 'published']);
    expect(audit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        action: 'workshop.created',
        actorId: 'owner',
        targetId: 'workshop',
      }),
    );
  });
  it('saves drafts and rejects attempts to write admin visibility', () => {
    expect(
      createWorkshopSchema.parse({ ...input, publicationStatus: 'draft' })
        .publicationStatus,
    ).toBe('draft');
    expect(
      updateWorkshopSchema.safeParse({ publicationStatus: 'hidden' }).success,
    ).toBe(false);
    expect(
      updateWorkshopSchema.safeParse({ visibilityStatus: 'active' }).success,
    ).toBe(false);
  });
  it('keeps ordinary edits out of review and preserves admin visibility', async () => {
    client.query.mockResolvedValueOnce({
      rows: [{ status: 'approved', isDraft: false, canCollectDeposit: false }],
    });
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'workshop', title: 'Tên mới' }],
    });
    await updateWorkshop('studio', 'staff', 'workshop', { title: 'Tên mới' });
    const sql = client.query.mock.calls[1][0];
    expect(sql).toContain("status = 'approved'::approval_status");
    expect(sql).not.toContain("'pending'");
    expect(sql).not.toContain('visibility_status =');
    expect(audit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'workshop.updated' }),
    );
  });
  it('keeps deposit changes published without admin review', async () => {
    client.query.mockResolvedValueOnce({
      rows: [{ status: 'approved', isDraft: false, canCollectDeposit: true }],
    });
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'workshop', title: input.title }],
    });
    await updateWorkshop('studio', 'owner', 'workshop', {
      basePrice: 20,
      depositPercent: 20,
    });
    expect(client.query.mock.calls[1][0]).toContain(
      "status = 'approved'::approval_status",
    );
    expect(client.query.mock.calls[1][0]).not.toContain("'pending'");
  });
  it('publishes verified studio workshops even with the default positive deposit', async () => {
    client.query.mockResolvedValueOnce({
      rows: [{ status: 'approved', isDraft: false, canCollectDeposit: true }],
    });
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'workshop', title: input.title, status: 'approved' }],
    });
    await createWorkshop('studio', 'owner', input);
    expect(client.query.mock.calls[1][0]).not.toContain("'pending'");
    expect(client.query.mock.calls[1][1].slice(-2)).toEqual([20, 'published']);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createWorkshopSchema,
  updateWorkshopSchema,
} from '../../src/modules/workshops/workshops.schemas.js';

const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }));
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: (action: (value: typeof client) => unknown) =>
    action(client),
}));
import {
  decideWorkshop,
  updateStudioStatus,
} from '../../src/modules/admin/admin.repository.js';

const workshop = {
  title: 'Thêu một bức tranh',
  description: 'Thực hành thêu tay',
  categoryId: 'other',
  durationMinutes: 90,
  basePrice: 200000,
};

describe('workshop category proposals', () => {
  beforeEach(() => client.query.mockReset());
  it('validates and normalizes proposals on create and update', () => {
    expect(
      createWorkshopSchema.parse({
        ...workshop,
        proposedCategoryName: '  Thêu   tay  ',
      }).proposedCategoryName,
    ).toBe('Thêu tay');
    for (const proposedCategoryName of ['', ' ', 'a', 'a'.repeat(81)]) {
      expect(
        createWorkshopSchema.safeParse({ ...workshop, proposedCategoryName })
          .success,
      ).toBe(false);
    }
    expect(
      updateWorkshopSchema.safeParse({ proposedCategoryName: 'Thêu tay' })
        .success,
    ).toBe(false);
    expect(
      updateWorkshopSchema.safeParse({
        categoryId: 'ceramics',
        proposedCategoryName: 'Thêu tay',
      }).success,
    ).toBe(false);
    expect(
      updateWorkshopSchema.safeParse({
        categoryId: 'other',
        proposedCategoryName: 'Thêu tay',
      }).success,
    ).toBe(true);
    expect(createWorkshopSchema.safeParse(workshop).success).toBe(true);
  });
  it('creates an active category only when an admin approves, in the workshop transaction', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{ status: 'pending', proposedCategoryName: 'Thêu tay' }],
      })
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // no matching category
      .mockResolvedValueOnce({ rows: [] }) // insert category
      .mockResolvedValueOnce({ rows: [{ status: 'approved' }] })
      .mockResolvedValueOnce({ rows: [] }) // history
      .mockResolvedValueOnce({
        rows: [
          { id: 'workshop', categoryId: 'new', proposedCategoryName: null },
        ],
      });
    const result = await decideWorkshop('workshop', 'admin', {
      status: 'approved',
    });
    expect(result.kind).toBe('updated');
    expect(client.query.mock.calls[3]?.[0]).toContain('INSERT INTO categories');
    const categoryId = client.query.mock.calls[3]?.[1][0];
    expect(categoryId.length).toBeLessThanOrEqual(100);
    expect(client.query.mock.calls[4]?.[1]).toEqual([
      'workshop',
      'approved',
      categoryId,
    ]);
    expect(client.query.mock.calls[5]?.[1][3]).toBeNull();
    expect(client.query.mock.calls[5]?.[1][4]).toBe('Thêu tay');
  });
  it('reuses an existing category instead of creating a duplicate', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{ status: 'pending', proposedCategoryName: 'Thêu tay' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'embroidery' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: 'approved' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'workshop' }] });
    await decideWorkshop('workshop', 'admin', { status: 'approved' });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO categories'),
      ),
    ).toBe(false);
    expect(client.query.mock.calls[4]?.[1]).toEqual([
      'workshop',
      'approved',
      'embroidery',
    ]);
  });
  it('does not create a category for a rejected or already reviewed workshop', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{ status: 'pending', proposedCategoryName: 'Thêu tay' }],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'rejected' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'workshop' }] });
    await decideWorkshop('workshop', 'admin', {
      status: 'rejected',
      reason: 'Cần bổ sung mô tả',
    });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('categories'),
      ),
    ).toBe(false);
    client.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [{ status: 'approved' }] });
    expect(
      await decideWorkshop('workshop', 'admin', { status: 'approved' }),
    ).toEqual({ kind: 'conflict', currentStatus: 'approved' });
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});

describe('studio category proposal decisions', () => {
  beforeEach(() => client.query.mockReset());
  it('keeps rejected proposals private and creates no category', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'pending',
            profileComplete: true,
            proposedCategoryName: 'Embroidery',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'studio',
            status: 'rejected',
            profileComplete: true,
            proposedCategoryName: 'Embroidery',
          },
        ],
      });
    await updateStudioStatus(
      'studio',
      'rejected',
      'admin',
      'Bổ sung thông tin studio',
    );
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][1]).toEqual([
      'rejected',
      'studio',
      null,
      'admin',
      'Bổ sung thông tin studio',
    ]);
  });
  it('reuses a category and replaces Other atomically on approval', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'pending',
            profileComplete: true,
            proposedCategoryName: 'Embroidery',
            contactPhone: '0901234567',
            contactEmail: 'studio@example.test',
            photoIds: [
              '00000000-0000-4000-8000-000000000001',
              '00000000-0000-4000-8000-000000000002',
              '00000000-0000-4000-8000-000000000003',
            ],
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'embroidery' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'studio',
            status: 'approved',
            profileComplete: true,
            proposedCategoryName: null,
          },
        ],
      });
    await updateStudioStatus('studio', 'approved', 'admin');
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO categories'),
      ),
    ).toBe(false);
    expect(client.query.mock.calls[4][1]).toEqual(['studio', 'embroidery']);
    expect(client.query.mock.calls[5][0]).toContain(
      'DELETE FROM studio_categories',
    );
    expect(client.query.mock.calls[6][1]).toEqual([
      'approved',
      'studio',
      'embroidery',
      'admin',
      null,
    ]);
  });
});

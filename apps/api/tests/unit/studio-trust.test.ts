import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studioVerificationDecisionSchema } from '@workshop/shared';

const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }));
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: (action: (value: typeof client) => unknown) =>
    action(client),
}));
import {
  updateStudioVerification,
  updateStudioStatus,
} from '../../src/modules/admin/admin.repository.js';

describe('studio trust', () => {
  beforeEach(() => client.query.mockReset());
  it('requires explicit evidence and confirmation, or a revocation reason', () => {
    expect(
      studioVerificationDecisionSchema.safeParse({
        verified: true,
        method: 'identity_address',
        confirmed: true,
      }).success,
    ).toBe(true);
    for (const input of [
      { verified: true },
      { verified: true, method: 'identity_address', confirmed: false },
      { verified: true, method: 'unknown', confirmed: true },
      { verified: false, reason: ' ' },
      { verified: false, reason: 'x'.repeat(501) },
      {
        verified: true,
        method: 'identity_address',
        confirmed: true,
        documentNumber: 'private',
      },
    ]) {
      expect(studioVerificationDecisionSchema.safeParse(input).success).toBe(
        false,
      );
    }
  });
  it('refuses missing, unapproved and repeated verification changes', async () => {
    const decision = {
      verified: true,
      method: 'identity_address',
      confirmed: true,
    } as const;
    for (const [rows, statusCode] of [
      [[], 404],
      [[{ status: 'pending', verifiedAt: null }], 409],
      [
        [
          {
            status: 'approved',
            profileComplete: true,
            verifiedAt: '2026-11-02',
          },
        ],
        409,
      ],
    ] as const) {
      client.query.mockReset().mockResolvedValueOnce({ rows });
      await expect(
        updateStudioVerification('studio', 'admin', decision),
      ).rejects.toMatchObject({ statusCode });
      expect(client.query).toHaveBeenCalledTimes(1);
    }
  });
  it('records the admin and method in the verification transaction', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{ status: 'approved', profileComplete: true, verifiedAt: null }],
      })
      .mockResolvedValueOnce({ rows: [{ verifiedAt: '2026-11-02T00:00:00Z' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await updateStudioVerification('studio', 'admin', {
        verified: true,
        method: 'business_registration',
        confirmed: true,
      }),
    ).toMatchObject({ trustLevel: 'verified' });
    expect(client.query.mock.calls[2][1]).toEqual([
      'studio',
      'admin',
      'verified',
      'business_registration',
      null,
    ]);
  });
  it('revokes verification with a reason and removes current verification metadata', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [
          { status: 'approved', profileComplete: true, verifiedAt: 'date' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ verifiedAt: null }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await updateStudioVerification('studio', 'admin', {
        verified: false,
        reason: 'Địa chỉ cần kiểm tra lại',
      }),
    ).toEqual({ trustLevel: 'approved', verifiedAt: null });
    expect(client.query.mock.calls[1][1]).toEqual(['studio', false, 'admin']);
    expect(client.query.mock.calls[2][1]).toEqual([
      'studio',
      'admin',
      'revoked',
      null,
      'Địa chỉ cần kiểm tra lại',
    ]);
  });
  it('also records revocation when approval is removed', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'approved',
            proposedCategoryName: null,
            verifiedAt: 'date',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ status: 'rejected', trustLevel: 'unapproved' }],
      });
    await updateStudioStatus(
      'studio',
      'suspended',
      'admin',
      'Temporary suspension reason',
    );
    expect(client.query.mock.calls[1][1]).toEqual([
      'studio',
      'admin',
      'Hồ sơ studio không còn được duyệt.',
    ]);
    expect(client.query.mock.calls[2][0]).toContain('verified_at = CASE');
  });
  it('rejects approving an incomplete submitted profile with HTTP 400', async () => {
    client.query.mockResolvedValueOnce({
      rows: [
        {
          status: 'pending',
          profileComplete: false,
          proposedCategoryName: null,
          verifiedAt: null,
        },
      ],
    });
    await expect(
      updateStudioStatus('studio', 'approved', 'admin'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
    expect(client.query).toHaveBeenCalledTimes(1);
  });
  it('stores reviewer, review time and the requested changes in the status transaction', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'pending',
            profileComplete: false,
            proposedCategoryName: null,
            verifiedAt: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'needs_changes' }] });
    await updateStudioStatus(
      'studio',
      'needs_changes',
      'admin',
      '  Bổ sung ảnh mặt tiền studio  ',
    );
    expect(client.query.mock.calls[1][1]).toEqual([
      'needs_changes',
      'studio',
      null,
      'admin',
      'Bổ sung ảnh mặt tiền studio',
    ]);
    expect(client.query.mock.calls[1][0]).toContain(
      'reviewed_by = $4, reviewed_at = now(), rejection_reason = $5',
    );
  });
});

import { defaultSiteSettings } from '@workshop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '../lib/api-client';
import { managementService } from './managementService';

const studioId = '00000000-0000-4000-8000-000000000001';
const workshopId = '00000000-0000-4000-8000-000000000002';
const sessionId = '00000000-0000-4000-8000-000000000003';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('managementService', () => {
  it('creates a studio using the validated profile payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ settings: defaultSiteSettings }))
      .mockResolvedValueOnce(
        Response.json({
          studio: {
            id: studioId,
            slug: 'studio-gom',
            name: 'Studio gốm',
            categoryId: 'ceramics',
            description: null,
            provinceId: 'ho-chi-minh',
            areaId: null,
            address: 'Địa chỉ studio',
            status: 'pending',
            createdAt: '2026-11-02T00:00:00.000Z',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const created = await managementService.createStudio({
      draftStudioId: studioId,
      contactPhone: '0901234567',
      contactEmail: 'studio@example.test',
      photoIds: [studioId, workshopId, sessionId],
      name: 'Studio gốm',
      categoryId: 'ceramics',
      provinceId: 'ho-chi-minh',
      address: 'Địa chỉ studio',
    });
    expect(created).toMatchObject({
      id: studioId,
      name: 'Studio gốm',
      status: 'pending',
    });

    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe(
      '/studios',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        draftStudioId: studioId,
        name: 'Studio gốm',
        categoryId: 'ceramics',
        provinceId: 'ho-chi-minh',
        address: 'Địa chỉ studio',
        contactPhone: '0901234567',
        contactEmail: 'studio@example.test',
        photoIds: [studioId, workshopId, sessionId],
      }),
    });
  });

  it('loads the signed-in user studio list and parses its role', async () => {
    const studio = {
      id: studioId,
      slug: 'studio-gom',
      name: 'Studio gốm',
      description: null,
      categoryId: 'ceramics',
      provinceId: 'ho-chi-minh',
      province: 'TP. Hồ Chí Minh',
      areaId: null,
      area: null,
      address: 'Địa chỉ studio',
      status: 'pending',
      role: 'owner',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ studios: [studio] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(managementService.listMyStudios()).resolves.toEqual([studio]);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      '/me/studios',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
    });
  });

  it('loads workshops and sessions only using the requested studio route', async () => {
    const workshop = {
      id: workshopId,
      slug: 'buoi-lam-gom',
      studioId,
      title: 'Buổi làm gốm',
      description: 'Mô tả',
      categoryId: 'ceramics',
      level: 'beginner',
      audience: ['người mới'],
      takeaway: null,
      durationMinutes: 90,
      basePrice: 120000,
      requirements: null,
      cancellationPolicy: null,
      paymentPolicy: null,
      provinceId: 'ho-chi-minh',
      areaId: null,
      address: 'Địa chỉ studio',
      status: 'pending',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const session = {
      id: '00000000-0000-4000-8000-000000000003',
      workshopId,
      workshopTitle: workshop.title,
      startsAt: '2026-12-01T02:00:00.000Z',
      endsAt: '2026-12-01T03:30:00.000Z',
      price: 120000,
      capacity: 10,
      seatsHeld: 0,
      seatsSold: 0,
      status: 'scheduled',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ workshops: [workshop] }))
      .mockResolvedValueOnce(Response.json({ sessions: [session] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      managementService.listStudioWorkshops(studioId),
    ).resolves.toEqual([workshop]);
    await expect(
      managementService.listStudioSessions(studioId),
    ).resolves.toEqual([session]);
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual([
      `/studios/${studioId}/workshops`,
      `/studios/${studioId}/sessions`,
    ]);
  });

  it('serializes admin filters and requires a reason to reject a workshop', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        items: [],
        total: 0,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      managementService.listAdminWorkshops({
        status: 'pending',
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      workshops: [],
      pagination: { page: 2, pageSize: 10, total: 0 },
    });
    expect(
      new URL(String(fetchMock.mock.calls[0][0])).searchParams.toString(),
    ).toBe('status=pending&page=2&pageSize=10');
    await expect(
      managementService.decideWorkshop(workshopId, { status: 'rejected' }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the correct owner/member routes and payloads for studio changes', async () => {
    const workshop = {
      id: workshopId,
      slug: 'buoi-lam-gom',
      studioId,
      title: 'Buổi làm gốm',
      description: 'Mô tả workshop',
      categoryId: 'ceramics',
      level: 'beginner',
      audience: [],
      takeaway: null,
      durationMinutes: 90,
      basePrice: 120000,
      requirements: null,
      cancellationPolicy: null,
      paymentPolicy: null,
      provinceId: 'ho-chi-minh',
      areaId: null,
      address: 'Địa chỉ studio',
      status: 'pending',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const session = {
      id: sessionId,
      workshopId,
      startsAt: '2026-12-01T02:00:00.000Z',
      endsAt: '2026-12-01T03:30:00.000Z',
      price: 120000,
      capacity: 8,
      seatsHeld: 0,
      seatsSold: 0,
      status: 'scheduled',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ workshop }))
      .mockResolvedValueOnce(Response.json({ workshop }))
      .mockResolvedValueOnce(Response.json({ session }))
      .mockResolvedValueOnce(Response.json({ session }))
      .mockResolvedValueOnce(
        Response.json({ session: { ...session, status: 'cancelled' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await managementService.saveStudioWorkshop(studioId, null, {
      title: 'Buổi làm gốm',
      description: 'Mô tả workshop',
      categoryId: 'ceramics',
      level: 'beginner',
      audience: [],
      durationMinutes: 90,
      basePrice: 120000,
    });
    await managementService.saveStudioWorkshop(studioId, workshopId, {
      title: 'Buổi làm gốm',
    });
    await managementService.saveStudioSession(studioId, workshopId, null, {
      startsAt: '2026-12-01T09:00:00+07:00',
      endsAt: '2026-12-01T10:30:00+07:00',
      capacity: 8,
    });
    await managementService.saveStudioSession(studioId, null, sessionId, {
      capacity: 9,
    });
    await managementService.cancelStudioSession(studioId, sessionId);

    expect(
      fetchMock.mock.calls.map(([url, init]) => [
        new URL(String(url)).pathname,
        init?.method,
      ]),
    ).toEqual([
      [`/studios/${studioId}/workshops`, 'POST'],
      [`/studios/${studioId}/workshops/${workshopId}`, 'PATCH'],
      [`/studios/${studioId}/workshops/${workshopId}/sessions`, 'POST'],
      [`/studios/${studioId}/sessions/${sessionId}`, 'PATCH'],
      [`/studios/${studioId}/sessions/${sessionId}/cancel`, 'POST'],
    ]);
  });

  it('surfaces malformed management API responses instead of returning empty data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ studios: [{ id: 'bad' }] })),
    );

    await expect(managementService.listMyStudios()).rejects.toBeInstanceOf(
      ApiResponseError,
    );
  });
});

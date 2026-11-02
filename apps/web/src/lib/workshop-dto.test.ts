import { describe, expect, it } from 'vitest';
import { publicWorkshopDtoSchema } from '@workshop/shared';

const workshopResponse = {
  id: 'workshop-id',
  slug: 'workshop',
  studioId: 'studio-id',
  studioSlug: 'studio',
  title: 'Workshop',
  description: 'Mô tả',
  categoryId: 'ceramics',
  level: 'beginner',
  audience: [],
  takeaway: null,
  durationMinutes: 60,
  basePrice: 100000,
  requirements: null,
  cancellationPolicy: 'Báo trước một ngày.',
  paymentPolicy: null,
  district: null,
  province: 'Hà Nội',
  provinceId: 'ha-noi',
  areaId: null,
  address: 'Địa chỉ thử nghiệm',
  isSimulated: true,
  studioName: 'Studio',
  studioDescription: null,
  sessions: [
    {
      id: 'session-id',
      startsAt: '2032-05-01T17:30:00.000Z',
      endsAt: '2032-05-01T18:30:00.000Z',
      price: 100000,
      availableSeats: 2,
    },
  ],
};

describe('public workshop DTO schema', () => {
  it('accepts separate nullable cancellation and payment policies with ISO timestamps', () => {
    expect(publicWorkshopDtoSchema.parse(workshopResponse)).toMatchObject({
      cancellationPolicy: 'Báo trước một ngày.',
      paymentPolicy: null,
      sessions: [{ startsAt: '2032-05-01T17:30:00.000Z' }],
    });
  });

  it('rejects a response with legacy policy naming or timezone-less session dates', () => {
    expect(() =>
      publicWorkshopDtoSchema.parse({
        ...workshopResponse,
        policy: 'Legacy',
      }),
    ).toThrow();
    expect(() =>
      publicWorkshopDtoSchema.parse({
        ...workshopResponse,
        sessions: [
          {
            ...workshopResponse.sessions[0],
            startsAt: '2032-05-01T17:30:00',
          },
        ],
      }),
    ).toThrow();
  });
});

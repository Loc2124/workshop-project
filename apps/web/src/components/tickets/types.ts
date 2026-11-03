import type { Workshop } from '../../types/workshop';

export type TicketData = {
  workshop: {
    id: string;
    title: string;
    reason?: string;
    categoryId: string;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    mediumUrl?: string | null;
    price: number;
    rating?: number;
    ratingCount?: number;
    description?: string;
    takeaway?: string | null;
    requirements?: string | null;
  };
  studio: { name: string; provinceName: string; address?: string | null };
  session: {
    startAt: string | null;
    durationMinutes: number;
    seatsLeft: number;
  };
  artisan?: {
    name: string;
    avatarUrl?: string | null;
    tagline?: string | null;
  };
};

export type TicketProps = TicketData & {
  href?: string;
  pattern?: boolean;
  className?: string;
  loading?: false;
  priority?: boolean;
};
export type TicketVariantProps =
  TicketProps | { loading: true; pattern?: boolean; className?: string };

export type Booking = {
  code: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  partySize: number;
  paymentMethod: 'at_studio' | 'prepaid';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded';
};

export function toTicketProps(workshop: Workshop): TicketProps {
  const session = [...workshop.sessions].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )[0];
  return {
    workshop: {
      id: workshop.id,
      title: workshop.title,
      reason: workshop.reason,
      categoryId: workshop.categoryId,
      imageUrl: workshop.imageUrl,
      thumbnailUrl: workshop.thumbnailUrl,
      mediumUrl: workshop.mediumUrl,
      price: session?.price ?? workshop.basePrice,
      rating: workshop.rating,
      ratingCount: workshop.reviewCount,
      description: workshop.description,
      takeaway: workshop.takeaway,
      requirements: workshop.requirements,
    },
    studio: {
      name: workshop.studioName,
      provinceName: workshop.province,
      address: workshop.address,
    },
    session: {
      startAt: session?.startsAt ?? null,
      durationMinutes: workshop.durationMinutes,
      seatsLeft: session?.availableSeats ?? 0,
    },
    artisan: workshop.artistName
      ? {
          name: workshop.artistName,
          avatarUrl: workshop.artistPhoto,
          tagline: workshop.artistIntro,
        }
      : undefined,
    href: `/workshop/${workshop.slug ?? workshop.id}`,
  };
}

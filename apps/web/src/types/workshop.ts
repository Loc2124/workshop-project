import type { CatalogResponseDto, PublicWorkshopDto } from '@workshop/shared';

export type WorkshopSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  price: number;
  availableSeats: number;
};

export type WorkshopReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
};

type WorkshopPolicies = Pick<
  PublicWorkshopDto,
  'cancellationPolicy' | 'paymentPolicy'
>;

export type Workshop = {
  id: string;
  slug?: string;
  studioId: string;
  studioSlug?: string;
  title: string;
  reason?: string;
  description: string;
  categoryId: string;
  level: string;
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  district: string | null;
  province: string;
  provinceId?: string;
  areaId?: string | null;
  address: string | null;
  isSimulated: boolean;
  studioName: string;
  studioDescription: string | null;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  artistName?: string;
  artistPhoto?: string;
  artistIntro?: string;
  nextStartsAt?: string;
  sessions: WorkshopSession[];
  reviews?: WorkshopReview[];
  included?: string[];
} & Partial<WorkshopPolicies>;

export type CatalogResponse = CatalogResponseDto;

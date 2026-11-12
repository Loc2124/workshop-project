import type { CatalogResponseDto, PublicWorkshopDto } from '@workshop/shared';

export type WorkshopSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  price: number;
  availableSeats: number;
  status?: 'scheduled' | 'cancelled' | 'completed';
  registrationDeadline?: string | null;
};

export type WorkshopReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
  replyComment?: string | null;
  repliedAt?: string | null;
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
  depositMode?: 'none' | 'optional' | 'required';
  studioContactPhone?: string | null;
  studioContactEmail?: string | null;
  depositPercent?: number;
  effectiveDepositPercent?: number;
  requirements: string | null;
  district: string | null;
  province: string;
  provinceId?: string;
  areaId?: string | null;
  address: string | null;
  isSimulated: boolean;
  isDiscontinued?: boolean;
  studioName: string;
  studioTrustLevel?: 'unapproved' | 'approved' | 'verified';
  studioDescription: string | null;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  artistName?: string;
  artistPhoto?: string;
  artistIntro?: string;
  nextStartsAt?: string;
  sessions: WorkshopSession[];
  reviews?: WorkshopReview[];
  included?: string[];
} & Partial<WorkshopPolicies>;

export type CatalogResponse = CatalogResponseDto;

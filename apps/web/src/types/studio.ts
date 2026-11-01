import type { Workshop } from './workshop';

export type StudioReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  avatarUrl?: string;
};

export type StudioDetailsContent = {
  openingHours?: string;
  mapImageUrl?: string;
  gallery?: Array<{ url: string; alt?: string }>;
  reviews?: StudioReview[];
  information?: {
    parking?: string;
    materials?: string;
    maxParticipants?: number;
    cancellationPolicy?: string;
  };
};

export type Studio = StudioDetailsContent & {
  id: string;
  categoryId: string;
  slug?: string;
  name: string;
  description: string;
  province: string;
  provinceId: string;
  areaId: string | null;
  areaName: string | null;
  address: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
};

export type StudioListing = Studio & {
  workshopCount: number;
  categoryIds: string[];
  startingPrice: number;
  availableSessions: number;
};

export type PublicStudio = Omit<Studio, 'description'> & {
  description: string | null;
  workshops: Workshop[];
};

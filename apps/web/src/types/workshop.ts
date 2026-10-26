export type WorkshopSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  price: number;
  availableSeats: number;
};

export type Workshop = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  district: string;
  address: string | null;
  isSimulated: boolean;
  organizerName: string;
  organizerDescription: string | null;
  nextStartsAt?: string;
  sessions: WorkshopSession[];
};

export type CatalogResponse = {
  items: Workshop[];
  pagination: { page: number; pageSize: number; total: number };
};

export type CatalogFilters = {
  categoryId?: string;
  provinceId?: string;
  areaIds?: string[];
  level?: 'beginner' | 'intermediate' | 'all';
  audience?: string;
  priceMin?: number;
  priceMax?: number;
  dateFrom?: string;
  dateTo?: string;
  takeawaySameDay?: boolean;
  page: number;
  pageSize: number;
};

export type SortOption = 'recommended' | 'price-asc' | 'price-desc' | 'soonest';

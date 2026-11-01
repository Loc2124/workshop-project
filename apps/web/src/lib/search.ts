import type { Workshop } from '../types/workshop';
import { getCategoryMeta } from '../constants/categories';

export function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, ' ');
}

export function searchTextScore(value: string, query: string) {
  const text = normalizeSearchText(value);
  const normalized = normalizeSearchText(query);
  if (!normalized) return 0;
  return (
    (text === normalized ? 12 : text.includes(normalized) ? 6 : 0) +
    normalized.split(' ').filter((word) => text.includes(word)).length
  );
}

export function workshopSearchScore(workshop: Workshop, query: string) {
  const category = getCategoryMeta(workshop.categoryId);
  return (
    searchTextScore(workshop.title, query) * 8 +
    searchTextScore([category.name, ...category.keywords].join(' '), query) *
      5 +
    searchTextScore(category.description, query) * 2 +
    searchTextScore(workshop.studioName, query) * 4 +
    searchTextScore(workshop.artistName ?? '', query) * 2 +
    searchTextScore(workshop.province, query) * 2 +
    searchTextScore(workshop.description, query)
  );
}

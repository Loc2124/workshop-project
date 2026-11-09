import {
  getCategoryOptions,
  getUpcomingCategories,
} from '../constants/categories';
import type { Workshop } from '../types/workshop';
import { rankWorkshops } from './rankWorkshops';
import {
  normalizeSearchText,
  searchTextScore,
  workshopSearchScore,
} from './search';

export type SearchSuggestion = {
  id: string;
  group: 'Bộ môn' | 'Studio' | 'Workshop';
  label: string;
  detail?: string;
  href: string;
  categoryId?: string;
};

export function getSearchSuggestions(
  workshops: Workshop[],
  query: string,
): SearchSuggestion[] {
  const categories: SearchSuggestion[] = (
    normalizeSearchText(query)
      ? getCategoryOptions(workshops)
      : getUpcomingCategories(workshops)
  )
    .filter(
      (category) =>
        !normalizeSearchText(query) ||
        searchTextScore(
          [category.name, category.description, ...category.keywords].join(' '),
          query,
        ) > 0,
    )
    .map((category): SearchSuggestion => ({
      id: `category-${category.id}`,
      categoryId: category.id,
      group: 'Bộ môn',
      label: category.name,
      detail: category.status === 'pending' ? 'Khác' : undefined,
      href: `/kham-pha?type=${encodeURIComponent(category.slug)}&view=workshop`,
    }));
  const orderedCategories = categories;
  if (!normalizeSearchText(query)) return orderedCategories.slice(0, 3);

  const studios = [
    ...new Map(
      workshops.map((workshop) => [workshop.studioId, workshop]),
    ).values(),
  ]
    .filter((workshop) => searchTextScore(workshop.studioName, query) > 0)
    .sort(
      (a, b) =>
        searchTextScore(b.studioName, query) -
        searchTextScore(a.studioName, query),
    )
    .map((workshop): SearchSuggestion => ({
      id: `studio-${workshop.studioId}`,
      group: 'Studio',
      label: workshop.studioName,
      detail: workshop.province,
      href: `/studios/${workshop.studioSlug ?? workshop.studioId}`,
    }));
  const matches = rankWorkshops(workshops, query)
    .filter((workshop) => workshopSearchScore(workshop, query) > 0)
    .map((workshop): SearchSuggestion => ({
      id: `workshop-${workshop.id}`,
      group: 'Workshop',
      label: workshop.title,
      detail: workshop.studioName,
      href: `/workshop/${workshop.slug ?? workshop.id}`,
    }));
  return [
    ...matches.slice(0, 3),
    ...studios.slice(0, 3),
    ...orderedCategories.slice(0, 3),
  ];
}

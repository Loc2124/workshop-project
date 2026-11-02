import {
  Amphora,
  Flame,
  Paintbrush,
  Flower2,
  SprayCan,
  Gem,
  Stamp,
  Droplets,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import categoryData from '../../../../data/categories.json';
import type { Workshop } from '../types/workshop';

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  placeholderImage: string | null;
  status: 'active' | 'pending';
  sortOrder: number;
  isVisible?: boolean;
  keywords: string[];
  description: string;
  imagePosition?: string;
};

export let categories: Category[] = categoryData as Category[];
const metadata = new Map(categories.map((category) => [category.id, category]));
export function registerCategories(data: Category[]) {
  data.forEach((category) => metadata.set(category.id, category));
  categories = data;
  return data;
}
export const DEFAULT_CATEGORY: Category = {
  id: 'other',
  slug: 'khac',
  name: 'Khác',
  icon: 'Shapes',
  color: '#78716c',
  placeholderImage: '/images/workshops/category-default.svg',
  status: 'pending',
  sortOrder: 999,
  keywords: [],
  description: '',
  imagePosition: '65% 35%',
};
const icons: Record<string, LucideIcon> = {
  Amphora,
  Flame,
  Paintbrush,
  Flower2,
  SprayCan,
  Gem,
  Stamp,
  Droplets,
  Shapes,
};

export function getCategoryMeta(id?: string | null): Category {
  const category = metadata.get(id ?? '');
  return {
    ...DEFAULT_CATEGORY,
    ...category,
    id: category?.id ?? id ?? DEFAULT_CATEGORY.id,
    slug: category?.slug ?? id ?? DEFAULT_CATEGORY.slug,
    icon:
      category?.icon && icons[category.icon]
        ? category.icon
        : DEFAULT_CATEGORY.icon,
    color: category?.color || DEFAULT_CATEGORY.color,
    placeholderImage:
      category?.placeholderImage || DEFAULT_CATEGORY.placeholderImage,
    imagePosition: category?.imagePosition || DEFAULT_CATEGORY.imagePosition,
  };
}

export function getCategoryIcon(id?: string | null) {
  return icons[getCategoryMeta(id).icon ?? ''] ?? Shapes;
}

// Existing bookmarks are accepted; application records retain only the ID.
export function categoryValue(value: string | null) {
  return categories.find(
    (category) =>
      category.isVisible !== false &&
      (category.id === value ||
        category.slug === value ||
        category.name.toLocaleLowerCase('vi') ===
          value?.toLocaleLowerCase('vi')),
  )?.id;
}

export function getUpcomingCategories(workshops: Workshop[], now = Date.now()) {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const workshop of workshops) {
    for (const session of workshop.sessions) {
      if (
        !Number.isFinite(Date.parse(session.startsAt)) ||
        Date.parse(session.startsAt) <= now
      )
        continue;
      const key = `${workshop.id}:${session.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(
        workshop.categoryId,
        (counts.get(workshop.categoryId) ?? 0) + 1,
      );
    }
  }
  return [...counts]
    .map(([id, count]) => ({ ...getCategoryMeta(id), count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, 'vi'),
    );
}

export function getCategoryOptions(workshops: Workshop[], now = Date.now()) {
  const upcoming = getUpcomingCategories(workshops, now);
  const options = new Map(
    categories
      .filter(
        (category) =>
          category.isVisible !== false &&
          (category.status === 'active' || category.id === 'other'),
      )
      .map((category) => [
        category.id,
        { ...getCategoryMeta(category.id), count: 0 },
      ]),
  );
  upcoming.forEach((category) => {
    if (options.has(category.id)) options.set(category.id, category);
  });
  return [...options.values()].sort(
    (a, b) =>
      Number(a.id === 'other') - Number(b.id === 'other') ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, 'vi'),
  );
}

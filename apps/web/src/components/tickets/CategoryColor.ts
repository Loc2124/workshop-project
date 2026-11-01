import { getCategoryMeta } from '../../constants/categories';

export function categoryColor(categoryId: string) {
  const color = getCategoryMeta(categoryId).color ?? '#78716c';
  return { color, backgroundColor: color, borderColor: color };
}

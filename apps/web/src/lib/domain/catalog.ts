import type { Workshop } from '../../types/workshop';

export function provinceSlug(name: string) {
  return name
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/^tp\.?\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Keep the API's relevance order within each province; never interleave cities.
export function groupByProvince(workshops: Workshop[]) {
  const groups = new Map<string, Workshop[]>();
  workshops.forEach((workshop) => {
    const key = workshop.provinceId ?? workshop.province;
    const group = groups.get(key) ?? [];
    group.push(workshop);
    groups.set(key, group);
  });
  return [...groups.values()].flat();
}

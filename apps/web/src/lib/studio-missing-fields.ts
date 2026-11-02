import type { ZodIssue } from 'zod';

const groups = [
  { label: 'tên studio', fields: ['name'] },
  {
    label: 'loại workshop',
    fields: ['categoryId', 'categoryIds', 'proposedCategoryName'],
  },
  { label: 'tỉnh/thành', fields: ['provinceId'] },
  { label: 'địa chỉ', fields: ['address', 'areaId'] },
  { label: 'SĐT', fields: ['contactPhone'] },
  { label: 'email', fields: ['contactEmail'] },
  { label: 'ảnh', fields: ['photoIds', 'draftStudioId'] },
  { label: 'giới thiệu hợp lệ', fields: ['description'] },
  { label: 'liên kết Facebook hợp lệ', fields: ['facebookUrl'] },
  { label: 'liên kết Instagram hợp lệ', fields: ['instagramUrl'] },
  { label: 'liên kết Google Maps hợp lệ', fields: ['googleMapsUrl'] },
];
export function studioMissingFields(issues: ZodIssue[]): string[] {
  const fields = new Set(issues.map((issue) => String(issue.path[0])));
  return groups
    .filter((group) => group.fields.some((field) => fields.has(field)))
    .map((group) => group.label);
}

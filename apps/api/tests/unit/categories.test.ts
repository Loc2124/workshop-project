import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  assertCategoryId,
  listCategories,
} from '../../src/modules/catalog/categories.repository.js';
import { workshopInputSchema } from '../../src/modules/workshops/workshops.schemas.js';

vi.mock('../../src/db/pool.js', () => ({ query: vi.fn() }));
const database = vi.mocked(query);
beforeEach(() => database.mockReset());

describe('category references', () => {
  it('exposes metadata including pending categories without duplicating names onto workshops', async () => {
    const category = {
      id: 'new-craft',
      slug: 'new-craft',
      name: 'New craft',
      icon: null,
      color: null,
      placeholderImage: null,
      status: 'pending',
      sortOrder: 999,
      keywords: ['thread'],
      description: 'Hand sewing',
    };
    database.mockResolvedValueOnce({ rows: [category], rowCount: 1 } as never);
    expect(await listCategories()).toEqual([category]);
    expect(database.mock.calls[0][0]).toContain('FROM categories');
    expect(database.mock.calls[0][0]).not.toContain("status = 'active'");
  });

  it('validates the foreign key before a write, including pending IDs', async () => {
    database.mockResolvedValueOnce({ rows: [{}], rowCount: 1 } as never);
    await expect(assertCategoryId('new-craft')).resolves.toBeUndefined();
    expect(database).toHaveBeenCalledWith(
      'SELECT 1 FROM categories WHERE id = $1',
      ['new-craft'],
    );
    database.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(assertCategoryId('missing')).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
  });

  it('requires categoryId and rejects the old category-name field', () => {
    const input = {
      title: 'Workshop',
      description: 'Description',
      categoryId: 'ceramics',
      durationMinutes: 90,
      basePrice: 0,
    };
    expect(workshopInputSchema.safeParse(input).success).toBe(true);
    expect(
      workshopInputSchema.safeParse({
        ...input,
        categoryId: undefined,
        category: 'Gốm',
      }).success,
    ).toBe(false);
  });
});

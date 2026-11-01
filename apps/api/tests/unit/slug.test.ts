import { describe, expect, it } from 'vitest';
import { createSlug } from '../../src/lib/slug.js';

describe('createSlug', () => {
  it('normalizes Vietnamese names and adds a unique suffix', () => {
    const first = createSlug('Gốm Nhà Mình');
    const second = createSlug('Gốm Nhà Mình');

    expect(first).toMatch(/^gom-nha-minh-[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });
});

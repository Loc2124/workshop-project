import type { PoolClient } from 'pg';
import { createSlug } from '../../lib/slug.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';

export async function listCategories() {
  const result = await query(`SELECT id, slug, name, icon, color,
    placeholder_image AS "placeholderImage", status, is_visible AS "isVisible", sort_order AS "sortOrder",
    keywords, description, image_position AS "imagePosition"
    FROM categories WHERE status='active' OR id='other' ORDER BY (id='other'),sort_order,name,id`);
  return result.rows;
}

export async function assertCategoryId(
  id: string,
  existingWorkshopId?: string,
) {
  const result = await query(
    "SELECT 1 FROM categories WHERE id = $1 AND ((is_visible AND (status='active' OR id='other')) OR EXISTS(SELECT 1 FROM workshops w WHERE w.id=$2::uuid AND w.category_id=categories.id))",
    [id, existingWorkshopId ?? null],
  );
  if (!result.rowCount)
    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Bộ môn không hợp lệ.');
}

export async function approveCategoryProposal(
  client: PoolClient,
  proposal: string,
): Promise<string> {
  // Serialize category creation so concurrent approvals reuse the same name.
  await client.query('SELECT pg_advisory_xact_lock(726139284)');
  const matching = await client.query<{ id: string }>(
    `SELECT id FROM categories WHERE lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = lower($1) ORDER BY (status = 'active') DESC, id LIMIT 1`,
    [proposal],
  );
  const approvedCategoryId =
    matching.rows[0]?.id ?? createSlug(proposal.slice(0, 50));
  if (matching.rows[0]) {
    await client.query(
      `UPDATE categories SET status = 'active' WHERE id = $1`,
      [approvedCategoryId],
    );
  } else {
    await client.query(
      `INSERT INTO categories (id, slug, name, status, icon, color, placeholder_image)
          VALUES ($1, $1, $2, 'active', 'Shapes', '#78716c', '/images/workshops/category-default.svg')`,
      [approvedCategoryId, proposal],
    );
  }
  return approvedCategoryId;
}

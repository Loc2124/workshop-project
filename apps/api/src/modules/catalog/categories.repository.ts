import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';

export async function listCategories() {
  const result = await query(`SELECT id, slug, name, icon, color,
    placeholder_image AS "placeholderImage", status, sort_order AS "sortOrder",
    keywords, description, image_position AS "imagePosition"
    FROM categories ORDER BY sort_order, name`);
  return result.rows;
}

export async function assertCategoryId(id: string) {
  const result = await query('SELECT 1 FROM categories WHERE id = $1', [id]);
  if (!result.rowCount)
    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Bộ môn không hợp lệ.');
}

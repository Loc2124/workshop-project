import { writeAuditLog } from './audit-log.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
export const categoryEdit = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();
export const categoryVisibility = z.object({ visible: z.boolean() }).strict();
export const categoryOrder = z
  .object({
    ids: z.array(z.string().min(1).max(150)).min(1).max(1000),
    expectedIds: z.array(z.string().min(1).max(150)).min(1).max(1000),
  })
  .strict();
export async function adminCategories() {
  return {
    categories: (
      await query(
        `SELECT c.id,c.name,c.slug,c.is_visible AS "isVisible",c.sort_order AS "sortOrder",c.status AS "reviewStatus",(SELECT count(*)::int FROM workshops w WHERE w.category_id=c.id) AS "workshopCount" FROM categories c ORDER BY (c.id='other'),c.sort_order,c.name,c.id`,
      )
    ).rows,
  };
}
function isUnique(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
export async function saveCategory(
  id: string | null,
  actor: string,
  input: z.infer<typeof categoryEdit>,
) {
  try {
    await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(726139284)');
      const duplicate = await client.query(
        'SELECT id FROM categories WHERE lower(trim(name))=lower($1) AND ($2::text IS NULL OR id<>$2)',
        [input.name, id],
      );
      if (duplicate.rowCount)
        throw new AppError(409, 'CONFLICT', 'Tên loại workshop đã tồn tại.');
      if (id) {
        if (
          !(
            await client.query(
              'SELECT id FROM categories WHERE id=$1 FOR UPDATE',
              [id],
            )
          ).rowCount
        )
          throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy loại workshop.');
        if (id === 'other' && (input.name !== 'Khác' || input.slug !== 'khac'))
          throw new AppError(
            400,
            'BAD_REQUEST',
            'Mục Khác là lựa chọn hệ thống, không thể đổi tên hoặc slug.',
          );
        await client.query(
          "UPDATE categories SET name=$2,slug=$3,status='active' WHERE id=$1",
          [id, input.name, input.slug],
        );
      } else {
        id = 'category-' + randomUUID();
        const rank = (
          await client.query<{ n: number }>(
            "SELECT coalesce(max(sort_order),0)+1 AS n FROM categories WHERE id<>'other'",
          )
        ).rows[0].n;
        await client.query(
          "INSERT INTO categories(id,name,slug,status,sort_order,icon,color,placeholder_image) VALUES($1,$2,$3,'active',$4,'Shapes','#78716c','/images/workshops/category-default.svg')",
          [id, input.name, input.slug, rank],
        );
        await client.query(
          "UPDATE categories SET sort_order=$1+1 WHERE id='other'",
          [rank],
        );
      }
      await writeAuditLog(client, {
        actorId: actor,
        action: 'category.saved',
        targetType: 'category',
        targetId: id,
        targetName: input.name,
        reason: `categoryId=${id}; slug=${input.slug}`,
      });
    });
  } catch (error) {
    if (isUnique(error))
      throw new AppError(
        409,
        'CONFLICT',
        'Slug đã được sử dụng. Vui lòng chọn slug khác.',
      );
    throw error;
  }
  return adminCategories();
}
export async function setCategoryVisibility(
  id: string,
  actor: string,
  visible: boolean,
) {
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(726139284)');
    if (id === 'other' && !visible)
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Khác phải luôn hiển thị ở cuối danh sách.',
      );
    const result = await client.query<{ name: string }>(
      "UPDATE categories SET is_visible=$2,status=CASE WHEN $2 THEN 'active' ELSE status END WHERE id=$1 RETURNING name",
      [id, visible],
    );
    if (!result.rowCount)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy loại workshop.');
    await writeAuditLog(client, {
      actorId: actor,
      action: visible ? 'category.shown' : 'category.hidden',
      targetType: 'category',
      targetId: id,
      targetName: result.rows[0].name,
      reason: `categoryId=${id}`,
    });
  });
  return adminCategories();
}
export async function reorderCategories(
  actor: string,
  input: z.infer<typeof categoryOrder>,
) {
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(726139284)');
    const current = (
      await client.query<{ id: string }>(
        "SELECT id FROM categories ORDER BY (id='other'),sort_order,name,id FOR UPDATE",
      )
    ).rows.map((r) => r.id);
    if (
      current.length !== input.expectedIds.length ||
      current.some((id, i) => id !== input.expectedIds[i])
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Danh mục đã thay đổi. Vui lòng tải lại trước khi sắp xếp.',
      );
    if (
      input.ids.length !== current.length ||
      new Set(input.ids).size !== current.length ||
      input.ids.some((id) => !current.includes(id)) ||
      input.ids.at(-1) !== 'other'
    )
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Thứ tự không hợp lệ. Khác phải nằm cuối danh sách.',
      );
    await client.query(
      'UPDATE categories c SET sort_order=ordered.rank FROM unnest($1::text[]) WITH ORDINALITY AS ordered(id,rank) WHERE c.id=ordered.id',
      [input.ids],
    );
    await writeAuditLog(client, {
      actorId: actor,
      action: 'category.reordered',
      targetType: 'category',
      targetId: 'workshop-categories',
      targetName: 'Danh mục workshop',
      reason: JSON.stringify(input.ids),
      before: { ids: current },
      after: { ids: input.ids },
    });
  });
  return adminCategories();
}

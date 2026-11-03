import { query } from '../../db/pool.js';
import { imagePublicUrl } from './image-storage.js';
import type { PoolClient } from 'pg';
export async function coverImages(
  ids: string[],
  type: 'studio' | 'workshop',
  client?: PoolClient,
) {
  if (!ids.length)
    return new Map<
      string,
      { imageUrl: string; thumbnailUrl?: string; mediumUrl?: string }
    >();
  const sql =
    type === 'workshop'
      ? `SELECT DISTINCT ON (i.workshop_id) i.workshop_id AS id,i.key,i.thumbnail_key AS "thumbnailKey",i.medium_key AS "mediumKey" FROM images i WHERE i.workshop_id=ANY($1::uuid[]) AND i.state='ready' ORDER BY i.workshop_id,i.created_at,i.id`
      : `SELECT DISTINCT ON (st.id) st.id,i.key,i.thumbnail_key AS "thumbnailKey",i.medium_key AS "mediumKey" FROM studios st JOIN images i ON i.id=ANY(st.photo_ids) AND i.state='ready' WHERE st.id=ANY($1::uuid[]) ORDER BY st.id,array_position(st.photo_ids,i.id)`;
  type Row = {
    id: string;
    key: string;
    thumbnailKey: string | null;
    mediumKey: string | null;
  };
  const result = client
    ? await client.query<Row>(sql, [ids])
    : await query<Row>(sql, [ids]);
  return new Map(
    result.rows.map((image) => [
      image.id,
      {
        imageUrl: imagePublicUrl(image.key),
        ...(image.thumbnailKey
          ? { thumbnailUrl: imagePublicUrl(image.thumbnailKey) }
          : {}),
        ...(image.mediumKey
          ? { mediumUrl: imagePublicUrl(image.mediumKey) }
          : {}),
      },
    ]),
  );
}
export async function attachCoverImages<T extends { id: string }>(
  items: T[],
  type: 'studio' | 'workshop',
  client?: PoolClient,
) {
  const images = await coverImages(
    items.map((item) => item.id),
    type,
    client,
  );
  return items.map((item) => ({ ...item, ...images.get(item.id) }));
}

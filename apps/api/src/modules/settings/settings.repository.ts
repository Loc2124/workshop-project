import {
  siteSettingsSchema,
  SETTINGS_KEY,
  defaultSiteSettings,
  type SiteSettings,
} from '@workshop/shared';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { writeAuditLog } from '../admin/audit-log.js';

export async function getSiteSettings(
  client?: PoolClient,
): Promise<SiteSettings> {
  const q = client ? client.query.bind(client) : query;
  let result = await q('SELECT value FROM settings WHERE key=$1', [SETTINGS_KEY]);
  if (!result.rows[0]) {
    await q(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, clock_timestamp()) 
       ON CONFLICT (key) DO NOTHING`,
      [SETTINGS_KEY, JSON.stringify(defaultSiteSettings)],
    );
    result = await q('SELECT value FROM settings WHERE key=$1', [SETTINGS_KEY]);
  }
  if (!result.rows[0]) {
    return defaultSiteSettings;
  }
  return siteSettingsSchema.parse(result.rows[0].value);
}

export async function getAdminSettings() {
  let row = (
    await query(
      'SELECT value,xmin::text AS version,updated_at AS "updatedAt" FROM settings WHERE key=$1',
      [SETTINGS_KEY],
    )
  ).rows[0];
  if (!row) {
    await query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, clock_timestamp()) 
       ON CONFLICT (key) DO NOTHING`,
      [SETTINGS_KEY, JSON.stringify(defaultSiteSettings)],
    );
    row = (
      await query(
        'SELECT value,xmin::text AS version,updated_at AS "updatedAt" FROM settings WHERE key=$1',
        [SETTINGS_KEY],
      )
    ).rows[0];
  }
  if (!row) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa tải được cài đặt hệ thống.',
    );
  }
  return {
    settings: siteSettingsSchema.parse(row.value),
    version: row.version,
    updatedAt: row.updatedAt,
  };
}
export async function saveSiteSettings(
  actor: string,
  input: { settings: SiteSettings; expectedVersion: string },
) {
  const settings = siteSettingsSchema.parse(input.settings);
  await withTransaction(async (client) => {
    const previous = (
      await client.query(
        'SELECT value,xmin::text AS version FROM settings WHERE key=$1 FOR UPDATE',
        [SETTINGS_KEY],
      )
    ).rows[0];
    if (previous?.version !== input.expectedVersion)
      throw new AppError(
        409,
        'CONFLICT',
        'Cài đặt đã thay đổi. Hãy tải lại trước khi lưu.',
      );
    await client.query(
      'UPDATE settings SET value=$2,updated_by=$3,updated_at=clock_timestamp() WHERE key=$1',
      [SETTINGS_KEY, settings, actor],
    );
    await writeAuditLog(client, {
      actorId: actor,
      action: 'settings.updated',
      targetType: 'settings',
      targetId: SETTINGS_KEY,
      targetName: 'Cài đặt hệ thống',
      before: previous.value,
      after: settings,
    });
  });
  return getAdminSettings();
}

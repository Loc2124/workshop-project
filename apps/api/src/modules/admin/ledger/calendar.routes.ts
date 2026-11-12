import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../../../db/pool.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAuditLog } from '../audit-log.js';

export const calendarRouter = Router();

const calendarInput = z
  .object({
    date: z.iso.date(),
    type: z.enum(['non_working', 'working']),
    label: z.string().trim().min(2).max(160),
    officialReference: z.string().trim().min(4).max(500),
  })
  .strict();

calendarRouter.get('/lich-nghi', async (req, res) => {
  const year = z.coerce
    .number()
    .int()
    .min(2020)
    .max(2100)
    .optional()
    .parse(req.query.year);
  const result = await withTransaction((client) =>
    client.query(
      `SELECT calendar_date AS date,day_type AS type,label,official_reference AS "officialReference",active,updated_at AS "updatedAt"
     FROM business_calendar_overrides WHERE ($1::int IS NULL OR extract(year FROM calendar_date)=$1)
     ORDER BY calendar_date`,
      [year ?? null],
    ),
  );
  res.json({ items: result.rows });
});

calendarRouter.post('/lich-nghi', async (req, res) => {
  const input = calendarInput.parse(req.body);
  await withTransaction(async (client) => {
    const existing = await client.query<{
      label: string;
      type: string;
      officialReference: string;
      active: boolean;
    }>(
      `SELECT label,day_type AS type,official_reference AS "officialReference",active FROM business_calendar_overrides WHERE calendar_date=$1 FOR UPDATE`,
      [input.date],
    );
    const before = existing.rows[0] ?? null;
    const action = !before ? 'created' : before.active ? 'updated' : 'enabled';
    await client.query(
      `INSERT INTO business_calendar_overrides(calendar_date,day_type,label,official_reference,active,created_by,updated_by)
       VALUES($1,$2,$3,$4,true,$5,$5)
       ON CONFLICT(calendar_date) DO UPDATE SET day_type=EXCLUDED.day_type,label=EXCLUDED.label,official_reference=EXCLUDED.official_reference,active=true,updated_by=EXCLUDED.updated_by,updated_at=clock_timestamp()`,
      [
        input.date,
        input.type,
        input.label,
        input.officialReference,
        req.user!.sub,
      ],
    );
    await client.query(
      `INSERT INTO business_calendar_events(calendar_date,actor_id,action,previous,current) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [
        input.date,
        req.user!.sub,
        action,
        before ? JSON.stringify(before) : null,
        JSON.stringify({
          type: input.type,
          label: input.label,
          officialReference: input.officialReference,
          active: true,
        }),
      ],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.calendar.date_saved',
      targetType: 'settings',
      targetId: input.date,
      targetName: 'Lịch ngày làm việc nhà nước',
      before,
      after: {
        date: input.date,
        type: input.type,
        label: input.label,
        officialReference: input.officialReference,
        active: true,
      },
    });
  });
  res.status(201).json({
    ok: true,
    date: input.date,
    type: input.type,
    label: input.label,
    active: true,
  });
});

calendarRouter.delete('/lich-nghi/:date', async (req, res) => {
  const date = z.iso.date().parse(req.params.date);
  await withTransaction(async (client) => {
    const result = await client.query<{
      label: string;
      dayType: string;
      officialReference: string;
    }>(
      `UPDATE business_calendar_overrides SET active=false,updated_by=$2,updated_at=clock_timestamp() WHERE calendar_date=$1 AND active RETURNING label,day_type AS "dayType",official_reference AS "officialReference"`,
      [date, req.user!.sub],
    );
    if (!result.rows[0])
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy ngày nghỉ đang áp dụng.',
      );
    await client.query(
      `INSERT INTO business_calendar_events(calendar_date,actor_id,action,previous,current) VALUES($1,$2,'disabled',$3::jsonb,$4::jsonb)`,
      [
        date,
        req.user!.sub,
        JSON.stringify({
          type: result.rows[0].dayType,
          label: result.rows[0].label,
          officialReference: result.rows[0].officialReference,
          active: true,
        }),
        JSON.stringify({
          type: result.rows[0].dayType,
          label: result.rows[0].label,
          active: false,
        }),
      ],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.calendar.date_disabled',
      targetType: 'settings',
      targetId: date,
      targetName: 'Lịch ngày làm việc nhà nước',
      before: { label: result.rows[0].label, active: true },
      after: { label: result.rows[0].label, active: false },
    });
  });
  res.json({ ok: true, date, active: false });
});

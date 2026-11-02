import { query } from '../../db/pool.js';
export async function selectAdminOverview() {
  const result = await query(`WITH bounds AS (
    SELECT now() AS generated, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today,
      date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS day_start
  ), days AS (SELECT generate_series((SELECT today FROM bounds)-29,(SELECT today FROM bounds),interval '1 day')::date AS day),
  daily AS (SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,count(*)::integer AS count FROM bookings WHERE created_at >= ((SELECT today FROM bounds)-29)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' GROUP BY 1)
  SELECT generated AS "generatedAt",
    json_build_object(
      'pendingStudios',(SELECT count(*)::int FROM studios WHERE NOT is_draft AND status='pending'),
      'newWorkshops',(SELECT count(*)::int FROM workshops WHERE created_at>=bounds.generated-interval '7 days'),
      'todayBookings',(SELECT count(*)::int FROM bookings WHERE created_at>=bounds.day_start AND created_at<bounds.day_start+interval '1 day'),
      'newUsers',(SELECT count(*)::int FROM users WHERE created_at>=bounds.generated-interval '7 days')
    ) AS metrics,
    json_build_object(
      'overdueStudios',(SELECT count(*)::int FROM studios WHERE NOT is_draft AND status='pending' AND submitted_at<bounds.generated-interval '48 hours'),
      'openReports',(SELECT count(*)::int FROM reports WHERE status IN ('new','in_progress')),
      'resubmittedStudios',(SELECT count(*)::int FROM studios WHERE NOT is_draft AND status='pending' AND resubmitted_at IS NOT NULL)
    ) AS tasks,
    COALESCE((SELECT json_agg(activity ORDER BY activity."createdAt" DESC, activity.id::bigint DESC) FROM (
      SELECT id::text,actor_name AS "actorName",action,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",created_at AS "createdAt"
      FROM admin_activity_log ORDER BY created_at DESC,id DESC LIMIT 10
    ) activity),'[]'::json) AS activities,
    (SELECT json_agg(json_build_object('date',to_char(days.day,'YYYY-MM-DD'),'count',coalesce(daily.count,0)) ORDER BY days.day) FROM days LEFT JOIN daily USING(day)) AS "bookingSeries"
  FROM bounds`);
  return result.rows[0];
}

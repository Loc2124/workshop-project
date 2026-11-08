-- Expiration in migration 019 sets reservation_status=cancelled. That does not
-- mean the customer cancelled these seats: a verified late payment may reclaim
-- capacity. Repair only untouched expired holds without any issued ticket.
-- No reservation, payment, refund or session seat counter is changed here.
WITH repaired AS (
 UPDATE booking_seats bs SET state='active',cancelled_at=NULL
 FROM bookings b WHERE b.id=bs.booking_id AND b.seat_revision=0 AND b.status='expired'
  AND bs.state='cancelled' AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id)
 RETURNING b.id,b.order_code
), bookings_repaired AS (SELECT DISTINCT id,order_code FROM repaired)
INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
SELECT NULL,'Hệ thống','booking.expired_seats_baseline_repaired','booking',id,order_code::text,
 'Sửa danh sách chỗ của lượt giữ đã hết hạn để đối soát tiền về muộn. Không giữ hoặc bán lại chỗ.' FROM bookings_repaired;

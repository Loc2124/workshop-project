-- Repair only refund-needed records with received money and no refund decision.
-- Keep receipts and every existing pending, forfeited or refunded decision.
WITH repaired AS (
  UPDATE bookings
  SET refund_due_amount = paid_amount,
      refund_status = 'pending'
  WHERE status = 'refund_needed'
    AND paid_amount > 0
    AND refund_status = 'not_applicable'
    AND refund_due_amount = 0
  RETURNING id, order_code
)
INSERT INTO admin_activity_log (
  actor_id, actor_name, action, entity_type, entity_id, entity_name, reason
)
SELECT NULL, 'Hệ thống', 'booking.refund_metadata.repaired', 'booking', id,
       COALESCE(order_code::text, id::text),
       'Bổ sung khoản cần hoàn từ số tiền đã nhận; chưa thực hiện chuyển hoàn.'
FROM repaired;

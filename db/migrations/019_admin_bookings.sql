ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE bookings ADD COLUMN reservation_status text NOT NULL DEFAULT 'pending'
 CHECK (reservation_status IN ('pending','confirmed','cancelled','completed'));
UPDATE bookings SET reservation_status=CASE WHEN status='paid' THEN 'confirmed' WHEN status IN ('expired','cancelled','refund_needed') THEN 'cancelled' ELSE 'pending' END;
CREATE INDEX bookings_reservation_status_idx ON bookings(reservation_status,created_at DESC);
CREATE TABLE booking_status_history (
 id bigserial PRIMARY KEY,
 booking_id uuid NOT NULL REFERENCES bookings(id),
 from_status text,
 to_status text NOT NULL,
 previous_payment_status text,
 payment_status text NOT NULL,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 actor_name text NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_status_history_booking_idx ON booking_status_history(booking_id,created_at,id);
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_status_history FROM anon,authenticated;
REVOKE ALL ON SEQUENCE booking_status_history_id_seq FROM anon,authenticated;
-- Current state only: earlier transitions were not recorded.
INSERT INTO booking_status_history(booking_id,to_status,payment_status,actor_name,reason)
 SELECT id,reservation_status,status::text,'Hệ thống','Trạng thái tại thời điểm bắt đầu lưu lịch sử' FROM bookings;

CREATE FUNCTION sync_booking_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status IN ('expired','cancelled','refund_needed') THEN NEW.reservation_status:='cancelled';
  ELSIF NEW.status='paid' AND NEW.reservation_status IN ('pending','confirmed') THEN NEW.reservation_status:='confirmed';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_reservation_sync BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION sync_booking_reservation();

CREATE FUNCTION append_booking_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; actor_label text; event_reason text; previous text; old_payment text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.reservation_status IS NOT DISTINCT FROM OLD.reservation_status AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 actor:=nullif(current_setting('app.booking_actor',true),'')::uuid;
 SELECT full_name INTO actor_label FROM users WHERE id=actor;
 actor_label:=coalesce(actor_label,'Hệ thống');
 event_reason:=coalesce(nullif(current_setting('app.booking_reason',true),''),'Cập nhật trạng thái từ hệ thống');
 IF TG_OP='UPDATE' THEN previous:=OLD.reservation_status;old_payment:=OLD.status::text; END IF;
 INSERT INTO booking_status_history(booking_id,from_status,to_status,previous_payment_status,payment_status,actor_id,actor_name,reason)
 VALUES(NEW.id,previous,NEW.reservation_status,old_payment,NEW.status::text,actor,actor_label,event_reason);
 INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason,previous_status,new_status)
 VALUES(actor,actor_label,'booking.'||NEW.reservation_status,'booking',NEW.id,NEW.order_code::text,event_reason,previous,NEW.reservation_status);
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_activity AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION append_booking_activity();

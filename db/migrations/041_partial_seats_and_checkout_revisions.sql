ALTER TABLE bookings
 ADD COLUMN original_quantity integer,
 ADD COLUMN original_total_amount integer,
 ADD COLUMN original_deposit_amount integer,
 ADD COLUMN seat_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN extra_received_amount bigint NOT NULL DEFAULT 0 CHECK(extra_received_amount>=0),
 ADD COLUMN extra_refund_due_amount bigint NOT NULL DEFAULT 0 CHECK(extra_refund_due_amount>=0),
 ADD COLUMN extra_refunded_amount bigint NOT NULL DEFAULT 0 CHECK(extra_refunded_amount>=0);
UPDATE bookings SET original_quantity=quantity,original_total_amount=total_amount,original_deposit_amount=deposit_amount;
ALTER TABLE bookings ALTER COLUMN original_quantity SET NOT NULL, ALTER COLUMN original_total_amount SET NOT NULL, ALTER COLUMN original_deposit_amount SET NOT NULL;
CREATE FUNCTION snapshot_original_booking_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.original_quantity:=NEW.quantity;NEW.original_total_amount:=NEW.total_amount;NEW.original_deposit_amount:=NEW.deposit_amount;RETURN NEW;
END;$$;
CREATE TRIGGER booking_original_amounts BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_original_booking_amounts();

CREATE TABLE booking_seats(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES bookings(id),
 seq integer NOT NULL CHECK(seq BETWEEN 1 AND 10),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled')),
 total_amount integer NOT NULL CHECK(total_amount>=0),
 deposit_amount integer NOT NULL CHECK(deposit_amount>=0),
 paid_amount integer NOT NULL DEFAULT 0 CHECK(paid_amount>=0),
 refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
 refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
 cancelled_at timestamptz,
 UNIQUE(booking_id,seq)
);
INSERT INTO booking_seats(booking_id,seq,state,total_amount,deposit_amount,paid_amount,refund_due_amount,refunded_amount,cancelled_at)
SELECT b.id,n,CASE WHEN b.reservation_status='cancelled' OR t.status='void' THEN 'cancelled' ELSE 'active' END,
 original_seat_share(b.total_amount,b.quantity,n),original_seat_share(b.deposit_amount,b.quantity,n),
 COALESCE(t.paid_amount,original_seat_share(b.paid_amount,b.quantity,n)),
 COALESCE(t.refund_due_amount,original_seat_share(b.refund_due_amount,b.quantity,n)),
 COALESCE(t.refunded_amount,original_seat_share(b.refunded_amount,b.quantity,n)),b.cancelled_at
FROM bookings b CROSS JOIN LATERAL generate_series(1,b.quantity)n LEFT JOIN tickets t ON t.booking_id=b.id AND t.seq=n;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_seats FROM PUBLIC,anon,authenticated;
CREATE FUNCTION initialize_booking_seats() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO booking_seats(booking_id,seq,total_amount,deposit_amount)
 SELECT NEW.id,n,original_seat_share(NEW.total_amount,NEW.quantity,n),original_seat_share(NEW.deposit_amount,NEW.quantity,n) FROM generate_series(1,NEW.quantity)n;
 RETURN NEW;
END;$$;
CREATE TRIGGER booking_seats_initial AFTER INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION initialize_booking_seats();

ALTER TABLE payments ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN checkout_claimed_at timestamptz,
 ADD COLUMN checkout_setup text NOT NULL DEFAULT 'ready' CHECK(checkout_setup IN ('pending','creating','ready','unknown','superseded'));
CREATE UNIQUE INDEX payment_deposit_revision ON payments(booking_id,checkout_revision) WHERE kind='deposit';
CREATE TABLE booking_extra_refunds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL REFERENCES payments(id),booking_id uuid NOT NULL REFERENCES bookings(id),
 source_event_id uuid NOT NULL UNIQUE REFERENCES webhook_events(id),provider_ref text,
 amount integer NOT NULL CHECK(amount>0),refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE booking_extra_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_extra_refunds FROM PUBLIC,anon,authenticated;
ALTER TABLE booking_refund_receipts ALTER COLUMN amount TYPE bigint;

CREATE OR REPLACE FUNCTION initialize_ticket_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seat booking_seats;
BEGIN
 SELECT * INTO seat FROM booking_seats WHERE booking_id=NEW.booking_id AND seq=NEW.seq;
 IF NOT FOUND OR seat.state<>'active' THEN RAISE EXCEPTION 'Seat is not active';END IF;
 NEW.total_amount:=seat.total_amount;NEW.deposit_amount:=seat.deposit_amount;NEW.paid_amount:=seat.paid_amount;
 RETURN NEW;
END;$$;
CREATE FUNCTION mirror_ticket_to_booking_seat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE booking_seats SET paid_amount=NEW.paid_amount,refund_due_amount=NEW.refund_due_amount,refunded_amount=NEW.refunded_amount,
 state=CASE WHEN NEW.status='void' THEN 'cancelled' ELSE state END,
 cancelled_at=CASE WHEN NEW.status='void' THEN COALESCE(cancelled_at,clock_timestamp()) ELSE cancelled_at END
 WHERE booking_id=NEW.booking_id AND seq=NEW.seq;
 RETURN NEW;
END;$$;
CREATE TRIGGER ticket_seat_mirror AFTER UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION mirror_ticket_to_booking_seat();

CREATE FUNCTION synchronize_booking_seat_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE due integer;
BEGIN
 IF NEW.seat_revision=0 THEN
  IF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE booking_seats SET paid_amount=original_seat_share(NEW.paid_amount,NEW.original_quantity,seq) WHERE booking_id=NEW.id;
  END IF;
  IF NEW.reservation_status='cancelled' THEN
   UPDATE booking_seats SET state='cancelled',cancelled_at=COALESCE(cancelled_at,NEW.cancelled_at,clock_timestamp()),
    refund_due_amount=GREATEST(refunded_amount,CASE WHEN NEW.refund_due_amount>=NEW.paid_amount THEN paid_amount
     WHEN NEW.refund_due_amount=GREATEST(0,NEW.paid_amount-NEW.deposit_amount) THEN GREATEST(0,paid_amount-deposit_amount)
     ELSE original_seat_share(NEW.refund_due_amount,NEW.original_quantity,seq) END) WHERE booking_id=NEW.id;
  END IF;
 ELSIF current_setting('app.partial_seat_operation',true) IS DISTINCT FROM 'true' AND NEW.paid_amount<>OLD.paid_amount AND NEW.reservation_status<>'cancelled' THEN
  IF NEW.paid_amount<>NEW.total_amount THEN RAISE EXCEPTION 'Partial receipt requires seat allocation';END IF;
  UPDATE booking_seats SET paid_amount=total_amount WHERE booking_id=NEW.id AND state='active';
  UPDATE tickets t SET paid_amount=s.paid_amount,
   refund_due_amount=CASE WHEN t.attendance_status='absent' THEN GREATEST(t.refunded_amount,s.paid_amount-s.deposit_amount) ELSE t.refund_due_amount END,
   refund_history_locked=t.refund_history_locked OR (t.attendance_status='absent' AND s.paid_amount>s.deposit_amount),
   refund_started_at=CASE WHEN t.attendance_status='absent' AND s.paid_amount>s.deposit_amount THEN COALESCE(t.refund_started_at,clock_timestamp()) ELSE t.refund_started_at END
   FROM booking_seats s WHERE s.booking_id=NEW.id AND s.state='active' AND t.booking_id=s.booking_id AND t.seq=s.seq;
  SELECT COALESCE(sum(refund_due_amount),0)::integer INTO due FROM booking_seats WHERE booking_id=NEW.id;
  UPDATE bookings SET refund_due_amount=due,refund_status=CASE WHEN due+extra_refund_due_amount>refunded_amount+extra_refunded_amount THEN 'pending' WHEN due+extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER aa_booking_seat_receipts AFTER UPDATE OF paid_amount,reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION synchronize_booking_seat_receipts();

CREATE FUNCTION preserve_partial_seat_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seqs integer[];due integer;returned integer;
BEGIN
 IF OLD.seat_revision>0 AND OLD.reservation_status<>'cancelled' AND NEW.reservation_status='cancelled'
    AND current_setting('app.partial_seat_operation',true) IS DISTINCT FROM 'true' THEN
  SELECT array_agg(seq) INTO seqs FROM booking_seats WHERE booking_id=OLD.id AND state='active';
  UPDATE booking_seats SET state='cancelled',cancelled_at=clock_timestamp(),refund_due_amount=paid_amount WHERE booking_id=OLD.id AND seq=ANY(seqs);
  UPDATE tickets t SET status='void',refund_due_amount=s.refund_due_amount,refund_history_locked=t.refund_history_locked OR s.refund_due_amount>0,
    refund_started_at=CASE WHEN s.refund_due_amount>0 THEN COALESCE(t.refund_started_at,clock_timestamp()) ELSE t.refund_started_at END
    FROM booking_seats s WHERE s.booking_id=OLD.id AND t.booking_id=s.booking_id AND t.seq=s.seq AND s.seq=ANY(seqs);
  SELECT COALESCE(sum(refund_due_amount),0)::integer,COALESCE(sum(refunded_amount),0)::integer INTO due,returned FROM booking_seats WHERE booking_id=OLD.id;
  NEW.refund_due_amount:=due;NEW.refunded_amount:=returned;
  NEW.refund_status:=CASE WHEN due+NEW.extra_refund_due_amount>returned+NEW.extra_refunded_amount THEN 'pending' WHEN due+NEW.extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END;
  NEW.status:=CASE WHEN NEW.refund_status='pending' THEN 'refund_needed'::booking_status ELSE 'cancelled'::booking_status END;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER booking_partial_cancel_guard BEFORE UPDATE OF reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION preserve_partial_seat_cancellation();

-- Keep the pre-existing whole-group synchronizer for untouched bookings only.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('synchronize_ticket_finances()'::regprocedure) INTO definition;
 definition:=regexp_replace(definition,'BEGIN[[:space:]]+',E'BEGIN\n IF NEW.seat_revision>0 THEN RETURN NEW; END IF;\n');
 EXECUTE definition;
END;$$;

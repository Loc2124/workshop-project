ALTER TABLE bookings ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0);
UPDATE bookings SET refunded_amount=refund_due_amount WHERE refund_status='refunded';
CREATE TABLE booking_refund_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  amount integer NOT NULL CHECK(amount>0),
  reference text,
  actor_id uuid REFERENCES users(id),
  refunded_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO booking_refund_receipts(booking_id,amount,reference,refunded_at)
SELECT id,refunded_amount,refund_reference,refunded_at FROM bookings WHERE refunded_amount>0;
ALTER TABLE booking_refund_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_refund_receipts FROM PUBLIC,anon,authenticated;

ALTER TABLE tickets
  ADD COLUMN attendance_status text NOT NULL DEFAULT 'unmarked' CHECK(attendance_status IN ('unmarked','attended','absent')),
  ADD COLUMN attendance_marked_by uuid REFERENCES users(id),
  ADD COLUMN attendance_marked_at timestamptz,
  ADD COLUMN total_amount integer NOT NULL DEFAULT 0 CHECK(total_amount>=0),
  ADD COLUMN deposit_amount integer NOT NULL DEFAULT 0 CHECK(deposit_amount>=0),
  ADD COLUMN paid_amount integer NOT NULL DEFAULT 0 CHECK(paid_amount>=0),
  ADD COLUMN refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
  ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
  ADD COLUMN refund_started_at timestamptz,
  ADD COLUMN refund_history_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);

CREATE FUNCTION original_seat_share(amount integer,quantity integer,seq integer) RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN seq=quantity THEN amount-(amount/quantity)*(quantity-1) ELSE amount/quantity END
$$;
UPDATE tickets t SET
  total_amount=original_seat_share(b.total_amount,b.quantity,t.seq),
  deposit_amount=original_seat_share(b.deposit_amount,b.quantity,t.seq),
  paid_amount=original_seat_share(b.paid_amount,b.quantity,t.seq),
  refund_due_amount=original_seat_share(b.refund_due_amount,b.quantity,t.seq),
  refunded_amount=original_seat_share(b.refunded_amount,b.quantity,t.seq),
  refund_started_at=CASE WHEN b.refund_due_amount>0 THEN COALESCE(b.refunded_at,b.cancelled_at) END,
  refund_history_locked=b.refund_due_amount>0,
  attendance_status=b.attendance_status,attendance_marked_by=b.attendance_marked_by,attendance_marked_at=b.attendance_marked_at
FROM bookings b WHERE b.id=t.booking_id;

CREATE FUNCTION initialize_ticket_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b bookings;
BEGIN
 SELECT * INTO b FROM bookings WHERE id=NEW.booking_id;
 NEW.total_amount:=original_seat_share(b.total_amount,b.quantity,NEW.seq);
 NEW.deposit_amount:=original_seat_share(b.deposit_amount,b.quantity,NEW.seq);
 NEW.paid_amount:=original_seat_share(b.paid_amount,b.quantity,NEW.seq);
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_amount_snapshot BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION initialize_ticket_amounts();
CREATE FUNCTION increment_ticket_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_version BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION increment_ticket_version();

-- Existing whole-booking cancellation APIs remain compatible. A refund is cumulative;
-- outstanding money is refund_due_amount minus refunded_amount.
CREATE FUNCTION synchronize_ticket_finances() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE due integer;
BEGIN
 IF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE tickets SET paid_amount=original_seat_share(NEW.paid_amount,NEW.quantity,seq) WHERE booking_id=NEW.id;
 END IF;
 IF NEW.reservation_status='cancelled' THEN
   UPDATE tickets SET refund_due_amount=GREATEST(refunded_amount,
     CASE WHEN NEW.refund_due_amount>=NEW.paid_amount THEN paid_amount
       WHEN NEW.refund_due_amount=GREATEST(0,NEW.paid_amount-NEW.deposit_amount) THEN GREATEST(0,paid_amount-deposit_amount)
       ELSE original_seat_share(NEW.refund_due_amount,NEW.quantity,seq) END),
     refund_started_at=CASE WHEN NEW.refund_due_amount>0 THEN COALESCE(refund_started_at,clock_timestamp()) ELSE refund_started_at END
     ,refund_history_locked=refund_history_locked OR NEW.refund_due_amount>0
   WHERE booking_id=NEW.id;
 ELSIF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE tickets SET refund_due_amount=GREATEST(refunded_amount,paid_amount-deposit_amount),
     refund_started_at=CASE WHEN paid_amount>deposit_amount THEN COALESCE(refund_started_at,clock_timestamp()) ELSE refund_started_at END,
     refund_history_locked=refund_history_locked OR paid_amount>deposit_amount
   WHERE booking_id=NEW.id AND attendance_status='absent';
   SELECT COALESCE(sum(refund_due_amount),0)::integer INTO due FROM tickets WHERE booking_id=NEW.id;
   IF due>NEW.refund_due_amount THEN
     UPDATE bookings SET refund_due_amount=due,refund_status=CASE WHEN due>refunded_amount THEN 'pending' ELSE 'refunded' END WHERE id=NEW.id;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_financial_sync AFTER UPDATE OF paid_amount,reservation_status,refund_due_amount ON bookings FOR EACH ROW EXECUTE FUNCTION synchronize_ticket_finances();

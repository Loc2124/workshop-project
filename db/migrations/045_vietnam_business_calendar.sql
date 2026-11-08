-- Government-published Vietnam calendar. Explicit make-up working dates can
-- override the normal Monday-Friday rule, so weekend swaps are represented.
CREATE TABLE business_calendar_overrides (
  calendar_date date PRIMARY KEY,
  day_type text NOT NULL CHECK (day_type IN ('non_working','working')),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 160),
  official_reference text NOT NULL CHECK (length(trim(official_reference)) BETWEEN 4 AND 500),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX business_calendar_active_year_idx
  ON business_calendar_overrides ((extract(year FROM calendar_date)), calendar_date)
  WHERE active;

-- Official Government News Portal: 24 November is Vietnam Culture Day and
-- employees have the day off; this date is upcoming in the current 2026 cycle.
INSERT INTO business_calendar_overrides(calendar_date,day_type,label,official_reference)
VALUES (
  DATE '2026-11-24',
  'non_working',
  'Ngày Văn hóa Việt Nam',
  'https://xaydungchinhsach.chinhphu.vn/ngay-24-11-hang-nam-la-ngay-van-hoa-viet-nam-nguoi-lao-dong-duoc-nghi-huong-nguyen-luong-119260113152642414.htm'
);

CREATE TABLE business_calendar_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  calendar_date date NOT NULL,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('created','updated','disabled','enabled')),
  previous jsonb,
  current jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX business_calendar_events_date_idx ON business_calendar_events (calendar_date, created_at);
ALTER TABLE business_calendar_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_calendar_overrides, business_calendar_events FROM PUBLIC, anon, authenticated;

CREATE FUNCTION is_open_slot_working_day(day_to_check date) RETURNS boolean
LANGUAGE sql STABLE STRICT AS $$
  SELECT COALESCE(
    (SELECT c.day_type='working' FROM business_calendar_overrides c WHERE c.calendar_date=day_to_check AND c.active),
    extract(isodow FROM day_to_check) BETWEEN 1 AND 5
  )
$$;

-- Count full working dates after the local date of the triggering event and
-- preserve its local clock time. Weekend/holiday event dates are not counted.
CREATE FUNCTION add_open_slot_business_days(event_at timestamptz, days_to_add integer)
RETURNS timestamptz LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  local_event timestamp := event_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
  due_date date := (event_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  counted integer := 0;
BEGIN
  IF days_to_add < 0 THEN RAISE EXCEPTION 'days_to_add must be non-negative'; END IF;
  WHILE counted < days_to_add LOOP
    due_date := due_date + 1;
    IF is_open_slot_working_day(due_date) THEN counted := counted + 1; END IF;
  END LOOP;
  RETURN (due_date + local_event::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
END;
$$;

CREATE FUNCTION financial_obligation_deadline(kind text, event_at timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE STRICT AS $$
  SELECT CASE kind
    WHEN 'customer_refund' THEN add_open_slot_business_days(event_at, 7)
    WHEN 'studio_payout' THEN add_open_slot_business_days(event_at, 3)
    ELSE NULL
  END
$$;

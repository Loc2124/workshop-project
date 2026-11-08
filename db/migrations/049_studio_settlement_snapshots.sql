CREATE TABLE studio_settlement_snapshots (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id),
  session_id uuid NOT NULL REFERENCES sessions(id),
  due_at timestamptz NOT NULL,
  net_amount bigint NOT NULL,
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO studio_settlement_snapshots(booking_id,session_id,due_at,net_amount,breakdown,created_at)
SELECT o.booking_id,b.session_id,o.due_at,o.amount,
  COALESCE(o.payout_snapshot,jsonb_build_object('legacyPayout',o.amount)),
  COALESCE(o.payout_snapshot_at,o.created_at)
FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
WHERE o.kind='studio_payout' AND o.due_at IS NOT NULL
ON CONFLICT(booking_id) DO NOTHING;

ALTER TABLE studio_settlement_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_settlement_snapshots FROM PUBLIC,anon,authenticated;

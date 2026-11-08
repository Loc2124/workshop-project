CREATE TABLE booking_requests (
  user_id uuid NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK(length(payload_hash)=64),
  booking_id uuid UNIQUE REFERENCES bookings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_requests FROM PUBLIC,anon,authenticated;

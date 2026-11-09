ALTER TABLE tickets
  ADD COLUMN attendance_method text
  CHECK (attendance_method IN ('check_in', 'manual_confirmation'));

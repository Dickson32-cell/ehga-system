-- EHGA Mobility operations schema
-- All money in GHS. Computed columns are maintained as GENERATED ALWAYS or by triggers.

CREATE TABLE IF NOT EXISTS app_user (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('MANAGING_DIRECTOR','HR','OPERATIONS_MANAGER','DISPATCHER','ACCOUNTANT','DRIVER','RIDER')),
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS serial_counter (
  code_key TEXT PRIMARY KEY,
  prefix   TEXT NOT NULL,
  seq      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS setup_kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle (
  vehicle_code        TEXT PRIMARY KEY,
  type                TEXT NOT NULL,
  primary_role        TEXT NOT NULL,
  registration        TEXT,
  model               TEXT,
  color               TEXT,
  opening_odometer    NUMERIC(10,1) NOT NULL DEFAULT 0,
  current_odometer    NUMERIC(10,1) NOT NULL DEFAULT 0,
  next_service_odometer NUMERIC(10,1),
  km_to_service       NUMERIC(12,1) GENERATED ALWAYS AS (COALESCE(next_service_odometer,0) - current_odometer) STORED,
  last_inspection     DATE,
  insurance_expiry    DATE,
  roadworthy_expiry   DATE,
  status              TEXT NOT NULL DEFAULT 'Available',
  open_defect         TEXT,
  required_action     TEXT,
  assigned_driver     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS booking (
  id                SERIAL PRIMARY KEY,
  booking_code      TEXT UNIQUE,
  travel_date       DATE NOT NULL,
  direction         TEXT NOT NULL,
  departure_time    TEXT,
  customer_name     TEXT NOT NULL,
  phone             TEXT,
  seats             INTEGER NOT NULL DEFAULT 1,
  fare_per_seat     NUMERIC(12,2) NOT NULL DEFAULT 90,
  passenger_revenue NUMERIC(12,2) GENERATED ALWAYS AS (seats * fare_per_seat) STORED,
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (seats * fare_per_seat - amount_paid) STORED,
  payment_method    TEXT,
  status            TEXT NOT NULL DEFAULT 'Pending',
  pickup_point      TEXT,
  dropoff_point     TEXT,
  vehicle_id        TEXT REFERENCES vehicle(vehicle_code),
  booked_by         TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS dispatch (
  id                  SERIAL PRIMARY KEY,
  dispatch_code       TEXT UNIQUE,
  date                DATE NOT NULL,
  departure_time      TEXT,
  direction           TEXT NOT NULL,
  vehicle_id          TEXT REFERENCES vehicle(vehicle_code),
  driver              TEXT,
  seats_booked        INTEGER NOT NULL DEFAULT 0,
  seat_capacity       INTEGER NOT NULL DEFAULT 3,
  occupancy           NUMERIC(8,4) GENERATED ALWAYS AS (CASE WHEN seat_capacity > 0 THEN seats_booked::NUMERIC / seat_capacity ELSE 0 END) STORED,
  passenger_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
  parcel_revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_revenue       NUMERIC(12,2) GENERATED ALWAYS AS (passenger_revenue + parcel_revenue) STORED,
  decision            TEXT NOT NULL DEFAULT 'Go',
  decision_reason     TEXT,
  scheduled_departure TEXT,
  actual_departure    TEXT,
  arrival_time        TEXT,
  on_time_status      TEXT,
  dispatcher          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS parcel (
  id                SERIAL PRIMARY KEY,
  parcel_code       TEXT UNIQUE,
  booking_date      DATE NOT NULL,
  sender            TEXT NOT NULL,
  sender_phone      TEXT,
  recipient         TEXT NOT NULL,
  recipient_phone   TEXT,
  pickup_address    TEXT,
  delivery_address  TEXT,
  description       TEXT,
  declared_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
  size              TEXT NOT NULL DEFAULT 'Small',
  service           TEXT,
  intercity_charge  NUMERIC(12,2) NOT NULL DEFAULT 0,
  pickup_charge     NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_charge   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_charge      NUMERIC(12,2) GENERATED ALWAYS AS (intercity_charge + pickup_charge + delivery_charge) STORED,
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (intercity_charge + pickup_charge + delivery_charge - amount_paid) STORED,
  payment_method    TEXT,
  status            TEXT NOT NULL DEFAULT 'Booked',
  vehicle_id        TEXT REFERENCES vehicle(vehicle_code),
  rider             TEXT,
  proof_of_delivery TEXT,
  exception_notes   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS trip (
  id                   SERIAL PRIMARY KEY,
  trip_code            TEXT UNIQUE,
  date                 DATE NOT NULL,
  vehicle_id           TEXT REFERENCES vehicle(vehicle_code),
  driver               TEXT,
  direction            TEXT,
  start_odometer       NUMERIC(10,1) NOT NULL DEFAULT 0,
  end_odometer         NUMERIC(10,1) NOT NULL DEFAULT 0,
  kilometres           NUMERIC(10,1) GENERATED ALWAYS AS (GREATEST(end_odometer - start_odometer, 0)) STORED,
  passengers           INTEGER NOT NULL DEFAULT 0,
  passenger_revenue    NUMERIC(12,2) NOT NULL DEFAULT 0,
  parcel_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  private_hire_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_revenue        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_revenue        NUMERIC(12,2) GENERATED ALWAYS AS (passenger_revenue + parcel_revenue + private_hire_revenue + other_revenue) STORED,
  tolls                NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel_cost            NUMERIC(12,2) NOT NULL DEFAULT 0,
  maintenance_reserve  NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(end_odometer - start_odometer, 0) * 0.35) STORED,
  direct_contribution  NUMERIC(12,2) GENERATED ALWAYS AS ((passenger_revenue + parcel_revenue + private_hire_revenue + other_revenue) - tolls - fuel_cost - (GREATEST(end_odometer - start_odometer, 0) * 0.35)) STORED,
  revenue_per_km       NUMERIC(12,4) GENERATED ALWAYS AS (CASE WHEN GREATEST(end_odometer - start_odometer, 0) > 0 THEN (passenger_revenue + parcel_revenue + private_hire_revenue + other_revenue) / GREATEST(end_odometer - start_odometer, 0) ELSE 0 END) STORED,
  incident_status      TEXT NOT NULL DEFAULT 'None',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted              BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS fuel (
  id                  SERIAL PRIMARY KEY,
  fuel_code           TEXT UNIQUE,
  date                DATE NOT NULL,
  vehicle_id          TEXT NOT NULL REFERENCES vehicle(vehicle_code),
  trip_id             INTEGER REFERENCES trip(id),
  station             TEXT,
  litres              NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_litre     NUMERIC(10,2) NOT NULL DEFAULT 17,
  total_fuel_cost     NUMERIC(12,2) GENERATED ALWAYS AS (litres * price_per_litre) STORED,
  odometer            NUMERIC(10,1) NOT NULL DEFAULT 0,
  km_since_prior_fuel NUMERIC(10,1) NOT NULL DEFAULT 0,
  litres_per_100km    NUMERIC(10,2) GENERATED ALWAYS AS (CASE WHEN km_since_prior_fuel > 0 THEN litres * 100 / km_since_prior_fuel ELSE 0 END) STORED,
  receipt_number      TEXT,
  approved_by         TEXT,
  variance_note       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS private_hire (
  id              SERIAL PRIMARY KEY,
  hire_code       TEXT UNIQUE,
  service_date    DATE NOT NULL,
  customer        TEXT NOT NULL,
  phone           TEXT,
  service_type    TEXT NOT NULL DEFAULT 'Standard seat',
  pickup          TEXT,
  destination     TEXT,
  start_time      TEXT,
  end_time        TEXT,
  vehicle_id      TEXT REFERENCES vehicle(vehicle_code),
  driver          TEXT,
  quoted_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance         NUMERIC(12,2) GENERATED ALWAYS AS (quoted_amount - amount_paid) STORED,
  status          TEXT NOT NULL DEFAULT 'Inquiry',
  kilometres      NUMERIC(10,1) NOT NULL DEFAULT 0,
  fuel_and_tolls  NUMERIC(12,2) NOT NULL DEFAULT 0,
  contribution    NUMERIC(12,2) GENERATED ALWAYS AS (quoted_amount - fuel_and_tolls) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS school_student (
  id                  SERIAL PRIMARY KEY,
  student_code        TEXT UNIQUE,
  student_name        TEXT NOT NULL,
  guardian            TEXT,
  guardian_phone      TEXT,
  pickup_address      TEXT,
  school              TEXT,
  route_id            TEXT,
  am_pickup_time      TEXT,
  pm_pickup_time      TEXT,
  monthly_fee         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance             NUMERIC(12,2) GENERATED ALWAYS AS (monthly_fee - amount_paid) STORED,
  payment_status      TEXT NOT NULL DEFAULT 'Pending',
  authorized_guardian1 TEXT,
  authorized_guardian2 TEXT,
  pickup_code         TEXT NOT NULL UNIQUE,
  vehicle_id          TEXT REFERENCES vehicle(vehicle_code),
  driver              TEXT,
  start_date          DATE,
  end_date            DATE,
  active_status       BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cash_reconciliation (
  id                   SERIAL PRIMARY KEY,
  date                 DATE NOT NULL UNIQUE,
  opening_cash         NUMERIC(12,2) NOT NULL DEFAULT 0,
  passenger_cash       NUMERIC(12,2) NOT NULL DEFAULT 0,
  passenger_momo       NUMERIC(12,2) NOT NULL DEFAULT 0,
  parcel_cash          NUMERIC(12,2) NOT NULL DEFAULT 0,
  parcel_momo          NUMERIC(12,2) NOT NULL DEFAULT 0,
  private_hire_receipts NUMERIC(12,2) NOT NULL DEFAULT 0,
  school_receipts      NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_income         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_collections    NUMERIC(12,2) GENERATED ALWAYS AS (passenger_cash + passenger_momo + parcel_cash + parcel_momo + private_hire_receipts + school_receipts + other_income) STORED,
  refunds              NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel_paid_cash       NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_expenses       NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_closing_cash NUMERIC(12,2) GENERATED ALWAYS AS (opening_cash + passenger_cash + parcel_cash + private_hire_receipts + school_receipts + other_income - refunds - fuel_paid_cash - other_expenses) STORED,
  actual_closing_cash  NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_variance        NUMERIC(12,2) GENERATED ALWAYS AS (actual_closing_cash - (opening_cash + passenger_cash + parcel_cash + private_hire_receipts + school_receipts + other_income - refunds - fuel_paid_cash - other_expenses)) STORED,
  momo_expected        NUMERIC(12,2) NOT NULL DEFAULT 0,
  momo_confirmed       NUMERIC(12,2) NOT NULL DEFAULT 0,
  momo_variance        NUMERIC(12,2) GENERATED ALWAYS AS (momo_confirmed - momo_expected) STORED,
  reconciled_by        TEXT,
  review_status        TEXT NOT NULL DEFAULT 'OK',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted              BOOLEAN NOT NULL DEFAULT FALSE
);

-- Escalation: flag cash reconciliation for review when |cash_variance| > tolerance (default 50)
CREATE OR REPLACE FUNCTION ehga_cash_review_flag() RETURNS trigger AS $$
DECLARE
  tol NUMERIC := 50;
BEGIN
  SELECT COALESCE(value::NUMERIC, 50) INTO tol FROM setup_kv WHERE key = 'cash_variance_tolerance';
  IF tol IS NULL THEN tol := 50; END IF;
  IF ABS(NEW.cash_variance) > tol THEN
    NEW.review_status := 'Escalated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cash_review ON cash_reconciliation;
CREATE TRIGGER trg_cash_review
BEFORE INSERT OR UPDATE ON cash_reconciliation
FOR EACH ROW EXECUTE FUNCTION ehga_cash_review_flag();

-- Serial codes: transactional, never reused even after deletion
CREATE OR REPLACE FUNCTION next_serial(p_key TEXT) RETURNS TEXT AS $$
DECLARE
  r RECORD;
  code TEXT;
BEGIN
  INSERT INTO serial_counter(code_key, prefix, seq)
  VALUES (p_key, p_key || '-', 0)
  ON CONFLICT (code_key) DO NOTHING;

  UPDATE serial_counter
     SET seq = seq + 1
   WHERE code_key = p_key
  RETURNING prefix, seq INTO r;

  code := r.prefix || lpad(r.seq::TEXT, 4, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Per-table trigger functions assigning serial codes on insert
CREATE OR REPLACE FUNCTION ehga_code_booking() RETURNS trigger AS $$
BEGIN
  NEW.booking_code := COALESCE(NEW.booking_code, next_serial('EL-B'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_dispatch() RETURNS trigger AS $$
BEGIN
  NEW.dispatch_code := COALESCE(NEW.dispatch_code, next_serial('EL-D'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_parcel() RETURNS trigger AS $$
BEGIN
  NEW.parcel_code := COALESCE(NEW.parcel_code, next_serial('EL-P'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_trip() RETURNS trigger AS $$
BEGIN
  NEW.trip_code := COALESCE(NEW.trip_code, next_serial('EL-T'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_fuel() RETURNS trigger AS $$
BEGIN
  NEW.fuel_code := COALESCE(NEW.fuel_code, next_serial('EL-F'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_hire() RETURNS trigger AS $$
BEGIN
  NEW.hire_code := COALESCE(NEW.hire_code, next_serial('EL-H'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ehga_code_student() RETURNS trigger AS $$
BEGIN
  NEW.student_code := COALESCE(NEW.student_code, next_serial('EL-S'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_code ON booking;
CREATE TRIGGER trg_booking_code BEFORE INSERT ON booking FOR EACH ROW EXECUTE FUNCTION ehga_code_booking();
DROP TRIGGER IF EXISTS trg_dispatch_code ON dispatch;
CREATE TRIGGER trg_dispatch_code BEFORE INSERT ON dispatch FOR EACH ROW EXECUTE FUNCTION ehga_code_dispatch();
DROP TRIGGER IF EXISTS trg_parcel_code ON parcel;
CREATE TRIGGER trg_parcel_code BEFORE INSERT ON parcel FOR EACH ROW EXECUTE FUNCTION ehga_code_parcel();
DROP TRIGGER IF EXISTS trg_trip_code ON trip;
CREATE TRIGGER trg_trip_code BEFORE INSERT ON trip FOR EACH ROW EXECUTE FUNCTION ehga_code_trip();
DROP TRIGGER IF EXISTS trg_fuel_code ON fuel;
CREATE TRIGGER trg_fuel_code BEFORE INSERT ON fuel FOR EACH ROW EXECUTE FUNCTION ehga_code_fuel();
DROP TRIGGER IF EXISTS trg_hire_code ON private_hire;
CREATE TRIGGER trg_hire_code BEFORE INSERT ON private_hire FOR EACH ROW EXECUTE FUNCTION ehga_code_hire();
DROP TRIGGER IF EXISTS trg_student_code ON school_student;
CREATE TRIGGER trg_student_code BEFORE INSERT ON school_student FOR EACH ROW EXECUTE FUNCTION ehga_code_student();

-- Serial counter prefixes (never reused: counters only increment)
INSERT INTO serial_counter(code_key, prefix, seq) VALUES
  ('EL-B', 'EL-B-', 0),
  ('EL-D', 'EL-D-', 0),
  ('EL-P', 'EL-P-', 0),
  ('EL-T', 'EL-T-', 0),
  ('EL-F', 'EL-F-', 0),
  ('EL-H', 'EL-H-', 0),
  ('EL-S', 'EL-S-', 0)
ON CONFLICT (code_key) DO NOTHING;

-- Seed controlled lists (setup_kv) - idempotent
INSERT INTO setup_kv(key, value) VALUES
  ('directions', 'Koforidua to Accra|Accra to Koforidua|Within Koforidua|Within Accra'),
  ('payment_methods', 'MoMo|Cash|Bank transfer|Credit'),
  ('booking_statuses', 'Pending|Confirmed|Boarded|Completed|Cancelled|No show'),
  ('parcel_statuses', 'Booked|Collected|At hub|In transit|Out for delivery|Delivered|Failed|Returned|Cancelled'),
  ('dispatch_decisions', 'Go|Hold|Consolidate|Cancelled'),
  ('private_hire_statuses', 'Inquiry|Confirmed|In progress|Completed|Cancelled'),
  ('school_payment_statuses', 'Pending|Part paid|Paid|Overdue|Inactive'),
  ('vehicle_statuses', 'Available|In service|Maintenance hold|Breakdown|Inactive'),
  ('service_types', 'Standard seat|Entire vehicle|Airport transfer|Hourly hire|School run|Parcel support'),
  ('parcel_sizes', 'Envelope|Small|Medium|Large|XL'),
  ('incident_statuses', 'None|Open|Investigating|Closed'),
  ('standard_fare', '90'),
  ('standard_capacity', '3'),
  ('occupancy_target', '0.75'),
  ('parcel_revenue_target', '150'),
  ('fuel_price', '17'),
  ('maintenance_reserve', '0.35'),
  ('cash_variance_tolerance', '50')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- PHASE 2: Customer Portal, GPS, sign-off, ratings, incidents,
-- MoMo. All idempotent (safe to re-run with setup-db.js).
-- ============================================================

CREATE TABLE IF NOT EXISTS customer (
  id            SERIAL PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer ADD COLUMN IF NOT EXISTS avatar_mimetype TEXT;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS avatar_data TEXT;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
ALTER TABLE booking      ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer(id);
ALTER TABLE parcel       ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer(id);
ALTER TABLE private_hire ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer(id);
ALTER TABLE school_student ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer(id);

ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS rate_per_km NUMERIC(10,2);
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS seat_capacity INTEGER NOT NULL DEFAULT 4;
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS km_per_litre NUMERIC(6,2);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- One-time SMS OTP for customer registration (single-use, 10-minute expiry).
CREATE TABLE IF NOT EXISTS phone_otp (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'REGISTER',
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE booking ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE parcel  ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE private_hire ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE school_student ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE private_hire ADD COLUMN IF NOT EXISTS quote_status TEXT NOT NULL DEFAULT 'Auto';

CREATE TABLE IF NOT EXISTS incident (
  id            SERIAL PRIMARY KEY,
  incident_code TEXT UNIQUE,
  date          DATE NOT NULL,
  vehicle_id    TEXT REFERENCES vehicle(vehicle_code),
  trip_id       INTEGER REFERENCES trip(id),
  type          TEXT NOT NULL DEFAULT 'Other',
  severity      TEXT NOT NULL DEFAULT 'Minor',
  description   TEXT,
  action_taken  TEXT,
  status        TEXT NOT NULL DEFAULT 'Open',
  reported_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS departure_signoff (
  id          SERIAL PRIMARY KEY,
  dispatch_id INTEGER NOT NULL REFERENCES dispatch(id),
  signed_by   TEXT NOT NULL,
  role        TEXT NOT NULL,
  checks      TEXT NOT NULL DEFAULT '',
  gps_ok      BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (dispatch_id)
);

CREATE TABLE IF NOT EXISTS trip_rating (
  id             SERIAL PRIMARY KEY,
  subject_type   TEXT NOT NULL CHECK (subject_type IN ('BOOKING','PARCEL','PRIVATE_HIRE','SCHOOL')),
  subject_id     INTEGER NOT NULL,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  by_customer_id INTEGER REFERENCES customer(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_position (
  id           SERIAL PRIMARY KEY,
  vehicle_code TEXT NOT NULL REFERENCES vehicle(vehicle_code),
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  speed_kph    DOUBLE PRECISION,
  heading      DOUBLE PRECISION,
  accuracy_m   DOUBLE PRECISION,
  job_type     TEXT,
  job_code     TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vpos_vehicle ON vehicle_position(vehicle_code, recorded_at DESC);

CREATE TABLE IF NOT EXISTS momo_transaction (
  id            SERIAL PRIMARY KEY,
  reference     TEXT NOT NULL UNIQUE,
  provider      TEXT NOT NULL DEFAULT 'paystack',
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('BOOKING','PARCEL','PRIVATE_HIRE','SCHOOL')),
  subject_id    INTEGER NOT NULL,
  customer_id   INTEGER REFERENCES customer(id),
  amount        NUMERIC(12,2) NOT NULL,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'Pending',
  provider_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at       TIMESTAMPTZ
);

-- Incident serial codes (EL-I), same never-reused pattern
CREATE OR REPLACE FUNCTION ehga_code_incident() RETURNS trigger AS $$
BEGIN
  NEW.incident_code := COALESCE(NEW.incident_code, next_serial('EL-I'));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incident_code ON incident;
CREATE TRIGGER trg_incident_code BEFORE INSERT ON incident FOR EACH ROW EXECUTE FUNCTION ehga_code_incident();

INSERT INTO serial_counter(code_key, prefix, seq) VALUES ('EL-I', 'EL-I-', 0) ON CONFLICT (code_key) DO NOTHING;

-- New controlled lists / config (editable in Setup)
INSERT INTO setup_kv(key, value) VALUES
  ('route_km', 'Koforidua to Accra:90|Accra to Koforidua:90|Within Koforidua:15|Within Accra:20'),
  ('hire_base_fare', '50'),
  ('avg_speed_kph', '60'),
  ('whatsapp_line', '233000000000'),
  ('route_endpoints', 'Koforidua to Accra:6.0900,-0.2590|Accra to Koforidua:5.6130,-0.2340')
ON CONFLICT (key) DO NOTHING;

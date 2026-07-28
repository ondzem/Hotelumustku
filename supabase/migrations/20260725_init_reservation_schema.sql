-- 🏨 Supabase SQL Migration for Hotel u Můstku Reservation System
-- Enables btree_gist extension for PostgreSQL EXCLUDE constraint (prevents double-booking)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'standard' | 'nadstandard' | 'turisticky'
  floor TEXT NOT NULL, -- 'prizemi' | 'vyhled'
  capacity INT NOT NULL DEFAULT 2,
  extra_beds INT NOT NULL DEFAULT 0,
  base_price_per_night NUMERIC(10,2) NOT NULL DEFAULT 830.00,
  photos TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RESERVATIONS TABLE WITH ATOMIC DOUBLE-BOOKING EXCLUSION CONSTRAINT
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  manage_token TEXT UNIQUE NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE RESTRICT,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  booking_dates DATERANGE GENERATED ALWAYS AS (daterange(date_from, date_to, '[)')) STORED,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_note TEXT,
  adults_count INT NOT NULL DEFAULT 1,
  children_count INT NOT NULL DEFAULT 0,
  has_dog BOOLEAN DEFAULT FALSE,
  has_ebike BOOLEAN DEFAULT FALSE,
  ebike_count INT NOT NULL DEFAULT 0,
  has_half_board BOOLEAN DEFAULT FALSE,
  half_board_count INT NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL,
  accommodation_price NUMERIC(10,2) NOT NULL,
  city_tax NUMERIC(10,2) NOT NULL,
  addons_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  guests JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'paid'
  source TEXT NOT NULL DEFAULT 'web', -- 'web' | 'phone' | 'booking'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlapping_reservations EXCLUDE USING gist (
    room_id WITH =,
    booking_dates WITH &&
  ) WHERE (status != 'cancelled')
);

-- 3. BLOCKS TABLE (For Maintenance / Owner hold)
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  block_dates DATERANGE GENERATED ALWAYS AS (daterange(date_from, date_to, '[)')) STORED,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlapping_blocks EXCLUDE USING gist (
    room_id WITH =,
    block_dates WITH &&
  )
);

-- 4. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED INITIAL ROOMS DATA (6 Ground Floor + 6 View Floor Rooms)
INSERT INTO rooms (id, name, type, floor, capacity, extra_beds, base_price_per_night, sort_order) VALUES
  ('p1', 'Pokoj Turistický P1', 'turisticky', 'prizemi', 2, 0, 830.00, 1),
  ('p2', 'Pokoj Turistický P2', 'turisticky', 'prizemi', 2, 0, 830.00, 2),
  ('p3', 'Pokoj Turistický P3', 'turisticky', 'prizemi', 2, 0, 830.00, 3),
  ('pa', 'Pokoj Nadstandard A', 'nadstandard', 'prizemi', 2, 1, 890.00, 4),
  ('p5', 'Pokoj Standard P5', 'standard', 'prizemi', 2, 0, 830.00, 5),
  ('p6', 'Pokoj Standard P6', 'standard', 'prizemi', 2, 0, 830.00, 6),
  ('p7', 'Pokoj Standard P7', 'standard', 'vyhled', 2, 0, 830.00, 7),
  ('a1', 'Pokoj Nadstandard A1', 'nadstandard', 'vyhled', 2, 1, 890.00, 8),
  ('zen', 'Pokoj Nadstandard Zen', 'nadstandard', 'vyhled', 2, 0, 890.00, 9),
  ('p10', 'Pokoj Standard P10', 'standard', 'vyhled', 2, 0, 830.00, 10),
  ('p11', 'Pokoj Standard P11', 'standard', 'vyhled', 2, 0, 830.00, 11),
  ('p12', 'Pokoj Standard P12', 'standard', 'vyhled', 2, 0, 830.00, 12)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  floor = EXCLUDED.floor,
  base_price_per_night = EXCLUDED.base_price_per_night;

-- SEED INITIAL SETTINGS
INSERT INTO settings (key, value) VALUES
  ('hotel_info', '{"bank_account": "123456789/0800", "bank_name": "Česká spořitelna", "city_tax_per_person_night": 20.00, "check_in_time": "14:00", "check_out_time": "10:00"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

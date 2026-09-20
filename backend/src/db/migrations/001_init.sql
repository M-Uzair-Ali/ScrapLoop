-- ScrapLoop initial schema
-- Requires PostGIS extension for geospatial queries (nearby collectors, area buckets)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('household', 'collector');

CREATE TYPE scrap_category AS ENUM (
  'newspaper', 'cardboard', 'mixed_paper',
  'iron', 'steel', 'aluminum', 'copper',
  'plastic_bottles', 'mixed_plastic',
  'glass', 'e_waste', 'other'
);

CREATE TYPE listing_status AS ENUM ('open', 'matched', 'accepted', 'completed', 'cancelled');
CREATE TYPE match_status AS ENUM ('notified', 'viewed', 'accepted', 'declined', 'expired');

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number  VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          user_role NOT NULL,
  location      GEOGRAPHY(POINT, 4326),  -- lng/lat
  rating_avg    NUMERIC(3, 2) DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_location ON users USING GIST (location);

-- ─────────────────────────────────────────────
-- COLLECTOR PROFILE (1:1 extension of users where role = collector)
-- ─────────────────────────────────────────────

CREATE TABLE collector_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  categories_bought   scrap_category[] NOT NULL DEFAULT '{}',
  service_radius_km   NUMERIC(5, 2) NOT NULL DEFAULT 3.0,
  capacity_kg_per_day NUMERIC(6, 2) NOT NULL DEFAULT 100,
  vehicle_type        VARCHAR(40),
  availability_status BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- AREAS (geographic buckets for pricing aggregation)
-- ─────────────────────────────────────────────

CREATE TABLE areas (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      VARCHAR(120) NOT NULL,
  city      VARCHAR(120) NOT NULL,
  center    GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_km NUMERIC(5, 2) NOT NULL DEFAULT 2.0
);

CREATE INDEX idx_areas_center ON areas USING GIST (center);

-- ─────────────────────────────────────────────
-- LISTINGS
-- ─────────────────────────────────────────────

CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description           TEXT,
  photo_urls            TEXT[] DEFAULT '{}',
  pickup_window_start   TIMESTAMPTZ,
  pickup_window_end     TIMESTAMPTZ,
  status                listing_status NOT NULL DEFAULT 'open',
  location              GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_location ON listings USING GIST (location);
CREATE INDEX idx_listings_status ON listings (status);

CREATE TABLE listing_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id          UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  category            scrap_category NOT NULL,
  estimated_weight_kg NUMERIC(6, 2) NOT NULL,
  notes               TEXT
);

CREATE INDEX idx_listing_items_listing ON listing_items (listing_id);
CREATE INDEX idx_listing_items_category ON listing_items (category);

-- ─────────────────────────────────────────────
-- MATCHES (output of the matching engine)
-- ─────────────────────────────────────────────

CREATE TABLE matches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  collector_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        NUMERIC(6, 4) NOT NULL,
  status       match_status NOT NULL DEFAULT 'notified',
  notified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (listing_id, collector_id)
);

CREATE INDEX idx_matches_listing ON matches (listing_id);
CREATE INDEX idx_matches_collector ON matches (collector_id, status);

-- ─────────────────────────────────────────────
-- TRANSACTIONS (completed pickups — feeds the pricing engine)
-- ─────────────────────────────────────────────

CREATE TABLE transactions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id         UUID REFERENCES listings(id) ON DELETE SET NULL,
  collector_id       UUID NOT NULL REFERENCES users(id),
  household_id       UUID NOT NULL REFERENCES users(id),
  category           scrap_category NOT NULL,
  actual_weight_kg   NUMERIC(6, 2) NOT NULL,
  price_per_kg       NUMERIC(8, 2) NOT NULL,
  total_price        NUMERIC(10, 2) NOT NULL,
  area_id            UUID REFERENCES areas(id),
  location           GEOGRAPHY(POINT, 4326),
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_category_area_time
  ON transactions (category, area_id, completed_at DESC);

-- ─────────────────────────────────────────────
-- RATINGS
-- ─────────────────────────────────────────────

CREATE TABLE ratings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  rater_id       UUID NOT NULL REFERENCES users(id),
  ratee_id       UUID NOT NULL REFERENCES users(id),
  score          SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, rater_id)
);

-- ─────────────────────────────────────────────
-- PRICE SNAPSHOTS (materialized by the scheduled pricing engine)
-- ─────────────────────────────────────────────

CREATE TABLE price_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        scrap_category NOT NULL,
  area_id         UUID NOT NULL REFERENCES areas(id),
  avg_price_per_kg NUMERIC(8, 2) NOT NULL,
  sample_size     INTEGER NOT NULL,
  trend           VARCHAR(10) NOT NULL DEFAULT 'flat', -- 'up' | 'down' | 'flat'
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, area_id, computed_at)
);

CREATE INDEX idx_price_snapshots_lookup
  ON price_snapshots (category, area_id, computed_at DESC);

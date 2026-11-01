-- Supabase (PostgreSQL) schema for the whole Smartplantsystem (RimbaTag).
-- One file for everything the backend, the web app and the mobile app need,
-- because both apps reach the data only through the backend:
--   Sprint 1: accounts, plants, photos, approvals, assignments, audit log
--   Sprint 2: IoT plant protection (ESP32 sensors, readings, alerts)
--   Storage:  the public "plant-photos" bucket the backend uploads photos to
--
-- Run it in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- SAFE TO RE-RUN. Use it for a brand-new project and again later on a database
-- that already has data: it only creates what is missing. It never drops a table,
-- never deletes or overwrites rows, and never changes a column that already exists.
-- Everything runs in one transaction, so if anything fails nothing is applied.
--
-- The photo bucket is named "plant-photos". If SUPABASE_PHOTO_BUCKET in
-- backend/.env uses another name, change the name in the Storage section below.

BEGIN;

-- =====================================================================
-- Sprint 1
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles (
    role_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE
);
-- Adds only the roles that are missing (no duplicates, no wasted ids on re-runs).
INSERT INTO roles (role_name)
SELECT v.role_name
FROM (VALUES ('Botanist'), ('Conservation Officer'), ('Admin')) AS v (role_name)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.role_name = v.role_name);

CREATE TABLE IF NOT EXISTS users (
    user_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL REFERENCES roles(role_id),
    botanist_type   VARCHAR(20) DEFAULT NULL CHECK (botanist_type IN ('Internal', 'External')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Columns that older copies of this table may lack. Existing columns are left alone.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS botanist_type VARCHAR(20) DEFAULT NULL CHECK (botanist_type IN ('Internal', 'External')),
    ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Emails are compared case-insensitively (Admin@x.com = admin@x.com).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS plants (
    plant_id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    qr_code                  VARCHAR(100) NOT NULL UNIQUE,
    common_name              VARCHAR(150),
    scientific_name          VARCHAR(150) NOT NULL,
    family                   VARCHAR(100),
    genus                    VARCHAR(100),
    species                  VARCHAR(100),
    height_cm                DECIMAL(6,2),
    width_cm                 DECIMAL(6,2),
    morphological_notes      TEXT,
    surrounding_environment  TEXT,
    latitude                 DECIMAL(10,7),
    longitude                DECIMAL(10,7),
    location_visibility      VARCHAR(20) NOT NULL DEFAULT 'Public'
                               CHECK (location_visibility IN ('Public', 'Approximate', 'Hidden')),
    general_location         VARCHAR(150),
    conservation_status      VARCHAR(100),
    publication_status       VARCHAR(20) NOT NULL DEFAULT 'Under Research'
                               CHECK (publication_status IN ('Under Research', 'Published')),
    ecological_role          TEXT,
    medicinal_use            TEXT,
    cultural_significance    TEXT,
    registered_by            INT NOT NULL REFERENCES users(user_id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Columns that older copies of this table may lack. Every one is nullable or has a
-- default, so existing rows are never a problem. Existing columns are left alone.
ALTER TABLE plants
    ADD COLUMN IF NOT EXISTS common_name             VARCHAR(150),
    ADD COLUMN IF NOT EXISTS family                  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS genus                   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS species                 VARCHAR(100),
    ADD COLUMN IF NOT EXISTS height_cm               DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS width_cm                DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS morphological_notes     TEXT,
    ADD COLUMN IF NOT EXISTS surrounding_environment TEXT,
    ADD COLUMN IF NOT EXISTS latitude                DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude               DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS location_visibility     VARCHAR(20) NOT NULL DEFAULT 'Public'
                               CHECK (location_visibility IN ('Public', 'Approximate', 'Hidden')),
    ADD COLUMN IF NOT EXISTS general_location        VARCHAR(150),
    ADD COLUMN IF NOT EXISTS conservation_status     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS publication_status      VARCHAR(20) NOT NULL DEFAULT 'Under Research'
                               CHECK (publication_status IN ('Under Research', 'Published')),
    ADD COLUMN IF NOT EXISTS ecological_role         TEXT,
    ADD COLUMN IF NOT EXISTS medicinal_use           TEXT,
    ADD COLUMN IF NOT EXISTS cultural_significance   TEXT,
    ADD COLUMN IF NOT EXISTS created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Postgres has no "ON UPDATE CURRENT_TIMESTAMP", so a trigger keeps updated_at current.
-- The function is replaced in place; the trigger is dropped and recreated (this
-- touches no rows) because CREATE TRIGGER has no IF NOT EXISTS.
CREATE OR REPLACE FUNCTION plants_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS plants_set_updated_at ON plants;
CREATE TRIGGER plants_set_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW EXECUTE FUNCTION plants_set_updated_at();

CREATE TABLE IF NOT EXISTS plant_photos (
    photo_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plant_id       INT NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    photo_url      VARCHAR(255) NOT NULL,
    uploaded_by    INT NOT NULL REFERENCES users(user_id),
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE plant_photos
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS record_change_requests (
    request_id                     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plant_id                       INT DEFAULT NULL REFERENCES plants(plant_id) ON DELETE SET NULL,
    plant_qr_code_snapshot         VARCHAR(100),
    plant_scientific_name_snapshot VARCHAR(150),
    request_type                   VARCHAR(10) NOT NULL CHECK (request_type IN ('EDIT', 'DELETE')),
    proposed_changes               JSONB DEFAULT NULL,
    requested_by                   INT NOT NULL REFERENCES users(user_id),
    requested_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status                         VARCHAR(10) NOT NULL DEFAULT 'Pending'
                                     CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    reviewed_by                    INT DEFAULT NULL REFERENCES users(user_id),
    reviewed_at                    TIMESTAMPTZ DEFAULT NULL,
    review_comment                 TEXT DEFAULT NULL
);
ALTER TABLE record_change_requests
    ADD COLUMN IF NOT EXISTS plant_qr_code_snapshot         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS plant_scientific_name_snapshot VARCHAR(150),
    ADD COLUMN IF NOT EXISTS proposed_changes               JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS reviewed_by                    INT DEFAULT NULL REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS reviewed_at                    TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS review_comment                 TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS botanist_assignments (
    assignment_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    botanist_id      INT NOT NULL REFERENCES users(user_id),
    plant_id         INT NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    assigned_by      INT NOT NULL REFERENCES users(user_id),
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (botanist_id, plant_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INT REFERENCES users(user_id),
    action        VARCHAR(100) NOT NULL,
    target_table  VARCHAR(100),
    target_id     INT,
    details       JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS target_table VARCHAR(100),
    ADD COLUMN IF NOT EXISTS target_id    INT,
    ADD COLUMN IF NOT EXISTS details      JSONB;
CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_table, target_id);

-- Postgres (unlike MySQL) does not index foreign keys automatically.
-- These cover the lookups the backend actually does:
CREATE INDEX IF NOT EXISTS plant_photos_plant_id_idx ON plant_photos (plant_id);                         -- photos of a plant
CREATE INDEX IF NOT EXISTS change_requests_status_idx ON record_change_requests (status, requested_at);  -- officer's request list
CREATE INDEX IF NOT EXISTS change_requests_plant_id_idx ON record_change_requests (plant_id);             -- deleting a plant
CREATE INDEX IF NOT EXISTS change_requests_requested_by_idx ON record_change_requests (requested_by);    -- botanist's own requests
CREATE INDEX IF NOT EXISTS plants_registered_by_idx ON plants (registered_by);                           -- "my records"
CREATE INDEX IF NOT EXISTS botanist_assignments_plant_id_idx ON botanist_assignments (plant_id);         -- deleting a plant
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC, log_id DESC);          -- admin audit log, newest first
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id, created_at DESC);                 -- audit log filtered by user

-- =====================================================================
-- Sprint 2: IoT plant protection (ESP32 boards, readings, alerts)
-- Used by backend/controllers/iotController.js
-- =====================================================================

-- One row per ESP32 board. A board registers itself with its first reading.
CREATE TABLE IF NOT EXISTS iot_sensors (
    sensor_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_code    VARCHAR(50) NOT NULL,
    name           VARCHAR(100),
    -- The plant this board protects. If that plant is deleted the sensor stays.
    plant_id       INT REFERENCES plants(plant_id) ON DELETE SET NULL,
    latitude       DECIMAL(10,7),
    longitude      DECIMAL(10,7),
    location_note  VARCHAR(150),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at   TIMESTAMPTZ
);

-- Every reading a board sends (temperature, humidity, soil moisture, PIR motion).
CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sensor_id      INT NOT NULL REFERENCES iot_sensors(sensor_id) ON DELETE CASCADE,
    temperature_c  NUMERIC(5,2),
    humidity_pct   NUMERIC(5,2),
    soil_moisture_pct NUMERIC(5,2),
    motion         BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Motion / high-temperature / low-humidity / low-soil-moisture alerts, and who acknowledged them.
CREATE TABLE IF NOT EXISTS sensor_alerts (
    alert_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sensor_id        INT NOT NULL REFERENCES iot_sensors(sensor_id) ON DELETE CASCADE,
    alert_type       VARCHAR(20) NOT NULL CHECK (alert_type IN ('MOTION', 'TEMPERATURE', 'HUMIDITY', 'SOIL')),
    message          TEXT NOT NULL,
    value            NUMERIC(5,2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    acknowledged_at  TIMESTAMPTZ
);

-- If these tables were created earlier by hand or by an older script, add any
-- column the backend needs that is missing. Columns that already exist are left
-- alone, and every column here is nullable or has a default, so existing rows
-- are never a problem.
ALTER TABLE iot_sensors
    ADD COLUMN IF NOT EXISTS name          VARCHAR(100),
    ADD COLUMN IF NOT EXISTS plant_id      INT REFERENCES plants(plant_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS latitude      DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude     DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS location_note VARCHAR(150),
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
ALTER TABLE sensor_readings
    ADD COLUMN IF NOT EXISTS temperature_c NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS humidity_pct  NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS soil_moisture_pct NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS motion        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sensor_alerts
    ADD COLUMN IF NOT EXISTS value           NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS acknowledged_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Older copies of this table only allowed three alert types. Widen the rule to also
-- allow SOIL. Only the rule changes; no rows are touched, and it does nothing when
-- the rule already allows SOIL.
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'sensor_alerts'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%alert_type%'
          AND pg_get_constraintdef(oid) NOT LIKE '%SOIL%'
    LOOP
        EXECUTE format('ALTER TABLE sensor_alerts DROP CONSTRAINT %I', c.conname);
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sensor_alerts'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%alert_type%'
    ) THEN
        ALTER TABLE sensor_alerts ADD CONSTRAINT sensor_alerts_alert_type_check
            CHECK (alert_type IN ('MOTION', 'TEMPERATURE', 'HUMIDITY', 'SOIL'));
    END IF;
END $$;

-- Needed: the backend registers boards with INSERT ... ON CONFLICT (device_code).
CREATE UNIQUE INDEX IF NOT EXISTS iot_sensors_device_code_key ON iot_sensors (device_code);
CREATE INDEX IF NOT EXISTS iot_sensors_plant_id_idx ON iot_sensors (plant_id);                           -- deleting a plant
CREATE INDEX IF NOT EXISTS sensor_readings_sensor_time_idx ON sensor_readings (sensor_id, recorded_at DESC);  -- latest reading, charts, stats
CREATE INDEX IF NOT EXISTS sensor_alerts_cooldown_idx ON sensor_alerts (sensor_id, alert_type, created_at DESC); -- "same alert recently?" check
CREATE INDEX IF NOT EXISTS sensor_alerts_open_idx ON sensor_alerts (sensor_id) WHERE acknowledged_at IS NULL;    -- open alert counts
CREATE INDEX IF NOT EXISTS sensor_alerts_acknowledged_by_idx ON sensor_alerts (acknowledged_by);

-- =====================================================================
-- Storage: the photo bucket
-- =====================================================================

-- The backend uploads plant photos to this bucket and shows visitors their public
-- links, so the bucket has to be public. It is created only when it does not exist
-- yet; a bucket that already exists is left exactly as it is (if it is private,
-- turn on "Public bucket" in Dashboard -> Storage). The limits match what the
-- backend accepts: JPEG, PNG or WebP, up to 5 MB. The check keeps the script working
-- on a plain Postgres that has no Supabase Storage.
DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NOT NULL THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('plant-photos', 'plant-photos', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- =====================================================================
-- Security
-- =====================================================================

-- Supabase exposes every table in the "public" schema through its auto-generated
-- REST API, which anyone holding the (public) anon key can call. Turning on Row
-- Level Security with no policies blocks that API completely, so the data
-- (including password hashes) is only reachable through our Express backend,
-- which connects as the database owner and is not affected by RLS.
ALTER TABLE roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE botanist_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_sensors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_alerts          ENABLE ROW LEVEL SECURITY;

COMMIT;

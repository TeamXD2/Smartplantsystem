-- Supabase (PostgreSQL) schema.
-- Run it once in Supabase Dashboard -> SQL Editor -> New query -> Run.

CREATE TABLE roles (
    role_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO roles (role_name) VALUES
    ('Botanist'),
    ('Conservation Officer'),
    ('Admin');

CREATE TABLE users (
    user_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL REFERENCES roles(role_id),
    botanist_type   VARCHAR(20) DEFAULT NULL CHECK (botanist_type IN ('Internal', 'External')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Emails are compared case-insensitively (Admin@x.com = admin@x.com).
CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email));

CREATE TABLE plants (
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

-- Postgres has no "ON UPDATE CURRENT_TIMESTAMP", so a trigger keeps updated_at current.
CREATE FUNCTION plants_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER plants_set_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW EXECUTE FUNCTION plants_set_updated_at();

CREATE TABLE plant_photos (
    photo_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plant_id       INT NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    photo_url      VARCHAR(255) NOT NULL,
    uploaded_by    INT NOT NULL REFERENCES users(user_id),
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE record_change_requests (
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

CREATE TABLE botanist_assignments (
    assignment_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    botanist_id      INT NOT NULL REFERENCES users(user_id),
    plant_id         INT NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    assigned_by      INT NOT NULL REFERENCES users(user_id),
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (botanist_id, plant_id)
);

CREATE TABLE audit_logs (
    log_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INT REFERENCES users(user_id),
    action        VARCHAR(100) NOT NULL,
    target_table  VARCHAR(100),
    target_id     INT,
    details       JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_table, target_id);

-- Postgres (unlike MySQL) does not index foreign keys automatically.
-- These cover the lookups the backend actually does:
CREATE INDEX plant_photos_plant_id_idx ON plant_photos (plant_id);                         -- photos of a plant
CREATE INDEX change_requests_status_idx ON record_change_requests (status, requested_at);  -- officer's request list
CREATE INDEX change_requests_plant_id_idx ON record_change_requests (plant_id);             -- deleting a plant
CREATE INDEX change_requests_requested_by_idx ON record_change_requests (requested_by);    -- botanist's own requests

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

CREATE DATABASE IF NOT EXISTS biodiversity_system;
USE biodiversity_system;
CREATE TABLE roles (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO roles (role_name) VALUES
    ('Botanist'),
    ('Conservation Officer'),
    ('Admin');
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL,
    botanist_type   ENUM('Internal', 'External') DEFAULT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);
CREATE TABLE plants (
    plant_id                INT AUTO_INCREMENT PRIMARY KEY,
    qr_code                 VARCHAR(100) NOT NULL UNIQUE,
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
    location_visibility      ENUM('Public', 'Approximate', 'Hidden') NOT NULL DEFAULT 'Public',
    general_location          VARCHAR(150),
    conservation_status       VARCHAR(100),
    publication_status         ENUM('Under Research', 'Published') NOT NULL DEFAULT 'Under Research',
    ecological_role           TEXT,
    medicinal_use             TEXT,
    cultural_significance     TEXT,
    registered_by            INT NOT NULL,
    created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (registered_by) REFERENCES users(user_id)
);
CREATE TABLE plant_photos (
    photo_id       INT AUTO_INCREMENT PRIMARY KEY,
    plant_id       INT NOT NULL,
    photo_url      VARCHAR(255) NOT NULL,
    uploaded_by    INT NOT NULL,
    uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);
CREATE TABLE record_change_requests (
    request_id       INT AUTO_INCREMENT PRIMARY KEY,
    plant_id         INT DEFAULT NULL,
    plant_qr_code_snapshot        VARCHAR(100),
    plant_scientific_name_snapshot VARCHAR(150),
    request_type     ENUM('EDIT', 'DELETE') NOT NULL,
    proposed_changes JSON DEFAULT NULL,
    requested_by     INT NOT NULL,
    requested_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    reviewed_by      INT DEFAULT NULL,
    reviewed_at      DATETIME DEFAULT NULL,
    review_comment   TEXT DEFAULT NULL,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);
CREATE TABLE botanist_assignments (
    assignment_id    INT AUTO_INCREMENT PRIMARY KEY,
    botanist_id      INT NOT NULL,
    plant_id         INT NOT NULL,
    assigned_by      INT NOT NULL,
    assigned_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (botanist_id, plant_id),
    FOREIGN KEY (botanist_id) REFERENCES users(user_id),
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(user_id)
);

CREATE TABLE audit_logs (
    log_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT,
    action        VARCHAR(100) NOT NULL,
    target_table  VARCHAR(100),
    target_id     INT,
    details       JSON,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

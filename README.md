# Smartplantsystem

Smartplantsystem is the Smart Ground-Truthing and Digital Biodiversity System for plant species in Niah National Park. Botanists record plants in the field, conservation officers review and publish them, administrators manage accounts, ESP32 sensor boards watch over the plants, and park visitors browse the published species by scanning a QR code or using the web catalog. The web and mobile apps are branded RimbaTag.

The project has three applications that share one database:

- `backend/` is the API. It stores every plant record, photo, user account and sensor reading, and decides who may see or change what.
- `webapp/` is the web application for staff and the public species catalog.
- `mobile/` is the field application built with Expo. Botanists sign in with their account, and visitors can use it without one. It talks to the backend like the web app does.

## Contents

- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Roles and permissions](#roles-and-permissions)
- [The life of a plant record](#the-life-of-a-plant-record)
- [The web app](#the-web-app)
- [The mobile app](#the-mobile-app)
- [IoT plant protection](#iot-plant-protection)
- [Data model](#data-model)
- [API guide](#api-guide)
- [API reference](#api-reference)
- [Security](#security)
- [Backend code layout](#backend-code-layout)
- [Troubleshooting](#troubleshooting)
- [Changes from the original code](#changes-from-the-original-code)
- [Not built yet](#not-built-yet)

## Architecture

```
 Web app (webapp/)      Mobile app (mobile/)      ESP32 sensor boards
 React + Vite           Expo / React Native       (Wi-Fi)
      |                        |                        |
      | HTTP + login token     | HTTP + login token     | HTTP + device key
      v                        v                        v
 Backend (backend/)  <--- the only way to reach the data
 Node.js + Express
      |
      +--> Supabase database (PostgreSQL): plants, users, requests, history, sensors
      +--> Supabase Storage: plant photos
```

The backend is the only gateway to the data. For every request it checks who the user is, whether their role allows the action, and whether the data is valid. The web app and the mobile app talk to the backend and hold no Supabase keys. The sensor boards authenticate with a shared device key instead of a login. Row Level Security is switched on for every table with no policies, so a Supabase key cannot read the tables directly either.

The whole team shares one Supabase project (SPS), so everyone sees the same data.

## Repository layout

| Path | Contents |
|---|---|
| `schema.sql` | The one database schema for the whole project: tables, indexes, security settings and the photo bucket. It is safe to run again (see "Data model") |
| `backend/` | The Express API, its scripts and a Postman test collection |
| `webapp/` | The React web app. All data access goes through `webapp/src/api.js` |
| `mobile/` | The Expo field app. All data access goes through `mobile/src/api.ts` |

## Getting started

You need Node.js. Each application runs as its own process, started with `npm run dev` from its own folder (the mobile app uses `npx expo start`). No single command starts them together, so open one terminal per application and start the backend first, because neither app can show any data without it.

### Backend

1. Clone the repository. The `main` branch holds the backend, the web app and the mobile app together, so there is no other branch to switch to. For a brand new Supabase project, run `schema.sql` from the repository root in the SQL Editor first (see "Data model"). The team's shared project already has it, and running it again there is harmless.
2. Open a terminal in `backend` and install the packages (only for first run on device):
   ```
   npm install
   ```
3. Set up the `.env` file and put it in `backend` next to `.env.example`. It contains the database password and the secret key. Keep it private and make sure `.gitignore` stops it from being committed.
4. Check the connection. Every line should say `OK`:
   ```
   npm run check-supabase
   ```
   The check covers the Sprint 1 tables, the Row Level Security setting and the photo bucket. It does not look at the IoT tables.
5. Start the server:
   ```
   npm run dev
   ```
   When the terminal prints `Server running on http://localhost:5000` the backend is ready. Closing the terminal stops the server.

### Web app

1. Open a second terminal in `webapp` and install the packages (only for first run on device):
   ```
   npm install
   ```
2. Copy `.env.example` to `.env`. It contains one line, `VITE_API_URL=http://localhost:5000`, the address of the backend.
3. Start the app:
   ```
   npm run dev
   ```
   The app should be available at `http://localhost:5173`.

The backend only accepts browser requests from the addresses listed in its `CORS_ORIGINS` setting, which defaults to `http://localhost:5173`. If the web app runs on another address, add it to `CORS_ORIGINS` in `backend/.env` and restart the backend.

### Mobile app

1. Find the local IPv4 address of the computer running the backend (`ipconfig` on Windows). A phone cannot reach `localhost`.
2. Open `mobile/src/api.ts` and set `API_URL` to that address with the backend port, for example `http://192.168.1.20:5000`. The phone and the computer must be on the same Wi-Fi, and Windows may ask you to allow Node.js through the firewall.
3. Open a third terminal in `mobile`, run `npm install`, then `npx expo start`. You can open the app in a development build, an Android emulator, an iOS simulator or Expo Go.

The mobile app needs the running backend for everything except the login screen itself. Botanists sign in with the account an administrator created for them. Officer and Admin accounts are refused on the phone and work on the website.

### First administrator

A new database has no accounts, and only an administrator can create accounts. When the web app starts against a database that contains no administrator, it shows a one-time setup page instead of the normal site. The person who fills it in becomes the administrator and is signed in straight away. The page appears only while no administrator exists in the database. After the first one is created it never appears again, and the backend refuses further setup requests.

On a new deployment that is reachable from the internet, set `SETUP_KEY` in `backend/.env` before the first visit. The setup page then asks for that key, so only someone who knows it can create the administrator.

If every administrator account is lost, for example because the password is forgotten, run this from `backend`. It refuses to run while an active administrator exists unless you add `--force`:

```
npm run create-admin -- "Full Name" admin@example.com "a-strong-password"
```

All other accounts are created by an administrator in the web app, under Users. There is no public sign-up for now.

### Testing with Postman

Import `backend/postman/Biodiversity-Sprint1.postman_collection.json`. In the collection's Variables tab, set `adminEmail` and `adminPassword`. In the Upload plant photo request, open Body and pick `backend/postman/sample-leaf.png`. Then run the whole collection. All 67 checks should pass. Each run adds test users (`...@test.com`) and plants to the shared database, so run it only when needed.

The collection covers the Sprint 1 flows: login and accounts, plants, editing and approval, publishing, the visitor view and account deactivation. It has no checks for the audit log, password changes or the IoT endpoints.

## Configuration

### Backend (`backend/.env`)

`backend/.env.example` lists every setting.

| Setting | Purpose |
|---|---|
| `PORT` | Port of the API. Default `5000` |
| `DATABASE_URL` | Supabase Postgres connection string (Dashboard, Connect, Session pooler) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTO_BUCKET` | Supabase project address, service key and the Storage bucket for photos (`plant-photos`) |
| `JWT_SECRET` | Signs login tokens. Use at least 32 random characters. A shorter value prints a warning, and in production the server refuses to start |
| `JWT_EXPIRES_IN` | Token lifetime. Default `7d` |
| `CORS_ORIGINS` | Addresses the web app may call the API from, comma separated. Default `http://localhost:5173`. Add the deployed web app's address here. The mobile app, Postman, curl and the sensor boards are not affected, because CORS is a browser rule |
| `TRUST_PROXY` | Needed only when the backend runs behind a proxy or hosting platform. Set it to the number of proxies in front of the backend, usually `1`, so the rate limits count each visitor separately |
| `SETUP_KEY` | Optional. Protects the one-time setup page on a new deployment (see "First administrator") |
| `IOT_DEVICE_KEY` | Secret the ESP32 boards send in the `X-Device-Key` header. While it is empty, the readings endpoint answers 503 |
| `IOT_TEMP_MAX`, `IOT_HUMIDITY_MIN`, `IOT_SOIL_MIN` | Optional alert limits: a temperature above `IOT_TEMP_MAX` (default 35), or humidity below `IOT_HUMIDITY_MIN` (default 40) or soil moisture below `IOT_SOIL_MIN` (default 20), raises an alert |
| `DB_SSL_CA` | Optional but recommended. Turns on verification of the database's TLS certificate (see below) |
| `DB_SSL` | Set to `false` to turn TLS off, only for a local Postgres |

The database connection is always encrypted. By default the server's certificate is not verified and the backend prints a warning at startup. To verify it, download the certificate in the Supabase Dashboard (Database, Settings, SSL Configuration), save it in `backend`, and set `DB_SSL_CA=./your-file.crt`.

### Web app (`webapp/.env`)

| Setting | Purpose |
|---|---|
| `VITE_API_URL` | Address of the backend. Default `http://localhost:5000`. For a deployed site, use the deployed backend's address and add the site's own address to `CORS_ORIGINS` on the backend |

### Mobile app (`mobile/src/api.ts`)

| Setting | Purpose |
|---|---|
| `API_URL` | Address of the backend, written in the file itself because the app has no `.env`. Use the computer's local IP address, for example `http://192.168.1.20:5000` |

## Roles and permissions

There are three roles. Botanists are either Internal or External. Park visitors need no account.

| Action | Park visitor | External botanist | Internal botanist | Conservation officer | Admin |
|---|---|---|---|---|---|
| View a published plant by QR code | Yes | Yes | Yes | Yes | Yes |
| Register a plant | No | Yes (1) | Yes | Yes | Yes |
| See full details including GPS | No | Assigned plants only (2) | Yes | Yes | Yes |
| Upload photos | No | Assigned plants only | Yes | Yes | Yes |
| Edit a plant | No | Send a request | Directly | Directly | Directly |
| Delete a plant | No | Send a request | Send a request | Directly, or approve requests | Directly, or approve requests |
| See own requests and the officer's reply | No | Yes | Yes | No | No |
| Approve or reject requests | No | No | No | Yes | Yes |
| Publish a plant to visitors | No | No | No | Yes | Yes |
| Export reports and the species list as CSV (web app) | No | No | No | Yes | Yes |
| View IoT sensors and readings, acknowledge alerts, edit sensors | No | No | No | Yes | Yes |
| Change your own password | No | Yes | Yes | Yes | Yes |
| Create, change and deactivate accounts | No | No | No | No | Yes |
| Set a temporary password for another account | No | No | No | No | Yes |
| Read the audit log | No | No | No | No | Yes |

1. An external botanist is assigned automatically to the plants they register.
2. For plants they are not assigned to, an external botanist sees exactly what a park visitor sees: nothing until the plant is published, then the public fields and the photos.

A botanist always has a type, `Internal` or `External`. The other roles have none. An administrator cannot deactivate or change the role of their own account. There is no public sign-up for now.

## The life of a plant record

1. A botanist registers the plant in the field with its name, size, GPS position and photos. The system creates a QR code such as `SFC-2E524325` to place next to the plant. The plant starts as Under Research and visitors cannot see it.
2. Internal botanists and officers correct records directly. External botanists send an edit request instead. Any botanist who wants a plant deleted sends a delete request.
3. An officer approves or rejects each request and can add a comment. An approved request applies the change or the deletion automatically. A rejected request changes nothing, and the botanist sees the status and comment in their request list and can send a new request. If two officers review the same request at the same time, only the first decision counts.
4. An officer publishes the plant and chooses how much of its location visitors see: `Public`, `Approximate` or `Hidden`. Officers and admins can also delete a plant directly.
5. Visitors who scan the QR code see the plant information, with the location shown as chosen in step 4.

Every step is written to the plant's history, for example "Test Botanist edited this plant (Height: 50cm to 150cm)".

### Visibility settings

Each plant has two settings.

- `publication_status` is `Under Research` (staff only, the default) or `Published` (visitors can see it).
- `location_visibility` controls what visitors see of the location: `Public` shows the exact GPS point, `Approximate` shows only the area name stored in `general_location`, and `Hidden` shows no location. It must be chosen when a plant is published.

The location fields are `latitude`, `longitude`, `surrounding_environment` and `general_location`.

### Who sees what

Internal botanists, officers, admins and assigned external botanists see every field. Park visitors, and external botanists looking at a plant they are not assigned to, see the public view. Before the plant is published they see nothing. Afterwards they see the names, classification, size, `morphological_notes`, `conservation_status`, `ecological_role`, `medicinal_use` and `cultural_significance`, plus the location according to the setting:

- `Public` adds `latitude`, `longitude`, `surrounding_environment` and `general_location`.
- `Approximate` adds `general_location` only.
- `Hidden` adds no location.

A published plant's public view also includes its `photos`. The public catalog list shows names, classification, `conservation_status`, `general_location`, `cover_photo_url` (the first photo), and `latitude` and `longitude` for plants whose location is `Public`.

## The web app

| Who | What they get |
|---|---|
| Anyone | A home page and the species catalog (published plants only) with search, paging and photos. A plant's page shows its details, its photo gallery and as much location as an officer allowed |
| Botanist | Register plant (form with photo, GPS and QR code), My records, and My requests with each decision and the officer's comment. Internal botanists edit directly. External botanists send edit requests. Any botanist can request a deletion |
| Conservation officer | Species database with publishing, bulk publish and unpublish, location visibility, direct editing, direct deletion, per-record history, saved table views and CSV export. Change requests to approve or reject botanists' requests. Distribution map, IoT monitoring and Reports |
| Admin | Everything an officer can do, plus Users (create accounts, change role and botanist type, deactivate or reactivate accounts, set a temporary password) and the Audit log |
| Every signed-in user | My account, where you change your own password |

The staff area has a sidebar menu that depends on the role, a search palette (Ctrl or Cmd + K, or `/`) that jumps to pages and records, and `g` then a letter shortcuts, listed in the keyboard shortcuts dialog. A notification bell and the sidebar badges refresh every 30 seconds: officers and admins see open sensor alerts and requests waiting for a decision, and botanists see decisions on their own requests.

The source in `webapp/src/` is organised like this:

- `api.js` is the single place that talks to the backend. It adds the login token, turns failures into readable messages and signs the user out when the backend rejects the token.
- `queries/` holds one small function per backend endpoint: `plants.js`, `usePlants.js`, `requests.js`, `users.js`, `account.js` (passwords and the audit log), `iot.js` and `setup.js`.
- `roles.js` and `plantFields.js` hold the role names and plant field names exactly as the backend uses them.
- `nav.js` holds the staff menu for each role. The sidebar, breadcrumbs, search palette and shortcuts all read from it.
- `context/` keeps the login state (`AuthContext.jsx` signs in with `POST /api/auth/login` and re-checks a saved token with `GET /api/auth/me` after a reload), the toast and confirm dialogs, and the notification counts.
- `pages/`, `components/` and `utils/` hold the screens, the shared pieces (`shell/`, `ui/` and `table/` subfolders) and the CSV and bulk-action helpers. `SetupGate` shows the one-time setup page when the backend reports that no administrator exists.

The web app keeps the login token in the browser's `localStorage`, so a reload keeps you signed in. The staff area is loaded only after sign-in, so visitors on a phone download just the public pages.

## The mobile app

`mobile/` is the RimbaTag field app, built with Expo SDK 57 and Expo Router. It has no local database and no offline mode: every screen reads from and writes to the backend, so it needs a connection. The login token is kept in memory only, so closing the app signs you out.

Botanists sign in on the first screen with `POST /api/auth/login`. Officer and Admin accounts get a message that they work on the website. A visitor taps "Explore as a visitor" and needs no account.

| Who | What they get |
|---|---|
| Botanist | Home with counts of their records, scanning a plant tag with the camera, registering a plant (photo from the camera, GPS from the phone, then the QR code to place next to the plant), My records with an All, Under Research or Published filter, plant details with Add photo (camera or gallery), edit, and My requests with the officer's decision and comment. Internal botanists save edits directly. External botanists send an edit request. Any botanist can request a deletion. A profile screen and Change password |
| Park visitor | The public species catalog with search, a species page with photos, and scanning a plant tag to open the species page. Exact GPS appears only when an officer chose `Public` |

The phone sends the same field names as the website (`scientific_name`, `height_cm`, `latitude` and so on). The register form covers the names, size, a description (`morphological_notes`) and the GPS position. The other plant fields are filled in on the website or through edits. Photos are limited to 5 MB, as on the web app. `mobile/src/api.ts` holds the backend address and the TypeScript types for the API responses.

## IoT plant protection

ESP32 boards in the park send temperature, humidity, soil moisture and motion (PIR) readings to the backend. The backend stores each reading, raises alerts, and shows everything to officers and admins on the IoT monitoring page.

How a board talks to the backend:

1. Choose a long random value for `IOT_DEVICE_KEY` in `backend/.env`, restart the backend, and put the same value in the ESP32 sketch.
2. The board sends `POST /api/iot/readings` with the header `X-Device-Key` and a JSON body (see the example below). Only `device_code` is required. The other fields can be left out when the board has no such sensor.
3. The first reading from a new `device_code` registers the board as a sensor. Its name starts as the device code. An officer or admin can rename it later, give it a GPS position and a note, and link it to the plant it protects.
4. The response says whether an alert was raised (`"alert": true`), so the board can sound its buzzer.

An alert is raised for movement, a temperature above `IOT_TEMP_MAX`, humidity below `IOT_HUMIDITY_MIN` and soil moisture below `IOT_SOIL_MIN`. The same kind of alert is not repeated for a sensor within 1 minute for motion, or within 10 minutes for the other types, so a person standing in front of the sensor creates one alert. Readings must be in range: temperature from -40 to 85, humidity and soil moisture from 0 to 100.

On the web app, the IoT monitoring page lists every sensor with its latest reading, shows a chart with minimum, average and maximum values and a movement count for the last 1 to 744 hours, and lists open alerts that staff acknowledge when someone has seen them. The page refreshes every 10 seconds while the tab is visible. If a sensor sends nothing for 2 minutes, the page shows it as offline.

If a plant is deleted, its sensors stay and lose the plant link.

## Data model

The structure is defined in `schema.sql` in the repository root. One file covers everything the three applications need, because the web and mobile apps reach the data only through the backend:

- Sprint 1: accounts, plants, photos, change requests, assignments and the audit log.
- Sprint 2: sensors, readings and alerts.
- The public `plant-photos` Storage bucket (5 MB limit, JPEG, PNG and WebP) that the backend uploads photos to.
- Row Level Security on every table, and the indexes the backend's queries use.

The file only creates what is missing. It never drops a table, deletes a row or changes an existing column, and it runs in one transaction, so a failure applies nothing. On a database from an earlier version it adds any column that is missing, widens the sensor alert types to include `SOIL`, and leaves an existing photo bucket untouched. If your bucket is private, turn on "Public bucket" in Supabase, Storage.

For a brand new Supabase project, paste the file into Dashboard, SQL Editor and run it, then continue with the backend setup. On an existing project, run it again whenever a new version adds tables or columns. If the IoT page reports that the IoT tables are missing or out of date, running it again fixes that. If `SUPABASE_PHOTO_BUCKET` in `backend/.env` is not `plant-photos`, change the bucket name in the Storage section of the file before you run it.

Please do not create, change or delete tables in the Supabase dashboard. If the database needs a change, tell the backend team so the schema file stays in sync.

| Table | Contents |
|---|---|
| `roles` | The three roles: Botanist, Conservation Officer, Admin |
| `users` | Staff accounts: name, email, hashed password, role and, for botanists, whether they are Internal or External. Accounts are deactivated instead of deleted |
| `plants` | One row per plant: names and classification, size, notes, GPS, conservation information, QR code and the two visibility settings |
| `plant_photos` | Links to each plant's photos. The image files are in the Supabase Storage bucket `plant-photos` |
| `record_change_requests` | Edit and delete requests from botanists, with the officer's decision and comment |
| `botanist_assignments` | Which external botanist is assigned to which plant |
| `audit_logs` | Every action (registered, edited, photo uploaded, approved and so on). The plant history is built from it |
| `iot_sensors` | One row per ESP32 board: device code, name, position, the plant it protects and when it last reported |
| `sensor_readings` | Every reading a board sends |
| `sensor_alerts` | Alerts raised from readings, and who acknowledged them |

The tables below use the field names the API uses in requests and responses. In the plants table, "register" means `POST /api/plants`, "edit" means `PATCH /api/plants/:id` or an approved edit request, "publish" means `PATCH /api/plants/:id/visibility`, and "auto" means the backend sets it.

### plants

| Field | Type and limits | Set by | Notes |
|---|---|---|---|
| `plant_id` | number | auto | |
| `qr_code` | text, such as `SFC-2E524325` | auto | Unique and never changes |
| `scientific_name` | text, max 150 | register, edit | Required |
| `common_name` | text, max 150 | register, edit | |
| `family`, `genus`, `species` | text, max 100 each | register, edit | |
| `height_cm`, `width_cm` | number from 0 to 9999.99 | register, edit | Returned as a string such as `"50.00"` |
| `latitude` | number from -90 to 90 | register, edit | Send together with `longitude`. Returned as a string |
| `longitude` | number from -180 to 180 | register, edit | Returned as a string |
| `morphological_notes` | text, max 10000 | register, edit | Appearance: leaves, flowers and so on |
| `surrounding_environment` | text, max 10000 | register, edit | Habitat |
| `conservation_status` | text, max 100 | edit | For example "Endangered" |
| `ecological_role` | text, max 10000 | edit | |
| `medicinal_use` | text, max 10000 | edit | |
| `cultural_significance` | text, max 10000 | edit | |
| `publication_status` | `Under Research` or `Published` | publish | Default `Under Research` |
| `location_visibility` | `Public`, `Approximate` or `Hidden` | publish | Must be chosen when publishing |
| `general_location` | text, max 150 | publish | Area name shown for `Approximate`, for example "Niah National Park" |
| `registered_by` | user id | auto | List responses also include `registered_by_name` |
| `created_at`, `updated_at` | ISO date string | auto | |

### users

| Field | Type and limits | Notes |
|---|---|---|
| `user_id` | number | |
| `full_name` | text, max 100 | |
| `email` | text, max 150 | Unique and not case sensitive, so `Ali@x.com` and `ali@x.com` are the same |
| `password` | text, 8 to 72 characters | Sent only when creating an account, changing a password or setting a temporary one. Stored hashed and never returned |
| `role_name` | `Botanist`, `Conservation Officer` or `Admin` | |
| `botanist_type` | `Internal`, `External` or `null` | Required for botanists and not allowed for other roles |
| `is_active` | `true` or `false` | `false` means deactivated: the account cannot log in |
| `created_at` | date | |

### plant_photos

| Field | Notes |
|---|---|
| `photo_id` | |
| `plant_id` | Deleted together with the plant |
| `photo_url` | Full public link to the image in Supabase Storage |
| `uploaded_by` | user id |
| `uploaded_at` | date |

### record_change_requests

| Field | Notes |
|---|---|
| `request_id` | |
| `plant_id` | Becomes `null` if the plant is deleted |
| `plant_qr_code_snapshot`, `plant_scientific_name_snapshot` | Copy of the plant's QR code and name when the request was sent, so the plant can still be identified after a deletion |
| `request_type` | `EDIT` or `DELETE` |
| `proposed_changes` | For `EDIT`, the new values such as `{ "height_cm": 150 }`, limited to editable fields. `null` for `DELETE` |
| `requested_by`, `requested_at` | Who sent the request and when. Lists add `requested_by_name` |
| `status` | `Pending`, `Approved` or `Rejected` |
| `reviewed_by`, `reviewed_at`, `review_comment` | Filled in when an officer reviews the request. `/mine` adds `reviewed_by_name` |

### botanist_assignments

| Field | Notes |
|---|---|
| `assignment_id` | |
| `botanist_id` | The external botanist |
| `plant_id` | Each botanist and plant pair appears only once |
| `assigned_by`, `assigned_at` | Who made the assignment and when |

### audit_logs

The plant history endpoint (`GET /api/plants/:id/history`) reads the rows for plants from this table, and `GET /api/audit-logs` lists all rows for admins.

| Field | Notes |
|---|---|
| `log_id` | |
| `user_id` | Who did it. The history adds `user_name` and `role_name`, and the audit log adds `user_name` and `user_email` |
| `action` | `CREATE_PLANT`, `UPDATE_PLANT`, `UPLOAD_PHOTO`, `UPDATE_VISIBILITY`, `DELETE_PLANT`, `REQUEST_EDIT`, `REQUEST_DELETE`, `APPROVED_REQUEST`, `REJECTED_REQUEST`, `CREATE_USER`, `UPDATE_USER`, `CHANGE_PASSWORD`, `RESET_PASSWORD`, `UPDATE_SENSOR`, `ACKNOWLEDGE_ALERT`, `LOGIN` |
| `target_table`, `target_id` | What the action was done to, for example `plants` and `12` |
| `details` | Extra information as JSON, such as the old and new values of an edit |
| `created_at` | date |
| `summary` | Added by the history endpoint: a ready-to-show sentence |

### iot_sensors

| Field | Notes |
|---|---|
| `sensor_id` | |
| `device_code` | Unique. Letters, numbers, `-` and `_`, max 50. This is how a board identifies itself |
| `name` | Max 100. Starts as the device code |
| `plant_id` | The plant the board protects. `null` if none, or if that plant was deleted |
| `latitude`, `longitude`, `location_note` | Where the board stands. The note is max 150 characters |
| `created_at`, `last_seen_at` | When the board registered and when it last sent a reading |

The sensor list adds `plant_name`, the latest reading and `open_alerts`.

### sensor_readings

| Field | Notes |
|---|---|
| `reading_id` | |
| `sensor_id` | Readings are deleted with their sensor |
| `temperature_c`, `humidity_pct`, `soil_moisture_pct` | Numbers with 2 decimals, returned as strings. Any of them can be `null` |
| `motion` | `true` when the PIR sensor saw movement |
| `recorded_at` | date |

### sensor_alerts

| Field | Notes |
|---|---|
| `alert_id` | |
| `sensor_id` | |
| `alert_type` | `MOTION`, `TEMPERATURE`, `HUMIDITY` or `SOIL` |
| `message`, `value` | A ready-to-show sentence, and the reading that caused the alert (`null` for motion) |
| `created_at` | date |
| `acknowledged_by`, `acknowledged_at` | Filled in when staff acknowledge the alert. The alert list adds `acknowledged_by_name` |

## API guide

### Where to send requests

The web app reads the backend address from `VITE_API_URL`, and the mobile app from `API_URL` in `mobile/src/api.ts`. Neither app should use supabase-js or any Supabase key, because everything goes through the backend.

### Logging in

1. Send `POST /api/auth/login` with `{ "email": "...", "password": "..." }`.
2. The response contains a token and the user:
   ```json
   {
     "token": "eyJhbGci...",
     "user": { "user_id": 1, "full_name": "System Admin", "email": "admin@...", "role_name": "Admin", "botanist_type": null }
   }
   ```
3. Save the token and send it with every other request:
   ```
   Authorization: Bearer <token>
   ```
4. Use `role_name`, and `botanist_type` for botanists, to decide which screens and buttons to show. The backend checks permissions on every request anyway, so hiding a button only improves the interface.
5. The token lasts 7 days. Logging out means deleting the saved token. After a restart, `GET /api/auth/me` tells you whether a saved token is still valid and returns the current user in the same shape as the login response.
6. If any request returns 401, the token has expired or the account was deactivated. Clear the token and show the login screen. A login with the right password for a deactivated account returns 403 with the message "This account has been deactivated".

### Response conventions

- Errors are always `{ "error": "message" }`, and the message can be shown to the user.
- Status codes: `400` invalid input, `401` not logged in, `403` not allowed, `404` not found, `409` conflict (for example a request that was already reviewed), `413` request body too large, `429` too many requests, `502` the photo could not be stored, `503` the IoT feature is not set up on the server.
- Decimal values come back as strings, for example `"height_cm": "50.00"` and `"latitude": "3.8167000"`. Use `Number(...)` before doing maths or showing a map.
- Dates are ISO strings such as `"2026-10-12T06:46:37.088Z"`.
- Plant lists return `{ plants, total, page, limit }`. The IoT alert list returns `{ alerts, total, page, limit }`, and the audit log returns `{ logs, total, page, limit, actions }`. Use `?page=2` for the next page. `limit` is 20 by default and 100 at most. The lists of users, requests and plant history are plain arrays without paging.
- Plant lists carry summary fields (names, status, GPS, `cover_photo_url`), and a plant's own endpoint returns the full details. For external botanists, plants they are not assigned to appear only once published, with the public catalog fields.

### Which endpoint each screen uses

| Screen | Request |
|---|---|
| Setup check | `GET /api/setup/status` |
| First administrator | `POST /api/setup/admin` |
| Login | `POST /api/auth/login`, and `GET /api/auth/me` to re-check a saved token |
| Species catalog (public) | `GET /api/public/plants?search=`, then `GET /api/public/plants/qr/:qr_code` for one plant |
| Plant list for staff | `GET /api/plants?search=&publication_status=` |
| My records | `GET /api/plants?mine=true` |
| Register a plant | `POST /api/plants`, then show the returned `qr_code` and `qr_code_image` |
| Scan QR (staff) | `GET /api/plants/qr/:qr_code` |
| Scan QR (park visitor) | `GET /api/public/plants/qr/:qr_code` |
| Plant details | `GET /api/plants/:id`, which includes `photos` |
| Edit a plant (internal botanist, officer, admin) | `PATCH /api/plants/:id` |
| Add a photo | `POST /api/plants/:id/photos` |
| Delete a plant (officer, admin) | `DELETE /api/plants/:id` |
| Plant history | `GET /api/plants/:id/history` |
| Send an edit or delete request (botanist) | `POST /api/requests` |
| My requests (botanist) | `GET /api/requests/mine` |
| Requests to review (officer, admin) | `GET /api/requests?status=Pending` |
| Approve or reject | `PATCH /api/requests/:id/review` |
| Publish and location visibility (officer, admin) | `PATCH /api/plants/:id/visibility` |
| Manage accounts (admin) | `GET /api/users`, `POST /api/auth/register`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password` |
| My account, change password | `PATCH /api/auth/password` |
| Audit log (admin) | `GET /api/audit-logs?action=&user_id=` |
| IoT monitoring (officer, admin) | `GET /api/iot/sensors`, `GET /api/iot/readings?sensor_id=&hours=`, `GET /api/iot/alerts?status=`, `PATCH /api/iot/alerts/:id/acknowledge`, `PATCH /api/iot/sensors/:id` |

### Behaviour a client has to handle

- QR codes: the QR contains only the `qr_code` text, for example `SFC-2E524325`. `qr_code_image` is a ready-made PNG that can go straight into `<img src="...">`. The mobile app also accepts a link that ends in the code.
- Restricted details: if `GET /api/plants/:id` returns `"full_detail": false`, the user is an external botanist who is not assigned to the plant. They get the park visitor view, with photos and a location only if allowed, and unpublished plants return 404 for them.
- Visitor view: the public scan returns 404 for unpublished plants. Location fields appear only if an officer allowed them.
- Photo upload: send `multipart/form-data` with the file in a field named `photo`. Accepted types are JPEG, PNG and WebP, up to 5 MB, with at most 20 photos per plant. The backend reads the file's real type from its content, so a renamed non-image is refused with 400. Do not set the `Content-Type` header yourself. The response contains the full `photo_url`.
- Editing as an external botanist: `PATCH /api/plants/:id` returns 403. Send an `EDIT` request instead and show it in My Requests.
- History: each item has a ready-to-show `summary` sentence.
- Accounts: an administrator cannot change their own status or role through `PATCH /api/users/:id`, and sets their own password with `PATCH /api/auth/password`. `POST /api/users/:id/reset-password` is for other accounts.

## API reference

All routes except login, setup, the public routes and the sensor readings route need `Authorization: Bearer <token>`. The sensor readings route needs the `X-Device-Key` header instead.

### Setup

| Method | URL | Who | What it does |
|---|---|---|---|
| GET | `/api/setup/status` | anyone | Returns `{ "setup_required": true or false, "key_required": true or false }`. `setup_required` is true only while the database has no administrator |
| POST | `/api/setup/admin` | anyone, while no administrator exists | Creates the first administrator from `{ full_name, email, password, setup_key }`. `setup_key` is needed only when `SETUP_KEY` is set. Returns 409 once an administrator exists, and 403 for a wrong key |

### Accounts

| Method | URL | Who | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | Log in and get a token |
| GET | `/api/auth/me` | logged in | Returns the current user and confirms a saved token is valid |
| PATCH | `/api/auth/password` | logged in | Change your own password from `{ current_password, new_password }`. A wrong current password returns 400 |
| POST | `/api/auth/register` | Admin | Create an account |
| GET | `/api/users` | Admin | List all accounts |
| PATCH | `/api/users/:id` | Admin | Deactivate, reactivate or change role and botanist type. Not allowed on your own account |
| POST | `/api/users/:id/reset-password` | Admin | Set a temporary password from `{ new_password }`, for an account other than your own. There is no email service, so the admin passes it on in person |

### Plants

| Method | URL | Who | What it does |
|---|---|---|---|
| GET | `/api/plants?search=&publication_status=&mine=true&page=&limit=` | logged in | Plant list, all filters optional. `full_detail` says whether opening the plant shows everything |
| POST | `/api/plants` | logged in | Register a plant and get its QR code |
| GET | `/api/plants/qr/:qr_code` | logged in | Find a plant by its QR code |
| GET | `/api/plants/:id` | logged in | View a plant |
| PATCH | `/api/plants/:id` | Internal botanist, Officer, Admin | Edit directly |
| POST | `/api/plants/:id/photos` | logged in | Upload a photo (form field `photo`) |
| GET | `/api/plants/:id/history` | logged in | List every change made to the plant |
| PATCH | `/api/plants/:id/visibility` | Officer, Admin | Publish and set location visibility |
| DELETE | `/api/plants/:id` | Officer, Admin | Delete a plant directly. The record stays in the history and its photo files are removed. Botanists send a delete request instead |

### Edit and delete requests

| Method | URL | Who | What it does |
|---|---|---|---|
| POST | `/api/requests` | Botanist | Request an edit or a deletion |
| GET | `/api/requests/mine?status=Rejected` | Botanist | Your own requests with status, reviewer and `review_comment`. The `status` filter is optional |
| GET | `/api/requests?status=Pending` | Officer, Admin | List requests waiting for review |
| PATCH | `/api/requests/:id/review` | Officer, Admin | Approve or reject. An approved request is applied automatically |

### Public routes

| Method | URL | What it does |
|---|---|---|
| GET | `/api/public/plants?search=&page=&limit=` | Species catalog: published plants only, with the area name, a cover photo, and GPS only for `Public` plants |
| GET | `/api/public/plants/qr/:qr_code` | What a park visitor sees after scanning a QR code |

### Audit log

| Method | URL | Who | What it does |
|---|---|---|---|
| GET | `/api/audit-logs?action=&user_id=&page=&limit=` | Admin | Every recorded action, newest first. The response also lists the action names found in the log, for a filter menu |

### IoT

| Method | URL | Who | What it does |
|---|---|---|---|
| POST | `/api/iot/readings` | ESP32 board (`X-Device-Key`) | Store a reading, register the board if it is new, and raise alerts. Limited to 120 requests per minute per IP |
| GET | `/api/iot/sensors` | Officer, Admin | Every sensor with its latest reading and open alert count, plus the alert limits in use |
| PATCH | `/api/iot/sensors/:id` | Officer, Admin | Change `name`, `location_note`, `latitude`, `longitude` or `plant_id` |
| GET | `/api/iot/readings?sensor_id=&hours=24` | Officer, Admin | Readings for charts, averaged into at most about 300 points, with minimum, maximum and average values and a movement count. `hours` is 1 to 744 |
| GET | `/api/iot/alerts?status=open&page=&limit=` | Officer, Admin | Alerts, `status` is `open` (default) or `all` |
| PATCH | `/api/iot/alerts/:id/acknowledge` | Officer, Admin | Mark an alert as seen. Returns 404 if it is already acknowledged |

### Example list response

`GET /api/plants?search=pitcher` returns:

```json
{
  "plants": [
    {
      "plant_id": 12, "qr_code": "SFC-2E524325", "common_name": "Pitcher Plant",
      "scientific_name": "Nepenthes rafflesiana", "family": "Nepenthaceae",
      "publication_status": "Under Research", "registered_by_name": "Ali Botanist",
      "cover_photo_url": "https://...supabase.co/storage/v1/object/public/plant-photos/...",
      "full_detail": true, "created_at": "2026-10-12T06:46:37.088Z"
    }
  ],
  "total": 1, "page": 1, "limit": 20
}
```

Search matches the scientific name, common name and family, and is not case sensitive.

### Example request bodies

Create an account (admin). The password has 8 to 72 characters. `botanist_type` is required for botanists and not allowed for other roles:

```json
{ "full_name": "Ali Botanist", "email": "ali@example.com", "password": "...", "role_name": "Botanist", "botanist_type": "External" }
```

Register a plant. Only `scientific_name` is required:

```json
{
  "scientific_name": "Nepenthes rafflesiana",
  "common_name": "Pitcher Plant",
  "family": "Nepenthaceae",
  "height_cm": 50,
  "width_cm": 20,
  "morphological_notes": "Green pitchers with red speckles",
  "latitude": 3.8167,
  "longitude": 113.7833
}
```

The limits are 0 to 9999.99 for `height_cm` and `width_cm`, -90 to 90 for `latitude` and -180 to 180 for `longitude`. Latitude and longitude must be sent together.

Edit request (external botanist):

```json
{ "plant_id": 12, "request_type": "EDIT", "proposed_changes": { "height_cm": 150 } }
```

Delete request:

```json
{ "plant_id": 12, "request_type": "DELETE" }
```

Approve or reject a request:

```json
{ "decision": "Rejected", "review_comment": "Height looks wrong, please re-measure" }
```

Publish a plant. `location_visibility` is required when publishing:

```json
{ "publication_status": "Published", "location_visibility": "Approximate", "general_location": "Niah National Park" }
```

Change your own password:

```json
{ "current_password": "...", "new_password": "..." }
```

A sensor reading from an ESP32 (header `X-Device-Key: <IOT_DEVICE_KEY>`). Only `device_code` is required:

```json
{ "device_code": "SENSOR-01", "temperature_c": 29.5, "humidity_pct": 78, "soil_moisture_pct": 46, "motion": true }
```

The answer has status 201: `{ "ok": true, "sensor_id": 1, "alert": true, "alerts": [ ... ] }`. `alert` is true when this reading raised at least one new alert.

## Security

- Passwords are stored hashed. Accounts are created by an administrator, except for the first administrator, who is created through the one-time setup page.
- The setup endpoints stop working as soon as an administrator exists, a simultaneous double submission creates only one administrator, and `SETUP_KEY` can restrict the first setup further.
- Login tokens accept only the HS256 algorithm and stop working as soon as their account is deactivated. Roles are read from the database on every request.
- Logins take about the same time for unknown emails and wrong passwords, and a deactivated account is revealed only to someone who knows the password.
- Rate limits: 10 wrong passwords per 15 minutes on login and on password changes (they share one limit), 10 setup attempts per 15 minutes, 120 requests per minute per IP on the public and setup endpoints, and 120 sensor readings per minute per IP. JSON bodies are limited to 100 KB.
- Sensor boards prove themselves with the `X-Device-Key` header. The backend compares it in constant time and refuses all readings while `IOT_DEVICE_KEY` is empty. One key is shared by every board, so keep it out of the repository.
- Administrators cannot deactivate or change their own account, so one active administrator always remains. A temporary password set by an administrator is for the account owner to replace with their own.
- Browsers can call the API only from the addresses in `CORS_ORIGINS`.
- The public endpoints return photos only for published plants, and return GPS only when an officer chose `Public`.
- Uploaded photos are checked by their content (JPEG, PNG or WebP) and limited to 20 per plant. The photo itself is stored exactly as uploaded, so EXIF metadata, including GPS, is deliberately kept because it may be used later. Photos live in a public Storage bucket and are shown to park visitors once a plant is published, so anyone who has a photo link can read that metadata, including the GPS position of a plant whose location is `Hidden`. Removing GPS from the public copy of each photo is not built yet.
- Row Level Security is switched on for every table with no policies, so only the backend can read the tables.
- The web app keeps the login token in `localStorage`. The mobile app keeps it in memory only.

## Backend code layout

| Path | Purpose |
|---|---|
| `server.js` | Starts the server, applies CORS, rate limits and security headers, and sends each request to the right route |
| `routes/` | The URLs and who may call them: `authRoutes`, `userRoutes`, `plantRoutes`, `requestRoutes`, `publicRoutes`, `setupRoutes`, `auditRoutes`, `iotRoutes` |
| `middleware/` | Checks that run before a request is handled: logged in (`auth.js`), right role (`role.js`), numeric ids (`validateId.js`), valid photo upload (`upload.js`) |
| `controllers/` | What happens for each request: `authController`, `userController`, `plantController`, `requestController`, `publicController`, `setupController` (the first administrator), `auditController` and `iotController` |
| `utils/validatePlant.js` | Rules for valid plant data |
| `utils/validateAccount.js` | Rules for valid new accounts and passwords, shared by account creation, setup and password changes |
| `utils/plantChanges.js` | Applies edits and records old and new values |
| `utils/publicView.js` | Decides which plant fields visitors see, and builds the public views |
| `utils/auditLog.js` | Writes the history records |
| `utils/qrcode.js` | Generates QR codes |
| `utils/imageType.js` | Checks that an uploaded photo really is a JPEG, PNG or WebP |
| `utils/photoStorage.js` | Removes photo files from Storage when a plant is deleted |
| `utils/listQuery.js` | Paging and search for list endpoints |
| `config/db.js` | Database connection, with the optional certificate check |
| `config/supabase.js` | Supabase client, used for photo storage |
| `scripts/checkSupabase.js` | `npm run check-supabase` |
| `scripts/createAdmin.js` | `npm run create-admin`, the recovery tool for a lost administrator |
| `postman/` | The Postman test collection and a sample image |

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` or "Could not get response" | The backend is not running. Start it with `npm run dev` in `backend` |
| `Missing in .env: ... - refusing to start` | The `.env` file is missing from the `backend` folder |
| `password authentication failed` | The database password changed. Ask for the latest `.env` |
| `ENOTFOUND`, `ENETUNREACH` or `ETIMEDOUT` | Check your internet connection. The Supabase project may be paused, so tell the teammate who manages it. Some school and office Wi-Fi networks block the database port, so try a phone hotspot |
| The web app shows "Cannot reach the server" while the backend is running | The web app's address is probably missing from `CORS_ORIGINS` in `backend/.env` (restart the backend after changing it), or `VITE_API_URL` points to the wrong place |
| The web app shows the setup page unexpectedly | The backend you are connected to has no administrator in its database. Check that `VITE_API_URL` and `DATABASE_URL` point to the intended project |
| The setup page does not appear on a new database | An administrator already exists, or the web app cannot reach the backend. Use the login page, or run `npm run create-admin` if nobody can sign in as an administrator |
| The phone app says "Can't reach the server" | Set `API_URL` in `mobile/src/api.ts` to the computer's local IP address instead of `localhost`, put both devices on the same Wi-Fi, and allow Node.js through the Windows firewall. The IP address changes when the computer joins another network |
| The phone app refuses a login with a message about the website | Officer and Admin accounts work on the website. Only Botanist accounts sign in on the phone |
| Photo upload returns 502 | Your `.env` may be outdated, or the `plant-photos` bucket does not exist. Ask for the latest `.env`, run `schema.sql` to create the bucket, and run `npm run check-supabase` |
| "Invalid email or password" | Check the login with a teammate. Accounts created in Supabase Authentication do not work here |
| "Too many login attempts" | There were 10 wrong passwords within 15 minutes (a wrong current password on the change-password form counts too). Wait, or restart the backend |
| "Too many requests, please slow down" | The public endpoints allow 120 requests per minute per IP. Wait a minute |
| The IoT page says the IoT tables are missing or out of date | Run `schema.sql` from the repository root in the Supabase SQL Editor. It is safe to run again |
| A sensor board gets 503 "IoT is not set up on this server" | `IOT_DEVICE_KEY` is empty in `backend/.env`. Set it and restart the backend |
| A sensor board gets 401 "Invalid device key" | The `X-Device-Key` in the sketch differs from `IOT_DEVICE_KEY` |
| A sensor board gets 429 "Too many readings" | The board sends more than 120 readings a minute from one IP address. Lengthen its send interval |

## Changes from the original code

### Backend: edited files

| File | Change |
|---|---|
| `server.js` | CORS is limited to the addresses in `CORS_ORIGINS` (it was open to everyone). JSON bodies are limited to 100 KB. Security headers are added (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`) and `X-Powered-By` is removed. The public routes and `/api/setup` share a limit of 120 requests per minute per IP. `/api/setup`, `/api/audit-logs` and `/api/iot` are mounted. Unknown routes return a JSON 404, malformed JSON returns 400 and oversized bodies return 413. `TRUST_PROXY` is supported. A `JWT_SECRET` shorter than 32 characters prints a warning, and in production the server refuses to start |
| `config/db.js` | Optional verification of the database certificate through `DB_SSL_CA`. Without it the behaviour is as before, with a warning printed at startup |
| `middleware/auth.js` | Token verification accepts only the HS256 algorithm |
| `controllers/authController.js` | `register` uses the shared account validation (email format, password 8 to 72 characters, botanist type rules), trims the name and email, and always records the acting admin in the history. `login` rejects non-text input, compares against a dummy hash when the email is unknown so timing does not reveal it, and checks the password before the deactivated status. New `me` and `changePassword` handlers |
| `routes/authRoutes.js` | Adds `GET /api/auth/me` and `PATCH /api/auth/password` |
| `controllers/plantController.js` | Photo upload reads the real file type from the file's content and allows at most 20 photos per plant (409 beyond that). The photo itself is stored unchanged, so EXIF and GPS data stay in the file. New `deletePlant` handler, a history sentence for `DELETE_PLANT`, and a length check on `general_location` |
| `routes/plantRoutes.js` | Adds `DELETE /api/plants/:id` for officers and admins |
| `controllers/requestController.js` | The `status` filter is validated and `review_comment` is checked. Photo files are removed from Storage when an approved delete request removes a plant |
| `controllers/userController.js` | When updating an account, a Botanist must end up with a type, and moving an account away from Botanist clears its type. New `resetPassword` handler |
| `routes/userRoutes.js` | Adds `POST /api/users/:id/reset-password` |
| `package.json` | Adds the `create-admin` script. No dependencies changed |
| `.env.example` | Adds `DB_SSL_CA`, `CORS_ORIGINS`, `TRUST_PROXY`, `SETUP_KEY` and the IoT settings, and explains `JWT_SECRET` |

### Backend: added files

| File | Purpose |
|---|---|
| `controllers/setupController.js` | The one-time first administrator: `GET /api/setup/status` and `POST /api/setup/admin`. It works only while the database has no administrator, serialises simultaneous attempts with a database lock, and honours the optional `SETUP_KEY` |
| `routes/setupRoutes.js` | The setup routes, with a limit of 10 attempts per 15 minutes per IP on the creation endpoint |
| `controllers/auditController.js`, `routes/auditRoutes.js` | The admin audit log, `GET /api/audit-logs` |
| `controllers/iotController.js`, `routes/iotRoutes.js` | The sensor readings route, the monitoring routes for staff and the alert rules (Sprint 2) |
| `utils/validateAccount.js` | Account and password validation shared by `register`, setup and password changes |
| `utils/imageType.js` | Detects JPEG, PNG and WebP files from their first bytes |
| `utils/photoStorage.js` | Removes photo files from Storage when a plant is deleted |
| `scripts/createAdmin.js` | `npm run create-admin`, the recovery tool for a lost administrator |
| `schema.sql` (repository root) | The whole database structure in one file: Sprint 1, Sprint 2, the photo bucket, indexes and Row Level Security. Safe to run again |

### Backend: changes that can affect existing clients

- Browsers can call the API only from the addresses in `CORS_ORIGINS`. The mobile app, Postman, curl and the sensor boards are not affected.
- Creating a Botanist, or changing an account to a Botanist, requires `botanist_type`.
- Passwords must have 8 to 72 characters.
- A file that is not really a JPEG, PNG or WebP image is refused with 400, even when it is renamed or sent with an image content type.
- An invalid `status` filter on the request lists returns 400.
- A wrong password for a deactivated account now returns the usual 401 instead of revealing that the account is deactivated.
- Published plants now include their photos for park visitors and for external botanists who are not assigned to them: `photos` on `GET /api/public/plants/qr/:qr_code` and on the restricted `GET /api/plants/:id` view, and `cover_photo_url` in both plant lists. `GET /api/plants/qr/:qr_code` now also returns `photos`.
- Both plant lists now include `latitude` and `longitude`: the staff list for users with full access, and the public catalog (and the restricted rows an external botanist sees) only for plants whose location is `Public`, the same rule as a plant's own page.

### Web app: summary

The web app was written so that all data goes through the backend. Supabase is not used directly. It has since been redesigned as RimbaTag, with a public site (home, catalog, species page, login) and a staff area with one page per feature (see "The web app"). The original dashboards for each role were replaced by that staff area, and the registration page, `supabaseClient.js` and `SetupNotice.jsx` were removed.

Notes for users and developers:

- There is no public registration page. An administrator creates accounts, and the first administrator is created on the one-time setup page.
- The old approve and reject status on plants is replaced by the backend's publish flow with location visibility, and by the change request flow for botanists.
- `description` is now `morphological_notes`, and only `scientific_name` is required when registering a plant.
- The public catalog uses `/api/public` and opens a plant by its QR code (`/species/:qrCode`) instead of by record id. It shows the cover photo in the list and a photo gallery on the species page.

### Mobile app: summary

The first version was an offline app with a local SQLite database, a placeholder login, its own plant IDs and an inactive Sync button. It now signs in against the backend, uses the backend's field names and IDs, uploads photos, and follows the same edit and request rules as the web app. The local database and the Sync button are gone.

## Not built yet

- Removing GPS (EXIF) from the copy of each photo that park visitors see.
- Offline use and sync in the mobile app. It needs a connection for every screen.
- A separate key for each sensor board. All boards share `IOT_DEVICE_KEY`.
- Postman checks for the audit log, password changes and the IoT endpoints.
- An OpenAPI description of the API.
- Researcher access requests (planned for a later sprint).

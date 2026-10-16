# Smartplantsystem

Smartplantsystem is the Smart Ground-Truthing and Digital Biodiversity System for plant species in Niah National Park. Botanists record plants in the field, conservation officers review and publish them, administrators manage accounts, and park visitors browse the published species by scanning a QR code or using the web catalog.

The project has three applications that share one database:

- `backend/` is the API. It stores every plant record, photo and user account and decides who may see or change what.
- `webapp/` is the web application for staff and the public species catalog.
- `mobile/` is the field application built with Expo. It currently runs on its own and is not connected to the backend yet.

## Contents

- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Roles and permissions](#roles-and-permissions)
- [The life of a plant record](#the-life-of-a-plant-record)
- [The web app](#the-web-app)
- [The mobile app](#the-mobile-app)
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
 Web app (webapp/)             Mobile app (mobile/)
 React + Vite                  Expo / React Native
      |                              |
      | HTTP + login token           | standalone for now (see "The mobile app")
      v                              v
 Backend (backend/)  <--- the only way to reach the data
 Node.js + Express
      |
      +--> Supabase database (PostgreSQL): plants, users, requests, history
      +--> Supabase Storage: plant photos
```

The backend is the only gateway to the data. For every request it checks who the user is, whether their role allows the action, and whether the data is valid. The web app talks to the backend and holds no Supabase keys. The mobile app will follow the same rule once it is connected. Row Level Security is switched on for every table with no policies, so a Supabase key cannot read the tables directly either.

The whole team shares one Supabase project (SPS), so everyone sees the same data.

## Repository layout

| Path | Contents |
|---|---|
| `backend/` | The Express API, its scripts and a Postman test collection |
| `webapp/` | The React web app. All data access goes through `webapp/src/api.js` |
| `mobile/` | The Expo field app with a local SQLite database |
| `sprint1_database_schema.sql` | The database structure. It is already applied in the team's Supabase project, so it only needs to be run for a brand new project |

## Getting started

You need Node.js. Each application runs as its own process, started with `npm run dev` from its own folder (the mobile app uses `npx expo start`). No single command starts them together, so open one terminal per application and start the backend first, because the web app cannot show any data without it.

### Backend

1. Clone the repository and switch to the `backend&Database` branch.
2. Open a terminal in `backend` and install the packages (only for first run on device):
   ```
   npm install
   ```
3. Setup the `.env` file and put it in `backend` next to `.env.example`. It contains the database password and the secret key. Keep it private: use .gitignore to not commit it and keep it safe.
4. Check the connection. Every line should say `OK`:
   ```
   npm run check-supabase
   ```
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

Open a third terminal in `mobile`, run `npm install`, then `npx expo start`. You can open the app in a development build, an Android emulator, an iOS simulator or Expo Go. The mobile app does not need the backend yet.

### First administrator

A new database has no accounts, and only an administrator can create accounts. When the web app starts against a database that contains no administrator, it shows a one-time setup page instead of the normal site. The person who fills it in becomes the administrator and is signed in straight away. The page appears only while no administrator exists in the database. After the first one is created it never appears again, and the backend refuses further setup requests.

On a new deployment that is reachable from the internet, set `SETUP_KEY` in `backend/.env` before the first visit. The setup page then asks for that key, so only someone who knows it can create the administrator.

If every administrator account is lost, for example because the password is forgotten, run this from `backend`. It refuses to run while an active administrator exists unless you add `--force`:

```
npm run create-admin -- "Full Name" admin@example.com "a-strong-password"
```

All other accounts are created by an administrator in the web app, under User Accounts. There is no public sign-up for now.

### Testing with Postman

Import `backend/postman/Biodiversity-Sprint1.postman_collection.json`. In the collection's Variables tab, set `adminEmail` and `adminPassword`. In the Upload plant photo request, open Body and pick `backend/postman/sample-leaf.png`. Then run the whole collection. All 67 checks should pass. Each run adds test users (`...@test.com`) and plants to the shared database, so run it only when needed.

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
| `CORS_ORIGINS` | Addresses the web app may call the API from, comma separated. Default `http://localhost:5173`. Add the deployed web app's address here. The mobile app, Postman and curl are not affected, because CORS is a browser rule |
| `TRUST_PROXY` | Needed only when the backend runs behind a proxy or hosting platform. Set it to the number of proxies in front of the backend, usually `1`, so the rate limits count each visitor separately |
| `SETUP_KEY` | Optional. Protects the one-time setup page on a new deployment (see "First administrator") |
| `DB_SSL_CA` | Optional but recommended. Turns on verification of the database's TLS certificate (see below) |
| `DB_SSL` | Set to `false` to turn TLS off, only for a local Postgres |

The database connection is always encrypted. By default the server's certificate is not verified and the backend prints a warning at startup. To verify it, download the certificate in the Supabase Dashboard (Database, Settings, SSL Configuration), save it in `backend`, and set `DB_SSL_CA=./your-file.crt`.

### Web app (`webapp/.env`)

| Setting | Purpose |
|---|---|
| `VITE_API_URL` | Address of the backend. Default `http://localhost:5000`. For a deployed site, use the deployed backend's address and add the site's own address to `CORS_ORIGINS` on the backend |

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
| Create, change and deactivate accounts | No | No | No | No | Yes |

1. An external botanist is assigned automatically to the plants they register.
2. For plants they are not assigned to, an external botanist sees exactly what a park visitor sees: nothing until the plant is published, then the public fields and the photos.

A botanist always has a type, `Internal` or `External`. The other roles have none. There is no public sign-up for now.

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
| Anyone | The species catalog (published plants only) with search and paging. A plant's page shows its details, its photos and as much location as an officer allowed |
| Botanist | A form to register plants with a photo, GPS and QR code, a list of their own records, and a My Requests tab with each decision and the officer's comment. Internal botanists edit directly. External botanists send edit requests. Any botanist can request a deletion |
| Conservation officer | All records with publishing, location visibility, direct editing, direct deletion and per-record history. A Change Requests tab to approve or reject botanists' requests |
| Admin | Everything an officer can do, plus User Accounts: create accounts, change role and botanist type, and deactivate or reactivate accounts |

The source in `webapp/src/` is organised like this:

- `api.js` is the single place that talks to the backend. It adds the login token, turns failures into readable messages and signs the user out when the backend rejects the token.
- `queries/` holds one small function per backend endpoint: `plants.js`, `requests.js`, `users.js` and `setup.js`.
- `roles.js` and `plantFields.js` hold the role names and plant field names exactly as the backend uses them.
- `context/AuthContext.jsx` keeps the login state. It signs in with `POST /api/auth/login` and re-checks a saved token with `GET /api/auth/me` after a page reload.
- `components/` and `pages/` hold the screens. `SetupGate` shows the one-time setup page when the backend reports that no administrator exists.

The web app keeps the login token in the browser's `localStorage`, so a reload keeps you signed in.

## The mobile app

`mobile/` is a standalone, offline application for now. It stores records in a local SQLite database and makes no network calls. Its login is a placeholder, and its plant fields and IDs do not match the backend: records get a local ID such as `PLANT-<timestamp>`, height is stored as text, and the coordinates are named `lat` and `lng`. The Sync records button shows a "Coming soon" message.

Connecting it to the backend is a separate step. It needs a real login, matching field names, photo upload and offline sync. Once connected, it will talk only to the backend like the web app. A phone cannot reach `localhost`, so it will need the local IP address of the computer running the backend, for example `http://192.168.1.20:5000`, with both devices on the same Wi-Fi.

## Data model

The structure is defined in `sprint1_database_schema.sql`. Please do not create, change or delete tables in the Supabase dashboard. If the database needs a change, tell the backend team so the schema file stays in sync.

| Table | Contents |
|---|---|
| `roles` | The three roles: Botanist, Conservation Officer, Admin |
| `users` | Staff accounts: name, email, hashed password, role and, for botanists, whether they are Internal or External. Accounts are deactivated instead of deleted |
| `plants` | One row per plant: names and classification, size, notes, GPS, conservation information, QR code and the two visibility settings |
| `plant_photos` | Links to each plant's photos. The image files are in the Supabase Storage bucket `plant-photos` |
| `record_change_requests` | Edit and delete requests from botanists, with the officer's decision and comment |
| `botanist_assignments` | Which external botanist is assigned to which plant |
| `audit_logs` | Every action (registered, edited, photo uploaded, approved and so on). The plant history is built from it |

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
| `password` | text, 8 to 72 characters | Sent only when creating an account. Stored hashed and never returned |
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

The plant history endpoint (`GET /api/plants/:id/history`) reads from this table.

| Field | Notes |
|---|---|
| `log_id` | |
| `user_id` | Who did it. The history adds `user_name` and `role_name` |
| `action` | `CREATE_PLANT`, `UPDATE_PLANT`, `UPLOAD_PHOTO`, `UPDATE_VISIBILITY`, `DELETE_PLANT`, `REQUEST_EDIT`, `REQUEST_DELETE`, `APPROVED_REQUEST`, `REJECTED_REQUEST`, `CREATE_USER`, `UPDATE_USER`, `LOGIN` |
| `target_table`, `target_id` | What the action was done to, for example `plants` and `12` |
| `details` | Extra information as JSON, such as the old and new values of an edit |
| `created_at` | date |
| `summary` | Added by the history endpoint: a ready-to-show sentence |

## API guide

### Where to send requests

The web app reads the backend address from `VITE_API_URL`. The mobile app will need the local IP address of the computer running the backend. Neither app should use supabase-js or any Supabase key, because everything goes through the backend.

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
6. If any request returns 401, the token has expired or the account was deactivated. Clear the token and show the login screen.

### Response conventions

- Errors are always `{ "error": "message" }`, and the message can be shown to the user.
- Status codes: `400` invalid input, `401` not logged in, `403` not allowed, `404` not found, `409` conflict (for example a request that was already reviewed), `413` request body too large, `429` too many requests.
- Decimal values come back as strings, for example `"height_cm": "50.00"` and `"latitude": "3.8167000"`. Use `Number(...)` before doing maths or showing a map.
- Dates are ISO strings such as `"2026-10-12T06:46:37.088Z"`.
- List endpoints return `{ plants, total, page, limit }`. Use `?page=2` for the next page. `limit` is 20 by default and 100 at most. Lists carry summary fields (names, status, GPS, `cover_photo_url`), and a plant's own endpoint returns the full details. For external botanists, plants they are not assigned to appear only once published, with the public catalog fields.

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
| Manage accounts (admin) | `GET /api/users`, `POST /api/auth/register`, `PATCH /api/users/:id` |

### Behaviour a client has to handle

- QR codes: the QR contains only the `qr_code` text, for example `SFC-2E524325`. `qr_code_image` is a ready-made PNG that can go straight into `<img src="...">`.
- Restricted details: if `GET /api/plants/:id` returns `"full_detail": false`, the user is an external botanist who is not assigned to the plant. They get the park visitor view, with photos and a location only if allowed, and unpublished plants return 404 for them.
- Visitor view: the public scan returns 404 for unpublished plants. Location fields appear only if an officer allowed them.
- Photo upload: send `multipart/form-data` with the file in a field named `photo`. Accepted types are JPEG, PNG and WebP, up to 5 MB, with at most 20 photos per plant. The backend reads the file's real type from its content, so a renamed non-image is refused with 400. Do not set the `Content-Type` header yourself. The response contains the full `photo_url`.
- Editing as an external botanist: `PATCH /api/plants/:id` returns 403. Send an `EDIT` request instead and show it in My Requests.
- History: each item has a ready-to-show `summary` sentence.

## API reference

All routes except login, setup and the public routes need `Authorization: Bearer <token>`.

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
| POST | `/api/auth/register` | Admin | Create an account |
| GET | `/api/users` | Admin | List all accounts |
| PATCH | `/api/users/:id` | Admin | Deactivate, reactivate or change role and botanist type |

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

## Security

- Passwords are stored hashed. Accounts are created by an administrator, except for the first administrator, who is created through the one-time setup page.
- The setup endpoints stop working as soon as an administrator exists, a simultaneous double submission creates only one administrator, and `SETUP_KEY` can restrict the first setup further.
- Login tokens accept only the HS256 algorithm and stop working as soon as their account is deactivated. Roles are read from the database on every request.
- Logins take about the same time for unknown emails and wrong passwords, and a deactivated account is revealed only to someone who knows the password.
- Rate limits: 10 wrong passwords per 15 minutes on login, 10 setup attempts per 15 minutes, and 120 requests per minute per IP on the public endpoints. JSON bodies are limited to 100 KB.
- Browsers can call the API only from the addresses in `CORS_ORIGINS`.
- The public endpoints return photos only for published plants, and return GPS only when an officer chose `Public`.
- Uploaded photos are checked by their content (JPEG, PNG or WebP) and limited to 20 per plant. The photo itself is stored exactly as uploaded, so EXIF metadata, including GPS, is deliberately kept because it may be used later. Photos live in a public Storage bucket and are shown to park visitors once a plant is published, so anyone who has a photo link can read that metadata, including the GPS position of a plant whose location is `Hidden`. Removing GPS from the public copy of each photo is planned for Sprint 2.
- Row Level Security is switched on for every table with no policies, so only the backend can read the tables.
- The web app keeps the login token in `localStorage`.

## Backend code layout

| Path | Purpose |
|---|---|
| `server.js` | Starts the server, applies CORS, rate limits and security headers, and sends each request to the right route |
| `routes/` | The URLs and who may call them |
| `middleware/` | Checks that run before a request is handled: logged in, right role, valid photo upload |
| `controllers/` | What happens for each request. `setupController.js` handles the first administrator |
| `utils/validatePlant.js` | Rules for valid plant data |
| `utils/validateAccount.js` | Rules for valid new accounts, shared by account creation and setup |
| `utils/plantChanges.js` | Applies edits and records old and new values |
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
| Phone app cannot reach the backend | Use the computer's local IP address instead of `localhost`, put both devices on the same Wi-Fi, and allow Node.js through the Windows firewall |
| Photo upload returns 502 | Your `.env` may be outdated. Ask for the latest one and run `npm run check-supabase` |
| "Invalid email or password" | Check the login with a teammate. Accounts created in Supabase Authentication do not work here |
| "Too many login attempts" | There were 10 wrong passwords within 15 minutes. Wait, or restart the backend |
| "Too many requests, please slow down" | The public endpoints allow 120 requests per minute per IP. Wait a minute |

### Backend: edited files

| File | Change |
|---|---|
| `server.js` | CORS is limited to the addresses in `CORS_ORIGINS` (it was open to everyone). JSON bodies are limited to 100 KB. Security headers are added (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`) and `X-Powered-By` is removed. The public routes and `/api/setup` share a limit of 120 requests per minute per IP. `/api/setup` is mounted. Unknown routes return a JSON 404, malformed JSON returns 400 and oversized bodies return 413. `TRUST_PROXY` is supported. A `JWT_SECRET` shorter than 32 characters prints a warning, and in production the server refuses to start |
| `config/db.js` | Optional verification of the database certificate through `DB_SSL_CA`. Without it the behaviour is as before, with a warning printed at startup |
| `middleware/auth.js` | Token verification accepts only the HS256 algorithm |
| `controllers/authController.js` | `register` uses the shared account validation (email format, password 8 to 72 characters, botanist type rules), trims the name and email, and always records the acting admin in the history. `login` rejects non-text input, compares against a dummy hash when the email is unknown so timing does not reveal it, and checks the password before the deactivated status. A new `me` handler returns the current user |
| `routes/authRoutes.js` | Adds `GET /api/auth/me` |
| `controllers/plantController.js` | Photo upload reads the real file type from the file's content and allows at most 20 photos per plant (409 beyond that). The photo itself is stored unchanged, so EXIF and GPS data stay in the file. New `deletePlant` handler, a history sentence for `DELETE_PLANT`, and a length check on `general_location` |
| `routes/plantRoutes.js` | Adds `DELETE /api/plants/:id` for officers and admins |
| `controllers/requestController.js` | The `status` filter is validated and `review_comment` is checked. Photo files are removed from Storage when an approved delete request removes a plant |
| `controllers/userController.js` | When updating an account, a Botanist must end up with a type, and moving an account away from Botanist clears its type |
| `package.json` | Adds the `create-admin` script. No dependencies changed |
| `.env.example` | Adds `DB_SSL_CA`, `CORS_ORIGINS`, `TRUST_PROXY` and `SETUP_KEY`, and explains `JWT_SECRET` |

### Backend: added files

| File | Purpose |
|---|---|
| `controllers/setupController.js` | The one-time first administrator: `GET /api/setup/status` and `POST /api/setup/admin`. It works only while the database has no administrator, serialises simultaneous attempts with a database lock, and honours the optional `SETUP_KEY` |
| `routes/setupRoutes.js` | The setup routes, with a limit of 10 attempts per 15 minutes per IP on the creation endpoint |
| `utils/validateAccount.js` | Account validation shared by `register` and setup |
| `utils/imageType.js` | Detects JPEG, PNG and WebP files from their first bytes |
| `utils/photoStorage.js` | Removes photo files from Storage when a plant is deleted |
| `scripts/createAdmin.js` | `npm run create-admin`, the recovery tool for a lost administrator |

### Backend: changes that can affect existing clients

- Browsers can call the API only from the addresses in `CORS_ORIGINS`. The mobile app, Postman and curl are not affected.
- Creating a Botanist, or changing an account to a Botanist, requires `botanist_type`.
- Passwords must have 8 to 72 characters.
- A file that is not really a JPEG, PNG or WebP image is refused with 400, even when it is renamed or sent with an image content type.
- An invalid `status` filter on the request lists returns 400.
- A wrong password for a deactivated account now returns the usual 401 instead of revealing that the account is deactivated.
- Published plants now include their photos for park visitors and for external botanists who are not assigned to them: `photos` on `GET /api/public/plants/qr/:qr_code` and on the restricted `GET /api/plants/:id` view, and `cover_photo_url` in both plant lists. `GET /api/plants/qr/:qr_code` now also returns `photos`.
- Both plant lists now include `latitude` and `longitude`: the staff list for users with full access, and the public catalog (and the restricted rows an external botanist sees) only for plants whose location is `Public`, the same rule as a plant's own page.

### Web app: summary

The web app was written so that all data goes through the backend. Supabase is not used directly.

| Kind | Files |
|---|---|
| Added | `src/api.js`, `src/roles.js`, `src/plantFields.js`, `src/hooks.js`, `src/queries/requests.js`, `src/pages/Setup.jsx`, and the components `ChangeRequestsPanel`, `ChangesList`, `EditPanel`, `HistoryPanel`, `MyRequestsPanel`, `Pager`, `PublishPanel`, `SetupGate` and `StatusTag` |
| Rewritten | `src/App.jsx`, `src/main.jsx`, `src/context/AuthContext.jsx`, `src/queries/plants.js`, `src/queries/users.js`, `src/queries/setup.js`, the components `Navbar`, `PlantForm`, `PlantRecordsTable` and `PrivateRoute`, and the pages `Login`, `SpeciesCatalog`, `SpeciesDetail`, `BotanistDashboard`, `OfficerDashboard` and `AdminDashboard` |
| Edited | `src/index.css` (styles added for the QR result, change lists and history, unused rules removed), `package.json`, `package-lock.json`, `.env.example` (now holds `VITE_API_URL`) |
| Removed | `src/supabaseClient.js`, `src/components/SetupNotice.jsx`, `src/pages/Register.jsx` |
| Unchanged | `src/pages/Home.jsx`, `index.html`, `vite.config.js` |

Users and developers experience notice:

- There is no public registration page. An administrator creates accounts, and the first administrator is created on the one-time setup page.
- The old approve and reject status on plants is replaced by the backend's publish flow with location visibility, and by the change request flow for botanists.
- `description` is now `morphological_notes`, and only `scientific_name` is required when registering a plant.
- The public catalog uses `/api/public` and opens a plant by its QR code (`/species/:qrCode`) instead of by record id. It does not show photos yet, although the API now returns them (`cover_photo_url` and `photos`).

## Not built yet

- Admin view of the audit log, password reset and changing your own password.
- Connecting the mobile app: real login, matching fields, photo upload and offline sync.
- Removing GPS (EXIF) from the copy of each photo that park visitors see.
- An OpenAPI description of the API, planned for after the mobile app has a better structure.
- Later sprints: researcher access requests, reports, IoT sensors and offline sync.

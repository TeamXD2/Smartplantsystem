# Biodiversity System — Backend & Database

This is the backend and database behind the web app and the mobile app. It stores every
plant record, photo and user account, and decides who is allowed to see or change what.

**Contents**
1. [How it fits together](#1-how-it-fits-together)
2. [The database](#2-the-database)
3. [Who can do what](#3-who-can-do-what)
4. [The life of a plant record](#4-the-life-of-a-plant-record)
5. [Running the backend](#5-running-the-backend)
6. [Connecting the web / mobile app](#6-connecting-the-web--mobile-app)
7. [API reference](#7-api-reference)
8. [Where things are in the code](#8-where-things-are-in-the-code)
9. [Common problems](#9-common-problems)
10. [Not built yet](#10-not-built-yet)

---

## 1. How it fits together

```
 Web app / Mobile app
        │   HTTP requests, with the user's login token
        ▼
 Backend  (Node.js + Express, this folder)
        │   1. Who is this?  2. Are they allowed?  3. Is the data valid?
        ├──►  Supabase database (PostgreSQL) — plants, users, requests, history
        └──►  Supabase Storage — plant photos
```

- The apps **only talk to the backend**. They never read or write Supabase directly.
- The backend checks the user's login, their role (Botanist, Officer, Admin) and the data
  they send, then reads/writes the database.
- The whole team shares **one Supabase project (SPS)**, so everyone sees the same data.

---

## 2. The database

The structure is defined in `sprint1_database_schema.sql` (in the folder above `backend`).
It is already set up in the team's Supabase project.

| Table | What it stores |
|---|---|
| `roles` | The 3 roles: Botanist, Conservation Officer, Admin |
| `users` | Staff accounts: name, email, encrypted password, role, and for Botanists whether they are `Internal` or `External`. Accounts can be deactivated instead of deleted |
| `plants` | One row per plant: names and classification, height/width, notes, GPS, conservation info, its QR code, and two visibility settings (below) |
| `plant_photos` | Links to each plant's photos. The image files themselves are in the Supabase Storage bucket `plant-photos` |
| `record_change_requests` | Edit/delete requests sent by Botanists, and the Officer's decision and comment |
| `botanist_assignments` | Which External Botanist is assigned to which plant (they only see full details of their assigned plants) |
| `audit_logs` | Every action (registered, edited, photo uploaded, approved…). This is what the plant **history** shows |

**The two visibility settings on each plant**
- `publication_status` — `Under Research` (staff only, the default) or `Published` (Park Visitors can see it).
- `location_visibility` — how much location visitors see: `Public` (exact GPS), `Approximate` (area name only, from `general_location`), or `Hidden`.

### Fields

These are the names the API uses in requests and responses.

**`plants`**

"Set by" says how a field gets its value: **register** = `POST /api/plants`,
**edit** = `PATCH /api/plants/:id` or an approved EDIT request,
**publish** = `PATCH /api/plants/:id/visibility` (Officer/Admin), **auto** = the backend.

| Field | Type / limits | Set by | Notes |
|---|---|---|---|
| `plant_id` | number | auto | |
| `qr_code` | text, e.g. `SFC-2E524325` | auto | Unique. Never changes |
| `scientific_name` | text, max 150 | register, edit | **Required** |
| `common_name` | text, max 150 | register, edit | |
| `family`, `genus`, `species` | text, max 100 each | register, edit | |
| `height_cm`, `width_cm` | number 0–9999.99 | register, edit | 🔒 · Returned as a string, e.g. `"50.00"` |
| `latitude` | number −90 to 90 | register, edit | 🔒 · Send together with `longitude` · Returned as a string |
| `longitude` | number −180 to 180 | register, edit | 🔒 · Returned as a string |
| `morphological_notes` | text, max 10000 | register, edit | 🔒 · Appearance (leaves, flowers…) |
| `surrounding_environment` | text, max 10000 | register, edit | 🔒 · Habitat |
| `conservation_status` | text, max 100 | edit | e.g. "Endangered" |
| `ecological_role` | text, max 10000 | edit | |
| `medicinal_use` | text, max 10000 | edit | |
| `cultural_significance` | text, max 10000 | edit | |
| `publication_status` | `Under Research` / `Published` | publish | Default `Under Research` |
| `location_visibility` | `Public` / `Approximate` / `Hidden` | publish | Must be chosen when publishing |
| `general_location` | text, max 150 | publish | 🔒 · Area name shown for `Approximate`, e.g. "Niah National Park" |
| `registered_by` | user id | auto | List responses also include `registered_by_name` |
| `created_at`, `updated_at` | date (ISO string) | auto | |

🔒 = left out for an External Botanist who isn't assigned to the plant (`full_detail: false`).

Park Visitors (public endpoints) see the names, classification, size, `morphological_notes`,
`conservation_status`, `ecological_role`, `medicinal_use` and `cultural_significance`, plus:
`Public` → `latitude`, `longitude`, `surrounding_environment`, `general_location` ·
`Approximate` → `general_location` only · `Hidden` → no location. The public catalog list shows only names,
classification, `conservation_status` and `general_location`.

**`users`**

| Field | Type / limits | Notes |
|---|---|---|
| `user_id` | number | |
| `full_name` | text, max 100 | |
| `email` | text, max 150 | Unique, not case-sensitive (`Ali@x.com` = `ali@x.com`) |
| `password` | text | Only sent when creating an account. Stored encrypted and never returned |
| `role_name` | `Botanist` / `Conservation Officer` / `Admin` | |
| `botanist_type` | `Internal` / `External` / `null` | Only for Botanists |
| `is_active` | `true` / `false` | `false` = deactivated, can't log in |
| `created_at` | date | |

**`plant_photos`**

| Field | Notes |
|---|---|
| `photo_id` | |
| `plant_id` | Deleted together with the plant |
| `photo_url` | Full public link to the image in Supabase Storage |
| `uploaded_by` | user id |
| `uploaded_at` | date |

**`record_change_requests`**

| Field | Notes |
|---|---|
| `request_id` | |
| `plant_id` | Becomes `null` if the plant is deleted |
| `plant_qr_code_snapshot`, `plant_scientific_name_snapshot` | Copy of the plant's QR code and name when the request was sent, so you can still tell which plant it was after a deletion |
| `request_type` | `EDIT` / `DELETE` |
| `proposed_changes` | For `EDIT`: the new values, e.g. `{ "height_cm": 150 }` (only editable fields). `null` for `DELETE` |
| `requested_by`, `requested_at` | Who sent it and when (lists add `requested_by_name`) |
| `status` | `Pending` / `Approved` / `Rejected` |
| `reviewed_by`, `reviewed_at`, `review_comment` | Filled in when an Officer reviews it (`/mine` adds `reviewed_by_name`) |

**`botanist_assignments`**

| Field | Notes |
|---|---|
| `assignment_id` | |
| `botanist_id` | The External Botanist |
| `plant_id` | Each botanist/plant pair only once |
| `assigned_by`, `assigned_at` | Who assigned it and when |

**`audit_logs`** (shown through `GET /api/plants/:id/history`)

| Field | Notes |
|---|---|
| `log_id` | |
| `user_id` | Who did it (history adds `user_name` and `role_name`) |
| `action` | `CREATE_PLANT`, `UPDATE_PLANT`, `UPLOAD_PHOTO`, `UPDATE_VISIBILITY`, `REQUEST_EDIT`, `REQUEST_DELETE`, `APPROVED_REQUEST`, `REJECTED_REQUEST`, `CREATE_USER`, `UPDATE_USER`, `LOGIN` |
| `target_table`, `target_id` | What it was done to, e.g. `plants` / `12` |
| `details` | Extra info as JSON, e.g. the old → new values of an edit |
| `created_at` | date |
| `summary` | Added by the history endpoint: a ready-to-show sentence |

**`roles`**: `role_id`, `role_name`.

**Security**
- Row Level Security is switched on for every table with no rules, so nobody can read the
  tables directly with a Supabase key. Only the backend can.
- Please **don't create, change or delete tables in the Supabase dashboard**. If the database
  needs a change, tell the backend team so the schema file stays in sync.

---

## 3. Who can do what

| | Park Visitor (no login) | External Botanist | Internal Botanist | Conservation Officer | Admin |
|---|---|---|---|---|---|
| Scan QR of a **published** plant | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register a new plant | ❌ | ✅ ¹ | ✅ | ✅ | ✅ |
| See full details (incl. GPS) | ❌ | assigned plants only | ✅ | ✅ | ✅ |
| Upload photos | ❌ | assigned plants only | ✅ | ✅ | ✅ |
| Edit a plant | ❌ | send a request | ✅ directly | ✅ directly | ✅ directly |
| Delete a plant | ❌ | send a request | send a request | approve requests | approve requests |
| See own requests and the Officer's reply | ❌ | ✅ | ✅ | ❌ | ❌ |
| Approve / reject requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Publish a plant to visitors | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create / deactivate accounts | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ An External Botanist is automatically assigned to plants they register.

There is **no public sign-up**: only an Admin can create accounts.

---

## 4. The life of a plant record

1. **Registered** — a Botanist records it in the field (name, size, GPS, photos).
   The system creates a QR code (e.g. `SFC-2E524325`) to put next to the plant.
   Status: **Under Research** — visitors can't see it.
2. **Corrected** — Internal Botanists and Officers edit directly. External Botanists send an
   **edit request**; any Botanist who wants a plant deleted sends a **delete request**.
3. **Reviewed** — an Officer approves or rejects each request, with an optional comment.
   - Approved → the change (or deletion) is applied automatically.
   - Rejected → nothing changes. The Botanist sees the status and comment in their request
     list and can send a new request.
   - If two Officers review the same request at the same time, only the first one counts.
4. **Published** — an Officer publishes it and must choose how much location to show
   (`Public`, `Approximate` or `Hidden`).
5. **Scanned by visitors** — they see the plant info, with location shown as chosen above.

Every step is recorded in the plant's **history**, e.g.
*"Test Botanist edited this plant (Height: 50cm → 150cm)"*.

---

## 5. Running the backend

You need **Node.js**. The database, photo bucket and Admin account are already set up.

1. Clone the repo, switch to the `backend&Database` branch and open a terminal in `backend`.
2. Install packages:
   ```
   npm install
   ```
3. Ask a teammate for the team's **`.env` file** and put it in the `backend` folder (next to
   `.env.example`). It contains the database password and secret key, so keep it private:
   never commit it, post it in a group chat, or put it in the web/mobile app.
4. Check the connection (read-only, every line should say `OK`):
   ```
   npm run check-supabase
   ```
5. Start the server:
   ```
   npm run dev
   ```
   When you see `Server running on http://localhost:5000`, it's working. Keep this terminal
   open — closing it stops the server. Next time, just run `npm run dev`.

**Login details:** ask a teammate for the test accounts.

**Testing with Postman (optional):** import `postman/Biodiversity-Sprint1.postman_collection.json`,
set `adminEmail` / `adminPassword` in the collection's **Variables** tab, pick
`postman/sample-leaf.png` in *Upload plant photo* → **Body**, then **Run** the collection.
All 60 checks should pass. Each run adds test users (`...@test.com`) and plants to the
**shared** database, so only run it when needed.

---

## 6. Connecting the web / mobile app

### Where to send requests
- Web app: `http://localhost:5000`
- Mobile app: `localhost` won't work on a phone. Use the local IP of the computer running
  the backend, e.g. `http://192.168.1.20:5000` (both on the same Wi-Fi).
- Don't use supabase-js or any Supabase key in the apps — everything goes through here.

### Logging in
1. `POST /api/auth/login` with `{ "email": "...", "password": "..." }`
2. It returns:
   ```json
   {
     "token": "eyJhbGci...",
     "user": { "user_id": 1, "full_name": "System Admin", "email": "admin@...", "role_name": "Admin", "botanist_type": null }
   }
   ```
3. Save the `token` and send it with **every** other request:
   ```
   Authorization: Bearer <token>
   ```
4. Use `role_name` (and `botanist_type` for Botanists) to decide which screens and buttons
   to show. The backend checks permissions anyway — hiding a button is only for a nicer UI.
5. The token lasts 7 days. Logging out = deleting the saved token.
6. If any request returns **401**, the token expired or the account was deactivated: clear
   the token and show the login screen.

### What responses look like
- Errors are always `{ "error": "message" }` — the message can be shown to the user.
- Status codes: `400` invalid input · `401` not logged in · `403` not allowed ·
  `404` not found · `409` conflict (e.g. already reviewed) · `429` too many failed logins.
- ⚠️ Decimal values come back as **strings**: `"height_cm": "50.00"`,
  `"latitude": "3.8167000"`. Use `Number(...)` before maths or maps.
- Dates are ISO strings, e.g. `"2026-10-12T06:46:37.088Z"`.

### Which endpoint each screen uses

| Screen | Request |
|---|---|
| Login | `POST /api/auth/login` |
| Species catalog (public, no login) | `GET /api/public/plants?search=` → open one with `GET /api/public/plants/qr/:qr_code` |
| Plant list / dashboard (staff) | `GET /api/plants?search=&publication_status=` |
| My records (plants I registered) | `GET /api/plants?mine=true` |
| Register a plant | `POST /api/plants` → show the returned `qr_code` and `qr_code_image` |
| Scan QR (staff) | `GET /api/plants/qr/:qr_code` |
| Scan QR (Park Visitor, no login) | `GET /api/public/plants/qr/:qr_code` |
| Plant details | `GET /api/plants/:id` (includes `photos`) |
| Edit plant (Internal Botanist / Officer / Admin) | `PATCH /api/plants/:id` |
| Add photo | `POST /api/plants/:id/photos` |
| Plant history | `GET /api/plants/:id/history` |
| Send edit/delete request (Botanist) | `POST /api/requests` |
| My requests (Botanist) | `GET /api/requests/mine` |
| Requests to review (Officer / Admin) | `GET /api/requests?status=Pending` |
| Approve / reject | `PATCH /api/requests/:id/review` |
| Publish / location visibility (Officer / Admin) | `PATCH /api/plants/:id/visibility` |
| Manage accounts (Admin) | `GET /api/users`, `POST /api/auth/register`, `PATCH /api/users/:id` |

### Things the UI needs to handle
- **QR codes** — the QR just contains the `qr_code` text (e.g. `SFC-2E524325`).
  `qr_code_image` is a ready-made PNG you can put straight into `<img src="...">`.
- **Restricted details** — if `GET /api/plants/:id` returns `"full_detail": false`, the user
  is an External Botanist not assigned to this plant. GPS, size and notes are left out, so
  show them as restricted rather than empty.
- **Visitor view** — the public scan returns 404 for unpublished plants ("not available
  yet"). Location fields only appear if the Officer allowed them.
- **Photo upload** — send `multipart/form-data` with the file in a field named `photo`
  (jpg/png/webp, max 5MB). Don't set the `Content-Type` header yourself. The response has
  the full `photo_url` to display.
- **Editing as an External Botanist** — `PATCH /api/plants/:id` returns 403; send an
  `EDIT` request instead and show it in *My requests*.
- **History** — each item has a ready-to-show `summary` sentence.
- **Lists** — list endpoints return `{ plants, total, page, limit }`. Use `?page=2` for the next
  page (`limit` is 20 by default, max 100). Lists only have summary fields (names, status,
  `cover_photo_url`); open a plant for its full details. The public catalog never includes
  GPS or photos.

---

## 7. API reference

All routes except login and the public scan need `Authorization: Bearer <token>`.

### Accounts
| Method | URL | Who | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | Log in, get a token |
| POST | `/api/auth/register` | Admin | Create an account |
| GET | `/api/users` | Admin | List all accounts |
| PATCH | `/api/users/:id` | Admin | Deactivate / reactivate / change role |

### Plants
| Method | URL | Who | What it does |
|---|---|---|---|
| GET | `/api/plants?search=&publication_status=&mine=true&page=&limit=` | logged in | Plant list (all filters optional). `full_detail` says if opening the plant shows everything |
| POST | `/api/plants` | logged in | Register a plant, returns its QR code |
| GET | `/api/plants/qr/:qr_code` | logged in | Find a plant by scanning its QR |
| GET | `/api/plants/:id` | logged in | View a plant |
| PATCH | `/api/plants/:id` | Internal Botanist, Officer, Admin | Edit directly |
| POST | `/api/plants/:id/photos` | logged in | Upload a photo (form field `photo`, image, max 5MB) |
| GET | `/api/plants/:id/history` | logged in | See every change made to the plant |
| PATCH | `/api/plants/:id/visibility` | Officer, Admin | Publish / set location visibility |

### Edit & delete requests
| Method | URL | Who | What it does |
|---|---|---|---|
| POST | `/api/requests` | Botanist | Request an edit or a delete |
| GET | `/api/requests/mine?status=Rejected` | Botanist | Your own requests: status, reviewer and `review_comment` (`status` filter optional) |
| GET | `/api/requests?status=Pending` | Officer, Admin | See waiting requests |
| PATCH | `/api/requests/:id/review` | Officer, Admin | Approve or reject (applied automatically if approved) |

### Public (no login)
| Method | URL | What it does |
|---|---|---|
| GET | `/api/public/plants?search=&page=&limit=` | Species catalog: published plants only, area name but no GPS or photos |
| GET | `/api/public/plants/qr/:qr_code` | What a Park Visitor sees after scanning |

### Example list response

`GET /api/plants?search=pitcher`:
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
Search matches scientific name, common name and family (not case-sensitive).

### Example request bodies

Create an account (Admin) — `botanist_type` only for Botanists:
```json
{ "full_name": "Ali Botanist", "email": "ali@example.com", "password": "...", "role_name": "Botanist", "botanist_type": "External" }
```

Register a plant — only `scientific_name` is required:
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
Rules: `height_cm`/`width_cm` 0–9999.99 · `latitude` −90 to 90 · `longitude` −180 to 180 ·
latitude and longitude must be sent together.

Edit request (External Botanist):
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
Publish a plant (`location_visibility` is required when publishing):
```json
{ "publication_status": "Published", "location_visibility": "Approximate", "general_location": "Niah National Park" }
```

---

## 8. Where things are in the code

| Folder / file | What it's for |
|---|---|
| `server.js` | Starts the server and sends each request to the right route |
| `routes/` | The list of URLs and who may call them |
| `middleware/` | Checks done before a request is handled: logged in? right role? valid photo? |
| `controllers/` | What actually happens for each request |
| `utils/validatePlant.js` | Rules for valid plant data |
| `utils/plantChanges.js` | Applies edits and records old → new values |
| `utils/auditLog.js` | Writes the history / audit records |
| `utils/qrcode.js` | Makes QR codes |
| `utils/listQuery.js` | Paging and search for list endpoints |
| `config/db.js` | Supabase database connection (settings come from `.env`) |
| `config/supabase.js` | Supabase client, used to store photos in Supabase Storage |
| `scripts/checkSupabase.js` | `npm run check-supabase` |
| `postman/` | The Postman test collection |

---

## 9. Common problems

| Problem | Fix |
|---|---|
| `ECONNREFUSED` / "Could not get response" | The server isn't running — run `npm run dev` |
| `Missing in .env: ... - refusing to start` | The `.env` file is missing from the `backend` folder |
| `password authentication failed` | The database password changed — ask for the latest `.env` |
| `ENOTFOUND` / `ENETUNREACH` / `ETIMEDOUT` | Check your internet, or the Supabase project may be paused — tell the teammate who manages it. Some school/office Wi-Fi blocks the database port; try a phone hotspot |
| Phone app can't reach the backend | Use the computer's local IP (not `localhost`), same Wi-Fi on both, and allow Node.js through the Windows firewall |
| Photo upload returns 502 | Your `.env` may be outdated — ask for the latest one, then run `npm run check-supabase` |
| "Invalid email or password" | Check the login with a teammate. Accounts made in Supabase Authentication don't work here |
| "Too many login attempts" | 10 wrong passwords in 15 minutes — wait, or restart the server |

---

## 10. Not built yet

- Officer deletes a plant directly, Admin views the audit log, password reset
- Sprint 2+: researcher access requests, reports, IoT sensors, offline sync

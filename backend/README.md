# Biodiversity System — Backend

The backend (Node.js + Express + MySQL) shared by the mobile app and the web app.
The apps send requests here; the backend checks who you are, checks what you're
allowed to do, then reads/writes the MySQL database.

---

## 1. Get it running (first time)

You need: **Node.js**, **XAMPP** (for MySQL + phpMyAdmin) and **Postman** (for testing).

**Step 1 — Start MySQL**
Open the XAMPP Control Panel and click **Start** next to **Apache** and **MySQL**.

**Step 2 — Create the database**
Go to http://localhost/phpmyadmin → **Import** → choose `sprint1_database_schema.sql`
(in the folder above `backend`) → **Go**. You should see `biodiversity_system` with 7 tables.

**Step 3 — Install packages**
In a terminal inside the `backend` folder:
```
npm install
```
(Warnings about "vulnerabilities" are expected and don't stop anything working.)

**Step 4 — Create your `.env` file**
Copy `.env.example` and rename the copy to `.env`. With XAMPP's default settings
you only need to change one line — set `JWT_SECRET` to any long random text:
```
JWT_SECRET=put-any-long-random-text-here-at-least-32-characters
```
(`DB_USER=root` and an empty `DB_PASSWORD=` already match XAMPP.)

**Step 5 — Create the first Admin account**
Only an Admin can create accounts, so the first Admin is added by hand.

a) Make a password hash (replace `Admin123` with the password you want):
```
node -e "require('bcrypt').hash('Admin123',10).then(console.log)"
```
b) In phpMyAdmin, click `biodiversity_system` → **SQL** tab, paste this
(put your hash in), and click **Go**:
```sql
INSERT INTO users (full_name, email, password_hash, role_id)
VALUES ('System Admin', 'admin@example.com', 'PASTE-HASH-HERE',
        (SELECT role_id FROM roles WHERE role_name = 'Admin'));
```

**Step 6 — Start the server**
```
npm run dev
```
When you see `Server running on http://localhost:5000`, it's working.
Keep this terminal open — closing it stops the server.

> **Every time after the first:** start MySQL in XAMPP, then `npm run dev`.

---

## 2. Test it with Postman

A ready-made test collection is in `postman/` — 33 requests with 44 automatic checks.

1. Postman → **Import** → choose `postman/Biodiversity-Sprint1.postman_collection.json`.
2. Open **Upload plant photo** (inside *2. Plants*) → **Body** tab → in the `photo` row,
   choose the file `postman/sample-leaf.png` → **Ctrl + S**.
3. If your Admin isn't `admin@example.com` / `Admin123`: click the collection →
   **Variables** tab → change `adminEmail` / `adminPassword` → **Ctrl + S**.
4. Click the collection → **Run** → **Run Biodiversity System - Sprint 1**.

All 44 checks should pass. Each run creates new test users and plants, so you can
run it as many times as you like.

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
| Approve / reject requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Publish a plant to visitors | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create / deactivate accounts | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ An External Botanist is automatically assigned to plants they register.

---

## 4. The life of a plant record

1. **Registered** — a Botanist records it in the field (name, size, GPS, photos).
   The system creates a QR code (e.g. `SFC-2E524325`) to put next to the plant.
   Status: **Under Research** — visitors can't see it.
2. **Corrected** — Internal Botanists and Officers edit directly. External Botanists
   send an edit request that an Officer approves or rejects.
3. **Published** — an Officer publishes it and must choose how much location to show:
   - `Public` — exact GPS
   - `Approximate` — area name only, e.g. "Niah National Park"
   - `Hidden` — no location at all
4. **Scanned by visitors** — they see the plant info, with location shown as chosen above.

Every step is recorded in the plant's **history**, e.g.
*"Test Botanist edited this plant (Height: 50cm → 150cm)"*.

---

## 5. API quick reference

**Logging in:** `POST /api/auth/login` with `{ "email": "...", "password": "..." }` returns a
`token`. Send it with every other request as a header:
```
Authorization: Bearer <token>
```
Errors always come back as `{ "error": "message" }`.

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
| GET | `/api/requests?status=Pending` | Officer, Admin | See waiting requests |
| PATCH | `/api/requests/:id/review` | Officer, Admin | Approve or reject (applied automatically if approved) |

### Public (no login)
| Method | URL | What it does |
|---|---|---|
| GET | `/api/public/plants/qr/:qr_code` | What a Park Visitor sees after scanning |

### Example request bodies

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
Approve a request:
```json
{ "decision": "Approved", "review_comment": "Checked in the field" }
```
Publish a plant (`location_visibility` is required when publishing):
```json
{ "publication_status": "Published", "location_visibility": "Approximate", "general_location": "Niah National Park" }
```

---

## 6. Where things are in the code

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
| `config/db.js` | Database connection (settings come from `.env`) |
| `uploads/` | Uploaded photos are saved here |
| `postman/` | The Postman test collection |

---

## 7. Common problems

| Problem | Fix |
|---|---|
| `ECONNREFUSED` / Postman says "Could not get response" | The server isn't running — run `npm run dev` |
| Requests return "Server error…" and the terminal shows `ECONNREFUSED ...:3306` | MySQL isn't started — start it in XAMPP |
| Terminal shows `ER_BAD_DB_ERROR` or `ER_NO_SUCH_TABLE` | The database wasn't imported — redo Step 2 |
| `JWT_SECRET is not set - refusing to start` | You haven't created `.env` (Step 4) |
| Login says "Invalid email or password" for the Admin | Check Step 5 — the hash must be made from the same password you type |
| "Too many login attempts" | 10 wrong passwords in 15 minutes — wait, or restart the server |
| Photo upload fails in Postman | Choose the file again in the request's **Body** tab |

---

## 8. Not built yet

- Sprint 2: Officer deletes a plant directly, search & filter, Admin views audit log,
  password reset, researcher access requests, reports, IoT sensors, offline sync.

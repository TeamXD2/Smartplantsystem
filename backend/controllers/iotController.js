const crypto = require('crypto');
const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { parsePaging } = require('../utils/listQuery');

// IoT-Enabled Plant Protection (Sprint 2, proposal items 12-14).
// Tables: iot_sensors, sensor_readings, sensor_alerts (backend/sql/schema.sql).

// Alert thresholds - change them in backend/.env without touching code.
const TEMP_MAX = Number(process.env.IOT_TEMP_MAX || 35);           // degC
const HUMIDITY_MIN = Number(process.env.IOT_HUMIDITY_MIN || 40);   // %
const SOIL_MIN = Number(process.env.IOT_SOIL_MIN || 20);           // % soil moisture
// The same kind of alert is not repeated for a sensor within this window,
// so a person standing in front of the PIR creates one alert, not hundreds.
const ALERT_COOLDOWN = {
  MOTION: '1 minute',
  TEMPERATURE: '10 minutes',
  HUMIDITY: '10 minutes',
  SOIL: '10 minutes'
};
const DEVICE_CODE = /^[A-Za-z0-9_-]{1,50}$/;

// ---------- ESP32 side ----------

// The ESP32 proves it is ours with the X-Device-Key header (IOT_DEVICE_KEY in .env).
// A shared key is enough for a prototype; each board could get its own key later.
function requireDeviceKey(req, res, next) {
  const expected = process.env.IOT_DEVICE_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'IoT is not set up on this server (IOT_DEVICE_KEY missing in .env)' });
  }
  const given = String(req.get('X-Device-Key') || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid device key' });
  }
  next();
}

function readNumber(value, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return undefined; // undefined = invalid
  return Math.round(n * 100) / 100;
}

async function createAlertIfNew(client, sensorId, type, message, value) {
  const { rows } = await client.query(
    `SELECT 1 FROM sensor_alerts
     WHERE sensor_id = $1 AND alert_type = $2 AND created_at > NOW() - $3::interval
     LIMIT 1`,
    [sensorId, type, ALERT_COOLDOWN[type]]
  );
  if (rows.length > 0) return null;
  const { rows: [alert] } = await client.query(
    `INSERT INTO sensor_alerts (sensor_id, alert_type, message, value)
     VALUES ($1, $2, $3, $4) RETURNING alert_id, alert_type, message`,
    [sensorId, type, message, value]
  );
  return alert;
}

// POST /api/iot/readings  (ESP32, X-Device-Key)
// Body: { device_code: "SENSOR-01", temperature_c: 29.5, humidity_pct: 78,
//         soil_moisture_pct: 46, motion: true }   (every reading field is optional)
async function postReading(req, res) {
  const { device_code } = req.body || {};
  if (typeof device_code !== 'string' || !DEVICE_CODE.test(device_code)) {
    return res.status(400).json({ error: 'device_code is required (letters, numbers, - or _, max 50)' });
  }
  const temperature = readNumber(req.body.temperature_c, -40, 85);   // DHT11/22 range
  const humidity = readNumber(req.body.humidity_pct, 0, 100);
  const soil = readNumber(req.body.soil_moisture_pct, 0, 100);
  if (temperature === undefined || humidity === undefined || soil === undefined) {
    return res.status(400).json({ error: 'temperature_c must be -40 to 85, humidity_pct and soil_moisture_pct 0 to 100' });
  }
  const motion = req.body.motion === true || req.body.motion === 1 || req.body.motion === 'true';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // First reading from a new board registers it.
    const { rows: [sensor] } = await client.query(
      `INSERT INTO iot_sensors (device_code, name, last_seen_at)
       VALUES ($1, $1, NOW())
       ON CONFLICT (device_code) DO UPDATE SET last_seen_at = NOW()
       RETURNING sensor_id, name`,
      [device_code]
    );
    await client.query(
      `INSERT INTO sensor_readings (sensor_id, temperature_c, humidity_pct, soil_moisture_pct, motion)
       VALUES ($1, $2, $3, $4, $5)`,
      [sensor.sensor_id, temperature, humidity, soil, motion]
    );

    const alerts = [];
    const label = sensor.name || device_code;
    if (motion) {
      alerts.push(await createAlertIfNew(client, sensor.sensor_id, 'MOTION',
        `Movement detected near ${label} - possible intruder or poaching`, null));
    }
    if (temperature !== null && temperature > TEMP_MAX) {
      alerts.push(await createAlertIfNew(client, sensor.sensor_id, 'TEMPERATURE',
        `High temperature at ${label}: ${temperature} C (limit ${TEMP_MAX} C)`, temperature));
    }
    if (humidity !== null && humidity < HUMIDITY_MIN) {
      alerts.push(await createAlertIfNew(client, sensor.sensor_id, 'HUMIDITY',
        `Low humidity at ${label}: ${humidity}% (limit ${HUMIDITY_MIN}%)`, humidity));
    }
    if (soil !== null && soil < SOIL_MIN) {
      alerts.push(await createAlertIfNew(client, sensor.sensor_id, 'SOIL',
        `Low soil moisture at ${label}: ${soil}% (limit ${SOIL_MIN}%)`, soil));
    }
    await client.query('COMMIT');

    const created = alerts.filter(Boolean);
    // alert = true tells the ESP32 to sound its buzzer.
    res.status(201).json({ ok: true, sensor_id: sensor.sensor_id, alert: created.length > 0, alerts: created });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '42P01' || err.code === '42703') {
      return res.status(503).json({ error: 'IoT tables are out of date: run backend/sql/schema.sql in Supabase again' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error while saving the reading' });
  } finally {
    client.release();
  }
}

// ---------- Staff side (Conservation Officer, Admin) ----------

// GET /api/iot/sensors - every sensor with its latest reading and open alerts.
async function listSensors(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT s.sensor_id, s.device_code, s.name, s.plant_id, p.scientific_name AS plant_name,
              s.latitude, s.longitude, s.location_note, s.created_at, s.last_seen_at,
              r.temperature_c, r.humidity_pct, r.soil_moisture_pct, r.motion, r.recorded_at,
              (SELECT COUNT(*)::int FROM sensor_alerts a
                WHERE a.sensor_id = s.sensor_id AND a.acknowledged_at IS NULL) AS open_alerts
       FROM iot_sensors s
       LEFT JOIN plants p ON p.plant_id = s.plant_id
       LEFT JOIN LATERAL (
         SELECT temperature_c, humidity_pct, soil_moisture_pct, motion, recorded_at FROM sensor_readings
         WHERE sensor_id = s.sensor_id ORDER BY recorded_at DESC LIMIT 1
       ) r ON TRUE
       ORDER BY s.device_code`
    );
    res.json({ sensors: rows, thresholds: { temp_max: TEMP_MAX, humidity_min: HUMIDITY_MIN, soil_min: SOIL_MIN } });
  } catch (err) {
    if (err.code === '42P01' || err.code === '42703') {
      return res.status(503).json({ error: 'IoT tables are missing or out of date: run backend/sql/schema.sql in Supabase first' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching sensors' });
  }
}

// PATCH /api/iot/sensors/:id - name, GPS position and the plant it protects.
async function updateSensor(req, res) {
  try {
    const updates = {};
    const { name, location_note, plant_id } = req.body || {};
    if (name !== undefined) {
      if (name !== null && (typeof name !== 'string' || name.trim().length > 100)) {
        return res.status(400).json({ error: 'name must be text of at most 100 characters' });
      }
      updates.name = name ? name.trim() : null;
    }
    if (location_note !== undefined) {
      if (location_note !== null && (typeof location_note !== 'string' || location_note.length > 150)) {
        return res.status(400).json({ error: 'location_note must be text of at most 150 characters' });
      }
      updates.location_note = location_note || null;
    }
    for (const [key, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
      if (req.body[key] !== undefined) {
        const v = req.body[key] === null || req.body[key] === '' ? null : Number(req.body[key]);
        if (v !== null && (!Number.isFinite(v) || v < min || v > max)) {
          return res.status(400).json({ error: `${key} must be between ${min} and ${max}` });
        }
        updates[key] = v;
      }
    }
    if (plant_id !== undefined) {
      if (plant_id !== null && !(Number.isInteger(plant_id) && plant_id > 0)) {
        return res.status(400).json({ error: 'plant_id must be a plant id or null' });
      }
      updates.plant_id = plant_id;
    }
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const result = await pool.query(
      `UPDATE iot_sensors SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE sensor_id = $${fields.length + 1}`,
      [...fields.map((f) => updates[f]), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Sensor not found' });

    await logAction({ user_id: req.user.user_id, action: 'UPDATE_SENSOR', target_table: 'iot_sensors', target_id: req.params.id, details: updates });
    res.json({ message: 'Sensor updated' });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'That plant does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Server error while updating the sensor' });
  }
}

// GET /api/iot/readings?sensor_id=1&hours=24
// Readings for the chart plus simple analysis (min / max / average, movement count).
async function listReadings(req, res) {
  try {
    const sensorId = Number(req.query.sensor_id);
    const hours = req.query.hours === undefined ? 24 : Number(req.query.hours);
    if (!Number.isInteger(sensorId) || sensorId < 1) {
      return res.status(400).json({ error: 'sensor_id is required' });
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 31) {
      return res.status(400).json({ error: 'hours must be a whole number from 1 to 744' });
    }
    const since = `${hours} hours`;

    // Long periods are averaged into buckets so the chart stays light (max ~300 points).
    const bucketSeconds = Math.max(1, Math.ceil((hours * 3600) / 300));
    const { rows: readings } = await pool.query(
      `SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / $3) * $3) AS t,
              ROUND(AVG(temperature_c)::numeric, 2) AS temperature_c,
              ROUND(AVG(humidity_pct)::numeric, 2) AS humidity_pct,
              ROUND(AVG(soil_moisture_pct)::numeric, 2) AS soil_moisture_pct,
              BOOL_OR(motion) AS motion
       FROM sensor_readings
       WHERE sensor_id = $1 AND recorded_at > NOW() - $2::interval
       GROUP BY 1 ORDER BY 1`,
      [sensorId, since, bucketSeconds]
    );
    const { rows: [stats] } = await pool.query(
      `SELECT COUNT(*)::int AS readings,
              MIN(temperature_c) AS temp_min, MAX(temperature_c) AS temp_max,
              ROUND(AVG(temperature_c)::numeric, 1) AS temp_avg,
              MIN(humidity_pct) AS humidity_min, MAX(humidity_pct) AS humidity_max,
              ROUND(AVG(humidity_pct)::numeric, 1) AS humidity_avg,
              MIN(soil_moisture_pct) AS soil_min, MAX(soil_moisture_pct) AS soil_max,
              ROUND(AVG(soil_moisture_pct)::numeric, 1) AS soil_avg,
              COUNT(*) FILTER (WHERE motion)::int AS motion_count
       FROM sensor_readings
       WHERE sensor_id = $1 AND recorded_at > NOW() - $2::interval`,
      [sensorId, since]
    );
    res.json({ sensor_id: sensorId, hours, readings, stats });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'IoT tables are out of date: run backend/sql/schema.sql in Supabase again' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching readings' });
  }
}

// GET /api/iot/alerts?status=open|all&page=&limit=
async function listAlerts(req, res) {
  try {
    const paging = parsePaging(req.query);
    if (paging.error) return res.status(400).json({ error: paging.error });
    const status = req.query.status || 'open';
    if (!['open', 'all'].includes(status)) return res.status(400).json({ error: "status must be 'open' or 'all'" });

    const { rows } = await pool.query(
      `SELECT a.alert_id, a.sensor_id, s.device_code, s.name AS sensor_name, a.alert_type, a.message,
              a.value, a.created_at, a.acknowledged_at, u.full_name AS acknowledged_by_name,
              COUNT(*) OVER () AS total
       FROM sensor_alerts a
       JOIN iot_sensors s ON s.sensor_id = a.sensor_id
       LEFT JOIN users u ON u.user_id = a.acknowledged_by
       ${status === 'open' ? 'WHERE a.acknowledged_at IS NULL' : ''}
       ORDER BY a.created_at DESC, a.alert_id DESC
       LIMIT $1 OFFSET $2`,
      [paging.limit, paging.offset]
    );
    res.json({
      alerts: rows.map(({ total, ...a }) => a),
      total: rows.length ? Number(rows[0].total) : 0,
      page: paging.page,
      limit: paging.limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching alerts' });
  }
}

// PATCH /api/iot/alerts/:id/acknowledge - "I've seen it / someone is on the way".
async function acknowledgeAlert(req, res) {
  try {
    const result = await pool.query(
      `UPDATE sensor_alerts SET acknowledged_by = $1, acknowledged_at = NOW()
       WHERE alert_id = $2 AND acknowledged_at IS NULL`,
      [req.user.user_id, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    await logAction({ user_id: req.user.user_id, action: 'ACKNOWLEDGE_ALERT', target_table: 'sensor_alerts', target_id: req.params.id });
    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while acknowledging the alert' });
  }
}

module.exports = { requireDeviceKey, postReading, listSensors, updateSensor, listReadings, listAlerts, acknowledgeAlert };

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Droplets, MapPin, Radio, Thermometer, Footprints } from 'lucide-react';
import { fetchSensors, fetchReadings, fetchAlerts, acknowledgeAlert, updateSensor } from '../queries/iot';
import LineChart from './LineChart';

// Centralised IoT monitoring dashboard (proposal item 14) for Officers and Admins:
// live sensor cards, a chart with min/avg/max (habitat analysis), and the alert
// list to respond to. Refreshes itself every 10 seconds.
const REFRESH_MS = 10000;
const ONLINE_WITHIN_MS = 2 * 60 * 1000; // no reading for 2 minutes = offline
const PERIODS = [
  [1, 'Last hour'],
  [24, '24 hours'],
  [168, '7 days'],
  [720, '30 days'],
];

function ago(iso) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function num(v, digits = 1) {
  return v == null ? '—' : Number(v).toFixed(digits);
}

function SensorSettings({ sensor, onSaved }) {
  const [form, setForm] = useState({
    name: sensor.name || '',
    latitude: sensor.latitude ?? '',
    longitude: sensor.longitude ?? '',
    location_note: sensor.location_note || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) })),
      () => setError('Could not get your location.')
    );
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateSensor(sensor.sensor_id, {
        name: form.name.trim() || null,
        location_note: form.location_note.trim() || null,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      });
      setError('');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sensor-settings" onSubmit={save}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label>Sensor name</label>
        <input className="input" maxLength={100} placeholder="e.g. Pitcher plant plot A" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="field">
          <label>Latitude</label>
          <input className="input" type="number" step="any" min={-90} max={90} value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
        </div>
        <div className="field">
          <label>Longitude</label>
          <input className="input" type="number" step="any" min={-180} max={180} value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Location note</label>
        <input className="input" maxLength={150} placeholder="e.g. Great Cave trail, 200 m after the bridge" value={form.location_note} onChange={(e) => set('location_note', e.target.value)} />
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation}><MapPin size={15} /> Use my location</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving...' : 'Save sensor'}</button>
      </div>
    </form>
  );
}

export default function IotDashboard() {
  const [sensors, setSensors] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState(24);
  const [readings, setReadings] = useState({ readings: [], stats: null });
  const [alerts, setAlerts] = useState({ alerts: [], total: 0 });
  const [alertStatus, setAlertStatus] = useState('open');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([fetchSensors(), fetchAlerts({ status: alertStatus, limit: 20 })]);
      setSensors(s.sensors);
      setThresholds(s.thresholds);
      setAlerts(a);
      setSelected((current) => current ?? s.sensors[0]?.sensor_id ?? null);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [alertStatus]);

  const loadReadings = useCallback(async () => {
    if (!selected) return;
    try {
      setReadings(await fetchReadings(selected, hours));
    } catch (err) {
      setError(err.message);
    }
  }, [selected, hours]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    loadReadings();
    const timer = setInterval(loadReadings, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadReadings]);

  async function acknowledge(id) {
    try {
      await acknowledgeAlert(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const sensor = sensors.find((s) => s.sensor_id === selected);
  const openAlerts = sensors.reduce((n, s) => n + s.open_alerts, 0);
  const online = sensors.filter((s) => s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WITHIN_MS).length;
  const stats = readings.stats;

  return (
    <div className="iot">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary, like the profile stats in the mobile app */}
      <div className="stat-row">
        <div className="stat"><div className="stat-num">{sensors.length}</div><div className="stat-label">Sensors</div></div>
        <div className="stat"><div className="stat-num green">{online}</div><div className="stat-label">Online now</div></div>
        <div className="stat"><div className={`stat-num ${openAlerts ? 'orange' : ''}`}>{openAlerts}</div><div className="stat-label">Open alerts</div></div>
      </div>

      {sensors.length === 0 && !error && (
        <div className="panel empty-state">
          <Radio size={28} />
          <p>No sensors yet. A sensor appears here automatically the first time its ESP32 sends a reading.</p>
        </div>
      )}

      {/* One card per ESP32 */}
      <div className="sensor-grid">
        {sensors.map((s) => {
          const isOnline = s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WITHIN_MS;
          return (
            <button key={s.sensor_id} type="button" className={`sensor-card ${s.sensor_id === selected ? 'selected' : ''}`}
              onClick={() => { setSelected(s.sensor_id); setEditing(false); }}>
              <div className="sensor-head">
                <div>
                  <div className="sensor-name">{s.name || s.device_code}</div>
                  <div className="muted sensor-code">{s.device_code}{s.location_note ? ` · ${s.location_note}` : ''}</div>
                </div>
                <span className={`tag ${isOnline ? 'tag-approved' : 'tag-offline'}`}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className="sensor-values">
                <span><Thermometer size={16} /> {num(s.temperature_c)}°C</span>
                <span><Droplets size={16} /> {num(s.humidity_pct, 0)}%</span>
                <span className={s.motion ? 'motion-on' : ''}><Footprints size={16} /> {s.motion ? 'Movement' : 'Still'}</span>
              </div>
              <div className="sensor-foot muted">
                Last reading {ago(s.recorded_at)}
                {s.open_alerts > 0 && <span className="tag tag-pending">{s.open_alerts} alert{s.open_alerts > 1 ? 's' : ''}</span>}
                {s.latitude == null && <span className="tag tag-offline">No GPS set</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart + analysis for the selected sensor */}
      {sensor && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>{sensor.name || sensor.device_code}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {sensor.latitude != null ? `GPS ${num(sensor.latitude, 5)}, ${num(sensor.longitude, 5)}` : 'GPS position not set yet'}
              </p>
            </div>
            <div className="row-actions">
              <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 150 }}>
                {PERIODS.map(([h, label]) => <option key={h} value={h}>{label}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Close settings' : 'Sensor settings'}
              </button>
            </div>
          </div>

          {editing && <SensorSettings key={sensor.sensor_id} sensor={sensor} onSaved={() => { setEditing(false); load(); }} />}

          {stats && (
            <div className="analysis">
              <div><span className="muted">Temperature</span><strong>{num(stats.temp_avg)}°C</strong><span className="muted">min {num(stats.temp_min)} · max {num(stats.temp_max)}</span></div>
              <div><span className="muted">Humidity</span><strong>{num(stats.humidity_avg, 0)}%</strong><span className="muted">min {num(stats.humidity_min, 0)} · max {num(stats.humidity_max, 0)}</span></div>
              <div><span className="muted">Movement</span><strong>{stats.motion_count}</strong><span className="muted">detections</span></div>
              <div><span className="muted">Readings</span><strong>{stats.readings}</strong><span className="muted">in this period</span></div>
            </div>
          )}

          <LineChart
            hours={hours}
            data={readings.readings}
            series={[
              { key: 'temperature_c', label: 'Temperature', unit: '°C', color: '#C97B3D' },
              { key: 'humidity_pct', label: 'Humidity', unit: '%', color: '#1F4D3A', min: 0, max: 100 },
            ]}
          />
          {thresholds && (
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Alerts are raised for movement, temperature above {thresholds.temp_max}°C or humidity below {thresholds.humidity_min}%.
            </p>
          )}
        </div>
      )}

      {/* Alerts */}
      <div className="panel">
        <div className="panel-head">
          <h3><AlertTriangle size={18} /> Alerts</h3>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab ${alertStatus === 'open' ? 'active' : ''}`} onClick={() => setAlertStatus('open')}>Open</button>
            <button className={`tab ${alertStatus === 'all' ? 'active' : ''}`} onClick={() => setAlertStatus('all')}>All</button>
          </div>
        </div>
        {alerts.alerts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{alertStatus === 'open' ? 'No open alerts. All quiet in the park.' : 'No alerts yet.'}</p>
        ) : (
          <ul className="alert-list">
            {alerts.alerts.map((a) => (
              <li key={a.alert_id} className={a.acknowledged_at ? 'done' : ''}>
                <span className={`alert-type ${a.alert_type.toLowerCase()}`}>
                  {a.alert_type === 'MOTION' ? <Footprints size={16} /> : a.alert_type === 'TEMPERATURE' ? <Thermometer size={16} /> : <Droplets size={16} />}
                </span>
                <div className="alert-body">
                  <div>{a.message}</div>
                  <div className="muted">
                    {a.sensor_name || a.device_code} · {new Date(a.created_at).toLocaleString()}
                    {a.acknowledged_at && ` · seen by ${a.acknowledged_by_name || 'staff'}`}
                  </div>
                </div>
                {!a.acknowledged_at && (
                  <button className="btn btn-outline btn-sm" onClick={() => acknowledge(a.alert_id)}><Check size={15} /> Acknowledge</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

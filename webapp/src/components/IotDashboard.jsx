import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCheck, Droplets, MapPin, Radio, Thermometer, Footprints, RefreshCw, Sprout } from 'lucide-react';
import { fetchSensors, fetchReadings, fetchAlerts, acknowledgeAlert, updateSensor } from '../queries/iot';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNotifications } from '../context/NotificationsContext';
import { useUnsavedChanges } from '../useUnsavedChanges';
import { runBulk, plural } from '../utils/bulk';
import { relativeTime, exactTime } from '../hooks';
import LineChart from './LineChart';
import Field from './ui/Field';
import EmptyState from './ui/EmptyState';
import { RowCheck } from './table/TableParts';
import { Skeleton, SkeletonStats, SkeletonBlock } from './ui/Skeleton';

// Centralised IoT monitoring dashboard (proposal item 14) for Officers and Admins:
// live sensor cards, a chart with min/avg/max (habitat analysis), and the alert
// list to respond to. Refreshes itself every 10 seconds while the tab is visible.
const REFRESH_MS = 10000;
const ONLINE_WITHIN_MS = 2 * 60 * 1000; // no reading for 2 minutes = offline
const PERIODS = [
  [1, 'Last hour'],
  [24, '24 hours'],
  [168, '7 days'],
  [720, '30 days'],
];

function num(v, digits = 1) {
  return v == null ? '—' : Number(v).toFixed(digits);
}

function SensorSettings({ sensor, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: sensor.name || '',
    latitude: sensor.latitude ?? '',
    longitude: sensor.longitude ?? '',
    location_note: sensor.location_note || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = form.name !== (sensor.name || '') || String(form.latitude) !== String(sensor.latitude ?? '') || String(form.longitude) !== String(sensor.longitude ?? '') || form.location_note !== (sensor.location_note || '');
  useUnsavedChanges(dirty && !busy);

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) })),
      () => setError('Could not get your location. Allow location access, or type the coordinates.')
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
      toast.success('Sensor saved.');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sensor-settings" onSubmit={save}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <Field label="Sensor name">
        <input className="input" maxLength={100} placeholder="e.g. Pitcher plant plot A" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Latitude"><input className="input" type="number" step="any" min={-90} max={90} value={form.latitude} onChange={(e) => set('latitude', e.target.value)} /></Field>
        <Field label="Longitude"><input className="input" type="number" step="any" min={-180} max={180} value={form.longitude} onChange={(e) => set('longitude', e.target.value)} /></Field>
      </div>
      <Field label="Location note">
        <input className="input" maxLength={150} placeholder="e.g. Great Cave trail, 200 m after the bridge" value={form.location_note} onChange={(e) => set('location_note', e.target.value)} />
      </Field>
      <div className="row-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation}><MapPin size={15} aria-hidden="true" /> Use my location</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save sensor'}</button>
      </div>
    </form>
  );
}

export default function IotDashboard() {
  const toast = useToast();
  const confirm = useConfirm();
  const notifications = useNotifications();
  const [sensors, setSensors] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState(24);
  const [readings, setReadings] = useState({ readings: [], stats: null });
  const [alerts, setAlerts] = useState({ alerts: [], total: 0 });
  const [alertStatus, setAlertStatus] = useState('open');
  const [ticked, setTicked] = useState(() => new Set());
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [acking, setAcking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([fetchSensors(), fetchAlerts({ status: alertStatus, limit: 20 })]);
      setSensors(s.sensors);
      setThresholds(s.thresholds);
      setAlerts(a);
      setSelected((current) => current ?? s.sensors[0]?.sensor_id ?? null);
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
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

  // Poll while the tab is visible; catch up as soon as you come back to it.
  useEffect(() => {
    load();
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  useEffect(() => {
    loadReadings();
    const tick = () => { if (document.visibilityState === 'visible') loadReadings(); };
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadReadings]);

  // Forget ticks for alerts that are gone (acknowledged elsewhere).
  useEffect(() => {
    setTicked((current) => {
      const ids = new Set(alerts.alerts.map((a) => a.alert_id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [alerts]);

  async function acknowledge(id) {
    try {
      await acknowledgeAlert(id);
      toast.success('Alert acknowledged.');
      load();
      notifications.refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function acknowledgeMany(list, askFirst) {
    if (askFirst) {
      const ok = await confirm({
        title: `Acknowledge ${plural(list.length, 'alert')}?`,
        message: 'This tells the team that someone has seen them. It is written to the audit log.',
        confirmLabel: `Acknowledge ${list.length}`,
      });
      if (!ok) return;
    }
    setAcking(true);
    const { done, failed } = await runBulk(list, (a) => acknowledgeAlert(a.alert_id));
    setAcking(false);
    setTicked(new Set());
    await load();
    notifications.refresh();
    if (failed.length === 0) toast.success(`Acknowledged ${plural(done.length, 'alert')}.`);
    else toast.error(`Acknowledged ${done.length} of ${list.length} alerts.`, { detail: `${failed.length} failed: ${failed[0].message}` });
  }

  const sensor = sensors.find((s) => s.sensor_id === selected);
  const openAlerts = sensors.reduce((n, s) => n + s.open_alerts, 0);
  const online = sensors.filter((s) => s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WITHIN_MS).length;
  const stats = readings.stats;
  const openList = alerts.alerts.filter((a) => !a.acknowledged_at);
  const tickedList = openList.filter((a) => ticked.has(a.alert_id));

  function toggleTick(id) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!loaded) {
    return (
      <div className="iot" aria-busy="true">
        <SkeletonStats count={3} />
        <div className="sensor-grid">{[0, 1, 2].map((i) => <SkeletonBlock key={i} height={90} />)}</div>
        <SkeletonBlock height={260} />
      </div>
    );
  }

  return (
    <div className="iot">
      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}

      <div className="stat-row">
        <div className="stat"><div className="stat-num">{sensors.length}</div><div className="stat-label">Sensors</div></div>
        <div className="stat"><div className="stat-num green">{online}</div><div className="stat-label">Online now</div></div>
        <div className="stat"><div className={`stat-num ${openAlerts ? 'orange' : ''}`}>{openAlerts}</div><div className="stat-label">Open alerts</div></div>
      </div>
      {updatedAt && <p className="live-note" role="status">Live · updated {relativeTime(updatedAt.toISOString())}. Refreshes every 10 seconds while this tab is open.</p>}

      {sensors.length === 0 && !error && (
        <div className="panel">
          <EmptyState icon={Radio} title="No sensors yet" compact>A sensor appears here automatically the first time its ESP32 sends a reading.</EmptyState>
        </div>
      )}

      <div className="sensor-grid">
        {sensors.map((s) => {
          const isOnline = s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WITHIN_MS;
          return (
            <button key={s.sensor_id} type="button" aria-pressed={s.sensor_id === selected} className={`sensor-card ${s.sensor_id === selected ? 'selected' : ''}`}
              onClick={() => { setSelected(s.sensor_id); setEditing(false); }}>
              <div className="sensor-head">
                <div>
                  <div className="sensor-name">{s.name || s.device_code}</div>
                  <div className="muted sensor-code">{s.device_code}{s.location_note ? ` · ${s.location_note}` : ''}</div>
                </div>
                <span className={`tag ${isOnline ? 'tag-approved' : 'tag-offline'}`}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className="sensor-values">
                <span><Thermometer size={16} aria-hidden="true" /> {num(s.temperature_c)}°C</span>
                <span><Droplets size={16} aria-hidden="true" /> {num(s.humidity_pct, 0)}%</span>
                {s.soil_moisture_pct != null && <span title="Soil moisture"><Sprout size={16} aria-hidden="true" /> {num(s.soil_moisture_pct, 0)}% soil</span>}
                <span className={s.motion ? 'motion-on' : ''}><Footprints size={16} aria-hidden="true" /> {s.motion ? 'Movement' : 'Still'}</span>
              </div>
              <div className="sensor-foot muted">
                Last reading {s.recorded_at ? relativeTime(s.recorded_at) : 'never'}
                {s.open_alerts > 0 && <span className="tag tag-pending">{s.open_alerts} alert{s.open_alerts > 1 ? 's' : ''}</span>}
                {s.latitude == null && <span className="tag tag-offline">No GPS set</span>}
              </div>
            </button>
          );
        })}
      </div>

      {sensor && (
        <section className="panel" aria-labelledby="sensor-title">
          <div className="panel-head">
            <div>
              <h2 id="sensor-title" className="panel-title">{sensor.name || sensor.device_code}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {sensor.latitude != null ? `GPS ${num(sensor.latitude, 5)}, ${num(sensor.longitude, 5)}` : 'GPS position not set yet'}
              </p>
            </div>
            <div className="row-actions">
              <select className="input" aria-label="Chart period" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {PERIODS.map(([h, label]) => <option key={h} value={h}>{label}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
                {editing ? 'Close settings' : 'Sensor settings'}
              </button>
            </div>
          </div>

          {editing && <SensorSettings key={sensor.sensor_id} sensor={sensor} onSaved={() => { setEditing(false); load(); }} />}

          {stats && (
            <div className="analysis">
              <div><span className="muted">Temperature</span><strong>{num(stats.temp_avg)}°C</strong><span className="muted">min {num(stats.temp_min)} · max {num(stats.temp_max)}</span></div>
              <div><span className="muted">Humidity</span><strong>{num(stats.humidity_avg, 0)}%</strong><span className="muted">min {num(stats.humidity_min, 0)} · max {num(stats.humidity_max, 0)}</span></div>
              {stats.soil_avg != null && <div><span className="muted">Soil moisture</span><strong>{num(stats.soil_avg, 0)}%</strong><span className="muted">min {num(stats.soil_min, 0)} · max {num(stats.soil_max, 0)}</span></div>}
              <div><span className="muted">Movement</span><strong>{stats.motion_count}</strong><span className="muted">detections</span></div>
              <div><span className="muted">Readings</span><strong>{stats.readings}</strong><span className="muted">in this period</span></div>
            </div>
          )}

          <LineChart
            hours={hours}
            data={readings.readings}
            series={[
              { key: 'temperature_c', label: 'Temperature', unit: '°C', color: '#A9622B' },
              { key: 'humidity_pct', label: 'Humidity', unit: '%', color: '#1F4D3A', min: 0, max: 100 },
              ...(stats && stats.soil_avg != null ? [{ key: 'soil_moisture_pct', label: 'Soil moisture', unit: '%', color: '#8A6A3B', min: 0, max: 100 }] : []),
            ]}
          />
          {thresholds && (
            <p className="muted small" style={{ marginTop: 8 }}>
              Alerts are raised for movement, temperature above {thresholds.temp_max}°C, humidity below {thresholds.humidity_min}%
              {thresholds.soil_min != null && ` or soil moisture below ${thresholds.soil_min}%`}.
            </p>
          )}
        </section>
      )}

      <section className="panel" aria-labelledby="alerts-title">
        <div className="panel-head">
          <h2 id="alerts-title" className="panel-title"><AlertTriangle size={18} aria-hidden="true" /> Alerts</h2>
          <div className="segmented" role="group" aria-label="Which alerts">
            <button type="button" aria-pressed={alertStatus === 'open'} onClick={() => setAlertStatus('open')}>Open</button>
            <button type="button" aria-pressed={alertStatus === 'all'} onClick={() => setAlertStatus('all')}>All</button>
          </div>
        </div>

        {openList.length > 0 && (
          <div className="alert-toolbar">
            <label className="check-row">
              <RowCheck checked={tickedList.length === openList.length} indeterminate={tickedList.length > 0} onChange={() => setTicked(tickedList.length === openList.length ? new Set() : new Set(openList.map((a) => a.alert_id)))} label="Select all open alerts" />
              {tickedList.length > 0 ? `${tickedList.length} selected` : 'Select all'}
            </label>
            {tickedList.length > 0
              ? <button type="button" className="btn btn-primary btn-sm" disabled={acking} onClick={() => acknowledgeMany(tickedList, false)}><Check size={15} aria-hidden="true" /> Acknowledge {tickedList.length}</button>
              : <button type="button" className="btn btn-outline btn-sm" disabled={acking} onClick={() => acknowledgeMany(openList, true)}><CheckCheck size={15} aria-hidden="true" /> Acknowledge all {openList.length}</button>}
          </div>
        )}

        {alerts.alerts.length === 0 ? (
          <EmptyState icon={Check} compact title={alertStatus === 'open' ? 'No open alerts' : 'No alerts yet'}>
            {alertStatus === 'open' ? 'All quiet in the park.' : 'Alerts appear here when a sensor detects movement or unusual readings.'}
          </EmptyState>
        ) : (
          <ul className="alert-list">
            {alerts.alerts.map((a) => (
              <li key={a.alert_id} className={a.acknowledged_at ? 'done' : ''}>
                {!a.acknowledged_at && <RowCheck checked={ticked.has(a.alert_id)} onChange={() => toggleTick(a.alert_id)} label={`Select alert: ${a.message}`} />}
                <span className={`alert-type ${a.alert_type.toLowerCase()}`}>
                  {a.alert_type === 'MOTION' ? <Footprints size={16} aria-hidden="true" /> : a.alert_type === 'TEMPERATURE' ? <Thermometer size={16} aria-hidden="true" /> : a.alert_type === 'SOIL' ? <Sprout size={16} aria-hidden="true" /> : <Droplets size={16} aria-hidden="true" />}
                </span>
                <div className="alert-body">
                  <div>{a.message}</div>
                  <div className="muted">
                    {a.sensor_name || a.device_code} · <time dateTime={a.created_at} title={exactTime(a.created_at)}>{relativeTime(a.created_at)}</time>
                    {a.acknowledged_at && ` · seen by ${a.acknowledged_by_name || 'staff'}`}
                  </div>
                </div>
                {!a.acknowledged_at && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => acknowledge(a.alert_id)}><Check size={15} aria-hidden="true" /> Acknowledge</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {alerts.total > alerts.alerts.length && <p className="muted small">Showing the latest {alerts.alerts.length} of {alerts.total}.</p>}
      </section>
    </div>
  );
}

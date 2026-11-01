import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ClipboardCheck, Database, Map, PlusCircle, ArrowRight, Footprints, Thermometer, Droplets, Sprout, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { ROLES } from '../roles';
import { fetchPlants } from '../queries/plants';
import { fetchRequests, fetchMyRequests } from '../queries/requests';
import { fetchSensors } from '../queries/iot';
import { relativeTime, useDocumentTitle } from '../hooks';
import StatusTag from '../components/StatusTag';
import SpecimenName from '../components/ui/SpecimenName';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { Skeleton, SkeletonStats } from '../components/ui/Skeleton';

// The "Dashboard" page: what needs you first, the numbers, and recent records.
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const ALERT_ICON = { MOTION: Footprints, TEMPERATURE: Thermometer, HUMIDITY: Droplets, SOIL: Sprout };

function Stat({ to, value, label, tone }) {
  return (
    <Link to={to} className="stat stat-link">
      <div className={`stat-num ${tone || ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </Link>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const n = useNotifications();
  const botanist = user.role_name === ROLES.BOTANIST;
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [iot, setIot] = useState(null);
  const [error, setError] = useState('');
  useDocumentTitle('Dashboard');

  useEffect(() => {
    const mine = botanist ? 'true' : undefined;
    const count = (publication_status) => fetchPlants({ mine, publication_status, limit: 1 }).then((d) => d.total);

    Promise.all([
      fetchPlants({ mine, limit: 5 }),
      count('Under Research'),
      count('Published'),
      botanist ? fetchMyRequests('Pending') : fetchRequests('Pending'),
    ])
      .then(([latest, research, published, pending]) => {
        setRecent(latest.plants);
        setStats({ total: latest.total, research, published, pending: pending.length });
      })
      .catch((err) => setError(err.message));

    if (!botanist) {
      fetchSensors()
        .then((d) => setIot({
          sensors: d.sensors.length,
          online: d.sensors.filter((s) => s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < 120000).length,
        }))
        .catch(() => setIot(null)); // IoT tables not set up yet
    }
  }, [botanist]);

  const first = (user.full_name || '').split(' ')[0];
  const attention = botanist ? n.decidedCount : n.alertTotal + n.pendingCount;

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${first}`}
        description={botanist ? 'Register new plants and follow up on your requests.' : 'Here is what needs attention in the park today.'}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="quick-actions">
        {botanist ? (
          <Link to="/register" className="big-action"><PlusCircle size={28} aria-hidden="true" /> Register a new plant</Link>
        ) : (
          <>
            <Link to="/requests" className="big-action"><ClipboardCheck size={28} aria-hidden="true" /> Review change requests</Link>
            <Link to="/records" className="outline-action"><Database size={20} aria-hidden="true" /> Species database</Link>
            <Link to="/map" className="outline-action"><Map size={20} aria-hidden="true" /> Distribution map</Link>
          </>
        )}
      </div>

      <section className="panel attention" aria-labelledby="attention-title">
        <div className="panel-head">
          <h2 id="attention-title" className="panel-title">Needs your attention</h2>
          {attention > 0 && <span className="tag tag-pending">{attention}</span>}
        </div>
        {n.loading ? (
          <div><Skeleton width="70%" height={14} /><Skeleton width="50%" height={14} style={{ marginTop: 12 }} /></div>
        ) : attention === 0 ? (
          <p className="muted attention-clear">
            <CheckCircle2 size={18} aria-hidden="true" /> {botanist ? 'No new decisions on your requests.' : 'All clear. No open alerts and no requests waiting.'}
          </p>
        ) : (
          <ul className="attention-list">
            {!botanist && n.alerts.slice(0, 3).map((a) => {
              const Icon = ALERT_ICON[a.alert_type] || Footprints;
              return (
                <li key={`a${a.alert_id}`}>
                  <Link to="/iot">
                    <span className={`alert-type ${a.alert_type.toLowerCase()}`}><Icon size={16} aria-hidden="true" /></span>
                    <span className="attention-text"><span>{a.message}</span><span className="muted">{a.sensor_name || a.device_code} · {relativeTime(a.created_at)}</span></span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            {!botanist && n.pending.slice(0, 3).map((r) => (
              <li key={`r${r.request_id}`}>
                <Link to="/requests">
                  <span className="alert-type request"><ClipboardCheck size={16} aria-hidden="true" /></span>
                  <span className="attention-text"><span>{r.request_type === 'DELETE' ? 'Delete' : 'Edit'} request: <em>{r.plant_scientific_name_snapshot}</em></span><span className="muted">{r.requested_by_name} · {relativeTime(r.requested_at)}</span></span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
            {botanist && n.decided.slice(0, 4).map((r) => (
              <li key={`d${r.request_id}`}>
                <Link to="/requests">
                  <span className={`alert-type ${r.status === 'Approved' ? 'humidity' : 'temperature'}`}>{r.status === 'Approved' ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}</span>
                  <span className="attention-text"><span>{r.status}: {r.request_type === 'DELETE' ? 'delete' : 'edit'} <em>{r.plant_scientific_name_snapshot}</em></span><span className="muted">{r.review_comment || relativeTime(r.reviewed_at)}</span></span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!n.loading && !botanist && attention > Math.min(3, n.alerts.length) + Math.min(3, n.pending.length) && (
          <p className="attention-more">
            {attention - Math.min(3, n.alerts.length) - Math.min(3, n.pending.length)} more: <Link to="/iot">all alerts</Link> · <Link to="/requests">all requests</Link>
          </p>
        )}
      </section>

      {stats ? (
        <div className="stat-row four">
          <Stat to="/records" value={stats.total} label={botanist ? 'My records' : 'Records'} />
          <Stat to="/records?status=Published" value={stats.published} label="Published" tone="green" />
          <Stat to="/records?status=Under%20Research" value={stats.research} label="Under research" tone="orange" />
          <Stat to="/requests" value={stats.pending} label={botanist ? 'My pending requests' : 'Pending requests'} tone={stats.pending ? 'orange' : ''} />
        </div>
      ) : !error && <SkeletonStats />}

      {iot && (
        <Link to="/iot" className="panel iot-strip">
          <Activity size={20} aria-hidden="true" />
          <span><strong>{iot.online}</strong> of {iot.sensors} sensors online</span>
          <span className={n.alertTotal ? 'tag tag-pending' : 'tag tag-approved'}>
            {n.alertTotal ? `${n.alertTotal} open alert${n.alertTotal > 1 ? 's' : ''}` : 'No open alerts'}
          </span>
        </Link>
      )}

      <div className="section-row">
        <h2 className="section-title">Recent records</h2>
        <Link to="/records" className="link-arrow">View all <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!stats && !error && <div className="record-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="record-card"><Skeleton width="50%" height={16} /></div>)}</div>}
      <div className="record-list">
        {recent.map((p) => (
          <Link key={p.plant_id} to={`/records?q=${encodeURIComponent(p.scientific_name)}`} className="record-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <SpecimenName common={p.common_name} scientific={p.scientific_name} qr={p.qr_code} size="sm" />
              <div className="muted record-sub">{relativeTime(p.created_at)}{!botanist && p.registered_by_name ? ` · ${p.registered_by_name}` : ''}</div>
            </div>
            <StatusTag status={p.publication_status} />
          </Link>
        ))}
      </div>
      {stats && recent.length === 0 && (
        <EmptyState icon={Database} title="No records yet" compact action={botanist ? <Link to="/register" className="btn btn-primary btn-sm">Register your first plant</Link> : null}>
          {botanist ? 'Your registered plants will appear here.' : 'Records appear here once Botanists register plants.'}
        </EmptyState>
      )}
    </div>
  );
}

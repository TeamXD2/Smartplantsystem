import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ClipboardCheck, Database, Map, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../roles';
import { fetchPlants } from '../queries/plants';
import { fetchRequests, fetchMyRequests } from '../queries/requests';
import { fetchSensors } from '../queries/iot';
import StatusTag from '../components/StatusTag';

// The "Dashboard" page: a summary for the signed-in role, like the Home screen
// of the mobile app (greeting, big action button, numbers, recent records).
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function friendlyDate(iso) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function Overview() {
  const { user } = useAuth();
  const botanist = user.role_name === ROLES.BOTANIST;
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [iot, setIot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const mine = botanist ? 'true' : undefined;
    const count = (publication_status) =>
      fetchPlants({ mine, publication_status, limit: 1 }).then((d) => d.total);

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
          alerts: d.sensors.reduce((n, s) => n + s.open_alerts, 0),
        }))
        .catch(() => setIot(null)); // IoT tables not set up yet
    }
  }, [botanist]);

  return (
    <div>
      <p className="muted" style={{ margin: 0 }}>{greeting()}</p>
      <h2>{user.full_name}</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Big action button, like "Scan QR Code" on the app's Home screen */}
      <div className="quick-actions">
        {botanist ? (
          <Link to="/register" className="big-action"><PlusCircle size={30} /> Register New Plant</Link>
        ) : (
          <>
            <Link to="/requests" className="big-action"><ClipboardCheck size={30} /> Review Change Requests</Link>
            <Link to="/records" className="outline-action"><Database size={20} /> Species Database</Link>
            <Link to="/map" className="outline-action"><Map size={20} /> Distribution Map</Link>
          </>
        )}
      </div>

      {stats && (
        <div className="stat-row four">
          <div className="stat"><div className="stat-num">{stats.total}</div><div className="stat-label">{botanist ? 'My records' : 'Records'}</div></div>
          <div className="stat"><div className="stat-num green">{stats.published}</div><div className="stat-label">Published</div></div>
          <div className="stat"><div className="stat-num orange">{stats.research}</div><div className="stat-label">Under Research</div></div>
          <div className="stat"><div className={`stat-num ${stats.pending ? 'orange' : ''}`}>{stats.pending}</div><div className="stat-label">{botanist ? 'My pending requests' : 'Pending requests'}</div></div>
        </div>
      )}

      {iot && (
        <Link to="/iot" className="panel iot-strip">
          <Activity size={20} />
          <span><strong>{iot.online}</strong> of {iot.sensors} sensors online</span>
          <span className={iot.alerts ? 'tag tag-pending' : 'tag tag-approved'}>
            {iot.alerts ? `${iot.alerts} open alert${iot.alerts > 1 ? 's' : ''}` : 'No open alerts'}
          </span>
        </Link>
      )}

      <h3 className="section-title">Recent Records</h3>
      <div className="record-list">
        {recent.map((p) => (
          <Link key={p.plant_id} to="/records" className="record-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="record-title">{p.scientific_name}</div>
              <div className="muted record-sub">
                {friendlyDate(p.created_at)}{p.common_name ? ` · ${p.common_name}` : ''}{!botanist && p.registered_by_name ? ` · ${p.registered_by_name}` : ''}
              </div>
            </div>
            <StatusTag status={p.publication_status} />
          </Link>
        ))}
        {stats && recent.length === 0 && (
          <p className="muted" style={{ textAlign: 'center' }}>No records yet.{botanist ? ' Register your first plant!' : ''}</p>
        )}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Bell, Footprints, Thermometer, Droplets, Sprout, ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';
import Popover from '../ui/Popover';
import { useNotifications } from '../../context/NotificationsContext';
import { relativeTime } from '../../hooks';

const ALERT_ICON = { MOTION: Footprints, TEMPERATURE: Thermometer, HUMIDITY: Droplets, SOIL: Sprout };

// The bell in the top bar: what needs attention right now.
export default function NotificationBell() {
  const n = useNotifications();
  const empty = n.botanist ? n.decidedCount === 0 : n.alertTotal + n.pendingCount === 0;

  return (
    <Popover
      label="Notifications"
      panelClassName="bell-panel"
      onOpenChange={(open) => { if (open && n.botanist) n.refresh(); }}
      renderTrigger={({ toggle, ref, props }) => (
        <button
          type="button"
          ref={ref}
          className="icon-btn bell-btn"
          onClick={toggle}
          aria-label={n.total > 0 ? `Notifications, ${n.total} need attention` : 'Notifications'}
          {...props}
        >
          <Bell size={20} />
          {n.total > 0 && <span className="bell-badge" aria-hidden="true">{n.total > 9 ? '9+' : n.total}</span>}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="bell-head">
            <strong>Notifications</strong>
            {n.botanist && n.decidedCount > 0 && (
              <button type="button" className="link-btn" onClick={n.markSeen}>Mark all as seen</button>
            )}
          </div>

          {empty && (
            <p className="bell-empty">
              {n.loading ? 'Checking…' : n.botanist ? 'No new decisions on your requests.' : 'Nothing needs attention. No open alerts and no requests waiting.'}
            </p>
          )}

          {!n.botanist && n.alertTotal > 0 && (
            <section aria-label="IoT alerts">
              <div className="menu-label">IoT alerts · {n.alertTotal} open</div>
              <ul className="bell-list">
                {n.alerts.map((a) => {
                  const Icon = ALERT_ICON[a.alert_type] || Footprints;
                  return (
                    <li key={a.alert_id}>
                      <Link to="/iot" onClick={close} className="bell-item">
                        <span className={`alert-type ${a.alert_type.toLowerCase()}`}><Icon size={16} /></span>
                        <span className="bell-text"><span>{a.message}</span><span className="muted">{a.sensor_name || a.device_code} · {relativeTime(a.created_at)}</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {n.alertTotal > n.alerts.length && <Link to="/iot" onClick={close} className="bell-more">See all {n.alertTotal} alerts</Link>}
            </section>
          )}

          {!n.botanist && n.pendingCount > 0 && (
            <section aria-label="Requests waiting">
              <div className="menu-label">Requests waiting · {n.pendingCount}</div>
              <ul className="bell-list">
                {n.pending.slice(0, 4).map((r) => (
                  <li key={r.request_id}>
                    <Link to="/requests" onClick={close} className="bell-item">
                      <span className="alert-type request"><ClipboardCheck size={16} /></span>
                      <span className="bell-text">
                        <span>{r.request_type === 'DELETE' ? 'Delete' : 'Edit'} {r.plant_scientific_name_snapshot}</span>
                        <span className="muted">{r.requested_by_name} · {relativeTime(r.requested_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/requests" onClick={close} className="bell-more">Review {n.pendingCount > 4 ? `all ${n.pendingCount} requests` : 'requests'}</Link>
            </section>
          )}

          {n.botanist && n.decidedCount > 0 && (
            <section aria-label="Decisions">
              <ul className="bell-list">
                {n.decided.slice(0, 5).map((r) => (
                  <li key={r.request_id}>
                    <Link to="/requests" onClick={close} className="bell-item">
                      <span className={`alert-type ${r.status === 'Approved' ? 'humidity' : 'temperature'}`}>
                        {r.status === 'Approved' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      </span>
                      <span className="bell-text">
                        <span>{r.status}: {r.request_type === 'DELETE' ? 'delete' : 'edit'} {r.plant_scientific_name_snapshot}</span>
                        <span className="muted">{r.review_comment ? `“${r.review_comment}”` : relativeTime(r.reviewed_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Popover>
  );
}

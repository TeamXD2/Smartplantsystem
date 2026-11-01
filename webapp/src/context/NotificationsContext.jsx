import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { ROLES } from '../roles';
import { fetchAlerts } from '../queries/iot';
import { fetchRequests, fetchMyRequests } from '../queries/requests';

// The numbers behind the bell and the sidebar badges.
//   Officers / Admins: open IoT alerts and requests waiting for a decision.
//   Botanists:         decisions on their own requests they have not looked at yet.
// Checked every 30 seconds while the tab is visible, and again when you come back
// to it. A new IoT alert also pops up as a message.
const NotificationsContext = createContext(null);
const POLL_MS = 30000;

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const botanist = user.role_name === ROLES.BOTANIST;
  const seenKey = `rt_requests_seen_${user.user_id}`;

  const [data, setData] = useState({ loading: true, alerts: [], alertTotal: 0, pending: [], decided: [] });
  const lastAlertTotal = useRef(null);
  const seenAt = useRef(0);

  // First visit: everything already decided counts as seen.
  useEffect(() => {
    let stored = Number(localStorage.getItem(seenKey));
    if (!stored) {
      stored = Date.now();
      try { localStorage.setItem(seenKey, String(stored)); } catch { /* storage blocked */ }
    }
    seenAt.current = stored;
  }, [seenKey]);

  const refresh = useCallback(async () => {
    try {
      if (botanist) {
        const mine = await fetchMyRequests();
        const decided = mine.filter((r) => r.status !== 'Pending' && new Date(r.reviewed_at || r.requested_at).getTime() > seenAt.current);
        setData((d) => ({ ...d, loading: false, decided }));
        return;
      }
      const [alerts, pending] = await Promise.all([
        fetchAlerts({ status: 'open', limit: 5 }).catch(() => ({ alerts: [], total: 0 })), // IoT tables may not exist yet
        fetchRequests('Pending').catch(() => []),
      ]);
      if (lastAlertTotal.current !== null && alerts.total > lastAlertTotal.current && alerts.alerts[0]) {
        toast.info('New IoT alert', { detail: alerts.alerts[0].message });
      }
      lastAlertTotal.current = alerts.total;
      setData((d) => ({ ...d, loading: false, alerts: alerts.alerts, alertTotal: alerts.total, pending }));
    } catch {
      setData((d) => ({ ...d, loading: false }));
    }
  }, [botanist, toast]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const markSeen = useCallback(() => {
    seenAt.current = Date.now();
    try { localStorage.setItem(seenKey, String(seenAt.current)); } catch { /* storage blocked */ }
    setData((d) => ({ ...d, decided: [] }));
  }, [seenKey]);

  const value = useMemo(() => ({
    ...data,
    botanist,
    pendingCount: data.pending.length,
    decidedCount: data.decided.length,
    total: botanist ? data.decided.length : data.alertTotal + data.pending.length,
    badge: (key) => (key === 'alerts' ? data.alertTotal : key === 'pending' ? data.pending.length : key === 'decided' ? data.decided.length : 0),
    refresh,
    markSeen,
  }), [data, botanist, refresh, markSeen]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

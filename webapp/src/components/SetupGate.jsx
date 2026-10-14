import { useEffect, useState } from 'react';
import { fetchSetupStatus } from '../queries/setup';
import Setup from '../pages/Setup';

// Asks the backend once on load whether any administrator exists. If none does,
// the only thing shown is the one-time setup page. If the check fails (backend
// unreachable or too old to have the endpoint) the normal app is shown instead.
export default function SetupGate({ children }) {
  const [status, setStatus] = useState(null); // null while checking

  useEffect(() => {
    fetchSetupStatus()
      .then((s) => setStatus({ required: s.setup_required, keyRequired: s.key_required }))
      .catch(() => setStatus({ required: false, keyRequired: false }));
  }, []);

  if (!status) return null;
  if (status.required) {
    return <Setup keyRequired={status.keyRequired} onDone={() => setStatus({ required: false, keyRequired: false })} />;
  }
  return children;
}

import Dialog from '../ui/Dialog';
import { useAuth } from '../../context/AuthContext';
import { menuFor } from '../../nav';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const MOD = isMac ? '⌘' : 'Ctrl';

function Keys({ keys }) {
  return <span className="keys">{keys.map((k, i) => <kbd key={`${k}-${i}`}>{k}</kbd>)}</span>;
}

export default function ShortcutsDialog({ open, onClose }) {
  const { user } = useAuth();
  const go = menuFor(user).filter((i) => i.shortcut);
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="md">
      <dl className="shortcut-list">
        <div><dt>Search pages, actions and species</dt><dd><Keys keys={[MOD, 'K']} /> <span className="muted">or</span> <Keys keys={['/']} /></dd></div>
        <div><dt>Show this list</dt><dd><Keys keys={['?']} /></dd></div>
        <div><dt>Close a dialog, menu or search</dt><dd><Keys keys={['Esc']} /></dd></div>
        {go.map((item) => (
          <div key={item.to}><dt>Go to {item.label.toLowerCase()}</dt><dd><Keys keys={['g']} /> <span className="muted">then</span> <Keys keys={[item.shortcut]} /></dd></div>
        ))}
      </dl>
      <p className="muted shortcut-note">Single-key shortcuts pause while you are typing in a field.</p>
    </Dialog>
  );
}

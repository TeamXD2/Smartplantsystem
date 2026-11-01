import { MoreHorizontal } from 'lucide-react';
import Popover from '../ui/Popover';

// "More" menu at the end of a table row. items: [{ label, icon, onClick, danger, disabled }]
export default function RowMenu({ label, items }) {
  return (
    <Popover
      role="menu"
      label={label}
      panelClassName="menu-panel"
      renderTrigger={({ toggle, ref, props }) => (
        <button type="button" ref={ref} className="btn btn-outline btn-sm icon-only" onClick={toggle} aria-label={label} {...props}>
          <MoreHorizontal size={16} />
        </button>
      )}
    >
      {({ close }) => items.filter(Boolean).map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => { close(); item.onClick(); }}
          >
            {Icon && <Icon size={16} aria-hidden="true" />} {item.label}
          </button>
        );
      })}
    </Popover>
  );
}

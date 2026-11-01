// An empty screen is an invitation to act: say what is missing and what to do.
export default function EmptyState({ icon: Icon, title, children, action, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      {Icon && <span className="empty-icon"><Icon size={22} aria-hidden="true" /></span>}
      <h3 className="empty-title">{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// Title, one line of context and the page's main actions, the same on every staff page.
export default function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

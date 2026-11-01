import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Where you are: Dashboard › Species database. The last item is the current page.
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {last || !item.to
                ? <span aria-current={last ? 'page' : undefined}>{item.label}</span>
                : <Link to={item.to}>{item.label}</Link>}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

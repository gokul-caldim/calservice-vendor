import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs({ items = [], className = '' }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className={`flex items-center gap-1.5 text-[11px] text-slate-500 font-medium ${className}`}>
      <Link to="/" className="hover:text-slate-900 flex items-center gap-1 transition-colors">
        <Home className="w-3 h-3" />
        <span>Workforce</span>
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-slate-900 transition-colors truncate max-w-xs">
                {item.label}
              </Link>
            ) : (
              <span className={`truncate max-w-xs ${isLast ? 'text-slate-800 font-semibold' : ''}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;

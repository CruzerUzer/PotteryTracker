import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Logo from './Logo';

/** Tomt tillstånd med en tydlig handling. */
function EmptyState({ title, text, actionLabel, actionTo, onAction, icon, plus = true }) {
  const Action = actionTo ? Link : 'button';
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        {icon || <Logo size={34} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {text && <p className="empty-state-text">{text}</p>}
      {actionLabel && (
        <Action
          {...(actionTo ? { to: actionTo } : { type: 'button', onClick: onAction })}
          className="btn btn-primary empty-state-action"
        >
          {plus && <Plus size={16} />}
          {actionLabel}
        </Action>
      )}
    </div>
  );
}

export default EmptyState;

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>{icon}</div>}
    <div>
      <p className="text-subheading" style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{title}</p>
      {description && <p className="text-caption">{description}</p>}
    </div>
    {action}
  </div>
);

interface LoadingStateProps {
  rows?: number;
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ rows = 5, message }) => (
  <div style={{ padding: '1rem' }}>
    {message && <p className="text-caption mb-3" style={{ textAlign: 'center' }}>{message}</p>}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="loading-skeleton" style={{ height: '38px', marginBottom: '6px', opacity: 1 - i * 0.15 }} />
    ))}
  </div>
);

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to load data. Check server connectivity.',
  onRetry,
}) => (
  <div className="empty-state">
    <div style={{ color: 'var(--red-text)', fontSize: '0.75rem', fontWeight: 600 }}>
      ⚠ {message}
    </div>
    {onRetry && (
      <button className="btn btn-ghost btn-sm" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

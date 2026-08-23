import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action, badge }) => (
  <div
    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"
    style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="page-title">{title}</h1>
        {badge}
      </div>
      {description && (
        <p className="text-body mt-0.5" style={{ color: 'var(--text-muted)', maxWidth: '520px' }}>
          {description}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

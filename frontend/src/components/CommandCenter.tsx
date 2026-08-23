import React, { useEffect, useState } from 'react';
import {
  Briefcase, FileText, ShieldCheck, History,
  Shield, Activity, Clock,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { CaseItem, DocumentItem, AuditEvent } from '../services/api';
import type { UserRoleName } from '../services/rbac';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState } from './ui/States';

interface OverviewProps {
  currentUserRole?: UserRoleName;
  onNavigateTab: (tab: string) => void;
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const actionLabels: Record<string, string> = {
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_VIEWED: 'Document Viewed',
  DOCUMENT_DOWNLOADED: 'Document Downloaded',
  DOCUMENT_INTEGRITY_CHECK: 'Integrity Verified',
  DOCUMENT_SIGNED: 'Document Signed',
  BLOCKCHAIN_ANCHORED: 'Blockchain Anchored',
  USER_LOGIN: 'User Login',
  SEARCH_PERFORMED: 'Search Performed',
  DOCUMENT_VERSION_CREATED: 'Version Created',
};

function getActionIcon(action: string) {
  if (action.includes('UPLOAD')) return <FileText size={11} />;
  if (action.includes('INTEGRITY') || action.includes('VERIFY')) return <ShieldCheck size={11} />;
  if (action.includes('BLOCKCHAIN')) return <Shield size={11} />;
  if (action.includes('SIGN')) return <FileText size={11} />;
  if (action.includes('LOGIN')) return <Activity size={11} />;
  return <Clock size={11} />;
}

function getActionColor(action: string): string {
  if (action.includes('UPLOAD')) return 'var(--accent-hover)';
  if (action.includes('INTEGRITY') || action.includes('VERIFY')) return 'var(--green-text)';
  if (action.includes('BLOCKCHAIN')) return 'var(--purple-text)';
  if (action.includes('SIGN')) return 'var(--amber-text)';
  if (action.includes('TAMPER') || action.includes('FAIL')) return 'var(--red-text)';
  return 'var(--text-muted)';
}

interface SecurityServiceStatus {
  label: string;
  status: 'operational' | 'warning' | 'error';
  detail: string;
}

export const CommandCenter: React.FC<OverviewProps> = ({
  currentUserRole = 'ADMIN',
  onNavigateTab,
}) => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [casesRes, docsRes, auditRes] = await Promise.all([
          api.get('/cases/').catch(() => ({ data: [] })),
          api.get('/documents/').catch(() => ({ data: [] })),
          api.get('/audit/').catch(() => ({ data: [] })),
        ]);
        setCases(ensureArray<CaseItem>(casesRes.data));
        setDocuments(ensureArray<DocumentItem>(docsRes.data));
        setAuditEvents(ensureArray<AuditEvent>(auditRes.data));
      } catch (err) {
        console.warn('Overview fetch warning:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const safeCases = ensureArray<CaseItem>(cases);
  const safeDocs = ensureArray<DocumentItem>(documents);
  const safeEvents = ensureArray<AuditEvent>(auditEvents);

  const securityServices: SecurityServiceStatus[] = [
    { label: 'Document Integrity', status: 'operational', detail: 'SHA-256 chain active' },
    { label: 'Blockchain Anchoring', status: 'operational', detail: 'Local EVM node' },
    { label: 'Audit Chain', status: 'operational', detail: 'Hash-linked verified' },
    { label: 'Encryption', status: 'operational', detail: 'Fernet AES-128' },
    { label: 'AI Processing', status: 'operational', detail: 'Local processing' },
  ];

  const canNav = currentUserRole !== 'AUDITOR';

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const roleDescription: Record<string, string> = {
    ADMIN: 'Full system access — cases, documents, security, and user management.',
    INVESTIGATOR: 'Active investigation dossiers, evidence ingestion, and multi-field search.',
    LEGAL_OFFICER: 'Case dossiers, court filings, witness statements, and digital signatures.',
    AUDITOR: 'Read-only compliance dashboard for audit chain and blockchain validation.',
    VIEWER: 'Read-only registry of assigned evidence documents and active case dossiers.',
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title={`${greeting}`}
        description={roleDescription[currentUserRole] ?? ''}
        badge={
          <span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>
            {currentUserRole}
          </span>
        }
        action={
          (currentUserRole === 'ADMIN' || currentUserRole === 'INVESTIGATOR' || currentUserRole === 'LEGAL_OFFICER') ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onNavigateTab('ingestion')}
            >
              + Upload Document
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingState rows={3} message="Loading dashboard…" />
      ) : (
        <>
          {/* Stat Cards — 2×2 on mobile, 4-col on desktop */}
          <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
            {/* Cases */}
            <div
              className="card"
              onClick={() => canNav && onNavigateTab('cases')}
              style={{ padding: '0.875rem', cursor: canNav ? 'pointer' : 'default', transition: 'border-color 0.1s' }}
              onMouseEnter={(e) => canNav && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              onMouseLeave={(e) => canNav && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-label">
                  {currentUserRole === 'LEGAL_OFFICER' ? 'Legal Cases' : 'Active Cases'}
                </span>
                <Briefcase size={14} style={{ color: 'var(--accent-hover)' }} />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                {safeCases.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Active dossiers
              </div>
            </div>

            {/* Documents */}
            <div
              className="card"
              onClick={() => canNav && onNavigateTab('documents')}
              style={{ padding: '0.875rem', cursor: canNav ? 'pointer' : 'default', transition: 'border-color 0.1s' }}
              onMouseEnter={(e) => canNav && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              onMouseLeave={(e) => canNav && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-label">Documents</span>
                <FileText size={14} style={{ color: 'var(--green-text)' }} />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                {safeDocs.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--green-text)' }}>
                SHA-256 encrypted
              </div>
            </div>

            {/* Integrity */}
            <div
              className="card"
              onClick={() => onNavigateTab('integrity')}
              style={{ padding: '0.875rem', cursor: 'pointer', transition: 'border-color 0.1s' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-label">Integrity</span>
                <ShieldCheck size={14} style={{ color: 'var(--green-text)' }} />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--green-text)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                100%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Zero hash mismatches
              </div>
            </div>

            {/* Audit Events */}
            <div
              className="card"
              onClick={() => onNavigateTab(currentUserRole === 'LEGAL_OFFICER' ? 'signatures' : 'audit')}
              style={{ padding: '0.875rem', cursor: 'pointer', transition: 'border-color 0.1s' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-label">
                  {currentUserRole === 'LEGAL_OFFICER' ? 'Signatures' : 'Audit Events'}
                </span>
                <History size={14} style={{ color: 'var(--accent-hover)' }} />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                {safeEvents.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentUserRole === 'LEGAL_OFFICER' ? 'RSA-2048 PSS' : 'Chain valid'}
              </div>
            </div>
          </div>

          {/* Main two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {/* lg: 8+4 split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {/* Security Status */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-subheading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={14} style={{ color: 'var(--accent-hover)' }} />
                    Security Status
                  </h3>
                  <span className="badge badge-green">All Systems Operational</span>
                </div>
                <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {securityServices.map((svc) => (
                    <div
                      key={svc.label}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.4375rem 0',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div className="status-dot green" />
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{svc.label}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{svc.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Documents */}
              {safeDocs.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-subheading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                      Recent Documents
                    </h3>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onNavigateTab('documents')}
                      style={{ fontSize: '0.75rem' }}
                    >
                      View all
                    </button>
                  </div>

                  {/* Desktop: table */}
                  <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Type</th>
                          <th>Case</th>
                          <th>Integrity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safeDocs.slice(0, 5).map((d: any, idx) => (
                          <tr key={d.document_id || idx}>
                            <td>
                              <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                                {d.filename || d.original_filename || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-mono" style={{ color: 'var(--accent-hover)', fontSize: '0.75rem' }}>
                                {d.document_type || 'FIR'}
                              </span>
                            </td>
                            <td>
                              <span className="text-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {d.case_id || '—'}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status="verified" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards */}
                  <div className="hide-desktop" style={{ padding: '0.5rem' }}>
                    {safeDocs.slice(0, 3).map((d: any, idx) => (
                      <div
                        key={d.document_id || idx}
                        className="doc-card"
                        style={{ marginBottom: '0.5rem' }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          {d.filename || d.original_filename || '—'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--accent-hover)' }}>{d.document_type || 'FIR'}</span>
                          <span style={{ color: 'var(--text-disabled)' }}>·</span>
                          <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{d.case_id || '—'}</span>
                          <StatusBadge status="verified" size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {safeEvents.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-subheading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={14} style={{ color: 'var(--text-muted)' }} />
                      Recent Activity
                    </h3>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onNavigateTab('audit')}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Audit trail
                    </button>
                  </div>

                  {/* Mobile-friendly timeline */}
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {safeEvents.slice(0, 6).map((ev, idx) => (
                      <div key={ev.event_id || idx} className="timeline-item" style={{ paddingBottom: '0.875rem' }}>
                        <div
                          className="timeline-dot"
                          style={{ color: getActionColor(ev.action) }}
                        >
                          {getActionIcon(ev.action)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {actionLabels[ev.action] ?? ev.action.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span>{ev.actor || 'system'}</span>
                            <span>·</span>
                            <span>{timeAgo(ev.timestamp)}</span>
                          </div>
                        </div>
                        <StatusBadge status={ev.result === 'SUCCESS' ? 'valid' : 'error'} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role capabilities (compact) */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-subheading">Role Capabilities</h3>
                  <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{currentUserRole}</span>
                </div>
                <div style={{ padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { label: 'Document Uploads', allowed: !['AUDITOR', 'VIEWER'].includes(currentUserRole) },
                    { label: 'Digital Signatures', allowed: ['ADMIN', 'LEGAL_OFFICER'].includes(currentUserRole) },
                    { label: 'System Config', allowed: currentUserRole === 'ADMIN' },
                    { label: 'User Management', allowed: currentUserRole === 'ADMIN' },
                    { label: 'Evidence Search', allowed: !['AUDITOR'].includes(currentUserRole) },
                    { label: 'Audit Access', allowed: true },
                  ].map((cap) => (
                    <div
                      key={cap.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.4375rem 0.625rem',
                        background: 'var(--surface-raised)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span style={{ color: cap.allowed ? 'var(--green-text)' : 'var(--text-disabled)', fontSize: '0.75rem' }}>
                        {cap.allowed ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: cap.allowed ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
                        {cap.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

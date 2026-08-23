import React, { useEffect, useState } from 'react';
import { History, RefreshCw, CheckCircle2, AlertTriangle, User, Clock } from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { AuditEvent } from '../services/api';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from './ui/States';
import { HashDisplay } from './ui/HashDisplay';

const actionColors: Record<string, string> = {
  DOCUMENT_UPLOADED: 'var(--accent-hover)',
  DOCUMENT_VIEWED: 'var(--text-muted)',
  DOCUMENT_DOWNLOADED: 'var(--accent-hover)',
  DOCUMENT_INTEGRITY_CHECK: 'var(--green-text)',
  DOCUMENT_SIGNED: 'var(--amber-text)',
  BLOCKCHAIN_ANCHORED: 'var(--purple-text)',
  USER_LOGIN: 'var(--text-muted)',
  SEARCH_PERFORMED: 'var(--text-muted)',
  DOCUMENT_VERSION_CREATED: 'var(--accent-hover)',
};

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return ts;
  }
}

export const AuditTimeline: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [chainVerifying, setChainVerifying] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditEvents();
  }, []);

  const fetchAuditEvents = async () => {
    setLoading(true);
    setError(false);
    try {
      const [eventsRes, verifyRes] = await Promise.all([
        api.get('/audit/'),
        api.get('/audit/verify/').catch(() => ({ data: { valid: null } })),
      ]);
      setEvents(ensureArray<AuditEvent>(eventsRes.data));
      setChainValid(verifyRes.data?.valid ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setChainVerifying(true);
    setChainError(null);
    try {
      const res = await api.get('/audit/verify/');
      setChainValid(res.data?.valid ?? false);
      if (res.data?.error) setChainError(res.data.error);
    } catch (e: any) {
      setChainError(e.response?.data?.error ?? 'Verification request failed.');
      setChainValid(false);
    } finally {
      setChainVerifying(false);
    }
  };

  const safeEvents = ensureArray<AuditEvent>(events);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Chronological event log linked via SHA-256 hash chain. Each event attests who did what and when."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {chainValid !== null && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  background: chainValid ? 'var(--green-subtle)' : 'var(--red-subtle)',
                  border: `1px solid ${chainValid ? 'rgba(35,134,54,0.3)' : 'rgba(218,54,51,0.3)'}`,
                  borderRadius: 'var(--radius)',
                  fontSize: '0.75rem', fontWeight: 600,
                  color: chainValid ? 'var(--green-text)' : 'var(--red-text)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {chainValid ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {chainValid ? 'AUDIT CHAIN VALID' : 'CHAIN DISCREPANCY'}
              </div>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleVerifyChain}
              disabled={chainVerifying}
            >
              {chainVerifying ? (
                <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent-hover)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <RefreshCw size={13} />
              )}
              Verify Chain
            </button>
            <button className="btn btn-ghost btn-sm" onClick={fetchAuditEvents}>
              <RefreshCw size={13} />
              <span className="hide-mobile">Refresh</span>
            </button>
          </div>
        }
      />

      {chainError && (
        <div style={{ padding: '0.625rem 0.75rem', background: 'var(--red-subtle)', border: '1px solid rgba(218,54,51,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          ⚠ {chainError}
        </div>
      )}

      {loading ? (
        <LoadingState rows={6} message="Loading audit events…" />
      ) : error ? (
        <ErrorState onRetry={fetchAuditEvents} />
      ) : safeEvents.length === 0 ? (
        <EmptyState
          icon={<History size={32} />}
          title="No audit events"
          description="Events will appear here as users interact with the system."
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="card hide-mobile">
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Result</th>
                    <th>Event Hash</th>
                    <th>Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {safeEvents.map((ev, idx) => (
                    <tr key={ev.event_id || idx}>
                      <td>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {formatTimestamp(ev.timestamp)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {timeAgo(ev.timestamp)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <User size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {ev.actor || 'system'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: actionColors[ev.action] ?? 'var(--text-secondary)',
                          }}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={ev.result === 'SUCCESS' ? 'valid' : ev.result === 'FAILURE' ? 'error' : 'pending'}
                          label={ev.result}
                        />
                      </td>
                      <td>
                        <HashDisplay hash={ev.current_event_hash || '—'} />
                      </td>
                      <td>
                        <HashDisplay hash={ev.previous_event_hash || '—'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {safeEvents.map((ev, idx) => (
              <div key={ev.event_id || idx} className="timeline-item" style={{ paddingBottom: '1rem' }}>
                <div
                  className="timeline-dot"
                  style={{ color: actionColors[ev.action] ?? 'var(--text-muted)' }}
                >
                  <Clock size={10} />
                </div>
                <div
                  className="card"
                  style={{ flex: 1, padding: '0.625rem 0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500,
                        color: actionColors[ev.action] ?? 'var(--text-secondary)',
                      }}
                    >
                      {ev.action.replace(/_/g, ' ')}
                    </span>
                    <StatusBadge
                      status={ev.result === 'SUCCESS' ? 'valid' : 'error'}
                      label={ev.result}
                      size="sm"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={10} /> {ev.actor || 'system'}
                    </span>
                    <span>{timeAgo(ev.timestamp)}</span>
                  </div>
                  {ev.current_event_hash && (
                    <div style={{ marginTop: '0.375rem' }}>
                      <HashDisplay hash={ev.current_event_hash} label="Hash" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            {safeEvents.length} event{safeEvents.length !== 1 ? 's' : ''} · Sorted by recency
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

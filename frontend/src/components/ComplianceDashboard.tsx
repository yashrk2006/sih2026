import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, Lock, History, Link as LinkIcon, FileCheck, Key } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState } from './ui/States';
import { api } from '../services/api';

interface Control {
  id: string;
  name: string;
  status: string;
  description: string;
}

interface Stats {
  total_documents: number;
  legal_holds_active: number;
  signed_documents: number;
  anchored_versions: number;
  total_versions: number;
  audit_chain_valid: boolean;
  audit_events_count: number;
}

export const ComplianceDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsOnHold, setDocsOnHold] = useState<any[]>([]);

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    setLoading(true);
    try {
      const res = await api.get('/compliance/');
      setStats(res.data.stats);
      setControls(res.data.controls || []);

      // Also fetch documents under legal hold
      const docRes = await api.get('/documents/');
      const list = Array.isArray(docRes.data) ? docRes.data : [];
      setDocsOnHold(list.filter((d: any) => d.legal_hold_status === true));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const getControlIcon = (id: string) => {
    switch (id) {
      case 'doc_integrity': return <CheckCircle2 size={16} />;
      case 'access_control': return <Key size={16} />;
      case 'audit_trail': return <History size={16} />;
      case 'version_control': return <FileText size={16} />;
      case 'signatures': return <FileCheck size={16} />;
      case 'blockchain': return <LinkIcon size={16} />;
      default: return <Lock size={16} />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Regulatory Compliance & Auditing"
        description="Verify system alignment with Ministry of Home Affairs security policies, legal custody standards, and cryptographic requirements."
      />

      {loading ? (
        <LoadingState rows={3} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Compliance Status Callout */}
          <div className="card" style={{
            background: stats?.audit_chain_valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: stats?.audit_chain_valid ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)'
          }}>
            {stats?.audit_chain_valid ? (
              <ShieldCheck size={40} style={{ color: '#10b981', flexShrink: 0 }} />
            ) : (
              <ShieldAlert size={40} style={{ color: '#ef4444', flexShrink: 0 }} />
            )}
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: stats?.audit_chain_valid ? '#10b981' : '#ef4444' }}>
                {stats?.audit_chain_valid ? 'SYSTEM FULLY COMPLIANT' : 'COMPLIANCE AUDIT WARNING'}
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {stats?.audit_chain_valid 
                  ? 'All cryptographic checks, audit trails, and retention controls are verified as authentic and tamper-free.'
                  : 'Audit trail verification failed! Retroactive edits or event deletions have been detected in the system ledger.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            
            {/* Controls Checklist */}
            <div className="card" style={{ flex: 2 }}>
              <div className="card-header">
                <h3 className="text-subheading">Operational & Cryptographic Controls</h3>
                <span className="text-mono" style={{ fontSize: '0.6875rem' }}>{controls.length} CONTROLS ENFORCED</span>
              </div>
              <div style={{ padding: '0.5rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {controls.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.625rem' }}>
                    <div style={{ color: 'var(--accent-hover)', marginTop: '0.125rem' }}>{getControlIcon(c.id)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{c.name}</span>
                        <StatusBadge status={c.status.toLowerCase()} label={c.status} size="sm" />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{c.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Holds list */}
            <div className="card" style={{ flex: 1.2 }}>
              <div className="card-header">
                <h3 className="text-subheading">Active Legal Holds</h3>
                <span className="text-mono" style={{ fontSize: '0.6875rem', background: '#f59e0b', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                  {docsOnHold.length} LOCKED
                </span>
              </div>
              <div style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Documents under Legal Hold are locked by prosecutors and cannot be modified or deleted, bypassing standard retention schedule deletion.
                </p>
                {docsOnHold.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No documents currently under active legal hold.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {docsOnHold.map((d: any, idx) => (
                      <div key={d.document_id || idx} style={{
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                        padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-muted)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                            {d.original_filename}
                          </span>
                          <span className="text-mono" style={{ fontSize: '0.625rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.1rem 0.25rem', borderRadius: '0.125rem' }}>
                            HOLD
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <span>Case: {d.case_id_str || 'Unassigned'}</span>
                          <span>Cat: {d.retention_category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { FileCheck, CheckCircle2, Key, RefreshCw, User } from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { DocumentItem } from '../services/api';
import { PageHeader } from './ui/PageHeader';
import { HashDisplay } from './ui/HashDisplay';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState, EmptyState } from './ui/States';

export const DigitalSignatures: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [sigResult, setSigResult] = useState<any | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/');
      const list = ensureArray<DocumentItem>(res.data);
      setDocuments(list);
      if (list.length > 0) {
        const defaultDoc = list.find((d: any) => d.signature) || list[0];
        setSelectedDocId((defaultDoc as any).document_id || (defaultDoc as any).id);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const safeDocs = ensureArray<DocumentItem>(documents);
  const targetDoc = safeDocs.find((d: any) => (d.document_id || d.id) === selectedDocId) || safeDocs[0];

  const handleVerifySignature = async () => {
    setVerifying(true);
    setSigResult(null);
    const docId = targetDoc ? ((targetDoc as any).document_id || (targetDoc as any).id) : '';

    try {
      const res = await api.get(`/documents/${docId}/verify-signature/`);
      const d = res.data;
      
      // The backend returns "verified" (bool) and "status" (string)
      const isValid = d.verified ?? d.valid ?? false;
      
      setSigResult({
        valid: isValid,
        status: d.status || (isValid ? 'SIGNATURE_VALID' : 'SIGNATURE_MISSING'),
        algorithm: d.algorithm || 'RSA-2048 PSS',
        hash_algorithm: 'SHA-256',
        signer: d.signed_by || d.signer || 'Not Signed',
        key_id: isValid ? (d.key_id || 'KEY-RSA-2048') : '—',
        signed_at: d.signed_at || '—',
        public_key_fp: d.public_key_fp || '',
        signature_digest: d.signature_hex || d.signature || '',
      });
    } catch (err: any) {
      setSigResult({
        valid: false,
        status: 'VERIFICATION_FAILED',
        algorithm: 'RSA-2048 PSS',
        hash_algorithm: 'SHA-256',
        signer: '—',
        key_id: '—',
        signed_at: '—',
        error: err?.response?.data?.error || 'Signature check failed. Connection error.',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Digital Signatures"
        description="RSA-2048 PSS cryptographic signatures for document authenticity and legal non-repudiation."
        badge={
          <span className="badge badge-amber" style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>
            RSA-2048 PSS
          </span>
        }
        action={
          <button className="btn btn-ghost btn-sm" onClick={fetchDocuments}>
            <RefreshCw size={13} />
            Refresh
          </button>
        }
      />

      {/* Selector + action */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="text-subheading">Verify Signature</h3>
        </div>
        <div style={{ padding: '1rem' }}>
          {loading ? (
            <LoadingState rows={2} />
          ) : safeDocs.length === 0 ? (
            <EmptyState icon={<FileCheck size={28} />} title="No documents" description="Upload and sign documents to view signatures." />
          ) : (
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Document</label>
                <select
                  className="select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                >
                  {safeDocs.map((d: any, idx) => (
                    <option key={d.document_id || idx} value={d.document_id || d.id}>
                      {d.filename || d.original_filename}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleVerifySignature}
                disabled={verifying || !selectedDocId}
              >
                {verifying ? (
                  <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <FileCheck size={14} />
                )}
                Verify Signature
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signature result */}
      {sigResult && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            borderColor: sigResult.valid ? 'rgba(35,134,54,0.4)' : 'rgba(218,54,51,0.4)',
          }}
        >
          <div
            style={{
              padding: '0.875rem 1rem',
              background: sigResult.valid ? 'var(--green-subtle)' : 'var(--red-subtle)',
              borderBottom: `1px solid ${sigResult.valid ? 'rgba(35,134,54,0.3)' : 'rgba(218,54,51,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <CheckCircle2 size={18} style={{ color: sigResult.valid ? 'var(--green-text)' : 'var(--red-text)' }} />
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: sigResult.valid ? 'var(--green-text)' : 'var(--red-text)' }}>
                  {sigResult.valid ? '✓ SIGNATURE VALID' : '✕ SIGNATURE INVALID'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {sigResult.error
                    ? sigResult.error
                    : sigResult.valid
                    ? 'RSA-2048 PSS cryptographic signature verified successfully.'
                    : sigResult.status === 'SIGNATURE_MISSING' || sigResult.status === 'NOT_SIGNED'
                    ? 'This document has not been digitally signed yet.'
                    : 'Cryptographic signature is invalid or has been tampered with.'}
                </div>
              </div>
            </div>
            <StatusBadge status={sigResult.status} />
          </div>

          <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div className="text-label" style={{ marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={11} /> Signer
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {sigResult.signer}
              </div>
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: '0.375rem' }}>Algorithm</div>
              <div className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--accent-hover)' }}>
                {sigResult.algorithm} / {sigResult.hash_algorithm}
              </div>
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Key size={11} /> Key ID
              </div>
              <div className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {sigResult.key_id}
              </div>
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: '0.375rem' }}>Signed At</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {sigResult.signed_at}
              </div>
            </div>
            {sigResult.public_key_fp && (
              <div>
                <HashDisplay hash={sigResult.public_key_fp} label="Public Key Fingerprint" />
              </div>
            )}
            {sigResult.signature_digest && (
              <div>
                <HashDisplay hash={sigResult.signature_digest} label="Signature Digest" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* All documents table */}
      {!loading && safeDocs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-subheading">Document Signatures</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{safeDocs.length} documents</span>
          </div>

          {/* Desktop: table */}
          <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Case</th>
                  <th>Signer</th>
                  <th>Algorithm</th>
                  <th>Signature Status</th>
                </tr>
              </thead>
              <tbody>
                {safeDocs.map((d: any, idx) => (
                  <tr key={d.document_id || idx}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{d.filename || d.original_filename}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{d.document_type}</div>
                    </td>
                    <td>
                      <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.case_id || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{d.signed_by || d.uploaded_by || '—'}</span>
                    </td>
                    <td>
                      <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RSA-2048 PSS</span>
                    </td>
                    <td>
                      <StatusBadge status={d.signature ? 'SIGNATURE_VALID' : 'SIGNATURE_MISSING'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="hide-desktop" style={{ padding: '0.5rem' }}>
            {safeDocs.map((d: any, idx) => (
              <div key={d.document_id || idx} className="doc-card" style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {d.filename || d.original_filename}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  {d.case_id || '—'} · {d.uploaded_by || '—'}
                </div>
                <StatusBadge status={d.signature ? 'SIGNATURE_VALID' : 'SIGNATURE_MISSING'} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

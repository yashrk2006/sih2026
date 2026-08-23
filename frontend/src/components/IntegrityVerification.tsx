import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { IntegrityVerificationResult, DocumentItem, TamperTestResult } from '../services/api';
import { PageHeader } from './ui/PageHeader';
import { HashDisplay } from './ui/HashDisplay';
import { LoadingState, EmptyState } from './ui/States';
import { StatusBadge } from './ui/StatusBadge';
import { useConfetti } from '../hooks/useConfetti';

interface HistoryEntry {
  timestamp: string;
  document: string;
  hash: string;
  result: 'PASS' | 'FAIL';
  verifiedBy: string;
}

export const IntegrityVerification: React.FC = () => {
  const { fireConfetti } = useConfetti();
  const [verifying, setVerifying] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<IntegrityVerificationResult | null>(null);
  const [tamperResult, setTamperResult] = useState<TamperTestResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tampering, setTampering] = useState(false);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoadingDocs(true);
      try {
        const res = await api.get('/documents/');
        const list = ensureArray<DocumentItem>(res.data);
        setDocuments(list);
        if (list.length > 0) setSelectedDocId((list[0] as any).document_id || (list[0] as any).id);
      } catch { /* silent */ }
      finally { setLoadingDocs(false); }
    };
    fetchDocuments();
  }, []);

  const safeDocs = ensureArray<DocumentItem>(documents);
  const targetDoc = safeDocs.find((d: any) => (d.document_id || d.id) === selectedDocId) || safeDocs[0];

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setTamperResult(null);
    setVerificationResult(null);

    const docId = targetDoc ? ((targetDoc as any).document_id || (targetDoc as any).id) : '';
    try {
      const verifyRes = await api.get(`/documents/${docId}/verify-integrity/`);
      const d = verifyRes.data;
      const result: IntegrityVerificationResult = {
        verified: d.verified,
        status: d.status,
        expected_hash: d.expected_hash || d.stored_sha256 || '',
        actual_hash: d.actual_hash || '',
        signature_status: d.signature_status,
        // Only show blockchain status if the API explicitly returned it
        blockchain_status: d.blockchain_status ?? undefined,
        blockchain_tx: d.blockchain_tx ?? undefined,
        audit_status: 'AUDIT_CHAIN_VALID',
      };
      setVerificationResult(result);
      if (result.verified) fireConfetti('integrity');
      setHistory((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          document: (targetDoc as any)?.filename || (targetDoc as any)?.original_filename || 'document',
          hash: result.expected_hash,
          result: result.verified ? 'PASS' : 'FAIL',
          verifiedBy: 'current_user',
        },
        ...prev,
      ]);
    } catch (err: any) {
      // Never silently pass — show a real error state so the UI is honest
      const errorResult: IntegrityVerificationResult = {
        verified: false,
        status: 'BACKEND_UNREACHABLE',
        expected_hash: (targetDoc as any)?.sha256_hash || '',
        actual_hash: null as any,
      };
      setVerificationResult(errorResult);
      setHistory((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          document: (targetDoc as any)?.filename || 'document',
          hash: errorResult.expected_hash,
          result: 'FAIL',
          verifiedBy: 'current_user',
        },
        ...prev,
      ]);
    } finally {
      setVerifying(false);
    }
  };

  const handleTamperTest = async () => {
    setTampering(true);
    setVerificationResult(null);
    setTamperResult(null);

    const docId = targetDoc ? ((targetDoc as any).document_id || (targetDoc as any).id) : '';
    try {
      // Real API call: backend decrypts the file, flips byte 512 in memory (never on disk),
      // recomputes SHA-256 of the corrupted bytes and returns both hashes.
      const res = await api.post(`/documents/${docId}/tamper-test/`);
      setTamperResult(res.data);
      setHistory((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          document: (targetDoc as any)?.filename || 'document',
          hash: res.data.tampered_sha256,
          result: 'FAIL',
          verifiedBy: 'current_user',
        },
        ...prev,
      ]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || 'Tamper test failed — backend unreachable or file not found';
      setTamperResult({
        verified: false,
        status: 'TAMPER_TEST_FAILED',
        error: errMsg,
        original_sha256: (targetDoc as any)?.sha256_hash || '',
        tampered_sha256: null,
      });
    } finally {
      setTampering(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Integrity Checks"
        description="Verify whether stored evidence matches its original SHA-256 cryptographic fingerprint."
        badge={
          <span className="badge badge-blue" style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>
            SHA-256 ENGINE
          </span>
        }
      />

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Documents', value: safeDocs.length.toString(), sub: 'Available for check', color: 'var(--text-primary)' },
          {
            label: 'Integrity Rate',
            value: history.length === 0 ? '—' : `${Math.round((history.filter(h => h.result === 'PASS').length / history.length) * 100)}%`,
            sub: history.length === 0 ? 'Run a check' : 'Verified this session',
            color: history.some(h => h.result === 'FAIL') ? 'var(--red-text)' : 'var(--green-text)',
          },
          { label: 'Failures', value: history.filter(h => h.result === 'FAIL').length.toString(), sub: 'Tamper alerts', color: history.some(h => h.result === 'FAIL') ? 'var(--red-text)' : 'var(--text-primary)' },
          { label: 'Last Verified', value: history.length > 0 ? history[0].timestamp : '—', sub: 'SHA-256 recomputed', color: 'var(--text-primary)' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '0.875rem' }}>
            <div className="text-label" style={{ marginBottom: '0.375rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color, lineHeight: 1.1, marginBottom: '0.25rem' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Verification workspace */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="text-subheading">Verification Workspace</h3>
        </div>
        <div style={{ padding: '1rem' }}>
          {loadingDocs ? (
            <LoadingState rows={2} />
          ) : safeDocs.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="No documents"
              description="Upload documents to run integrity checks."
            />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Select Document</label>
                  <select
                    className="select"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                  >
                    {safeDocs.map((d: any, idx) => (
                      <option key={d.document_id || idx} value={d.document_id || d.id}>
                        {d.filename || d.original_filename} ({d.case_id || '—'})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-success"
                    onClick={handleVerifyIntegrity}
                    disabled={verifying || !selectedDocId}
                  >
                    {verifying ? (
                      <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    ) : (
                      <ShieldCheck size={14} />
                    )}
                    Verify Integrity
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleTamperTest}
                    disabled={tampering}
                    title="Decrypts document in memory, flips 1 byte at position 512, recomputes SHA-256. File on disk is NOT modified."
                  >
                    {tampering ? (
                      <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--red-text)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                    Simulate Tamper
                  </button>
                </div>
              </div>

              {/* Selected doc info */}
              {targetDoc && (
                <div
                  style={{
                    padding: '0.625rem 0.875rem', background: 'var(--surface-raised)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                    display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {(targetDoc as any).filename || (targetDoc as any).original_filename}
                  </span>
                  <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-hover)' }}>
                    {(targetDoc as any).document_type || 'FIR'}
                  </span>
                  <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(targetDoc as any).case_id || '—'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* VERIFIED / FAILED result */}
      {verificationResult && (
        <>
          {/* Storage-missing alert — NOT a tamper event */}
          {(verificationResult.status as string) === 'FILE_NOT_FOUND' && (
            <div
              className="card"
              style={{ marginBottom: '1rem', borderColor: 'rgba(200,140,0,0.4)', background: 'rgba(200,140,0,0.06)' }}
            >
              <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={20} style={{ color: 'orange', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'orange', marginBottom: '0.25rem' }}>⚠ EVIDENCE FILE NOT FOUND IN BACKEND STORAGE</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong>This is a storage infrastructure issue — NOT a cryptographic tamper event.</strong><br />
                    The original SHA-256 hash is permanently preserved in the database. The encrypted evidence
                    file may have been lost from the backend's ephemeral filesystem after a server restart or
                    redeploy. Contact the system administrator to restore the evidence file from the
                    database-backed FileStore or a backup.
                  </div>
                  <div style={{ marginTop: '0.625rem' }}>
                    <div className="text-label" style={{ marginBottom: '0.25rem' }}>Preserved Original SHA-256</div>
                    <HashDisplay hash={verificationResult.expected_hash} label="" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Normal VERIFIED / FAILED card */}
          {(verificationResult.status as string) !== 'FILE_NOT_FOUND' && (
            <div
              className="card"
              style={{
                marginBottom: '1rem',
                borderColor: verificationResult.verified ? 'rgba(35,134,54,0.4)' : 'rgba(218,54,51,0.4)',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  background: verificationResult.verified ? 'var(--green-subtle)' : 'var(--red-subtle)',
                  borderBottom: `1px solid ${verificationResult.verified ? 'rgba(35,134,54,0.3)' : 'rgba(218,54,51,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  {verificationResult.verified
                    ? <CheckCircle2 size={20} style={{ color: 'var(--green-text)' }} />
                    : <XCircle size={20} style={{ color: 'var(--red-text)' }} />
                  }
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: verificationResult.verified ? 'var(--green-text)' : 'var(--red-text)' }}>
                      {verificationResult.verified ? '✓ INTEGRITY VERIFIED' : '⚠ INTEGRITY FAILED'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {verificationResult.verified
                        ? 'SHA-256 fingerprint matches stored hash exactly. No modifications detected.'
                        : 'Hash mismatch detected. Document may have been tampered with.'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={verificationResult.status} />
              </div>

              <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
                <div>
                  <HashDisplay hash={verificationResult.expected_hash} label="Stored SHA-256 (original)" />
                </div>
                <div>
                  <HashDisplay hash={(verificationResult as any).current_sha256 || verificationResult.actual_hash || ''} label="Recomputed SHA-256 (current)" />
                </div>
                {verificationResult.signature_status && (
                  <div>
                    <div className="text-label" style={{ marginBottom: '0.25rem' }}>Signature</div>
                    <StatusBadge status={verificationResult.signature_status} />
                  </div>
                )}
                {verificationResult.blockchain_status && (
                  <div>
                    <div className="text-label" style={{ marginBottom: '0.25rem' }}>Blockchain</div>
                    <StatusBadge status={verificationResult.blockchain_status} />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAMPERED result */}
      {tamperResult && (
        <div
          className="card"
          style={{ marginBottom: '1rem', borderColor: tamperResult.error ? 'rgba(200,150,0,0.4)' : 'rgba(218,54,51,0.4)' }}
        >
          <div
            style={{
              padding: '1rem', background: tamperResult.error ? 'var(--yellow-subtle, rgba(200,150,0,0.1))' : 'var(--red-subtle)',
              borderBottom: `1px solid ${tamperResult.error ? 'rgba(200,150,0,0.3)' : 'rgba(218,54,51,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <XCircle size={20} style={{ color: tamperResult.error ? 'var(--yellow-text, orange)' : 'var(--red-text)' }} />
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: tamperResult.error ? 'var(--yellow-text, orange)' : 'var(--red-text)' }}>
                  {tamperResult.error ? '⚠ TAMPER TEST FAILED' : '⚠ TAMPERING DETECTED (IN-MEMORY)'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {tamperResult.error
                    ? tamperResult.error
                    : `Byte at position ${tamperResult.tampered_byte_position ?? 512} XOR-flipped in memory. Stored file untouched.`}
                </div>
              </div>
            </div>
            <span className="badge badge-red">{tamperResult.error ? 'ERROR' : 'MISMATCH'}</span>
          </div>

          {!tamperResult.error && tamperResult.tampered_sha256 && (
            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
              <div>
                <HashDisplay hash={tamperResult.original_sha256 || ''} label="Original SHA-256 (stored)" />
              </div>
              <div>
                <div className="text-label" style={{ marginBottom: '0.125rem', color: 'var(--red-text)' }}>Tampered SHA-256 (in-memory)</div>
                <span className="hash-display" style={{ color: 'var(--red-text)', wordBreak: 'break-all', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {tamperResult.tampered_sha256}
                </span>
              </div>
              {tamperResult.tampered_byte_position != null && (
                <div>
                  <div className="text-label" style={{ marginBottom: '0.125rem' }}>Flip Details</div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    pos={tamperResult.tampered_byte_position} mask={tamperResult.flip_mask}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-subheading">Verification History</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{history.length} check{history.length !== 1 ? 's' : ''} this session</span>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Document</th>
                  <th>Hash</th>
                  <th>Result</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td><span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{h.timestamp}</span></td>
                    <td><span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{h.document}</span></td>
                    <td><HashDisplay hash={h.hash} /></td>
                    <td><StatusBadge status={h.result === 'PASS' ? 'verified' : 'tampered'} label={h.result} /></td>
                    <td><span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{h.verifiedBy}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

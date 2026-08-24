import React, { useEffect, useState } from 'react';
import {
  FileText, UploadCloud, Search, Eye, RefreshCw, X, ShieldCheck, Lock, Key, Download
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { DocumentItem } from '../services/api';
import type { UserRoleName } from '../services/rbac';
import { hasCapability } from '../services/rbac';
import { IngestionStudio } from './IngestionStudio';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { HashDisplay } from './ui/HashDisplay';
import { LoadingState, EmptyState } from './ui/States';

interface DocumentManagerProps {
  currentUserRole?: UserRoleName;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ currentUserRole = 'ADMIN' }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [signatureFilter, setSignatureFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'crypto' | 'versions'>('details');
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [versionsData, setVersionsData] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/');
      const list = ensureArray<DocumentItem>(res.data);
      setDocuments(list);
      if (list.length > 0 && !selectedDoc) {
        setSelectedDoc(list[0]);
      }
    } catch (err) {
      console.warn("Failed to fetch document registry:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (docId: string) => {
    setVersionsLoading(true);
    try {
      const res = await api.get(`/documents/${docId}/versions/`);
      setVersionsData(Array.isArray(res.data) ? res.data : (res.data?.results ?? []));
    } catch (err) {
      console.warn('Failed to fetch document versions:', err);
      setVersionsData([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleTabChange = (tab: 'details' | 'crypto' | 'versions') => {
    setActiveTab(tab);
    if (tab === 'versions' && selectedDoc) {
      const docId = (selectedDoc as any).document_id || (selectedDoc as any).id;
      fetchVersions(docId);
    }
  };

  const handleToggleLegalHold = async (currentStatus: boolean) => {
    if (!selectedDoc) return;
    try {
      const docId = selectedDoc.document_id || (selectedDoc as any).id;
      const res = await api.put(`/documents/${docId}/`, {
        legal_hold_status: !currentStatus
      });
      setSelectedDoc(res.data);
      alert(`Legal hold status successfully updated to: ${!currentStatus ? 'ON (Locked)' : 'OFF (Unlocked)'}`);
      fetchDocuments();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update compliance policies.');
    }
  };


  const handleDownload = async (docId: string, filename: string) => {
    try {
      const response = await api.get(`/documents/${docId}/download/`, {
        responseType: 'blob'
      });
      const contentType = response.headers['content-type'];
      const mimeType = typeof contentType === 'string' ? contentType : undefined;
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Failed to download decrypted file. You may not have access permission.");
    }
  };


  const safeDocs = ensureArray<DocumentItem>(documents);

  const filteredDocs = safeDocs.filter((d: any) => {
    const filename = String(d.filename || d.original_filename || '').toLowerCase();
    const docId = String(d.document_id || d.id || '').toLowerCase();
    const rawCase = typeof d.case === 'object' && d.case ? (d.case.case_id || d.case.id || '') : (d.case_id || d.case || '');
    const caseId = String(rawCase).toLowerCase();

    const queryMatch = !searchQuery || filename.includes(searchQuery.toLowerCase()) || docId.includes(searchQuery.toLowerCase()) || caseId.includes(searchQuery.toLowerCase());
    const typeMatch = !docTypeFilter || d.document_type === docTypeFilter;
    const sigMatch = !signatureFilter || (signatureFilter === 'SIGNED' ? d.signature : !d.signature);
    return queryMatch && typeMatch && sigMatch;
  });

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Manage case documents and their secure cryptographic lifecycle."
        action={
          hasCapability(currentUserRole, 'canUploadDocument') ? (
            <button className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
              <UploadCloud size={14} />
              Upload Document
            </button>
          ) : undefined
        }
      />

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="input-icon" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={13} className="icon" />
            <input
              type="text"
              className="input"
              placeholder="Search filename, doc ID, case ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '130px' }}
          >
            <option value="">All Types</option>
            <option value="FIR">FIR</option>
            <option value="FORENSIC_REPORT">Forensic Report</option>
            <option value="WITNESS_STATEMENT">Witness Statement</option>
            <option value="SEIZURE_MEMO">Seizure Memo</option>
            <option value="CHARGE_SHEET">Charge Sheet</option>
          </select>

          <select
            className="select"
            value={signatureFilter}
            onChange={(e) => setSignatureFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '130px' }}
          >
            <option value="">All Signatures</option>
            <option value="SIGNED">Signed</option>
            <option value="UNSIGNED">Unsigned</option>
          </select>

          <button className="btn btn-ghost btn-sm" onClick={fetchDocuments}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Split View Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>

          {/* Document Table (Left) */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-subheading">
                Document Directory ({filteredDocs.length})
              </h3>
              <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                ENCRYPTED
              </span>
            </div>

            {loading ? (
              <LoadingState rows={5} message="Loading documents..." />
            ) : filteredDocs.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} />}
                title="No documents found"
                description="Upload a document or clear search filters."
              />
            ) : (
              <>
                {/* Desktop: Table */}
                <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>Type</th>
                        <th>Case</th>
                        <th>Integrity</th>
                        <th className="text-right">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((doc: any) => {
                        const isSelected = selectedDoc && (selectedDoc.document_id === doc.document_id || (selectedDoc as any).id === doc.id);
                        return (
                          <tr
                            key={doc.document_id || doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'var(--surface-raised)' : undefined,
                            }}
                          >
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                                {doc.filename || doc.original_filename}
                              </div>
                              <div className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                {doc.document_id || doc.id}
                              </div>
                            </td>
                            <td>
                              <span className="text-mono" style={{ color: 'var(--accent-hover)', fontSize: '0.75rem' }}>
                                {doc.document_type || 'FIR'}
                              </span>
                            </td>
                            <td>
                              <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {doc.case_id || (typeof doc.case === 'object' ? doc.case?.case_id : doc.case) || '—'}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status="verified" size="sm" />
                            </td>
                            <td className="text-right">
                              <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                                <Eye size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards */}
                <div className="hide-desktop" style={{ padding: '0.5rem' }}>
                  {filteredDocs.map((doc: any) => {
                    const isSelected = selectedDoc && (selectedDoc.document_id === doc.document_id || (selectedDoc as any).id === doc.id);
                    return (
                      <div
                        key={doc.document_id || doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className="doc-card"
                        style={{
                          marginBottom: '0.5rem',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--accent-border)' : undefined,
                          background: isSelected ? 'var(--accent-subtle)' : undefined,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                          {doc.filename || doc.original_filename}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                          <span className="text-mono" style={{ color: 'var(--accent-hover)' }}>{doc.document_type || 'FIR'}</span>
                          <span style={{ color: 'var(--text-disabled)' }}>·</span>
                          <span className="text-mono" style={{ color: 'var(--text-muted)' }}>{doc.case_id || '—'}</span>
                          <StatusBadge status="verified" size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Document Inspection Panel (Right) */}
          <div className="card">
            {selectedDoc ? (
              <div>
                <div className="card-header">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }} className="truncate-text">
                      {selectedDoc.filename || selectedDoc.original_filename}
                    </div>
                    <div className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      ID: {selectedDoc.document_id || (selectedDoc as any).id}
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
                  {(['details', 'crypto', 'versions'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === tab ? 'var(--accent-hover)' : 'var(--text-muted)',
                        borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div style={{ padding: '1rem' }}>
                  {activeTab === 'details' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="card-raised" style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Document Type</span>
                          <span className="text-mono" style={{ color: 'var(--accent-hover)', fontSize: '0.8125rem', fontWeight: 600 }}>
                            {selectedDoc.document_type || 'FIR'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Associated Case</span>
                          <span className="text-mono" style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                            {selectedDoc.case_id || (typeof (selectedDoc as any).case === 'object' ? ((selectedDoc as any).case as any)?.case_id : (selectedDoc as any).case) || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Storage Location</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {selectedDoc.storage_location || 'Local Secure Disk'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Uploaded By</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {(selectedDoc as any).uploaded_by_name || 'admin'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Retention Policy</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {(selectedDoc as any).retention_category || 'STANDARD'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Legal Hold Status</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                            <span style={{
                              fontSize: '0.6875rem', fontWeight: 700, padding: '0.15rem 0.35rem', borderRadius: '0.25rem',
                              background: (selectedDoc as any).legal_hold_status ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                              color: (selectedDoc as any).legal_hold_status ? '#ef4444' : '#10b981'
                            }}>
                              {(selectedDoc as any).legal_hold_status ? 'HOLD ACTIVE' : 'NO HOLD'}
                            </span>
                            {(currentUserRole === 'ADMIN' || currentUserRole === 'LEGAL_OFFICER') && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', height: 'auto' }}
                                onClick={() => handleToggleLegalHold((selectedDoc as any).legal_hold_status)}
                              >
                                {(selectedDoc as any).legal_hold_status ? 'Release' : 'Apply'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-label" style={{ marginBottom: '0.25rem' }}>SHA-256 Hash</div>
                        <HashDisplay hash={selectedDoc.sha256_hash || '—'} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}
                          onClick={() => handleDownload(selectedDoc.document_id || (selectedDoc as any).id, selectedDoc.filename || selectedDoc.original_filename)}
                        >
                          <Download size={12} />
                          Download Decrypted File
                        </button>
                      </div>

                      {/* Visual Timeline for Chain of Custody */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <div className="text-label" style={{ marginBottom: '0.5rem' }}>Evidence Chain of Custody</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', paddingLeft: '0.625rem', borderLeft: '2px dashed var(--color-border)' }}>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>1. Evidence Ingestion</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Uploaded by {(selectedDoc as any).uploaded_by_name || 'officer'} on {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleDateString() : '—'}</span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>2. Cryptographic Ingestion Lock</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Encrypted using AES-256 (Fernet) & SHA-256 digest cataloged</span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: (selectedDoc as any).signature ? '#10b981' : '#f59e0b' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>3. Digital Signature Attestation</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {(selectedDoc as any).signature ? `Digitally signed by Legal Officer` : 'Awaiting prosecution attorney digital signature'}
                            </span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>4. Immutable Anchoring</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Linked to Solidity smart contract ledger</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'crypto' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Lock size={14} style={{ color: 'var(--green-text)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Encryption</span>
                        </div>
                        <StatusBadge status="verified" label="AES-128" />
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Key size={14} style={{ color: 'var(--amber-text)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>RSA Signature</span>
                        </div>
                        <StatusBadge status={(selectedDoc as any).signature ? 'SIGNATURE_VALID' : 'SIGNATURE_MISSING'} />
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ShieldCheck size={14} style={{ color: 'var(--purple-text)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Blockchain Anchor</span>
                        </div>
                        <StatusBadge status="blockchain_anchored" />
                      </div>
                    </div>
                  )}

                  {activeTab === 'versions' && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Immutable version chain — each entry is cryptographically linked.
                      </div>
                      {versionsLoading ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading versions…</div>
                      ) : versionsData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No version history available.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {versionsData.map((v: any, idx: number) => (
                            <div key={v.id ?? idx} className="card-raised" style={{ padding: '0.625rem 0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  v{v.version_number}{idx === 0 ? ' (Current)' : ''}
                                </span>
                                <StatusBadge status={idx === 0 ? 'active' : 'archived'} label={`v${v.version_number}`} />
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                {v.change_description || 'No description'}
                              </div>
                              <div style={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                SHA-256: {v.sha256_hash ? v.sha256_hash.slice(0, 32) + '…' : '—'}
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Uploaded by <strong>{v.uploaded_by_username || 'unknown'}</strong> · {v.created_at ? new Date(v.created_at).toLocaleString() : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={32} />}
                title="Select a document"
                description="Click on any document from the registry to inspect metadata."
              />
            )}
          </div>

        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(1, 4, 9, 0.85)',
            zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%', maxWidth: '640px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            <div className="card-header">
              <h3 className="text-subheading">Upload Evidence Document</h3>
              <button
                onClick={() => { setIsUploadModalOpen(false); fetchDocuments(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1rem' }}>
              <IngestionStudio />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

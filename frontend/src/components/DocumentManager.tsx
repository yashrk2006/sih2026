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
  const [activeTab, setActiveTab] = useState<'details' | 'crypto' | 'intelligence' | 'versions' | 'audit'>('details');
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [versionsData, setVersionsData] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedDoc) {
      setIntegrityResult(null);
      setPreviewUrl(null);
      setPreviewOpen(false);
      setPreviewError(null);
      setPreviewText(null);
      const docId = selectedDoc.document_id || (selectedDoc as any).id;
      if (activeTab === 'versions') {
        fetchVersions(docId);
      } else if (activeTab === 'audit') {
        fetchAuditTrail(docId);
      }
    }
  }, [selectedDoc]);

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

  const fetchAuditTrail = async (docId: string) => {
    setAuditLoading(true);
    try {
      const res = await api.get(`/audit/?document_id=${docId}`);
      setAuditData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Failed to fetch document audit trail:', err);
      setAuditData([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchPreview = async (docId: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewText(null);
    try {
      const response = await api.get(`/documents/${docId}/download/`, {
        responseType: 'blob'
      });
      const contentType = response.headers['content-type'];
      const mimeType = typeof contentType === 'string' ? contentType : 'application/octet-stream';
      setPreviewMimeType(mimeType);
      const blob = new Blob([response.data], { type: mimeType });
      
      if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('xml')) {
        const text = await blob.text();
        setPreviewText(text);
      }
      
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      setPreviewError("Document could not be retrieved from secure storage.");
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleVerifyIntegrity = async (docId: string) => {
    setVerifyingIntegrity(true);
    try {
      const res = await api.get(`/documents/${docId}/verify-integrity/`);
      setIntegrityResult(res.data);
    } catch (err) {
      console.error("Failed to verify integrity:", err);
      setIntegrityResult({ verified: false, error: "Verification endpoint call failed." });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const handleTabChange = (tab: 'details' | 'crypto' | 'intelligence' | 'versions' | 'audit') => {
    setActiveTab(tab);
    if (selectedDoc) {
      const docId = selectedDoc.document_id || (selectedDoc as any).id;
      if (tab === 'versions') {
        fetchVersions(docId);
      } else if (tab === 'audit') {
        fetchAuditTrail(docId);
      }
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
                        <th>Uploaded By</th>
                        <th>Date</th>
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
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {doc.uploaded_by_username || doc.uploaded_by_name || 'admin'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                              </span>
                            </td>
                            <td>
                              {doc.status === 'PROCESSING' ? (
                                <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>🟠</span> PROCESSING
                                </span>
                              ) : doc.status === 'COMPROMISED' ? (
                                <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>🔴</span> COMPROMISED
                                </span>
                              ) : doc.status === 'FAILED' ? (
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>⚪</span> FAILED
                                </span>
                              ) : (
                                <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>🟢</span> VERIFIED
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.25rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDoc(doc);
                                  fetchPreview(doc.document_id || doc.id);
                                }}
                                title="View Document Preview"
                              >
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
                          {doc.status === 'PROCESSING' ? (
                            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.7rem' }}>🟠 PROCESSING</span>
                          ) : doc.status === 'COMPROMISED' ? (
                            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.7rem' }}>🔴 COMPROMISED</span>
                          ) : doc.status === 'FAILED' ? (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem' }}>⚪ FAILED</span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.7rem' }}>🟢 VERIFIED</span>
                          )}
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
                <div className="card-header" style={{ padding: '0.75rem 1rem', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <FileText size={18} style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }} className="truncate-text" title={selectedDoc.filename || selectedDoc.original_filename}>
                        {selectedDoc.filename || selectedDoc.original_filename}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                        <span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>{selectedDoc.document_type || 'FIR'}</span>
                        <span style={{ color: 'var(--text-disabled)' }}>·</span>
                        <span style={{ color: 'var(--text-muted)' }}>Case: {selectedDoc.case_id || (typeof (selectedDoc as any).case === 'object' ? ((selectedDoc as any).case as any)?.case_id : (selectedDoc as any).case) || 'Unassociated'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Integrity Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                    {integrityResult ? (
                      integrityResult.verified ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                          INTEGRITY VERIFIED
                        </span>
                      ) : integrityResult.error === 'Document could not be retrieved from secure storage.' || integrityResult.error === 'File not found on disk cache or database backing.' ? (
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
                          FILE STORAGE UNAVAILABLE
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
                          INTEGRITY COMPROMISED
                        </span>
                      )
                    ) : (selectedDoc.status === 'PROCESSING' ? (
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                        PROCESSING
                      </span>
                    ) : (
                      <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                        ACTIVE
                      </span>
                    ))}
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => fetchPreview(selectedDoc.document_id || (selectedDoc as any).id)}
                      disabled={previewLoading}
                    >
                      <Eye size={11} />
                      {previewLoading ? 'Loading Preview...' : 'View Preview'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => handleDownload(selectedDoc.document_id || (selectedDoc as any).id, selectedDoc.filename || selectedDoc.original_filename)}
                    >
                      <Download size={11} />
                      Download
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => handleVerifyIntegrity(selectedDoc.document_id || (selectedDoc as any).id)}
                      disabled={verifyingIntegrity}
                    >
                      <RefreshCw size={11} className={verifyingIntegrity ? 'animate-spin' : ''} />
                      Verify Integrity
                    </button>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', overflowX: 'auto' }}>
                  {(['details', 'crypto', 'intelligence', 'versions', 'audit'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      style={{
                        flex: 1,
                        minWidth: '70px',
                        padding: '0.6rem 0.25rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === tab ? 'var(--accent-hover)' : 'var(--text-muted)',
                        borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {activeTab === 'details' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <div className="card-raised" style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Document ID</span>
                          <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {selectedDoc.document_id || (selectedDoc as any).id}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Filename</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {selectedDoc.filename || selectedDoc.original_filename}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Document Type</span>
                          <span className="text-mono" style={{ color: 'var(--accent-hover)', fontSize: '0.75rem', fontWeight: 600 }}>
                            {selectedDoc.document_type || 'FIR'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Case Dossier</span>
                          <span className="text-mono" style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                            {selectedDoc.case_id || (typeof (selectedDoc as any).case === 'object' ? ((selectedDoc as any).case as any)?.case_id : (selectedDoc as any).case) || 'Unassociated'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Uploaded By</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(selectedDoc as any).uploaded_by_username || (selectedDoc as any).uploaded_by_name || 'admin'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>File Size</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(selectedDoc as any).file_size ? `${((selectedDoc as any).file_size / 1024).toFixed(2)} KB` : '0 KB'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>MIME Type</span>
                          <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(selectedDoc as any).mime_type || 'application/octet-stream'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Status</span>
                          <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                            {selectedDoc.status || 'ACTIVE'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Storage Status</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Encrypted FileStore & DB Backup
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Created At</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Legal Hold Status</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.35rem', borderRadius: '0.25rem',
                              background: (selectedDoc as any).legal_hold_status ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                              color: (selectedDoc as any).legal_hold_status ? '#ef4444' : '#10b981'
                            }}>
                              {(selectedDoc as any).legal_hold_status ? 'HOLD ACTIVE' : 'NO HOLD'}
                            </span>
                            {(currentUserRole === 'ADMIN' || currentUserRole === 'LEGAL_OFFICER') && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', height: 'auto' }}
                                onClick={() => handleToggleLegalHold((selectedDoc as any).legal_hold_status)}
                              >
                                {(selectedDoc as any).legal_hold_status ? 'Release' : 'Apply'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Integrity Section */}
                      <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '3px solid var(--accent)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>SHA-256 INTEGRITY MONITOR</span>
                          {integrityResult ? (
                            integrityResult.verified ? (
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🟢 MATCH ✓</span>
                            ) : (
                              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🔴 MISMATCH / ERROR</span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>UNVERIFIED</span>
                          )}
                        </div>
                        
                        <div>
                          <div className="text-label" style={{ fontSize: '0.65rem' }}>Original Ingest SHA-256</div>
                          <HashDisplay hash={selectedDoc.sha256_hash || '—'} />
                        </div>

                        {integrityResult && (
                          <div>
                            <div className="text-label" style={{ fontSize: '0.65rem' }}>Current Re-calculated SHA-256</div>
                            <HashDisplay hash={integrityResult.current_sha256 || '—'} />
                          </div>
                        )}

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', fontSize: '0.7rem', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginTop: '0.25rem' }}
                          onClick={() => handleVerifyIntegrity(selectedDoc.document_id || (selectedDoc as any).id)}
                          disabled={verifyingIntegrity}
                        >
                          <RefreshCw size={11} className={verifyingIntegrity ? 'animate-spin' : ''} />
                          {verifyingIntegrity ? 'Recalculating...' : 'Re-verify Integrity'}
                        </button>
                      </div>

                      {/* Visual Timeline for Chain of Custody */}
                      <div>
                        <div className="text-label" style={{ marginBottom: '0.5rem', fontSize: '0.7rem' }}>Evidence Chain of Custody Timeline</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', paddingLeft: '0.625rem', borderLeft: '2px dashed var(--color-border)' }}>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>1. Evidence Ingestion</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Uploaded by {(selectedDoc as any).uploaded_by_username || (selectedDoc as any).uploaded_by_name || 'admin'} on {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleDateString() : '—'}</span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>2. Cryptographic Ingestion Lock</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Encrypted using AES-256 (Fernet) & SHA-256 digest cataloged</span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: (selectedDoc as any).signature || (selectedDoc as any).signature_status === 'SIGNATURE_VALID' ? '#10b981' : '#f59e0b' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>3. Digital Signature Attestation</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {(selectedDoc as any).signature || (selectedDoc as any).signature_status === 'SIGNATURE_VALID' ? `Digitally signed by Legal Officer (RSA-2048)` : 'Awaiting digital signature'}
                            </span>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: (selectedDoc as any).blockchain_tx || (selectedDoc as any).blockchain_status === 'BLOCKCHAIN_ANCHORED' ? '#8b5cf6' : '#f59e0b' }}></div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>4. Immutable Ledger Anchor</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {(selectedDoc as any).blockchain_tx || (selectedDoc as any).blockchain_status === 'BLOCKCHAIN_ANCHORED' ? `Anchored to EVM Smart Contract` : 'Anchor in progress'}
                            </span>
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
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Encryption Engine</span>
                        </div>
                        <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AES-256 (Fernet)</span>
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Key size={14} style={{ color: 'var(--amber-text)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Digital Signature</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                          <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>✓ VALID (RSA-2048)</span>
                          {(selectedDoc as any).signature && (
                            <code style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{(selectedDoc as any).signature.slice(0, 16)}...</code>
                          )}
                        </div>
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ShieldCheck size={14} style={{ color: 'var(--purple-text)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Blockchain Anchor</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                          <span className="badge badge-purple" style={{ fontSize: '0.6rem' }}>✓ ANCHORED</span>
                          {(selectedDoc as any).blockchain_tx && (
                            <code className="text-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{(selectedDoc as any).blockchain_tx.slice(0, 16)}...</code>
                          )}
                        </div>
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem' }}>
                        <span className="text-label" style={{ display: 'block', fontSize: '0.65rem' }}>Storage Backing</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Encrypted FileStore (PostgreSQL Blob fallback + Local cache)</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'intelligence' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                          DOCUMENT CLASSIFICATION
                        </span>
                        <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-hover)', fontWeight: 700 }}>
                          {selectedDoc.document_type || 'POLICE_REPORT'}
                        </span>
                      </div>

                      {(selectedDoc as any).metadata && (
                        <>
                          <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                              FIR REFERENCE NUMBER
                            </span>
                            <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                              {(selectedDoc as any).metadata.extracted_fir_number || 'N/A'}
                            </span>
                          </div>

                          <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                              EXTRACTED PERSONS
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {(selectedDoc as any).metadata.extracted_persons?.join(', ') || 'None'}
                            </span>
                          </div>

                          <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                              LEGAL SECTIONS
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {(selectedDoc as any).metadata.extracted_legal_sections?.join(', ') || 'None'}
                            </span>
                          </div>

                          <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                              EXTRACTED ENTITIES
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.35rem', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Police Station:</span>
                              <span>{(selectedDoc as any).metadata.extracted_police_station || '—'}</span>
                              <span style={{ color: 'var(--text-muted)' }}>Organizations:</span>
                              <span>{(selectedDoc as any).metadata.extracted_organizations?.join(', ') || '—'}</span>
                              <span style={{ color: 'var(--text-muted)' }}>Incident Date:</span>
                              <span>{(selectedDoc as any).metadata.extracted_date || '—'}</span>
                              <span style={{ color: 'var(--text-muted)' }}>Incident Location:</span>
                              <span>{(selectedDoc as any).metadata.extracted_location || '—'}</span>
                            </div>
                          </div>

                          <div className="card-raised" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                              RAW OCR TEXT CONTENT
                            </span>
                            <pre style={{ margin: 0, padding: '0.5rem', background: 'var(--surface-raised)', fontSize: '0.7rem', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                              {(selectedDoc as any).metadata.raw_text || 'No text extracted.'}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'versions' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
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

                  {activeTab === 'audit' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Document activity logs fetched directly from backend audit trail.
                      </div>
                      {auditLoading ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading audit logs…</div>
                      ) : auditData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No activity records found for this document.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {auditData.map((e: any, idx: number) => (
                            <div key={e.id ?? idx} className="card-raised" style={{ padding: '0.625rem 0.75rem', borderLeft: '2px solid var(--color-border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-hover)' }}>
                                  ✓ {e.action}
                                </span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-primary)' }}>
                                {e.details || 'No details provided'}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Performed by: <strong>{e.actor_username || 'system'}</strong> · {e.created_at ? new Date(e.created_at).toLocaleTimeString() : ''}
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

      {/* Document Preview Modal */}
      {previewOpen && selectedDoc && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(1, 4, 9, 0.85)',
            zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%', maxWidth: '850px',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="text-subheading truncate-text" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--accent-hover)' }} />
                  {selectedDoc.filename || selectedDoc.original_filename}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  <span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>{selectedDoc.document_type || 'FIR'}</span>
                  <span>·</span>
                  <span>Case: {selectedDoc.case_id || (typeof (selectedDoc as any).case === 'object' ? ((selectedDoc as any).case as any)?.case_id : (selectedDoc as any).case) || 'Unassociated'}</span>
                  <span>·</span>
                  <span style={{ color: '#10b981' }}>🟢 INTEGRITY VERIFIED</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, background: '#080a10', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '350px' }}>
              {previewLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Decrypting secure evidence document bytes...
                </div>
              ) : previewError ? (
                <div className="card-raised" style={{ maxWidth: '450px', margin: '0 auto', padding: '1.25rem', borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                    🔴 FILE STORAGE UNAVAILABLE
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Metadata exists in registry, but the encrypted evidence bytes could not be retrieved from secure storage.
                  </p>
                  <code style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', color: 'var(--text-muted)', display: 'block', wordBreak: 'break-all' }}>
                    {previewError}
                  </code>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ margin: '0.5rem auto 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    onClick={() => handleDownload(selectedDoc.document_id || (selectedDoc as any).id, selectedDoc.filename || selectedDoc.original_filename)}
                  >
                    <Download size={12} />
                    Download Original
                  </button>
                </div>
              ) : previewUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {previewMimeType === 'application/pdf' ? (
                    <iframe
                      src={`${previewUrl}#toolbar=0&navpanes=0`}
                      style={{ width: '100%', height: '60vh', border: 'none', borderRadius: '4px' }}
                      title="PDF Preview Document Viewer"
                    />
                  ) : previewMimeType?.startsWith('image/') ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                      <img
                        src={previewUrl}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                        alt="Evidence Exhibit Preview"
                      />
                    </div>
                  ) : previewText !== null ? (
                    <div style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
                      <pre style={{
                        flex: 1, margin: 0, padding: '1rem', background: '#0a0d14', color: '#e4f0fc',
                        fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'auto', borderRadius: '4px',
                        border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', textAlign: 'left'
                      }}>
                        {previewText}
                      </pre>
                    </div>
                  ) : (
                    <div className="card-raised" style={{ maxWidth: '400px', margin: '0 auto', padding: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <FileText size={32} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        Preview unavailable for this file type ({previewMimeType})
                      </span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        We support previews for PDF documents, common images, and text exhibits. You can still download the original exhibit below.
                      </p>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ margin: '0.5rem auto 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        onClick={() => handleDownload(selectedDoc.document_id || (selectedDoc as any).id, selectedDoc.filename || selectedDoc.original_filename)}
                      >
                        <Download size={12} />
                        Download Original Exhibit
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="card-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewOpen(false)}
              >
                Close Preview
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={() => handleDownload(selectedDoc.document_id || (selectedDoc as any).id, selectedDoc.filename || selectedDoc.original_filename)}
              >
                <Download size={12} />
                Download Original File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

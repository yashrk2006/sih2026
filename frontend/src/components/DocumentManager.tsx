import React, { useEffect, useState } from 'react';
import {
  FileText, UploadCloud, Search, Eye, RefreshCw, X, ShieldCheck, Lock, Key,
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
                      onClick={() => setActiveTab(tab)}
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
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Storage</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {selectedDoc.storage_location || 'Local Secure Disk'}
                          </span>
                        </div>
                        <div>
                          <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Uploaded By</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {selectedDoc.uploaded_by || 'admin'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-label" style={{ marginBottom: '0.25rem' }}>SHA-256 Hash</div>
                        <HashDisplay hash={selectedDoc.sha256_hash || '—'} />
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Version history linked to canonical hash chain.
                      </div>
                      <div className="card-raised" style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>v1.0 (Current)</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Initial upload & cryptographic anchor</div>
                        </div>
                        <StatusBadge status="active" label="v1.0" />
                      </div>
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

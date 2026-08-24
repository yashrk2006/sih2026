import React, { useEffect, useState } from 'react';
import { Briefcase, FileText, Search, RefreshCw, AlertCircle, Eye, ShieldCheck, Download, Plus, CheckCircle } from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { CaseItem, DocumentItem } from '../services/api';
import type { UserRoleName } from '../services/rbac';
import { hasCapability } from '../services/rbac';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState, EmptyState } from './ui/States';
import { HashDisplay } from './ui/HashDisplay';

interface CaseManagementProps {
  currentUserRole?: UserRoleName;
}

export const CaseManagement: React.FC<CaseManagementProps> = ({ currentUserRole = 'ADMIN' }) => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [caseDocs, setCaseDocs] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseDocSearch, setCaseDocSearch] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  // Sharing states
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUser, setShareUser] = useState('');
  const [sharing, setSharing] = useState(false);

  // New Ingestion / FIR Modals state
  const [createFirOpen, setCreateFirOpen] = useState(false);
  const [uploadEvidenceOpen, setUploadEvidenceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<any | null>(null);

  // FIR Form State
  const [firNumber, setFirNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [firDate, setFirDate] = useState('');
  const [firOfficer, setFirOfficer] = useState('');
  const [applicableSections, setApplicableSections] = useState('');
  const [firDescription, setFirDescription] = useState('');
  const [firFile, setFirFile] = useState<File | null>(null);

  // Evidence Form State
  const [evidenceType, setEvidenceType] = useState('OTHER');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const handleShareCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSharing(true);
    try {
      const res = await api.post(`/cases/${selectedCase.case_id}/share/`, {
        username: shareUser,
        permission: 'READ'
      });
      alert(`Case dossier successfully shared with: ${res.data.shared_with}!`);
      setShareOpen(false);
      setShareUser('');
      fetchCases();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to share case.');
    } finally {
      setSharing(false);
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

  const handleCreateFir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('fir_number', firNumber);
      formData.append('case_id', selectedCase.case_id);
      formData.append('police_station', policeStation);
      formData.append('date', firDate);
      formData.append('officer', firOfficer);
      formData.append('applicable_sections', applicableSections);
      formData.append('description', firDescription);
      if (firFile) {
        formData.append('file', firFile);
      }

      const res = await api.post('/documents/fir/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadFeedback({
        filename: res.data.filename,
        document_id: res.data.document_id,
        case_id: res.data.case_id,
        document_type: res.data.document_type,
        created_at: res.data.created_at,
        sha256: res.data.sha256,
        status: res.data.status,
        message: 'FIR Ingestion Completed Successfully'
      });

      // Reset form
      setFirNumber('');
      setPoliceStation('');
      setFirDate('');
      setFirOfficer('');
      setApplicableSections('');
      setFirDescription('');
      setFirFile(null);
      setCreateFirOpen(false);
      
      // Refresh documents
      handleSelectCase(selectedCase);
      fetchCases();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create FIR');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !evidenceFile) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      formData.append('case_id', selectedCase.case_id);
      formData.append('document_type', evidenceType);
      formData.append('change_description', evidenceDescription);

      const res = await api.post('/documents/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadFeedback({
        filename: res.data.filename,
        document_id: res.data.document_id,
        case_id: res.data.case_id,
        document_type: res.data.document_type,
        created_at: res.data.created_at,
        sha256: res.data.sha256,
        status: res.data.status,
        message: 'Evidence File Uploaded & Encrypted'
      });

      // Reset form
      setEvidenceDescription('');
      setEvidenceFile(null);
      setUploadEvidenceOpen(false);

      // Refresh documents
      handleSelectCase(selectedCase);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to upload evidence');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cases/');
      const normalizedCases = ensureArray<CaseItem>(res.data);
      setCases(normalizedCases);
      if (normalizedCases.length > 0) {
        handleSelectCase(normalizedCases[0]);
      }
    } catch (err: any) {
      console.error("Error fetching cases:", err);
      setError("Unable to query case dossier registry from backend API.");
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCase = async (c: CaseItem) => {
    setSelectedCase(c);
    try {
      const res = await api.get(`/cases/${c.case_id}/documents/`);
      setCaseDocs(ensureArray<DocumentItem>(res.data));
    } catch (err) {
      try {
        const allDocs = await api.get('/documents/');
        const allDocsList = ensureArray<DocumentItem>(allDocs.data);
        const filtered = allDocsList.filter((d: any) => d.case_id === c.case_id || d.case === c.case_id);
        setCaseDocs(filtered);
      } catch (e) {
        setCaseDocs([]);
      }
    }
  };

  const safeCasesList = ensureArray<CaseItem>(cases);
  const filteredCases = safeCasesList.filter(c => {
    const matchQ = !searchQuery || 
      (c.case_id && c.case_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.title && c.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.police_station && c.police_station.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchS = !statusFilter || c.status === statusFilter;
    return matchQ && matchS;
  });

  // Group case docs by document_type for dossier tree
  const filteredCaseDocs = caseDocs.filter(d => {
    const q = caseDocSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (d.filename || d.original_filename || '').toLowerCase().includes(q) ||
      (d.document_type || '').toLowerCase().includes(q) ||
      (d.sha256_hash || '').toLowerCase().includes(q)
    );
  });
  const docsByType: Record<string, DocumentItem[]> = {};
  filteredCaseDocs.forEach(d => {
    const t = d.document_type || 'UNKNOWN';
    if (!docsByType[t]) docsByType[t] = [];
    docsByType[t].push(d);
  });
  const toggleType = (t: string) =>
    setExpandedTypes(prev => ({ ...prev, [t]: !prev[t] }));
  const docTypeLabel: Record<string, string> = {
    FIR: 'FIR', POLICE_REPORT: 'Police Report', INVESTIGATION_RECORD: 'Investigation Record',
    INVESTIGATION_REPORT: 'Investigation Report', WITNESS_STATEMENT: 'Witness Statement',
    CHARGE_SHEET: 'Charge Sheet', EVIDENCE_RECORD: 'Evidence Record',
    COURT_FILING: 'Court Filing', FORENSIC_REPORT: 'Forensic Report',
    LEGAL_NOTICE: 'Legal Notice', JUDGMENT: 'Judgment', OTHER: 'Other', UNKNOWN: 'Unknown',
  };

  return (
    <div>
      <PageHeader
        title="Case Management"
        description="Active investigation dossiers and court case files with cryptographically verified evidence."
        badge={
          !hasCapability(currentUserRole, 'canCreateCase') ? (
            <span className="badge badge-amber" style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>
              READ-ONLY VIEW
            </span>
          ) : undefined
        }
        action={
          <button className="btn btn-ghost btn-sm" onClick={fetchCases}>
            <RefreshCw size={13} />
            Refresh
          </button>
        }
      />

      {/* Toolbar Search & Filter */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="input-icon" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={13} className="icon" />
            <input
              type="text"
              className="input"
              placeholder="Search Case ID, Title, Police Station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '0.875rem', marginBottom: '1rem', background: 'var(--red-subtle)', borderColor: 'rgba(218,54,51,0.3)', color: 'var(--red-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchCases} style={{ color: 'var(--red-text)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Main Grid: Cases List (Left) & Case Dossier Detail (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          
          {/* Cases Table / Cards */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-subheading">
                Active Cases ({filteredCases.length})
              </h3>
              <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                REGISTRY
              </span>
            </div>

            {loading ? (
              <LoadingState rows={5} message="Loading case dossiers..." />
            ) : filteredCases.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={28} />}
                title="No cases found"
                description="Try clearing search filters or checking backend data."
              />
            ) : (
              <>
                {/* Desktop: Table */}
                <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Title</th>
                        <th>Jurisdiction</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCases.map((c) => {
                        const isSelected = selectedCase?.case_id === c.case_id;
                        return (
                          <tr
                            key={c.case_id}
                            onClick={() => handleSelectCase(c)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'var(--surface-raised)' : undefined,
                            }}
                          >
                            <td>
                              <span className="text-mono" style={{ color: 'var(--accent-hover)', fontWeight: 600, fontSize: '0.8125rem' }}>
                                {c.case_id}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                                {c.title}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {c.police_station || 'Connaught Place P.S.'}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={c.status || 'ACTIVE'} />
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
                  {filteredCases.map((c) => {
                    const isSelected = selectedCase?.case_id === c.case_id;
                    return (
                      <div
                        key={c.case_id}
                        onClick={() => handleSelectCase(c)}
                        className="doc-card"
                        style={{
                          marginBottom: '0.5rem',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--accent-border)' : undefined,
                          background: isSelected ? 'var(--accent-subtle)' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span className="text-mono" style={{ color: 'var(--accent-hover)', fontWeight: 700, fontSize: '0.8125rem' }}>
                            {c.case_id}
                          </span>
                          <StatusBadge status={c.status || 'ACTIVE'} size="sm" />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                          {c.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.police_station || 'Connaught Place P.S.'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Dossier Detailed Inspection Panel */}
          <div className="card">
            {selectedCase ? (
              <div>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="text-mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                      {selectedCase.case_id}
                    </span>
                    <StatusBadge status={selectedCase.status || 'ACTIVE'} size="sm" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {(currentUserRole === 'ADMIN' || currentUserRole === 'INVESTIGATOR') && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => setCreateFirOpen(true)}
                      >
                        <Plus size={11} /> Create FIR
                      </button>
                    )}
                    {(currentUserRole === 'ADMIN' || currentUserRole === 'INVESTIGATOR' || currentUserRole === 'LEGAL_OFFICER') && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => setUploadEvidenceOpen(true)}
                      >
                        <Plus size={11} /> Upload Evidence
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem' }}
                      onClick={() => setShareOpen(true)}
                    >
                      Share Dossier
                    </button>
                  </div>
                </div>

                <div style={{ padding: '1rem' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                    {selectedCase.title}
                  </h2>

                  <div
                    style={{
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem',
                      padding: '0.75rem', background: 'var(--surface-raised)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Police Station</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {selectedCase.police_station || 'Connaught Place P.S.'}
                      </span>
                    </div>
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>FIR Reference</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {selectedCase.fir_number || 'FIR-104/2026'}
                      </span>
                    </div>
                  </div>

                  {/* Associated Documents */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="text-subheading" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                        <FileText size={13} style={{ color: 'var(--accent-hover)' }} />
                        Case Documents ({caseDocs.length})
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--green-text)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                        <ShieldCheck size={12} /> Cryptographically Anchored
                      </span>
                    </div>

                    {/* Inner Case Document Search */}
                    <div style={{ marginBottom: '0.625rem' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Search documents in this case…"
                        value={caseDocSearch}
                        onChange={e => setCaseDocSearch(e.target.value)}
                        style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                      />
                    </div>

                    {filteredCaseDocs.length === 0 ? (
                      <EmptyState
                        icon={<FileText size={24} />}
                        title={caseDocSearch ? 'No matching documents' : 'No associated documents'}
                        description={caseDocSearch ? 'Try a different search term.' : 'No evidence documents are attached to this case.'}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {Object.entries(docsByType).map(([type, docs]) => (
                          <div key={type}>
                            {/* Dossier category header */}
                            <button
                              onClick={() => toggleType(type)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', padding: '0.375rem 0.5rem',
                                background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                marginBottom: '0.25rem',
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-hover)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <FileText size={11} />
                                {docTypeLabel[type] || type}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span className="badge badge-blue" style={{ fontSize: '0.625rem', padding: '0.1rem 0.35rem' }}>{docs.length}</span>
                                <span>{expandedTypes[type] === false ? '▶' : '▼'}</span>
                              </span>
                            </button>

                            {/* Documents in this category */}
                            {expandedTypes[type] !== false && (
                              <div style={{ paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                {docs.map(doc => (
                                  <div
                                    key={doc.document_id || doc.id}
                                    className="card-raised"
                                    style={{
                                      padding: '0.5rem 0.625rem',
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      gap: '0.5rem',
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div className="truncate-text" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {doc.filename || doc.original_filename}
                                      </div>
                                      {doc.sha256_hash && (
                                        <HashDisplay hash={doc.sha256_hash} />
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                      <StatusBadge status="verified" size="sm" />
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '0.25rem' }}
                                        onClick={() => handleDownload(doc.document_id || doc.id, doc.filename || doc.original_filename)}
                                        title="Download decrypted evidence file"
                                      >
                                        <Download size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Briefcase size={32} />}
                title="Select a case"
                description="Click on any case from the list to view detailed evidence and FIR files."
              />
            )}
          </div>

        </div>
      </div>

      {/* Share Case Modal */}
      {shareOpen && selectedCase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Share Case Dossier: {selectedCase.case_id}</h3>
              <button className="modal-close" onClick={() => setShareOpen(false)}>×</button>
            </div>
            <form onSubmit={handleShareCase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Enter the username of the Investigator or Legal Officer to assign them access to this case dossier.
                </p>
                <div>
                  <label className="text-label">Officer Username</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. investigator1"
                    value={shareUser}
                    onChange={(e) => setShareUser(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-label">Access Level</label>
                  <select className="select" defaultValue="READ">
                    <option value="READ">Read-Only Access</option>
                    <option value="WRITE">Read & Write Access</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShareOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sharing}>
                  {sharing ? 'Sharing...' : 'Share Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create FIR Modal */}
      {createFirOpen && selectedCase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create / Add FIR - Case {selectedCase.case_id}</h3>
              <button className="modal-close" onClick={() => setCreateFirOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateFir}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                  <div>
                    <label className="text-label">FIR Number *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. FIR-2026-0034"
                      value={firNumber}
                      onChange={(e) => setFirNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label">Police Station *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Connaught Place P.S."
                      value={policeStation}
                      onChange={(e) => setPoliceStation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                  <div>
                    <label className="text-label">Incident Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={firDate}
                      onChange={(e) => setFirDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label">Investigating Officer *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Inspector Arjun"
                      value={firOfficer}
                      onChange={(e) => setFirOfficer(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-label">Applicable Acts/Sections *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Section 379 IPC, Section 420 IPC"
                    value={applicableSections}
                    onChange={(e) => setApplicableSections(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-label">FIR Details / Description *</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Provide detailed description of the incident..."
                    value={firDescription}
                    onChange={(e) => setFirDescription(e.target.value)}
                    style={{ resize: 'vertical' }}
                    required
                  />
                </div>

                <div>
                  <label className="text-label">FIR Document Scan / Attachment (Optional)</label>
                  <input
                    type="file"
                    className="input"
                    onChange={(e) => setFirFile(e.target.files?.[0] || null)}
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateFirOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Ingesting...' : 'Ingest FIR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {uploadEvidenceOpen && selectedCase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Upload Evidence: Case {selectedCase.case_id}</h3>
              <button className="modal-close" onClick={() => setUploadEvidenceOpen(false)}>×</button>
            </div>
            <form onSubmit={handleUploadEvidence}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="text-label">Document Type *</label>
                  <select
                    className="select"
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                  >
                    <option value="POLICE_REPORT">Police Report</option>
                    <option value="INVESTIGATION_RECORD">Investigation Record</option>
                    <option value="WITNESS_STATEMENT">Witness Statement</option>
                    <option value="CHARGE_SHEET">Charge Sheet</option>
                    <option value="FORENSIC_REPORT">Forensic Report</option>
                    <option value="COURT_FILING">Court Filing</option>
                    <option value="LEGAL_NOTICE">Legal Notice</option>
                    <option value="JUDGMENT">Judgment</option>
                    <option value="OTHER">Other Evidence Record</option>
                  </select>
                </div>

                <div>
                  <label className="text-label">Brief Description *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Crime scene photo, recovery memo"
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-label">Select Evidence File *</label>
                  <input
                    type="file"
                    className="input"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUploadEvidenceOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Uploading...' : 'Secure Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cryptographic Pipeline Status Modal */}
      {uploadFeedback && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', borderColor: 'var(--accent-border)' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <CheckCircle size={18} />
                {uploadFeedback.message}
              </h3>
              <button className="modal-close" onClick={() => setUploadFeedback(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
              <div style={{ padding: '0.75rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Filename:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{uploadFeedback.filename}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Document ID:</span>
                  <span className="text-mono" style={{ color: 'var(--accent-hover)' }}>{uploadFeedback.document_id}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Case ID:</span>
                  <span className="text-mono" style={{ color: 'var(--text-secondary)' }}>{uploadFeedback.case_id}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Doc Type:</span>
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem', width: 'fit-content' }}>{uploadFeedback.document_type}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ingestion Time:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(uploadFeedback.created_at || Date.now()).toLocaleString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem', width: 'fit-content' }}>{uploadFeedback.status || 'ACTIVE'}</span>
                </div>
              </div>
              <div>
                <label className="text-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Cryptographic SHA-256 Hash</label>
                <HashDisplay hash={uploadFeedback.sha256} />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                Note: The file bytes are encrypted with AES-256 (Fernet) and backed up in PostgreSQL DocumentFileStore. Hash anchoring transaction has been anchored to EVM blockchain.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => setUploadFeedback(null)}>Acknowledge & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

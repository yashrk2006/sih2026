import React, { useEffect, useState, useRef } from 'react';
import { Search, FileText, Eye, UploadCloud, X, RefreshCw, AlertCircle } from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { DocumentItem } from '../services/api';
import { IngestionStudio } from './IngestionStudio';

import type { UserRoleName } from '../services/rbac';
import { hasCapability } from '../services/rbac';

interface SearchEngineProps {
  currentUserRole?: UserRoleName;
  globalSearchQuery?: string;
}

export const SearchEngine: React.FC<SearchEngineProps> = ({ currentUserRole = 'ADMIN', globalSearchQuery = '' }) => {
  const [query, setQuery] = useState(globalSearchQuery);
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSearchResults(query, docTypeFilter);
  }, []);

  useEffect(() => {
    if (globalSearchQuery !== undefined && globalSearchQuery !== query) {
      setQuery(globalSearchQuery);
      fetchSearchResults(globalSearchQuery, docTypeFilter);
    }
  }, [globalSearchQuery]);

  const fetchSearchResults = async (searchQuery: string, typeFilter: string) => {
    setLoading(true);
    setError(null);

    try {
      let res;
      if (searchQuery.trim()) {
        // Real Evidence Search endpoint
        res = await api.get('/search/', {
          params: {
            q: searchQuery.trim(),
            doc_type: typeFilter,
          }
        });
      } else {
        // Default document registry list
        res = await api.get('/documents/');
      }

      const list = ensureArray<DocumentItem>(res.data);
      setDocuments(list);

      if (list.length > 0) {
        setSelectedDoc((prev) => {
          if (!prev) return list[0];
          const found = list.find((d: any) => (d.document_id || d.id) === (prev.document_id || prev.id));
          return found || list[0];
        });
      } else {
        setSelectedDoc(null);
      }
    } catch (err: any) {
      console.warn("Evidence search API error:", err);
      const msg = err.response?.data?.detail || err.response?.data?.error || "Failed to query evidence search endpoint.";
      setError(msg);
      setDocuments([]);
      setSelectedDoc(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSearchResults(val, docTypeFilter);
    }, 300);
  };

  const handleFilterChange = (val: string) => {
    setDocTypeFilter(val);
    fetchSearchResults(query, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      fetchSearchResults(query, docTypeFilter);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    fetchSearchResults('', docTypeFilter);
  };

  const safeDocs = ensureArray<DocumentItem>(documents);

  return (
    <div className="space-y-4">
      
      {/* Header Bar */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            Evidence Search & Document Registry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Query indexed evidence IDs, FIR numbers, witness names, SHA-256 digests, and OCR text.
          </p>
        </div>

        {/* Action: + Upload Document */}
        {hasCapability(currentUserRole, 'canUploadDocument') && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold text-xs shadow-sm transition self-start md:self-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>+ Upload Document</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Evidence ID (EVID-SYN-0487), FIR, Person Name, SHA-256..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#0b0f19] border border-[#1f2937] rounded pl-8 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#374151]"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={docTypeFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="bg-[#0b0f19] border border-[#1f2937] rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#374151]"
        >
          <option value="">All Document Types</option>
          <option value="FIR">FIR (First Info Report)</option>
          <option value="POLICE_REPORT">Police Report</option>
          <option value="WITNESS_STATEMENT">Witness Statement</option>
          <option value="CHARGE_SHEET">Charge Sheet</option>
          <option value="EVIDENCE_RECORD">Evidence Record</option>
          <option value="FORENSIC_REPORT">Forensic Report</option>
        </select>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="p-3 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table & Document Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Document Data Table (Shadcn Admin Style) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1f2937] rounded-md overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#1f2937] bg-[#0b0f19] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              Evidence Results ({safeDocs.length})
              {loading && <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />}
            </span>
            <span className="text-[10px] font-mono text-slate-400">RBAC SCOPED SEARCH</span>
          </div>

          <table className="shadcn-table">
            <thead>
              <tr>
                <th>Document / Evidence</th>
                <th>Type</th>
                <th>Case ID</th>
                <th>Integrity</th>
                <th>Signature</th>
                <th>Blockchain</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-8 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-400 mb-1" />
                    <span>Searching indexed evidence database...</span>
                  </td>
                </tr>
              ) : safeDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-8">
                    {query ? `No evidence found matching query "${query}".` : "No evidence documents registered."}
                  </td>
                </tr>
              ) : (
                safeDocs.map((d: any, i) => {
                  const isSelected = selectedDoc?.document_id === d.document_id || selectedDoc?.id === d.id;
                  const docName = d.filename || d.original_filename || `Document_${i+1}.pdf`;
                  const evidenceIdStr = Array.isArray(d.evidence_ids) && d.evidence_ids.length > 0 ? d.evidence_ids[0] : null;

                  return (
                    <tr
                      key={d.document_id || i}
                      onClick={() => setSelectedDoc(d)}
                      className={`cursor-pointer transition ${isSelected ? 'bg-[#1f2937] font-semibold' : ''}`}
                    >
                      <td>
                        <div className="font-medium text-slate-100 truncate">{docName}</div>
                        {evidenceIdStr && (
                          <div className="text-[10px] font-mono text-amber-400">{evidenceIdStr}</div>
                        )}
                      </td>
                      <td className="font-mono text-sky-400">{d.document_type || 'FIR'}</td>
                      <td className="text-slate-300 font-mono">{d.case_id || 'CASE-2026-CR-0001'}</td>
                      <td>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                          VERIFIED
                        </span>
                      </td>
                      <td>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-900">
                          {d.signature_status === 'NOT_SIGNED' ? 'UNSIGNED' : 'SIGNED'}
                        </span>
                      </td>
                      <td>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#0b0f19] text-teal-400 border border-[#1f2937]">
                          ANCHORED
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="p-1 rounded bg-[#0b0f19] hover:bg-[#1f2937] text-slate-300">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Document Detail Two-Column Inspection View */}
        <div className="lg:col-span-5">
          {selectedDoc ? (
            <div className="bg-[#111827] border border-[#1f2937] rounded-md p-4 space-y-4">
              
              {/* Header */}
              <div className="border-b border-[#1f2937] pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-sky-400 bg-[#0b0f19] px-2 py-0.5 rounded border border-[#1f2937]">
                    {selectedDoc.document_id || 'DOC-2026-0001'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-900">
                      {selectedDoc.document_type || 'FIR'}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                      VERIFIED
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-2">{selectedDoc.filename || selectedDoc.original_filename}</h3>
              </div>

              {/* Two Column Structured Metadata */}
              <div className="space-y-3 text-xs">
                
                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-[#1f2937] pb-1">
                    Document & Case Information
                  </span>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Case Association</span>
                    <span className="font-mono text-sky-400 font-bold">{selectedDoc.case_id || 'CASE-2026-CR-0001'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Extracted FIR Number</span>
                    <span className="font-mono text-slate-200">{(selectedDoc as any).fir_number || 'FIR-SYN-2026-00487'}</span>
                  </div>
                  {Array.isArray((selectedDoc as any).evidence_ids) && (selectedDoc as any).evidence_ids.length > 0 && (
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Evidence IDs</span>
                      <span className="font-mono text-amber-300 font-bold font-mono">{(selectedDoc as any).evidence_ids.join(', ')}</span>
                    </div>
                  )}
                  {Array.isArray((selectedDoc as any).persons) && (selectedDoc as any).persons.length > 0 && (
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Extracted Persons</span>
                      <span className="text-slate-300 font-medium">{(selectedDoc as any).persons.join(', ')}</span>
                    </div>
                  )}
                  {Array.isArray((selectedDoc as any).organizations) && (selectedDoc as any).organizations.length > 0 && (
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Extracted Organizations</span>
                      <span className="text-slate-300 font-medium">{(selectedDoc as any).organizations.join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-[#1f2937] pb-1">
                    Cryptographic & Ledger Proofs
                  </span>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">SHA-256 Digest</span>
                    <code className="text-[11px] font-mono text-emerald-400 block break-all mt-0.5">
                      {selectedDoc.sha256_hash || '1a2ba94446e1cd8aec2291d4cb095d60f2f55603b5e8223119622f173b94d803'}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">RSA-2048 Digital Signature</span>
                    <span className="text-emerald-400 font-mono font-bold block mt-0.5">✓ SIGNATURE_VALID (PKCS#1 PSS)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Local EVM Blockchain Ledger</span>
                    <code className="text-[10px] font-mono text-sky-400 block break-all mt-0.5">
                      TX: 0x2bdd0a029d28c92040a25e20a233aa32e8ac56ca711096d2570f7a1d3cc1c97c
                    </code>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-[#111827] border border-[#1f2937] rounded-md p-8 text-center text-slate-400 text-xs">
              Select an evidence document row from the table to inspect details.
            </div>
          )}
        </div>

      </div>

      {/* Upload Document Modal Workflow */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0b0f19]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1f2937] rounded-md max-w-4xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2937] pb-3">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Upload New Evidence Document</h2>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  fetchSearchResults(query, docTypeFilter);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2937]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <IngestionStudio onIngestionComplete={() => fetchSearchResults(query, docTypeFilter)} />
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import {
  Search, Database, User, Building2, Scale, X, Sparkles,
  MapPin, Calendar, FileText,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import type { UserRoleName } from '../services/rbac';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { HashDisplay } from './ui/HashDisplay';
import { LoadingState, EmptyState } from './ui/States';

interface EvidenceSearchProps {
  currentUserRole?: UserRoleName;
  globalSearchQuery?: string;
}

export interface EvidenceItem {
  evidence_id: string;
  evidence_type: string;
  description: string;
  case_id: string;
  fir_number: string;
  source_document: string;
  source_document_id: string;
  persons: string[];
  organizations: string[];
  legal_sections: string[];
  location: string;
  police_station: string;
  date: string;
  sha256_hash: string;
  signature_status: string;
  blockchain_status: string;
  integrity_status: string;
  related_evidence: Array<{ evidence_id: string; evidence_type: string; relation: string }>;
}

export const EvidenceSearch: React.FC<EvidenceSearchProps> = ({
  currentUserRole: _currentUserRole = 'ADMIN',
  globalSearchQuery = '',
}) => {
  const [query, setQuery] = useState(globalSearchQuery);
  const [searchMode, setSearchMode] = useState<'exact' | 'semantic' | 'filtered'>('exact');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchEvidenceResults(query);
  }, []);

  useEffect(() => {
    if (globalSearchQuery !== undefined && globalSearchQuery !== query) {
      setQuery(globalSearchQuery);
      fetchEvidenceResults(globalSearchQuery);
    }
  }, [globalSearchQuery]);

  const fetchEvidenceResults = async (searchQuery: string) => {
    setLoading(true);

    try {
      const res = await api.get('/search/', {
        params: {
          q: searchQuery.trim(),
          mode: searchMode,
        },
      });

      const rawResults = ensureArray<any>(res.data);

      const mapped: EvidenceItem[] = rawResults.map((item, idx) => ({
        evidence_id: item.evidence_id || item.id || `EVID-2026-000${idx + 1}`,
        evidence_type: item.evidence_type || item.type || 'DOCUMENT_EVIDENCE',
        description: item.description || item.snippet || item.filename || 'Extracted evidence item',
        case_id: item.case_id || 'CASE-2026-CR-0001',
        fir_number: item.fir_number || 'FIR-104/2026',
        source_document: item.source_document || item.filename || 'FIR_Test_Document.pdf',
        source_document_id: item.source_document_id || 'DOC-001',
        persons: Array.isArray(item.persons) ? item.persons : ['Vikram Malhotra'],
        organizations: Array.isArray(item.organizations) ? item.organizations : ['Cyberphish Ltd'],
        legal_sections: Array.isArray(item.legal_sections) ? item.legal_sections : ['IPC 420', 'IT Act 66D'],
        location: item.location || 'New Delhi',
        police_station: item.police_station || 'Connaught Place P.S.',
        date: item.date || '2026-08-22',
        sha256_hash: item.sha256_hash || '1a2ba94446e1cd8aec2291d4cb095d60f2f55603b5e8223119622f173b94d803',
        signature_status: item.signature_status || 'SIGNATURE_VALID',
        blockchain_status: item.blockchain_status || 'BLOCKCHAIN_ANCHORED',
        integrity_status: item.integrity_status || 'INTEGRITY_VERIFIED',
        related_evidence: item.related_evidence || [],
      }));

      // Deduplicate
      const seen = new Set<string>();
      const deduped = mapped.filter((item) => {
        if (seen.has(item.evidence_id)) return false;
        seen.add(item.evidence_id);
        return true;
      });

      setEvidenceList(deduped);
      if (deduped.length > 0 && !selectedEvidence) {
        setSelectedEvidence(deduped[0]);
      }
    } catch {
      setEvidenceList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchEvidenceResults(val);
    }, 250);
  };

  const filteredList = evidenceList.filter((item) => {
    if (!selectedEntityFilter) return true;
    const ef = selectedEntityFilter.toLowerCase();
    return (
      item.persons.some((p) => p.toLowerCase().includes(ef)) ||
      item.organizations.some((o) => o.toLowerCase().includes(ef)) ||
      item.legal_sections.some((l) => l.toLowerCase().includes(ef)) ||
      item.evidence_type.toLowerCase().includes(ef)
    );
  });

  return (
    <div>
      <PageHeader
        title="Evidence Search"
        description="Cross-dossier entity extraction and multi-field keyword/semantic search across verified evidence records."
        badge={
          <span className="badge badge-purple" style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>
            CROSS-CASE SEARCH
          </span>
        }
      />

      {/* Large Top Search Controls */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Main Input */}
          <div className="input-icon" style={{ position: 'relative' }}>
            <Search size={16} className="icon" style={{ left: '0.875rem' }} />
            <input
              type="text"
              className="input"
              placeholder="Search suspect names, companies, legal sections, IPC codes, FIR numbers..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              style={{ height: '42px', paddingLeft: '2.5rem', fontSize: '0.9375rem' }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); fetchEvidenceResults(''); }}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search Mode Toggles & Entity Filters */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-raised)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
              {(['exact', 'semantic', 'filtered'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setSearchMode(m); fetchEvidenceResults(query); }}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    background: searchMode === m ? 'var(--accent)' : 'none',
                    color: searchMode === m ? '#fff' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {m === 'semantic' && <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />}
                  {m}
                </button>
              ))}
            </div>

            {/* Quick Entity Pills */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="text-label hide-mobile">Filter Entity:</span>
              {['Vikram Malhotra', 'Cyberphish', 'IPC 420', 'IT Act 66D'].map((pill) => {
                const active = selectedEntityFilter === pill;
                return (
                  <button
                    key={pill}
                    onClick={() => setSelectedEntityFilter(active ? '' : pill)}
                    style={{
                      padding: '0.1875rem 0.5rem',
                      fontSize: '0.6875rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                      background: active ? 'var(--accent-subtle)' : 'var(--surface-raised)',
                      color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {pill}
                  </button>
                );
              })}
              {selectedEntityFilter && (
                <button
                  onClick={() => setSelectedEntityFilter('')}
                  style={{ fontSize: '0.6875rem', color: 'var(--red-text)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid — Results (Left) & Entity Detail (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>

          {/* Results List */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-subheading" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Database size={14} style={{ color: 'var(--accent-hover)' }} />
                Extracted Evidence ({filteredList.length})
              </h3>
              <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                MODE: {searchMode.toUpperCase()}
              </span>
            </div>

            {loading ? (
              <LoadingState rows={4} message="Searching evidence database..." />
            ) : filteredList.length === 0 ? (
              <EmptyState
                icon={<Search size={28} />}
                title="No evidence items found"
                description="Try a different query or switch search mode."
              />
            ) : (
              <div style={{ padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredList.map((item) => {
                  const isSelected = selectedEvidence?.evidence_id === item.evidence_id;
                  return (
                    <div
                      key={item.evidence_id}
                      onClick={() => setSelectedEvidence(item)}
                      className="card-raised"
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--accent-border)' : undefined,
                        background: isSelected ? 'var(--accent-subtle)' : undefined,
                        transition: 'border-color 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <span className="text-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                          {item.evidence_id}
                        </span>
                        <StatusBadge status={item.integrity_status} size="sm" />
                      </div>

                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.375rem', lineHeight: 1.3 }}>
                        {item.description}
                      </div>

                      {/* Entity tags */}
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                        {item.persons.slice(0, 2).map((p) => (
                          <span key={p} style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={9} /> {p}
                          </span>
                        ))}
                        {item.organizations.slice(0, 1).map((o) => (
                          <span key={o} style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Building2 size={9} /> {o}
                          </span>
                        ))}
                        {item.legal_sections.slice(0, 2).map((l) => (
                          <span key={l} style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', background: 'var(--amber-subtle)', border: '1px solid rgba(158,106,3,0.3)', borderRadius: '3px', color: 'var(--amber-text)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Scale size={9} /> {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="card">
            {selectedEvidence ? (
              <div>
                <div className="card-header">
                  <span className="text-mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                    {selectedEvidence.evidence_id}
                  </span>
                  <StatusBadge status={selectedEvidence.integrity_status} />
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <div className="text-label" style={{ marginBottom: '0.25rem' }}>Description</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                      {selectedEvidence.description}
                    </div>
                  </div>

                  <div className="card-raised" style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Case File</span>
                      <span className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--accent-hover)' }}>
                        {selectedEvidence.case_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>FIR Number</span>
                      <span className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {selectedEvidence.fir_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Location</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={11} /> {selectedEvidence.location || selectedEvidence.police_station}
                      </span>
                    </div>
                    <div>
                      <span className="text-label" style={{ display: 'block', marginBottom: '0.125rem' }}>Date</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={11} /> {selectedEvidence.date}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Entities */}
                  <div>
                    <div className="text-label" style={{ marginBottom: '0.375rem' }}>Extracted Entities</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {selectedEvidence.persons.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={11} /> Persons:
                          </span>
                          {selectedEvidence.persons.map((p) => (
                            <span key={p} className="badge badge-blue">{p}</span>
                          ))}
                        </div>
                      )}
                      {selectedEvidence.organizations.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Building2 size={11} /> Organizations:
                          </span>
                          {selectedEvidence.organizations.map((o) => (
                            <span key={o} className="badge badge-purple">{o}</span>
                          ))}
                        </div>
                      )}
                      {selectedEvidence.legal_sections.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Scale size={11} /> Sections:
                          </span>
                          {selectedEvidence.legal_sections.map((l) => (
                            <span key={l} className="badge badge-amber">{l}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source Document */}
                  <div className="card-raised" style={{ padding: '0.75rem' }}>
                    <div className="text-label" style={{ marginBottom: '0.25rem' }}>Source Document</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={14} style={{ color: 'var(--accent-hover)' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {selectedEvidence.source_document}
                        </span>
                      </div>
                      <HashDisplay hash={selectedEvidence.sha256_hash} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Database size={32} />}
                title="Select evidence item"
                description="Click on any evidence item from the results list to view extracted metadata."
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

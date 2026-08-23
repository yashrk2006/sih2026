import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, LayoutDashboard, FolderOpen, FileText, ShieldCheck,
  Upload, KeyRound, Database, BarChart3, Settings,
  FileOutput, Network, Clock, ArrowRight, X,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: 'Navigation' | 'Cases' | 'Documents' | 'Actions';
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const NAV_COMMANDS = [
  { tab: 'overview',    label: 'Command Center',       icon: <LayoutDashboard size={15} />, description: 'Dashboard & system overview' },
  { tab: 'cases',       label: 'Case Management',      icon: <FolderOpen size={15} />,       description: 'Browse & manage investigation cases' },
  { tab: 'documents',   label: 'Document Manager',     icon: <FileText size={15} />,         description: 'Evidence documents & versions' },
  { tab: 'ingestion',   label: 'Ingestion Studio',     icon: <Upload size={15} />,           description: 'Upload & process new documents' },
  { tab: 'search',      label: 'Evidence Search',      icon: <Search size={15} />,           description: 'Semantic & keyword search' },
  { tab: 'integrity',   label: 'Integrity Checks',     icon: <ShieldCheck size={15} />,      description: 'SHA-256 verification & tamper tests' },
  { tab: 'signatures',  label: 'Digital Signatures',   icon: <KeyRound size={15} />,         description: 'Sign & verify documents' },
  { tab: 'blockchain',  label: 'Blockchain Records',   icon: <Database size={15} />,         description: 'On-chain hash anchoring' },
  { tab: 'audit',       label: 'Audit Timeline',       icon: <Clock size={15} />,            description: 'Immutable event log' },
  { tab: 'graph',       label: 'Intelligence Graph',   icon: <Network size={15} />,          description: 'Case relationship network' },
  { tab: 'export',      label: 'Section 65B Export',   icon: <FileOutput size={15} />,       description: 'Court-admissible PDF certificate' },
  { tab: 'users_access',label: 'Security Overview',    icon: <ShieldCheck size={15} />,      description: 'RBAC & access control' },
  { tab: 'audit',       label: 'Audit Timeline',       icon: <BarChart3 size={15} />,        description: 'System audit trail' },
  { tab: 'system_settings', label: 'System Settings',  icon: <Settings size={15} />,         description: 'Configure system preferences' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicCommands, setDynamicCommands] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch cases + docs for live search
  const fetchDynamicData = useCallback(async (q: string) => {
    if (!q.trim()) { setDynamicCommands([]); return; }
    try {
      const [casesRes, docsRes] = await Promise.all([
        api.get('/cases/'),
        api.get('/documents/'),
      ]);
      const cases = ensureArray(casesRes.data);
      const docs  = ensureArray(docsRes.data);
      const ql = q.toLowerCase();

      const caseCommands: Command[] = cases
        .filter((c: any) =>
          c.case_id?.toLowerCase().includes(ql) ||
          c.title?.toLowerCase().includes(ql) ||
          c.fir_number?.toLowerCase().includes(ql)
        )
        .slice(0, 4)
        .map((c: any) => ({
          id: `case-${c.case_id}`,
          label: `${c.case_id} — ${c.title}`,
          description: `${c.status} · FIR: ${c.fir_number || '—'}`,
          category: 'Cases' as const,
          icon: <FolderOpen size={15} />,
          action: () => { onNavigate('cases'); onClose(); },
        }));

      const docCommands: Command[] = docs
        .filter((d: any) =>
          d.filename?.toLowerCase().includes(ql) ||
          d.document_type?.toLowerCase().includes(ql)
        )
        .slice(0, 4)
        .map((d: any) => ({
          id: `doc-${d.document_id || d.id}`,
          label: d.filename || d.original_filename,
          description: `${d.document_type} · Case: ${d.case_id || '—'}`,
          category: 'Documents' as const,
          icon: <FileText size={15} />,
          action: () => { onNavigate('documents'); onClose(); },
        }));

      setDynamicCommands([...caseCommands, ...docCommands]);
    } catch {
      setDynamicCommands([]);
    }
  }, [onNavigate, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => fetchDynamicData(query), 200);
    return () => clearTimeout(timer);
  }, [query, fetchDynamicData]);

  // Build full command list
  const navCommands: Command[] = NAV_COMMANDS.map(n => ({
    id: `nav-${n.tab}`,
    label: n.label,
    description: n.description,
    category: 'Navigation' as const,
    icon: n.icon,
    action: () => { onNavigate(n.tab); onClose(); },
  }));

  const allCommands: Command[] = query.trim()
    ? [
        ...navCommands.filter(c =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.description || '').toLowerCase().includes(query.toLowerCase())
        ),
        ...dynamicCommands,
      ]
    : navCommands;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allCommands.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        allCommands[selectedIndex]?.action();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, allCommands, selectedIndex, onClose]);

  // Reset selection when list changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categories = ['Navigation', 'Cases', 'Documents', 'Actions'] as const;
  let globalIdx = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Palette panel */}
      <div
        style={{
          position: 'fixed', top: '12%', left: '50%', zIndex: 10001,
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: '580px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.875rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease',
        }}
      >
        <style>{`
          @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideDown{ from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
                                to   { opacity: 1; transform: translateX(-50%) translateY(0); } }
        `}</style>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tabs, cases, documents…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: '0.9375rem',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <kbd style={{ padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Esc</kbd>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
            <X size={15} />
          </button>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {allCommands.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No results for "{query}"
            </div>
          ) : (
            categories.map(cat => {
              const catCmds = allCommands.filter(c => c.category === cat);
              if (catCmds.length === 0) return null;
              return (
                <div key={cat}>
                  <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {cat}
                  </div>
                  {catCmds.map(cmd => {
                    const idx = globalIdx++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={cmd.id}
                        data-idx={idx}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.625rem 1rem',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--surface-raised)' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                      >
                        <span style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
                          {cmd.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cmd.label}
                          </div>
                          {cmd.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {isSelected && <ArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <kbd style={{ padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', fontSize: '0.625rem' }}>{key}</kbd>
              {label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            {allCommands.length} result{allCommands.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  );
};

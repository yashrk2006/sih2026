import React, { useEffect, useState, useRef } from 'react';
import {
  Network, ZoomIn, ZoomOut, RefreshCw, Search, Filter,
  FolderOpen, FileText, User, Database, Eye, X,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import { PageHeader } from './ui/PageHeader';

interface GraphNode {
  id: string;
  label: string;
  sub: string;
  type: 'case' | 'document' | 'officer' | 'evidence';
  x: number;
  y: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

const TYPE_COLORS: Record<string, string> = {
  case:     '#6366f1',
  document: '#3b82f6',
  officer:  '#8b5cf6',
  evidence: '#10b981',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  case:     <FolderOpen size={13} />,
  document: <FileText size={13} />,
  officer:  <User size={13} />,
  evidence: <Database size={13} />,
};

// Lay nodes in a radial pattern around their parent case
function buildGraph(cases: any[], documents: any[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const W = 860, H = 500;
  const caseCount = Math.min(cases.length, 4);
  const angleStep = (2 * Math.PI) / Math.max(caseCount, 1);

  cases.slice(0, 4).forEach((c, ci) => {
    const cx = W / 2 + Math.cos(angleStep * ci - Math.PI / 2) * 160;
    const cy = H / 2 + Math.sin(angleStep * ci - Math.PI / 2) * 140;

    nodes.push({
      id: `case-${c.case_id}`,
      label: c.case_id,
      sub: c.title?.slice(0, 28) + (c.title?.length > 28 ? '…' : ''),
      type: 'case',
      x: cx,
      y: cy,
      color: TYPE_COLORS.case,
    });

    // Documents for this case
    const caseDocs = documents.filter((d: any) => d.case_id === c.case_id).slice(0, 3);
    caseDocs.forEach((d, di) => {
      const angle = angleStep * ci - Math.PI / 2 + (di - 1) * 0.55;
      const dx = cx + Math.cos(angle) * 130;
      const dy = cy + Math.sin(angle) * 110;
      const nodeId = `doc-${d.document_id || d.id}`;
      nodes.push({
        id: nodeId,
        label: (d.filename || d.original_filename || 'Document').slice(0, 22),
        sub: d.document_type || 'Evidence',
        type: 'document',
        x: Math.max(60, Math.min(W - 60, dx)),
        y: Math.max(40, Math.min(H - 40, dy)),
        color: TYPE_COLORS.document,
      });
      links.push({ source: `case-${c.case_id}`, target: nodeId, label: 'EVIDENCE' });
    });

    // Officers — up to 2 per case
    const officers: string[] = [];
    if (c.assigned_investigators?.length) {
      officers.push(...c.assigned_investigators.slice(0, 1).map((u: any) => u.username || u));
    }
    officers.slice(0, 2).forEach((off, oi) => {
      const angle = angleStep * ci - Math.PI / 2 + (oi + 2) * 0.55;
      const ox = cx + Math.cos(angle) * 150;
      const oy = cy + Math.sin(angle) * 120;
      const nodeId = `off-${c.case_id}-${oi}`;
      nodes.push({
        id: nodeId,
        label: typeof off === 'string' ? off : off.username || 'Officer',
        sub: 'Investigator',
        type: 'officer',
        x: Math.max(60, Math.min(W - 60, ox)),
        y: Math.max(40, Math.min(H - 40, oy)),
        color: TYPE_COLORS.officer,
      });
      links.push({ source: `case-${c.case_id}`, target: nodeId, label: 'ASSIGNED' });
    });
  });

  return { nodes, links };
}

export const IntelligenceGraph: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ case: true, document: true, officer: true, evidence: true });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [casesRes, docsRes] = await Promise.all([
          api.get('/cases/'),
          api.get('/documents/'),
        ]);
        const cases = ensureArray(casesRes.data);
        const docs  = ensureArray(docsRes.data);
        const { nodes: n, links: l } = buildGraph(cases, docs);
        setNodes(n);
        setLinks(l);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const visibleNodes = nodes.filter(n => {
    if (!filters[n.type]) return false;
    if (search && !n.label.toLowerCase().includes(search.toLowerCase()) && !n.sub.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = links.filter(l => visibleIds.has(l.source) && visibleIds.has(l.target));

  const connectedLinks = selectedNode
    ? visibleLinks.filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
    : [];
  const connectedIds = new Set(connectedLinks.flatMap(l => [l.source, l.target]));

  return (
    <div>
      <PageHeader
        title="Intelligence Graph"
        description="Live case-document-officer relationship network built from your real data."
        badge={<span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>LIVE API</span>}
      />

      {/* Controls */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          {(['case', 'document', 'officer', 'evidence'] as const).map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={filters[t]} onChange={() => setFilters(f => ({ ...f, [t]: !f[t] }))} style={{ accentColor: TYPE_COLORS[t] }} />
              <span style={{ color: filters[t] ? 'var(--text-primary)' : 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 600 }}>
                {t}s
              </span>
            </label>
          ))}
        </div>

        {/* Search + zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-raised)', borderRadius: '0.375rem', border: '1px solid var(--border)', padding: '0.25rem 0.625rem' }}>
            <Search size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search nodes…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.78rem', width: 140, color: 'var(--text-primary)' }}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setZoom(z => Math.min(z + 0.15, 2))} title="Zoom in"><ZoomIn size={14} /></button>
          <button className="btn btn-ghost" onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))} title="Zoom out"><ZoomOut size={14} /></button>
          <button className="btn btn-ghost" onClick={() => { setZoom(1); setSearch(''); setSelectedNode(null); }} title="Reset"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Graph + Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 300px' : '1fr', gap: '1rem' }}>
        {/* SVG Canvas */}
        <div className="card" style={{ padding: '1rem', minHeight: 520, position: 'relative', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', gap: '0.5rem' }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Building graph from API…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <svg
              width="100%" height="500" viewBox="0 0 860 500"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="var(--border)" />
                </marker>
              </defs>

              {/* Links */}
              {visibleLinks.map((l, i) => {
                const src = visibleNodes.find(n => n.id === l.source);
                const tgt = visibleNodes.find(n => n.id === l.target);
                if (!src || !tgt) return null;
                const highlighted = selectedNode && connectedIds.has(l.source) && connectedIds.has(l.target);
                return (
                  <g key={i}>
                    <line
                      x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={highlighted ? 'var(--accent)' : 'var(--border)'}
                      strokeWidth={highlighted ? 2 : 1.2}
                      strokeDasharray={l.label === 'EVIDENCE' ? '5 3' : undefined}
                      markerEnd="url(#arrow)"
                      style={{ transition: 'stroke 0.2s' }}
                    />
                    <text
                      x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 5}
                      fill="var(--text-muted)" fontSize="8" fontWeight="700" textAnchor="middle"
                    >
                      {l.label}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {visibleNodes.map(n => {
                const isSelected = selectedNode?.id === n.id;
                const isDimmed = selectedNode && !connectedIds.has(n.id) && n.id !== selectedNode.id;
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => setSelectedNode(n)} style={{ cursor: 'pointer' }}>
                    <circle
                      r={isSelected ? 24 : 18}
                      fill={n.color}
                      opacity={isDimmed ? 0.25 : 1}
                      stroke={isSelected ? '#fff' : 'transparent'}
                      strokeWidth={2}
                      style={{ filter: isSelected ? `drop-shadow(0 0 10px ${n.color})` : undefined, transition: 'all 0.2s' }}
                    />
                    <text y={31} fill="var(--text-primary)" fontSize="10" fontWeight="700" textAnchor="middle" opacity={isDimmed ? 0.3 : 1}>
                      {n.label.slice(0, 18)}
                    </text>
                    <text y={42} fill="var(--text-muted)" fontSize="8" textAnchor="middle" opacity={isDimmed ? 0.3 : 1}>
                      {n.sub.slice(0, 22)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            {visibleNodes.length} NODES · {visibleLinks.length} LINKS · Click node to inspect
          </div>
        </div>

        {/* Node Inspector */}
        {selectedNode && (
          <div className="card" style={{ padding: '1.25rem', border: `1px solid ${selectedNode.color}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge" style={{ background: `${selectedNode.color}20`, color: selectedNode.color, border: `1px solid ${selectedNode.color}40`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '0.25rem' }}>
                {selectedNode.type}
              </span>
              <button onClick={() => setSelectedNode(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ color: selectedNode.color, marginBottom: '0.25rem' }}>{TYPE_ICONS[selectedNode.type]}</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedNode.label}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{selectedNode.sub}</p>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: '1rem' }} />

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Connections</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {connectedLinks.map((l, i) => {
                const otherId = l.source === selectedNode.id ? l.target : l.source;
                const other = visibleNodes.find(n => n.id === otherId);
                return other ? (
                  <div key={i} onClick={() => setSelectedNode(other)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', background: 'var(--surface-raised)', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <span style={{ color: other.color }}>{TYPE_ICONS[other.type]}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.label}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>{l.label}</span>
                  </div>
                ) : null;
              })}
              {connectedLinks.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No visible connections</div>}
            </div>

            <button className="btn btn-ghost" style={{ width: '100%', marginTop: '1rem', fontSize: '0.78rem' }}>
              <Eye size={13} /> View Full Dossier
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

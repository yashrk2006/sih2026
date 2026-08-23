import React, { useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';

interface HashDisplayProps {
  hash: string;
  label?: string;
  className?: string;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({ hash, label, className }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback silently
    }
  };

  if (!hash || hash === '—') {
    return <span className="text-caption">—</span>;
  }

  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      {label && <span className="text-label" style={{ marginBottom: '0.125rem' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
        <span
          className="hash-display"
          onClick={() => setExpanded((p) => !p)}
          style={{ cursor: 'pointer', wordBreak: 'break-all' }}
        >
          {expanded ? hash : short}
        </span>
        <button
          onClick={handleCopy}
          title="Copy hash"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? 'var(--green-text)' : 'var(--text-muted)',
            padding: '0 0.125rem', display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            title="Expand hash"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
          >
            <ChevronDown size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

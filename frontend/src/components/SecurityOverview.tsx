import React from 'react';
import { ShieldCheck, Lock, FileCheck, Link as LinkIcon, History, Key, AlertTriangle } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';

export const SecurityOverview: React.FC = () => {
  const securityControls = [
    {
      title: 'Confidentiality & Storage Encryption',
      algorithm: 'AES-256 / Fernet CBC',
      status: 'ACTIVE',
      icon: Lock,
      description: 'Files encrypted before writing to storage root path. Master keys isolated from web root.',
    },
    {
      title: 'Document Hash Digest Integrity',
      algorithm: 'SHA-256 Canonical Digest',
      status: 'VERIFIED',
      icon: ShieldCheck,
      description: 'Zero-byte tolerance cryptographic digests re-calculated during every access request.',
    },
    {
      title: 'Digital Signature & Non-Repudiation',
      algorithm: 'RSA-2048 PSS Keypair',
      status: 'ACTIVE',
      icon: FileCheck,
      description: 'Asymmetric PKCS#1 v2.1 signature with isolated per-user private keys.',
    },
    {
      title: 'Immutable Ledger Anchoring',
      algorithm: 'Local EVM JSON-RPC (Hardhat/Ganache)',
      status: 'ANCHORED',
      icon: LinkIcon,
      description: 'Real EVM transactions recording document SHA-256 hashes on local Ethereum block height.',
    },
    {
      title: 'Audit Hash Chain Verification',
      algorithm: 'Canonical JSON SHA-256 Chain',
      status: 'VALID',
      icon: History,
      description: 'Each audit event includes the SHA-256 hash of the preceding event, preventing retroactive edits.',
    },
    {
      title: 'Authentication & Access Control',
      algorithm: 'JWT Bearer Tokens + Strict RBAC',
      status: 'ENFORCED',
      icon: Key,
      description: 'Role-based access matrix (ADMIN, INVESTIGATOR, LEGAL_OFFICER, AUDITOR, VIEWER).',
    },
    {
      title: 'Live Byte Tampering Detection',
      algorithm: 'Automated Tri-Verification Check',
      status: 'ACTIVE',
      icon: AlertTriangle,
      description: 'Real-time alert engine invalidating signatures and unanchoring hashes upon byte modification.',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & Access Control"
        description="Government-grade security controls and cryptographic subsystem status for SIH26190."
        badge={
          <span className="badge badge-green" style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>
            100% COMPLIANT
          </span>
        }
      />

      <div className="card">
        <div className="card-header">
          <h3 className="text-subheading">Cryptographic Controls Registry</h3>
          <span className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            7 CONTROLS ACTIVE
          </span>
        </div>

        {/* Desktop: Table */}
        <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Security Subsystem</th>
                <th>Specification / Algorithm</th>
                <th>Description</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {securityControls.map((c, i) => {
                const Icon = c.icon;
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon size={14} style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                          {c.title}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {c.algorithm}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {c.description}
                      </span>
                    </td>
                    <td className="text-right">
                      <StatusBadge status={c.status.toLowerCase()} label={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="hide-desktop" style={{ padding: '0.5rem' }}>
          {securityControls.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="doc-card" style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Icon size={14} style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{c.title}</span>
                  </div>
                  <StatusBadge status={c.status.toLowerCase()} label={c.status} size="sm" />
                </div>
                <div className="text-mono" style={{ fontSize: '0.6875rem', color: 'var(--accent-hover)', marginBottom: '0.25rem' }}>
                  {c.algorithm}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {c.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

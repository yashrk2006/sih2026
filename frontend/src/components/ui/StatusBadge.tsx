import React from 'react';

type StatusVariant =
  | 'verified' | 'valid' | 'active' | 'connected' | 'operational'
  | 'pending' | 'processing'
  | 'failed' | 'tampered' | 'invalid' | 'error' | 'disconnected'
  | 'warning' | 'unverified'
  | 'inactive' | 'unknown' | 'gray'
  | string;

function getVariantClass(variant: StatusVariant): string {
  const v = variant?.toLowerCase() ?? '';
  if (['verified', 'valid', 'active', 'connected', 'operational', 'signed', 'blockchain_anchored', 'integrity_verified', 'signature_valid', 'ok', 'pass', 'allowed'].includes(v))
    return 'badge badge-green';
  if (['pending', 'processing', 'reviewing', 'awaiting'].includes(v))
    return 'badge badge-amber';
  if (['failed', 'tampered', 'invalid', 'error', 'disconnected', 'hash_mismatch', 'integrity_failed', 'tampering_detected', 'restricted'].includes(v))
    return 'badge badge-red';
  if (['warning', 'unverified', 'partial'].includes(v))
    return 'badge badge-amber';
  if (['inactive', 'unknown', 'gray', 'unavailable', 'not_configured', 'local', 'local_processing'].includes(v))
    return 'badge badge-gray';
  if (['admin', 'full_access'].includes(v))
    return 'badge badge-purple';
  return 'badge badge-gray';
}

function formatLabel(status: string): string {
  if (!status) return '—';
  // Map common backend status strings to human-readable
  const map: Record<string, string> = {
    'INTEGRITY_VERIFIED': 'VERIFIED',
    'HASH_MISMATCH': 'TAMPERED',
    'BLOCKCHAIN_ANCHORED': 'ANCHORED',
    'BLOCKCHAIN_UNAVAILABLE': 'UNAVAILABLE',
    'BLOCKCHAIN_ANCHORED_ON_CHAIN': 'ON CHAIN',
    'HASH_NOT_ON_CHAIN': 'NOT ON CHAIN',
    'SIGNATURE_VALID': 'SIGNED',
    'SIGNATURE_INVALID': 'INVALID',
    'SIGNATURE_MISSING': 'UNSIGNED',
    'AUDIT_CHAIN_VALID': 'VALID',
    'AUDIT_CHAIN_INVALID': 'INVALID',
    'INTEGRITY_FAILED': 'FAILED',
    'TAMPERING_DETECTED': 'TAMPERED',
    'LOCAL_PROCESSING': 'LOCAL',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'default';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'default' }) => {
  const cls = getVariantClass(status);
  const display = label ?? formatLabel(status);
  return (
    <span className={cls} style={size === 'sm' ? { fontSize: '0.625rem' } : undefined}>
      {display}
    </span>
  );
};

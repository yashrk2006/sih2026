import React from 'react';
import { WifiOff, Wifi, RefreshCw, Trash2 } from 'lucide-react';
import type { QueuedUpload } from '../hooks/useOfflineQueue';

interface OfflineBannerProps {
  isOnline: boolean;
  queue: QueuedUpload[];
  isSyncing: boolean;
  lastSyncCount: number;
  onSync: () => void;
  onClear: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  queue,
  isSyncing,
  lastSyncCount,
  onSync,
  onClear,
}) => {
  // Only show if offline OR there are queued items pending sync
  if (isOnline && queue.length === 0) return null;

  const isOffline = !isOnline;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        borderRadius: '2rem',
        backdropFilter: 'blur(12px)',
        background: isOffline
          ? 'rgba(218, 54, 51, 0.15)'
          : 'rgba(234, 179, 8, 0.15)',
        border: `1px solid ${isOffline ? 'rgba(218,54,51,0.4)' : 'rgba(234,179,8,0.4)'}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        animation: 'slideUp 0.3s ease-out',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: isOffline ? '#f87171' : '#fbbf24',
        whiteSpace: 'nowrap',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {isOffline
        ? <WifiOff size={15} />
        : <Wifi size={15} style={{ color: '#fbbf24' }} />
      }

      <span>
        {isOffline
          ? `📡 Offline Mode — ${queue.length} upload${queue.length !== 1 ? 's' : ''} queued locally`
          : `⚡ Back online — ${queue.length} pending upload${queue.length !== 1 ? 's' : ''} ready to sync`
        }
      </span>

      {!isOffline && queue.length > 0 && (
        <button
          onClick={onSync}
          disabled={isSyncing}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.25rem 0.625rem',
            borderRadius: '1rem',
            border: '1px solid rgba(234,179,8,0.5)',
            background: 'rgba(234,179,8,0.15)',
            color: '#fbbf24',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          <RefreshCw
            size={12}
            style={isSyncing ? { animation: 'spin 0.8s linear infinite' } : {}}
          />
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}

      {queue.length > 0 && (
        <button
          onClick={onClear}
          title="Discard queued uploads"
          style={{
            display: 'flex', alignItems: 'center',
            padding: '0.25rem',
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={13} />
        </button>
      )}

      {lastSyncCount > 0 && queue.length === 0 && (
        <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>
          ✓ {lastSyncCount} synced
        </span>
      )}
    </div>
  );
};

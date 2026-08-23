import { useState, useEffect, useCallback } from 'react';

export interface QueuedUpload {
  id: string;
  filename: string;
  caseId: string;
  base64: string;
  mimeType: string;
  queuedAt: string;
  retries: number;
}

const STORAGE_KEY = 'sih26190_offline_queue';

function readQueue(): QueuedUpload[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedUpload[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queue, setQueue] = useState<QueuedUpload[]>(readQueue);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState(0);

  // Listen for real network events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const enqueue = useCallback((upload: Omit<QueuedUpload, 'id' | 'queuedAt' | 'retries'>) => {
    const item: QueuedUpload = {
      ...upload,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      queuedAt: new Date().toISOString(),
      retries: 0,
    };
    const next = [item, ...readQueue()];
    writeQueue(next);
    setQueue(next);
    return item.id;
  }, []);

  const syncQueue = useCallback(async () => {
    const pending = readQueue();
    if (pending.length === 0 || isSyncing) return;

    setIsSyncing(true);
    let synced = 0;
    const remaining: QueuedUpload[] = [];

    for (const item of pending) {
      try {
        // Convert base64 back to Blob and POST to real API
        const byteChars = atob(item.base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: item.mimeType });

        const formData = new FormData();
        formData.append('file', blob, item.filename);
        if (item.caseId) formData.append('case_id', item.caseId);
        formData.append('change_description', `Offline sync (queued ${item.queuedAt})`);

        const token = localStorage.getItem('sih_access_token');
        const res = await fetch('/api/documents/upload/', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (res.ok) {
          synced++;
        } else {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      } catch {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }

    writeQueue(remaining);
    setQueue(remaining);
    setLastSyncCount(synced);
    setIsSyncing(false);
  }, [isSyncing]);

  const clearQueue = useCallback(() => {
    writeQueue([]);
    setQueue([]);
  }, []);

  return {
    isOnline,
    queue,
    queueCount: queue.length,
    isSyncing,
    lastSyncCount,
    enqueue,
    syncQueue,
    clearQueue,
  };
}

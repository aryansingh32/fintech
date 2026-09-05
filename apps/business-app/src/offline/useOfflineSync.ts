import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { listQueuedPayments, removeQueuedPayments, QueuedPayment } from './offlineQueue';

export type SyncState = 'OFFLINE' | 'ONLINE_IDLE' | 'SYNCING' | 'SYNCED';

/**
 * Watches connectivity and the local offline queue, auto-flushing queued
 * payments once a connection is available (blueprint #39: OFFLINE ->
 * SYNCING -> VERIFIED -> SYNCED). Each item's result comes back individually
 * from the sync endpoint (SYNCED / ALREADY_SYNCED / FAILED) - only
 * successfully-processed items are removed from the local queue, so a
 * genuine failure (not just "already synced") stays queued for retry
 * instead of being silently dropped.
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedPayment[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('ONLINE_IDLE');

  const refreshQueue = useCallback(async () => {
    setQueue(await listQueuedPayments());
  }, []);

  useEffect(() => {
    refreshQueue();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, [refreshQueue]);

  const sync = useCallback(async () => {
    const pending = await listQueuedPayments();
    if (pending.length === 0) {
      setSyncState('ONLINE_IDLE');
      return;
    }
    setSyncState('SYNCING');
    try {
      const results = await apiClient.sync.syncPayments(
        pending.map((p) => ({
          loanId: p.loanId,
          amount: p.amount,
          method: p.method,
          referenceId: p.referenceId,
          clientTransactionId: p.clientTransactionId,
          allocation: p.allocation,
        })),
      );
      const succeededIds = results
        .filter((r) => r.status === 'SYNCED' || r.status === 'ALREADY_SYNCED')
        .map((r) => r.clientTransactionId);
      await removeQueuedPayments(succeededIds);
      await refreshQueue();
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setSyncState('SYNCED');
    } catch {
      // Network dropped again mid-sync, or the server is unreachable -
      // everything stays queued and will retry on the next connectivity
      // event or manual "Sync now" tap.
      setSyncState('OFFLINE');
    }
  }, [queryClient, refreshQueue]);

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      sync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isOnline,
    queueLength: queue.length,
    syncState: isOnline ? syncState : 'OFFLINE',
    refreshQueue,
    syncNow: sync,
  };
}

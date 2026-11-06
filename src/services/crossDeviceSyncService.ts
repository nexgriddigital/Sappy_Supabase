import { storageService } from './storageService.ts';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatusType;
  lastSyncedAt: string | null;
  message: string;
  serverVersion: number;
}

type SyncListener = (state: SyncState) => void;

class CrossDeviceSyncService {
  private syncState: SyncState = {
    status: 'synced',
    lastSyncedAt: null,
    message: 'Multi-device cloud sync active',
    serverVersion: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private onDataChangedCallback: (() => void) | null = null;
  private syncIntervalId: any = null;
  private isSyncing = false;

  constructor() {
    // Listen to network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.updateState({
          status: 'offline',
          message: 'Offline mode: Changes will sync once reconnected.',
        });
      });

      // Sync on window / tab focus (e.g. user opens phone or switches back from another app)
      window.addEventListener('focus', () => {
        this.syncNow();
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.syncState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SyncState {
    return this.syncState;
  }

  private updateState(partial: Partial<SyncState>) {
    this.syncState = { ...this.syncState, ...partial };
    this.listeners.forEach((fn) => fn(this.syncState));
  }

  /**
   * Initializes background polling and binds data refresh handler.
   */
  public init(onDataChanged: () => void) {
    this.onDataChangedCallback = onDataChanged;

    // Initial sync
    this.syncNow();

    // Regular interval sync every 12 seconds
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = setInterval(() => {
      this.syncNow();
    }, 12000);
  }

  /**
   * Performs an immediate bi-directional sync with the server.
   */
  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.updateState({ status: 'offline', message: 'Offline mode' });
      return false;
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', message: 'Syncing with cloud...' });

    try {
      const localData = storageService.getAllData();
      const response = await fetch('/api/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: localData }),
      });

      if (!response.ok) {
        throw new Error(`Sync HTTP error ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.state) {
        // Hydrate local storage with merged multi-device state
        storageService.hydrateFromServer(result.state);

        this.updateState({
          status: 'synced',
          lastSyncedAt: result.serverTime || new Date().toISOString(),
          message: 'Cross-device synced',
          serverVersion: result.version || this.syncState.serverVersion + 1,
        });

        // Trigger UI reload so screens reflect new remote changes
        if (this.onDataChangedCallback) {
          this.onDataChangedCallback();
        }
        return true;
      } else {
        throw new Error(result.error || 'Unknown sync response');
      }
    } catch (err: any) {
      // Graceful fallback for static hosting (e.g. GitHub Pages) where Express backend is not hosted
      this.updateState({
        status: 'offline',
        message: 'Local offline storage active',
      });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Resets both local and server state across all devices.
   */
  public async resetAllDevices(): Promise<boolean> {
    try {
      await fetch('/api/pos/reset', { method: 'POST' });
      storageService.resetEverything();
      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        message: 'Reset synchronized across devices',
      });
      if (this.onDataChangedCallback) {
        this.onDataChangedCallback();
      }
      return true;
    } catch (err) {
      console.error('Failed to reset all devices:', err);
      return false;
    }
  }
}

export const crossDeviceSyncService = new CrossDeviceSyncService();

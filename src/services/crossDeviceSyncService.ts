import { storageService } from './storageService.ts';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.ts';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';
export type SyncModeType = 'server' | 'supabase' | 'local';

export interface SyncState {
  status: SyncStatusType;
  mode: SyncModeType;
  lastSyncedAt: string | null;
  message: string;
  serverVersion: number;
}

type SyncListener = (state: SyncState) => void;

class CrossDeviceSyncService {
  private syncState: SyncState = {
    status: 'offline',
    mode: 'local',
    lastSyncedAt: null,
    message: 'Local offline storage active',
    serverVersion: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private onDataChangedCallback: (() => void) | null = null;
  private syncIntervalId: any = null;
  private isSyncing = false;
  private broadcastChannel: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Network status listeners
      window.addEventListener('online', () => {
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.updateState({
          status: 'offline',
          message: 'Offline mode: Changes stored locally',
        });
      });

      // Sync on window/tab focus
      window.addEventListener('focus', () => {
        this.syncNow();
      });

      // BroadcastChannel for instant same-browser cross-tab syncing
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('sappy_pos_sync_channel');
          this.broadcastChannel.onmessage = (event: MessageEvent) => {
            if (event.data?.type === 'DATA_UPDATED' && this.onDataChangedCallback) {
              this.onDataChangedCallback();
            }
          };
        } catch {
          // Ignore BroadcastChannel errors in restricted contexts
        }
      }
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

  public getBackendUrl(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('sappy_custom_backend_url') || '';
  }

  public setBackendUrl(url: string) {
    if (typeof window === 'undefined') return;
    const clean = url.trim();
    if (clean) {
      localStorage.setItem('sappy_custom_backend_url', clean);
    } else {
      localStorage.removeItem('sappy_custom_backend_url');
    }
    this.syncNow();
  }

  private updateState(partial: Partial<SyncState>) {
    this.syncState = { ...this.syncState, ...partial };
    this.listeners.forEach((fn) => fn(this.syncState));
  }

  public broadcastLocalChange() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('sappy_pos_sync_channel');
        bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  }

  /**
   * Fast startup pull of canonical server state.
   * Returns a promise that settles when initial state is received or timed out.
   */
  public async initialSync(): Promise<boolean> {
    try {
      const customUrl = this.getBackendUrl();
      const targetUrl = customUrl
        ? customUrl.endsWith('/')
          ? `${customUrl}api/pos/state`
          : `${customUrl}/api/pos/state`
        : '/api/pos/state';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.state) {
          storageService.hydrateFromServer(result.state);
          this.updateState({
            status: 'synced',
            mode: 'server',
            lastSyncedAt: result.serverTime || new Date().toISOString(),
            message: 'Server synced (Express)',
            serverVersion: result.state.version || this.syncState.serverVersion + 1,
          });

          if (this.onDataChangedCallback) {
            this.onDataChangedCallback();
          }
          this.broadcastLocalChange();
          return true;
        }
      }
    } catch {
      // Fall through to standard syncNow
    }

    return this.syncNow();
  }

  /**
   * Initializes background polling and binds data refresh handler.
   */
  public init(onDataChanged: () => void) {
    this.onDataChangedCallback = onDataChanged;

    // Regular interval sync every 15 seconds
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = setInterval(() => {
      this.syncNow();
    }, 15000);
  }

  /**
   * Performs an immediate bi-directional sync.
   * Priority 1: Backend Express Server (/api/pos/sync or custom backend URL).
   * Priority 2: Direct Supabase Client (if configured).
   * Fallback: Local offline mode.
   */
  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.updateState({ status: 'offline', message: 'No internet connection' });
      return false;
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', message: 'Connecting to cloud sync...' });

    // --- STEP 1: Attempt Express Backend Sync ---
    try {
      const customUrl = this.getBackendUrl();
      const targetUrl = customUrl
        ? customUrl.endsWith('/')
          ? `${customUrl}api/pos/sync`
          : `${customUrl}/api/pos/sync`
        : '/api/pos/sync';

      const localData = storageService.getAllData();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: localData }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.state) {
          storageService.hydrateFromServer(result.state);

          this.updateState({
            status: 'synced',
            mode: 'server',
            lastSyncedAt: result.serverTime || new Date().toISOString(),
            message: 'Server synced (Express)',
            serverVersion: result.version || this.syncState.serverVersion + 1,
          });

          if (this.onDataChangedCallback) {
            this.onDataChangedCallback();
          }
          this.broadcastLocalChange();
          this.isSyncing = false;
          return true;
        }
      }
    } catch {
      // Backend not reachable on static host (e.g. GitHub Pages)
    }

    // --- STEP 2: Attempt Direct Supabase Sync ---
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const localProducts = storageService.getProducts();
          if (localProducts.length > 0) {
            await client.from('products').upsert(
              localProducts.map((p) => ({
                id: p.id,
                sku: p.sku,
                barcode: p.barcode,
                name: p.name,
                category: p.category,
                cost_price: p.costPrice,
                selling_price: p.sellingPrice,
                stock_level: p.stockLevel,
                low_stock_threshold: p.lowStockThreshold,
                unit: p.unit,
                description: p.description,
              }))
            );
          }

          const localCustomers = storageService.getCustomers();
          if (localCustomers.length > 0) {
            await client.from('customers').upsert(
              localCustomers.map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                credit_balance: c.creditBalance,
                credit_limit: c.creditLimit,
                total_purchased: c.totalPurchased,
              }))
            );
          }

          this.updateState({
            status: 'synced',
            mode: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            message: 'Cloud synced (Supabase)',
            serverVersion: this.syncState.serverVersion + 1,
          });

          if (this.onDataChangedCallback) {
            this.onDataChangedCallback();
          }
          this.broadcastLocalChange();
          this.isSyncing = false;
          return true;
        } catch (supabaseErr: any) {
          console.warn('Supabase sync warning:', supabaseErr?.message || supabaseErr);
        }
      }
    }

    // --- STEP 3: Fallback to Local Offline Storage ---
    this.updateState({
      status: 'offline',
      mode: 'local',
      message: 'Running in Local Mode (Standalone)',
    });
    this.isSyncing = false;
    return false;
  }

  /**
   * Resets both local and remote state.
   */
  public async resetAllDevices(): Promise<boolean> {
    try {
      const customUrl = this.getBackendUrl();
      const targetUrl = customUrl
        ? customUrl.endsWith('/')
          ? `${customUrl}api/pos/reset`
          : `${customUrl}/api/pos/reset`
        : '/api/pos/reset';
      await fetch(targetUrl, { method: 'POST' }).catch(() => {});
    } catch {}

    storageService.resetEverything();
    this.broadcastLocalChange();

    this.updateState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      message: 'Reset synchronized across devices',
    });

    if (this.onDataChangedCallback) {
      this.onDataChangedCallback();
    }
    return true;
  }
}

export const crossDeviceSyncService = new CrossDeviceSyncService();

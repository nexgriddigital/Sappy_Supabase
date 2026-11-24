import { storageService } from './storageService.ts';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { Sale, CreditPayment, Expense } from '../types/pos.ts';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';
export type SyncModeType = 'server' | 'supabase' | 'local';
export type AutoSyncMode = 'live' | 'manual';

export interface SyncState {
  status: SyncStatusType;
  mode: SyncModeType;
  autoSyncMode: AutoSyncMode;
  lastSyncedAt: string | null;
  message: string;
  serverVersion: number;
}

type SyncListener = (state: SyncState) => void;

export const DEFAULT_CLOUD_BACKEND_URL = 'https://ais-pre-r3d7544mmard67yh6cqteh-17765999408.europe-west2.run.app';
const RESET_EPOCH_STORAGE_KEY = 'sappy_pos_reset_epoch';
const AUTO_SYNC_MODE_STORAGE_KEY = 'sappy_pos_auto_sync_mode_v1';

class CrossDeviceSyncService {
  private autoSyncMode: AutoSyncMode = 'live';
  private syncState: SyncState = {
    status: 'offline',
    mode: 'local',
    autoSyncMode: 'live',
    lastSyncedAt: null,
    message: 'Local offline storage active',
    serverVersion: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private onDataChangedCallback: (() => void) | null = null;
  private syncIntervalId: any = null;
  private isSyncing = false;
  private isResetting = false;
  private activeSyncPromise: Promise<boolean> | null = null;
  private syncQueued = false;
  private queuedIsNewSetup = false;
  private actionDebounceTimer: any = null;
  private broadcastChannel: any = null;

  constructor() {
    this.autoSyncMode = this.loadAutoSyncMode();
    this.syncState = {
      ...this.syncState,
      autoSyncMode: this.autoSyncMode,
      message:
        this.autoSyncMode === 'manual'
          ? 'Manual Sync Only — background sync paused (low-bandwidth mode)'
          : this.syncState.message,
    };

    // 1. Subscribe to any storage mutations (actions completed anywhere in the app)
    storageService.subscribeToChanges(() => {
      if (!this.isResetting && this.autoSyncMode === 'live') {
        this.triggerActionSync();
      }
    });

    if (typeof window !== 'undefined') {
      // 2. 15-second background interval sync (only active in Live Sync mode)
      if (this.autoSyncMode === 'live') {
        this.startSyncTimer(15000);
      }

      // Network status listeners
      window.addEventListener('online', () => {
        if (!this.isResetting && this.autoSyncMode === 'live') {
          this.triggerActionSync(10);
        }
      });
      window.addEventListener('offline', () => {
        this.updateState({
          status: 'offline',
          message: 'Offline mode: Changes stored locally',
        });
      });

      // Sync on window/tab focus or visibility change (only in Live Sync mode)
      window.addEventListener('focus', () => {
        if (!this.isResetting && this.autoSyncMode === 'live') {
          this.triggerActionSync(10);
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isResetting && this.autoSyncMode === 'live') {
          this.triggerActionSync(10);
        }
      });

      // BroadcastChannel for instant same-browser cross-tab syncing
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('sappy_pos_sync_channel');
          this.broadcastChannel.onmessage = (event: MessageEvent) => {
            if (event.data?.type === 'FORCE_RESET') {
              if (event.data.resetEpoch) {
                this.setClientResetEpoch(Number(event.data.resetEpoch));
              }
              if (this.actionDebounceTimer) {
                clearTimeout(this.actionDebounceTimer);
                this.actionDebounceTimer = null;
              }
              this.syncQueued = false;
              this.queuedIsNewSetup = false;
              storageService.resetEverything(false);
              if (this.onDataChangedCallback) {
                this.onDataChangedCallback();
              }
              return;
            }
            if (event.data?.type === 'SYNC_MODE_CHANGED') {
              const incomingMode: AutoSyncMode = event.data.autoSyncMode === 'manual' ? 'manual' : 'live';
              this.applyAutoSyncMode(incomingMode, false);
              return;
            }
            if (event.data?.type === 'DATA_UPDATED') {
              if (this.isResetting) return;
              if (this.onDataChangedCallback) {
                this.onDataChangedCallback();
              }
              // Only trigger network sync in Live Sync mode
              if (this.autoSyncMode === 'live') {
                this.syncNow();
              }
            }
          };
        } catch {
          // Ignore BroadcastChannel errors in restricted contexts
        }
      }
    }
  }

  private loadAutoSyncMode(): AutoSyncMode {
    if (typeof window === 'undefined') return 'live';
    try {
      return localStorage.getItem(AUTO_SYNC_MODE_STORAGE_KEY) === 'manual' ? 'manual' : 'live';
    } catch {
      return 'live';
    }
  }

  public getAutoSyncMode(): AutoSyncMode {
    return this.autoSyncMode;
  }

  public setAutoSyncMode(mode: AutoSyncMode): void {
    const cleanMode: AutoSyncMode = mode === 'manual' ? 'manual' : 'live';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUTO_SYNC_MODE_STORAGE_KEY, cleanMode);
      } catch {}
    }
    this.applyAutoSyncMode(cleanMode, true);
  }

  private applyAutoSyncMode(mode: AutoSyncMode, broadcast: boolean): void {
    this.autoSyncMode = mode;

    if (mode === 'manual') {
      this.stopSyncTimer();
      this.syncQueued = false;
      this.queuedIsNewSetup = false;
      this.updateState({
        autoSyncMode: 'manual',
        message: 'Manual Sync Only — background sync paused (low-bandwidth mode)',
      });
    } else {
      this.startSyncTimer(15000);
      this.updateState({
        autoSyncMode: 'live',
        message: 'Live Sync active — syncing automatically',
      });
      if (broadcast && !this.isResetting) {
        this.syncNow();
      }
    }

    if (broadcast && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('sappy_pos_sync_channel');
        bc.postMessage({ type: 'SYNC_MODE_CHANGED', autoSyncMode: mode, timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  }

  private getClientResetEpoch(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(RESET_EPOCH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private setClientResetEpoch(epoch: number): void {
    if (typeof window === 'undefined' || !Number.isFinite(epoch) || epoch <= 0) return;
    try {
      const current = this.getClientResetEpoch();
      if (epoch > current) {
        localStorage.setItem(RESET_EPOCH_STORAGE_KEY, String(epoch));
      }
    } catch {}
  }

  /**
   * Stops any recurring background auto-sync interval and pending debounced sync.
   */
  public stopSyncTimer() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.actionDebounceTimer) {
      clearTimeout(this.actionDebounceTimer);
      this.actionDebounceTimer = null;
    }
  }

  /**
   * Starts or restarts the recurring background auto-sync timer (defaults to 15 seconds).
   * In Manual Sync Only mode, ensures no background timer is running.
   */
  public startSyncTimer(intervalMs = 15000) {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.autoSyncMode === 'manual') {
      return;
    }
    this.syncIntervalId = setInterval(() => {
      if (!this.isResetting && this.autoSyncMode === 'live') {
        this.syncNow();
      }
    }, intervalMs);
  }

  /**
   * Immediately schedules a sync whenever any action completes (Live Sync mode only).
   * Debounces by default (e.g. 60ms) to coalesce rapid multi-record operations.
   * If a sync is currently in progress, marks a follow-up sync as queued.
   */
  public triggerActionSync(delayMs = 60) {
    if (this.isResetting || this.autoSyncMode === 'manual') return;
    if (this.actionDebounceTimer) {
      clearTimeout(this.actionDebounceTimer);
    }
    this.actionDebounceTimer = setTimeout(() => {
      this.actionDebounceTimer = null;
      if (this.isResetting || this.autoSyncMode === 'manual') return;
      if (this.isSyncing) {
        this.syncQueued = true;
        return;
      }
      this.syncNow();
    }, delayMs);
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
    const custom = localStorage.getItem('sappy_custom_backend_url');
    if (custom && custom.trim()) {
      return custom.trim();
    }
    // If running on GitHub Pages (e.g. nexgriddigital.github.io) or external static host
    const host = window.location.hostname;
    if (
      host.endsWith('github.io') ||
      host.endsWith('pages.dev') ||
      host.endsWith('vercel.app') ||
      host.endsWith('netlify.app')
    ) {
      return DEFAULT_CLOUD_BACKEND_URL;
    }
    return '';
  }

  public setBackendUrl(url: string) {
    if (typeof window === 'undefined') return;
    const clean = String(url || '').trim();
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
    if (this.isResetting) return;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('sappy_pos_sync_channel');
        bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  }

  public broadcastForceReset(resetEpoch?: number) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('sappy_pos_sync_channel');
        bc.postMessage({ type: 'FORCE_RESET', resetEpoch, timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  }

  private initialSyncPromise: Promise<boolean> | null = null;

  /**
   * Fast startup pull of canonical server state.
   * Skipped automatically in Manual Sync Only mode unless forced by an explicit user action.
   */
  public initialSync(force = false): Promise<boolean> {
    if (this.isResetting) {
      return Promise.resolve(false);
    }
    if (!force && this.autoSyncMode === 'manual') {
      return Promise.resolve(false);
    }
    if (this.initialSyncPromise) {
      return this.initialSyncPromise;
    }

    this.initialSyncPromise = (async () => {
      const backend = this.getBackendUrl();
      const urlsToTry: string[] = [];

      if (backend) {
        urlsToTry.push(backend.endsWith('/') ? `${backend}api/pos/state` : `${backend}/api/pos/state`);
      } else {
        urlsToTry.push('/api/pos/state');
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        if (currentOrigin !== DEFAULT_CLOUD_BACKEND_URL) {
          urlsToTry.push(`${DEFAULT_CLOUD_BACKEND_URL}/api/pos/state`);
        }
      }

      for (const targetUrl of urlsToTry) {
        if (this.isResetting) return false;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);

          const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (this.isResetting) return false;

          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              continue; // Not JSON (probably HTML 404 page from static host)
            }

            const result = await response.json();
            if (this.isResetting) return false;
            if (result.success && result.state) {
              const serverResetEpoch = Number(result.state.resetEpoch || 0);
              const localResetEpoch = this.getClientResetEpoch();
              if (result.state.isReset) {
                if (serverResetEpoch > 0) this.setClientResetEpoch(serverResetEpoch);
                storageService.resetEverything(false);
              } else if (serverResetEpoch > 0 && localResetEpoch < serverResetEpoch) {
                storageService.resetEverything(false);
                this.setClientResetEpoch(serverResetEpoch);
                storageService.hydrateFromServer(result.state);
              } else {
                if (serverResetEpoch > 0) this.setClientResetEpoch(serverResetEpoch);
                storageService.hydrateFromServer(result.state);
              }

              this.updateState({
                status: 'synced',
                mode: 'server',
                lastSyncedAt: result.serverTime || new Date().toISOString(),
                message: result.state.isReset ? 'Factory reset synchronized' : 'Server synced (Express)',
                serverVersion: result.state.version || this.syncState.serverVersion + 1,
              });

              if (this.onDataChangedCallback) {
                this.onDataChangedCallback();
              }
              if (!result.state.isReset) {
                this.broadcastLocalChange();
              }
              return true;
            }
          }
        } catch {
          // Try fallback url
        }
      }

      if (this.isResetting) return false;
      return this.syncNow();
    })().finally(() => {
      this.initialSyncPromise = null;
    });

    return this.initialSyncPromise;
  }

  /**
   * Initializes background polling (when in Live Sync mode) and binds data refresh handler.
   */
  public init(onDataChanged: () => void) {
    this.onDataChangedCallback = onDataChanged;
    if (this.autoSyncMode === 'live') {
      this.startSyncTimer(15000);
    } else {
      this.stopSyncTimer();
    }
  }

  /**
   * Performs an immediate bi-directional sync.
   * Priority 1: Backend Express Server (/api/pos/sync or custom backend URL).
   * Priority 2: Direct Supabase Client (if configured).
   * Fallback: Local offline mode.
   */
  public syncNow(options?: { isNewSetup?: boolean }): Promise<boolean> {
    if (this.isResetting) {
      return Promise.resolve(false);
    }

    if (options?.isNewSetup && this.actionDebounceTimer) {
      clearTimeout(this.actionDebounceTimer);
      this.actionDebounceTimer = null;
    }

    if (this.isSyncing && this.activeSyncPromise) {
      this.syncQueued = true;
      if (options?.isNewSetup) {
        this.queuedIsNewSetup = true;
      }
      return this.activeSyncPromise;
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.updateState({ status: 'offline', message: 'No internet connection' });
      return Promise.resolve(false);
    }

    this.activeSyncPromise = this.executeSyncNow(options).finally(() => {
      this.activeSyncPromise = null;
    });
    return this.activeSyncPromise;
  }

  private async executeSyncNow(options?: { isNewSetup?: boolean }): Promise<boolean> {
    if (this.isResetting) return false;
    const syncStartedAt = Date.now();
    this.isSyncing = true;
    this.updateState({ status: 'syncing', message: 'Connecting to cloud sync...' });

    const finishSync = (success: boolean) => {
      this.isSyncing = false;
      if (!this.isResetting && this.syncQueued) {
        const nextIsNewSetup = this.queuedIsNewSetup;
        this.syncQueued = false;
        this.queuedIsNewSetup = false;
        setTimeout(() => {
          this.syncNow(nextIsNewSetup ? { isNewSetup: true } : undefined);
        }, 50);
      } else if (this.isResetting) {
        this.syncQueued = false;
        this.queuedIsNewSetup = false;
      }
      return success;
    };

    // --- STEP 1: Attempt Express Backend Sync ---
    const postUrlsToTry: string[] = [];
    const customUrl = this.getBackendUrl();
    if (customUrl) {
      postUrlsToTry.push(customUrl.endsWith('/') ? `${customUrl}api/pos/sync` : `${customUrl}/api/pos/sync`);
    } else {
      postUrlsToTry.push('/api/pos/sync');
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      if (currentOrigin !== DEFAULT_CLOUD_BACKEND_URL) {
        postUrlsToTry.push(`${DEFAULT_CLOUD_BACKEND_URL}/api/pos/sync`);
      }
    }

    const localData = storageService.getAllData();
    const clientResetEpoch = this.getClientResetEpoch();

    for (const targetUrl of postUrlsToTry) {
      if (this.isResetting) return finishSync(false);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: localData,
            isNewSetup: Boolean(options?.isNewSetup),
            clientResetEpoch,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (this.isResetting) return finishSync(false);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            continue; // Not JSON (probably HTML 404 page from static host)
          }

          const result = await response.json();
          if (this.isResetting) return finishSync(false);

          if (result.success && result.state) {
            const serverResetEpoch = Number(result.resetEpoch || result.state.resetEpoch || 0);
            if (result.wasReset || result.state.isReset) {
              if (serverResetEpoch > 0) this.setClientResetEpoch(serverResetEpoch);
              storageService.resetEverything(false);
            } else if (
              result.replaceLocal ||
              (serverResetEpoch > 0 && clientResetEpoch < serverResetEpoch)
            ) {
              storageService.resetEverything(false);
              if (serverResetEpoch > 0) this.setClientResetEpoch(serverResetEpoch);
              storageService.hydrateFromServer(result.state);
            } else {
              if (serverResetEpoch > 0) this.setClientResetEpoch(serverResetEpoch);
              storageService.hydrateFromServer(result.state, syncStartedAt);
            }

            this.updateState({
              status: 'synced',
              mode: 'server',
              lastSyncedAt: result.serverTime || new Date().toISOString(),
              message:
                result.wasReset || result.state.isReset
                  ? 'Factory reset synchronized'
                  : 'Server synced (Express Cloud)',
              serverVersion: result.version || this.syncState.serverVersion + 1,
            });

            if (this.onDataChangedCallback) {
              this.onDataChangedCallback();
            }
            if (!result.wasReset && !result.state.isReset) {
              this.broadcastLocalChange();
            }
            return finishSync(true);
          }
        }
      } catch {
        // Try fallback URL
      }
    }

    if (this.isResetting) return finishSync(false);

    // --- STEP 2: Attempt Direct Supabase Sync (All 5 POS Entities) ---
    if (isSupabaseConfigured()) {
      const client = await getSupabase();
      if (this.isResetting) return finishSync(false);
      if (client) {
        try {
          let hasRlsError = false;

          // 0. Check/Clear Factory Reset Tombstone in Supabase
          try {
            if (options?.isNewSetup) {
              await client.from('customers').delete().eq('id', '__system_reset_tombstone__');
            } else {
              const { data: tombstone } = await client
                .from('customers')
                .select('id, notes')
                .eq('id', '__system_reset_tombstone__')
                .maybeSingle();

              if (tombstone) {
                let resetAt = 'reset';
                try {
                  const parsed = JSON.parse(tombstone.notes || '{}');
                  if (parsed.resetAt) resetAt = parsed.resetAt;
                } catch {}

                const ackKey = 'sappy_pos_last_reset_ack';
                const lastAck = typeof window !== 'undefined' ? localStorage.getItem(ackKey) : null;
                if (lastAck !== resetAt) {
                  storageService.resetEverything(false);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(ackKey, resetAt);
                  }
                  this.updateState({
                    status: 'synced',
                    mode: 'supabase',
                    lastSyncedAt: new Date().toISOString(),
                    message: 'Factory reset synchronized from cloud',
                    serverVersion: this.syncState.serverVersion + 1,
                  });
                  if (this.onDataChangedCallback) {
                    this.onDataChangedCallback();
                  }
                  this.broadcastLocalChange();
                  return finishSync(true);
                }

                // Already acknowledged this reset; if store has no users/products yet, skip pushing empty/stale data
                if (!storageService.hasUsers() && storageService.getProducts().length === 0) {
                  this.updateState({
                    status: 'synced',
                    mode: 'supabase',
                    lastSyncedAt: new Date().toISOString(),
                    message: 'Store awaiting initial setup',
                  });
                  return finishSync(true);
                } else {
                  // User has set up a new store since the reset; clear tombstone
                  await client.from('customers').delete().eq('id', '__system_reset_tombstone__');
                }
              }
            }
          } catch (tombErr) {
            console.warn('Supabase reset tombstone check notice:', tombErr);
          }

          // 1. Products Sync (respect updatedAt & syncStartedAt so sales deductions never revert)
          if (this.isResetting) return finishSync(false);
          try {
            const { data: remoteProducts } = await client.from('products').select('*');
            if (this.isResetting) return finishSync(false);
            if (remoteProducts && Array.isArray(remoteProducts) && remoteProducts.length > 0) {
              const mappedProducts = remoteProducts.map((p: any) => ({
                id: p.id,
                sku: p.sku,
                barcode: p.barcode || '',
                name: p.name,
                category: p.category,
                costPrice: Number(p.cost_price || 0),
                sellingPrice: Number(p.selling_price || 0),
                stockLevel: Number(p.stock_level || 0),
                lowStockThreshold: Number(p.low_stock_threshold || 5),
                unit: p.unit || 'pcs',
                description: p.description || '',
                updatedAt: p.updated_at || undefined,
              }));
              storageService.mergeProductsFromRemote(mappedProducts, syncStartedAt);
            }

            if (this.isResetting) return finishSync(false);
            const currentProducts = storageService.getProducts();
            if (currentProducts.length > 0) {
              const { error: prodErr } = await client.from('products').upsert(
                currentProducts.map((p) => ({
                  id: p.id,
                  sku: p.sku,
                  barcode: p.barcode || '',
                  name: p.name,
                  category: p.category,
                  cost_price: p.costPrice,
                  selling_price: p.sellingPrice,
                  stock_level: p.stockLevel,
                  low_stock_threshold: p.lowStockThreshold,
                  unit: p.unit,
                  description: p.description,
                  updated_at: p.updatedAt || new Date().toISOString(),
                }))
              );
              if (prodErr && (prodErr.code === '42501' || prodErr.message?.includes('row-level security'))) {
                hasRlsError = true;
              }
            }
          } catch (pErr) {
            console.warn('Supabase product sync notice:', pErr);
          }

          // 2. Customers Sync
          try {
            const deletedCustIds = storageService.getDeletedCustomerIds();
            if (deletedCustIds.length > 0) {
              for (const delId of deletedCustIds) {
                if (delId.startsWith('__system_')) continue;
                try {
                  await client.from('customers').delete().eq('id', delId);
                } catch {}
              }
            }

            const { data: remoteCustomers } = await client.from('customers').select('*');
            if (remoteCustomers && Array.isArray(remoteCustomers) && remoteCustomers.length > 0) {
              const delSet = new Set(deletedCustIds);

              // Check if resilient staff registry record is in customers table
              const staffRegRecord = remoteCustomers.find((c: any) => c.id === '__system_staff_registry__');
              if (staffRegRecord && staffRegRecord.notes) {
                try {
                  const parsedStaff = JSON.parse(staffRegRecord.notes);
                  if (Array.isArray(parsedStaff) && parsedStaff.length > 0) {
                    storageService.hydrateFromServer({ users: parsedStaff });
                  }
                } catch {}
              }

              const mappedCustomers = remoteCustomers
                .filter((c: any) => !delSet.has(c.id) && !c.id.startsWith('__system_'))
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  companyName: c.company_name || undefined,
                  phone: c.phone,
                  email: c.email || undefined,
                  address: c.address || undefined,
                  taxNumber: c.tax_number || undefined,
                  creditBalance: Number(c.credit_balance || 0),
                  creditLimit: Number(c.credit_limit || 500),
                  totalPurchased: Number(c.total_purchased || 0),
                  notes: c.notes || undefined,
                  createdAt: c.created_at || new Date().toISOString(),
                  updatedAt: c.updated_at || undefined,
                }));
              storageService.mergeCustomersFromRemote(mappedCustomers, syncStartedAt);
            }

            const currentCustomers = storageService.getCustomers().filter((c) => !c.id.startsWith('__system_'));
            if (currentCustomers.length > 0) {
              const { error: custErr } = await client.from('customers').upsert(
                currentCustomers.map((c) => ({
                  id: c.id,
                  name: c.name,
                  company_name: c.companyName || null,
                  phone: c.phone,
                  email: c.email || null,
                  address: c.address || null,
                  tax_number: c.taxNumber || null,
                  credit_balance: c.creditBalance,
                  credit_limit: c.creditLimit,
                  total_purchased: c.totalPurchased,
                  notes: c.notes || null,
                }))
              );
              if (custErr && (custErr.code === '42501' || custErr.message?.includes('row-level security'))) {
                hasRlsError = true;
              }
            }
          } catch (cErr) {
            console.warn('Supabase customer sync notice:', cErr);
          }

          // 3. Sales Sync
          try {
            const { data: remoteSales } = await client.from('sales').select('*');
            if (remoteSales && Array.isArray(remoteSales) && remoteSales.length > 0) {
              const mappedSales: Sale[] = remoteSales.map((s: any) => ({
                id: s.id,
                invoiceNumber: s.invoice_number,
                timestamp: s.timestamp || new Date().toISOString(),
                customerId: s.customer_id || undefined,
                customerName: s.customer_name,
                customerPhone: s.customer_phone || undefined,
                customerEmail: s.customer_email || undefined,
                customerAddress: s.customer_address || undefined,
                subtotal: Number(s.subtotal || 0),
                taxRate: Number(s.tax_rate || 0),
                taxAmount: Number(s.tax_amount || 0),
                discountAmount: Number(s.discount_amount || 0),
                totalAmount: Number(s.total_amount || 0),
                totalCost: Number(s.total_cost || 0),
                grossProfit: Number(s.gross_profit || 0),
                paymentMethod: s.payment_method,
                amountTendered: Number(s.amount_tendered || 0),
                changeGiven: Number(s.change_given || 0),
                isCreditPaid: s.is_credit_paid ?? true,
                creditDueDate: s.credit_due_date || undefined,
                paidAmount: Number(s.paid_amount || 0),
                notes: s.notes || undefined,
                items: Array.isArray(s.items) ? s.items : [],
              }));
              const localSales = storageService.getSales();
              const salesMap = new Map(localSales.map((s) => [s.id, s]));
              for (const rs of mappedSales) {
                const existing = salesMap.get(rs.id);
                if (existing && existing.isReturned) {
                  salesMap.set(rs.id, { ...rs, ...existing });
                } else {
                  salesMap.set(rs.id, rs);
                }
              }
              storageService.hydrateFromServer({ sales: Array.from(salesMap.values()) }, syncStartedAt);
            }

            const currentSales = storageService.getSales();
            if (currentSales.length > 0) {
              const { error: salesErr } = await client.from('sales').upsert(
                currentSales.map((s) => ({
                  id: s.id,
                  invoice_number: s.invoiceNumber,
                  timestamp: s.timestamp,
                  customer_id: s.customerId || null,
                  customer_name: s.customerName,
                  customer_phone: s.customerPhone || null,
                  customer_email: s.customerEmail || null,
                  customer_address: s.customerAddress || null,
                  subtotal: s.subtotal,
                  tax_rate: s.taxRate,
                  tax_amount: s.taxAmount,
                  discount_amount: s.discountAmount,
                  total_amount: s.totalAmount,
                  total_cost: s.totalCost,
                  gross_profit: s.grossProfit,
                  payment_method: s.paymentMethod,
                  amount_tendered: s.amountTendered,
                  change_given: s.changeGiven,
                  is_credit_paid: s.isCreditPaid,
                  credit_due_date: s.creditDueDate || null,
                  paid_amount: s.paidAmount || 0,
                  notes: s.notes || null,
                  items: s.items || [],
                }))
              );
              if (salesErr && (salesErr.code === '42501' || salesErr.message?.includes('row-level security'))) {
                hasRlsError = true;
              }
            }
          } catch (sErr) {
            console.warn('Supabase sales sync notice:', sErr);
          }

          // 4. Credit Debt Payments Sync
          try {
            const { data: remotePayments } = await client.from('credit_payments').select('*');
            if (remotePayments && Array.isArray(remotePayments) && remotePayments.length > 0) {
              const mappedPayments: CreditPayment[] = remotePayments.map((p: any) => ({
                id: p.id,
                customerId: p.customer_id,
                customerName: p.customer_name,
                saleId: p.sale_id || undefined,
                amount: Number(p.amount || 0),
                paymentMethod: p.payment_method || 'cash',
                timestamp: p.timestamp || new Date().toISOString(),
                receiptNumber: p.receipt_number,
                notes: p.notes || undefined,
              }));
              const localPayments = storageService.getCreditPayments();
              const payMap = new Map(localPayments.map((p) => [p.id, p]));
              for (const rp of mappedPayments) {
                payMap.set(rp.id, rp);
              }
              storageService.hydrateFromServer({ creditPayments: Array.from(payMap.values()) });
            }

            const currentPayments = storageService.getCreditPayments();
            if (currentPayments.length > 0) {
              const { error: payErr } = await client.from('credit_payments').upsert(
                currentPayments.map((p) => ({
                  id: p.id,
                  customer_id: p.customerId,
                  customer_name: p.customerName,
                  sale_id: p.saleId || null,
                  amount: p.amount,
                  payment_method: p.paymentMethod,
                  timestamp: p.timestamp,
                  receipt_number: p.receiptNumber,
                  notes: p.notes || null,
                }))
              );
              if (payErr && (payErr.code === '42501' || payErr.message?.includes('row-level security'))) {
                hasRlsError = true;
              }
            }
          } catch (pErr) {
            console.warn('Supabase credit payments sync notice:', pErr);
          }

          // 5. Expenses Sync
          try {
            const { data: remoteExpenses } = await client.from('expenses').select('*');
            if (remoteExpenses && Array.isArray(remoteExpenses) && remoteExpenses.length > 0) {
              const mappedExpenses: Expense[] = remoteExpenses.map((e: any) => ({
                id: e.id,
                date: e.date,
                category: e.category,
                title: e.title,
                amount: Number(e.amount || 0),
                paymentMethod: e.payment_method || 'cash',
                payee: e.payee,
                receiptNumber: e.receipt_number || undefined,
                notes: e.notes || undefined,
                createdAt: e.created_at || new Date().toISOString(),
              }));
              const localExpenses = storageService.getExpenses();
              const expMap = new Map(localExpenses.map((e) => [e.id, e]));
              for (const re of mappedExpenses) {
                expMap.set(re.id, re);
              }
              storageService.hydrateFromServer({ expenses: Array.from(expMap.values()) });
            }

            const currentExpenses = storageService.getExpenses();
            if (currentExpenses.length > 0) {
              const { error: expErr } = await client.from('expenses').upsert(
                currentExpenses.map((e) => ({
                  id: e.id,
                  date: e.date,
                  category: e.category,
                  title: e.title,
                  amount: e.amount,
                  payment_method: e.paymentMethod,
                  payee: e.payee,
                  receipt_number: e.receiptNumber || null,
                  notes: e.notes || null,
                }))
              );
              if (expErr && (expErr.code === '42501' || expErr.message?.includes('row-level security'))) {
                hasRlsError = true;
              }
            }
          } catch (eErr) {
            console.warn('Supabase expenses sync notice:', eErr);
          }

          // 6. Users & Staff Profiles Sync (Dual-Channel: Dedicated Table + Resilient System Cloud Registry)
          try {
            let remoteUsersFound: any[] = [];
            let tableSyncSucceeded = false;

            // Strategy A: Check dedicated 'app_users' or 'users' table
            try {
              const { data: remoteAppUsers, error: usersErr } = await client.from('app_users').select('*');
              if (!usersErr && remoteAppUsers && Array.isArray(remoteAppUsers)) {
                tableSyncSucceeded = true;
                remoteUsersFound = remoteAppUsers.map((u: any) => ({
                  id: u.id,
                  email: u.email,
                  fullName: u.full_name || u.fullName || u.email.split('@')[0],
                  role: u.role || 'owner',
                  storeName: u.store_name || u.storeName || 'Sappy Stationary',
                  phone: u.phone || undefined,
                  pinCode: u.pin_code || u.pinCode || undefined,
                  password: u.password !== undefined ? u.password : undefined,
                  status: u.status || 'active',
                  createdAt: u.created_at || u.createdAt || new Date().toISOString(),
                  updatedAt: u.updated_at || u.updatedAt || undefined,
                  lastLoginAt: u.last_login_at || u.lastLoginAt || undefined,
                  notes: u.notes || undefined,
                }));
              }
            } catch {}

            // Strategy B: If table not yet created, fetch from resilient staff registry record in Supabase
            if (!tableSyncSucceeded) {
              try {
                const { data: regData } = await client
                  .from('customers')
                  .select('notes')
                  .eq('id', '__system_staff_registry__')
                  .maybeSingle();

                if (regData && regData.notes) {
                  const parsed = JSON.parse(regData.notes);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    remoteUsersFound = parsed;
                  }
                }
              } catch (regFetchErr) {
                console.warn('System staff registry fetch notice:', regFetchErr);
              }
            }

            // Hydrate and merge remote users with local users
            if (remoteUsersFound.length > 0) {
              storageService.hydrateFromServer({ users: remoteUsersFound });
            }

            // Push current local users to Supabase so both devices have identical staff list
            const currentUsers = storageService.getUsers();
            if (currentUsers.length > 0) {
              // 1. Write to app_users if table is available
              if (tableSyncSucceeded) {
                try {
                  await client.from('app_users').upsert(
                    currentUsers.map((u) => ({
                      id: u.id,
                      email: u.email,
                      full_name: u.fullName,
                      role: u.role,
                      store_name: u.storeName,
                      phone: u.phone || null,
                      pin_code: u.pinCode || null,
                      status: u.status,
                      notes: u.notes || null,
                      updated_at: u.updatedAt || new Date().toISOString(),
                    }))
                  );
                } catch {}
              }

              // 2. Always maintain backup in system staff registry so devices without the new SQL table sync instantly
              try {
                await client.from('customers').upsert({
                  id: '__system_staff_registry__',
                  name: '__SYSTEM_STAFF_REGISTRY__',
                  phone: '+251 00 000 0000',
                  credit_balance: 0,
                  credit_limit: 0,
                  total_purchased: 0,
                  notes: JSON.stringify(currentUsers),
                });
              } catch (regSaveErr) {
                console.warn('System staff registry save notice:', regSaveErr);
              }
            }
          } catch (uErr) {
            console.warn('Supabase users sync notice:', uErr);
          }

          if (hasRlsError) {
            this.updateState({
              status: 'error',
              mode: 'supabase',
              message: 'Supabase RLS active (42501): Run 1-click RLS fix in Cloud Sync',
            });
            return finishSync(false);
          }

          this.updateState({
            status: 'synced',
            mode: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            message: 'Cloud synced (Supabase Live)',
            serverVersion: this.syncState.serverVersion + 1,
          });

          if (this.onDataChangedCallback) {
            this.onDataChangedCallback();
          }
          this.broadcastLocalChange();
          return finishSync(true);
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
    return finishSync(false);
  }

  /**
   * Resets both local and remote state cleanly with a reset lock and epoch barrier
   * so no in-flight sync or stale peer tab can resurrect deleted inventory.
   */
  public async resetAllDevices(): Promise<boolean> {
    this.isResetting = true;
    if (this.actionDebounceTimer) {
      clearTimeout(this.actionDebounceTimer);
      this.actionDebounceTimer = null;
    }
    this.syncQueued = false;
    this.queuedIsNewSetup = false;

    let resetEpoch = Math.max(Date.now(), this.getClientResetEpoch() + 1);
    this.setClientResetEpoch(resetEpoch);

    // 1. Wipe local storage IMMEDIATELY and broadcast FORCE_RESET so no timer/peer tab can re-upload old products
    storageService.resetEverything(false);
    this.broadcastForceReset(resetEpoch);
    if (this.onDataChangedCallback) {
      this.onDataChangedCallback();
    }

    try {
      // 2. Wait briefly for any in-flight sync to settle so no stale request lands after our wipe
      const inflight: Promise<unknown>[] = [];
      if (this.activeSyncPromise) inflight.push(this.activeSyncPromise.catch(() => {}));
      if (this.initialSyncPromise) inflight.push(this.initialSyncPromise.catch(() => {}));
      if (inflight.length > 0) {
        await Promise.race([
          Promise.allSettled(inflight),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      }

      // 3. Wipe remote Express backend stores with strict timeouts
      const resetUrlsToTry: string[] = [];
      const customUrl = this.getBackendUrl();
      if (customUrl) {
        resetUrlsToTry.push(customUrl.endsWith('/') ? `${customUrl}api/pos/reset` : `${customUrl}/api/pos/reset`);
      } else {
        resetUrlsToTry.push('/api/pos/reset');
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        if (currentOrigin !== DEFAULT_CLOUD_BACKEND_URL) {
          resetUrlsToTry.push(`${DEFAULT_CLOUD_BACKEND_URL}/api/pos/reset`);
        }
      }

      await Promise.allSettled(
        resetUrlsToTry.map(async (targetUrl) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          try {
            const resp = await fetch(targetUrl, { method: 'POST', signal: controller.signal });
            if (resp.ok) {
              const contentType = resp.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const json = await resp.json();
                const srvEpoch = Number(json?.resetEpoch || 0);
                if (srvEpoch > resetEpoch) {
                  resetEpoch = srvEpoch;
                  this.setClientResetEpoch(resetEpoch);
                }
              }
            }
          } catch {
            // Ignore unreachable fallback endpoint
          } finally {
            clearTimeout(timeoutId);
          }
        })
      );

      // 4. Wipe live Supabase tables (if configured) in FK-safe order using type-agnostic filters
      if (isSupabaseConfigured()) {
        const client = await getSupabase();
        if (client) {
          try {
            const tablesById = [
              'sale_items',
              'sales',
              'credit_payments',
              'expenses',
              'products',
              'customers',
              'app_users',
              'store_users',
            ];
            for (const tableName of tablesById) {
              try {
                const { error } = await client.from(tableName).delete().not('id', 'is', null);
                if (error && tableName === 'products') {
                  // Fallback explicit delete by id list in case PostgREST filter behaved unexpectedly
                  const { data: remaining } = await client.from('products').select('id');
                  if (remaining && remaining.length > 0) {
                    const ids = remaining.map((r: any) => r.id).filter(Boolean);
                    if (ids.length > 0) {
                      await client.from('products').delete().in('id', ids);
                    }
                  }
                }
              } catch {}
            }

            try {
              await client.from('store_settings').delete().not('key', 'is', null);
            } catch {}

            // Write a factory reset tombstone so peer devices wipe cleanly instead of re-uploading stale data
            const resetAt = new Date().toISOString();
            try {
              await client.from('customers').upsert({
                id: '__system_reset_tombstone__',
                name: '__SYSTEM_RESET_TOMBSTONE__',
                phone: '+251 00 000 0000',
                credit_balance: 0,
                credit_limit: 0,
                total_purchased: 0,
                notes: JSON.stringify({ resetAt, resetEpoch }),
              });
              if (typeof window !== 'undefined') {
                localStorage.setItem('sappy_pos_last_reset_ack', resetAt);
              }
            } catch {}
          } catch (supaErr) {
            console.warn('Supabase reset warning:', supaErr);
          }
        }
      }
    } finally {
      // 5. Final ironclad local wipe & release reset lock
      this.setClientResetEpoch(resetEpoch);
      storageService.resetEverything(false);
      this.broadcastForceReset(resetEpoch);
      this.isResetting = false;

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        message: 'All data, users, and catalog records permanently wiped clean across all devices',
      });

      if (this.onDataChangedCallback) {
        this.onDataChangedCallback();
      }
    }

    return true;
  }
}

export const crossDeviceSyncService = new CrossDeviceSyncService();

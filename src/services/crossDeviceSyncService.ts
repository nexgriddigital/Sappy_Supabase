import { storageService } from './storageService.ts';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { Product, Customer, Sale, CreditPayment, Expense } from '../types/pos.ts';

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

export const DEFAULT_CLOUD_BACKEND_URL = 'https://ais-pre-r3d7544mmard67yh6cqteh-17765999408.europe-west2.run.app';

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
  private syncQueued = false;
  private actionDebounceTimer: any = null;
  private broadcastChannel: any = null;

  constructor() {
    // 1. Subscribe to any storage mutations (actions completed anywhere in the app)
    storageService.subscribeToChanges(() => {
      this.triggerActionSync();
    });

    if (typeof window !== 'undefined') {
      // 2. Unconditional 15-second background interval sync
      this.startSyncTimer(15000);

      // Network status listeners
      window.addEventListener('online', () => {
        this.triggerActionSync(10);
      });
      window.addEventListener('offline', () => {
        this.updateState({
          status: 'offline',
          message: 'Offline mode: Changes stored locally',
        });
      });

      // Sync on window/tab focus or visibility change
      window.addEventListener('focus', () => {
        this.triggerActionSync(10);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.triggerActionSync(10);
        }
      });

      // BroadcastChannel for instant same-browser cross-tab syncing
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('sappy_pos_sync_channel');
          this.broadcastChannel.onmessage = (event: MessageEvent) => {
            if (event.data?.type === 'DATA_UPDATED') {
              if (this.onDataChangedCallback) {
                this.onDataChangedCallback();
              }
              // Lightly trigger sync to ensure local state reflects peer tab update
              this.syncNow();
            }
          };
        } catch {
          // Ignore BroadcastChannel errors in restricted contexts
        }
      }
    }
  }

  /**
   * Starts or restarts the recurring background auto-sync timer (defaults to 15 seconds).
   */
  public startSyncTimer(intervalMs = 15000) {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = setInterval(() => {
      this.syncNow();
    }, intervalMs);
  }

  /**
   * Immediately schedules a sync whenever any action completes.
   * Debounces by default (e.g. 60ms) to coalesce rapid multi-record operations.
   * If a sync is currently in progress, marks a follow-up sync as queued.
   */
  public triggerActionSync(delayMs = 60) {
    if (this.actionDebounceTimer) {
      clearTimeout(this.actionDebounceTimer);
    }
    this.actionDebounceTimer = setTimeout(() => {
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
   * Checks primary endpoint and falls back to live Cloud Run server automatically.
   */
  public async initialSync(): Promise<boolean> {
    const backend = this.getBackendUrl();
    const urlsToTry: string[] = [];

    if (backend) {
      urlsToTry.push(backend.endsWith('/') ? `${backend}api/pos/state` : `${backend}/api/pos/state`);
    } else {
      urlsToTry.push('/api/pos/state');
      urlsToTry.push(`${DEFAULT_CLOUD_BACKEND_URL}/api/pos/state`);
    }

    for (const targetUrl of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            continue; // Not JSON (probably HTML 404 page from static host)
          }

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
        // Try fallback url
      }
    }

    return this.syncNow();
  }

  /**
   * Initializes background polling and binds data refresh handler.
   * Auto sync runs every 15 seconds unconditionally.
   */
  public init(onDataChanged: () => void) {
    this.onDataChangedCallback = onDataChanged;
    this.startSyncTimer(15000);
  }

  /**
   * Performs an immediate bi-directional sync.
   * Priority 1: Backend Express Server (/api/pos/sync or custom backend URL).
   * Priority 2: Direct Supabase Client (if configured).
   * Fallback: Local offline mode.
   */
  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) {
      this.syncQueued = true;
      return false;
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.updateState({ status: 'offline', message: 'No internet connection' });
      return false;
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', message: 'Connecting to cloud sync...' });

    const finishSync = (success: boolean) => {
      this.isSyncing = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        setTimeout(() => {
          this.syncNow();
        }, 50);
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
      postUrlsToTry.push(`${DEFAULT_CLOUD_BACKEND_URL}/api/pos/sync`);
    }

    const localData = storageService.getAllData();

    for (const targetUrl of postUrlsToTry) {
      try {
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
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            continue; // Not JSON (probably HTML 404 page from static host)
          }

          const result = await response.json();
          if (result.success && result.state) {
            storageService.hydrateFromServer(result.state);

            this.updateState({
              status: 'synced',
              mode: 'server',
              lastSyncedAt: result.serverTime || new Date().toISOString(),
              message: 'Server synced (Express Cloud)',
              serverVersion: result.version || this.syncState.serverVersion + 1,
            });

            if (this.onDataChangedCallback) {
              this.onDataChangedCallback();
            }
            this.broadcastLocalChange();
            return finishSync(true);
          }
        }
      } catch {
        // Try fallback URL
      }
    }

    // --- STEP 2: Attempt Direct Supabase Sync (All 5 POS Entities) ---
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          let hasRlsError = false;

          // 1. Products Sync
          try {
            const { data: remoteProducts } = await client.from('products').select('*');
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
              }));
              const localProducts = storageService.getProducts();
              const prodMap = new Map(localProducts.map((p) => [p.id, p]));
              for (const rp of mappedProducts) {
                prodMap.set(rp.id, rp);
              }
              storageService.hydrateFromServer({ products: Array.from(prodMap.values()) });
            }

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
                try {
                  await client.from('customers').delete().eq('id', delId);
                } catch {}
              }
            }

            const { data: remoteCustomers } = await client.from('customers').select('*');
            if (remoteCustomers && Array.isArray(remoteCustomers) && remoteCustomers.length > 0) {
              const delSet = new Set(deletedCustIds);
              const mappedCustomers = remoteCustomers
                .filter((c: any) => !delSet.has(c.id))
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
                }));
              const localCust = storageService.getCustomers();
              const custMap = new Map(localCust.map((c) => [c.id, c]));
              for (const rc of mappedCustomers) {
                custMap.set(rc.id, rc);
              }
              storageService.hydrateFromServer({ customers: Array.from(custMap.values()) });
            }

            const currentCustomers = storageService.getCustomers();
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
                salesMap.set(rs.id, rs);
              }
              storageService.hydrateFromServer({ sales: Array.from(salesMap.values()) });
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

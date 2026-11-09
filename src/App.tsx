import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, TabType } from './components/Navbar.tsx';
import { DashboardTab } from './components/DashboardTab.tsx';
import { RegisterTab } from './components/RegisterTab.tsx';
import { SalesLedgerTab } from './components/SalesLedgerTab.tsx';
import { CreditDebtTab } from './components/CreditDebtTab.tsx';
import { InventoryTab } from './components/InventoryTab.tsx';
import { ExpensesTab } from './components/ExpensesTab.tsx';
import { ReportsTab } from './components/ReportsTab.tsx';
import { QRBarcodeStudioTab } from './components/QRBarcodeStudioTab.tsx';
import { UsersTab } from './components/UsersTab.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { SupabaseSyncTab } from './components/SupabaseSyncTab.tsx';
import { A4InvoiceModal } from './components/A4InvoiceModal.tsx';
import { AuthPage } from './components/AuthPage.tsx';
import { CloudSyncModal } from './components/CloudSyncModal.tsx';
import { MasterPasscodeModal } from './components/MasterPasscodeModal.tsx';
import { CustomerDisplayModal } from './components/CustomerDisplayModal.tsx';
import { CommandPaletteModal } from './components/CommandPaletteModal.tsx';
import { ToastNotification, ToastMessage } from './components/ToastNotification.tsx';
import { soundEffects } from './utils/soundEffects.ts';
import { STARTER_STATIONERY_PRODUCTS } from './data/starterCatalog.ts';
import { storageService } from './services/storageService.ts';
import { crossDeviceSyncService, SyncState } from './services/crossDeviceSyncService.ts';
import { LoadingScreen } from './components/LoadingAnimation.tsx';
import { isSupabaseConfigured } from './lib/supabase.ts';
import { checkAndApplyUrlPairing } from './services/pairingService.ts';
import {
  Customer,
  CreditPayment,
  Expense,
  Product,
  Sale,
  StoreConfig,
  AppUser,
  CartItem,
} from './types/pos.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => storageService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState<boolean>(false);
  const [criticalChallenge, setCriticalChallenge] = useState<{
    actionName: string;
    actionDescription: string;
    onExecute: () => void;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [users, setUsers] = useState<AppUser[]>(() => storageService.getUsers());
  const [config, setConfig] = useState<StoreConfig>(storageService.getStoreConfig());

  // Cross-device sync state
  const [syncState, setSyncState] = useState<SyncState>(() => crossDeviceSyncService.getState());
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Invoice Modal State
  const [activeInvoice, setActiveInvoice] = useState<Sale | null>(null);

  // UI/UX Upgrades State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => soundEffects.getIsMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeCartData, setActiveCartData] = useState<{
    cart: CartItem[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    taxRate: number;
    grandTotal: number;
    customer?: Customer | null;
  }>({
    cart: [],
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    taxRate: 0,
    grandTotal: 0,
    customer: null,
  });

  // Supabase connection flag
  const [dbConnected, setDbConnected] = useState<boolean>(isSupabaseConfigured());

  // Toast Notification helper
  const showToast = useCallback((title: string, description?: string, type: 'success' | 'error' | 'info' = 'success', durationMs = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastMessage = { id, title, description, type, durationMs };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // POS Sound Toggle
  const handleToggleSound = useCallback(() => {
    const muted = soundEffects.toggleMute();
    setIsSoundMuted(muted);
    if (!muted) {
      soundEffects.playBeep();
      showToast('POS Sound Feedback Enabled', 'Scanner beeps and cash register chimes active', 'success', 2500);
    } else {
      showToast('POS Sound Feedback Muted', 'Terminal audio feedback silenced', 'info', 2500);
    }
  }, [showToast]);

  // Touchscreen Fullscreen Toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        showToast('Touch POS Fullscreen Mode', 'Press Esc or toggle icon to exit full screen', 'info', 2500);
      }).catch(() => {
        // Fullscreen prevented by browser
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, [showToast]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Global Keyboard Shortcuts (Cmd+K, Ctrl+K, and '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === '/' && !isCommandPaletteOpen) {
        const target = e.target as HTMLElement;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          setIsCommandPaletteOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  // Load data from storage service
  const reloadData = useCallback(() => {
    setProducts(storageService.getProducts());
    setCustomers(storageService.getCustomers());
    setSales(storageService.getSales());
    setExpenses(storageService.getExpenses());
    setCreditPayments(storageService.getCreditPayments());
    setUsers(storageService.getUsers());
    setConfig(storageService.getStoreConfig());
    setDbConnected(isSupabaseConfigured());
  }, []);

  // Load 16 Stationery Essentials Starter Pack
  const handleLoadStarterPack = useCallback(() => {
    const now = Date.now();
    STARTER_STATIONERY_PRODUCTS.forEach((starterItem, index) => {
      const p: Product = {
        ...starterItem,
        id: `prod-stn-${now}-${index + 1}`,
      };
      storageService.saveProduct(p);
    });

    reloadData();
    crossDeviceSyncService.syncNow();
    soundEffects.playCashRegister();
    showToast(
      'Starter Pack Loaded (16 Products)',
      'High-demand stationery essentials (Parker, Bic, Oxford, Double A, Casio) added to catalog.',
      'success',
      4500
    );
  }, [reloadData, showToast]);

  // Initialize data and cross-device sync service
  useEffect(() => {
    let isMounted = true;

    // Check if device opened with 1-click pairing link (#pair=...)
    const didPairFromUrl = checkAndApplyUrlPairing();
    if (didPairFromUrl) {
      reloadData();
      setDbConnected(true);
      const ownerUser = storageService.getUsers().find((u) => u.role === 'owner') || storageService.getUsers()[0];
      if (ownerUser) {
        storageService.setCurrentUser(ownerUser);
        setCurrentUser(ownerUser);
      }
      showToast(
        'Device Paired Successfully',
        'Connected to Sappy Stationary cloud database and synchronized!',
        'success',
        5000
      );
    } else {
      // Load any existing local data
      reloadData();
    }

    // Subscribe to cross-device sync state changes
    const unsubscribe = crossDeviceSyncService.subscribe((state) => {
      setSyncState(state);
    });

    // Start background syncing with server
    crossDeviceSyncService.init(reloadData);

    // Initial server state fetch: await remote canonical state before deciding Auth mode
    const startupPromise = crossDeviceSyncService.initialSync();
    const minLoaderPromise = new Promise((resolve) => setTimeout(resolve, 400));
    const safetyTimeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));

    Promise.race([
      Promise.all([startupPromise, minLoaderPromise]),
      safetyTimeoutPromise,
    ]).then(() => {
      if (isMounted) {
        reloadData();
        const activeUser = storageService.getCurrentUser();
        if (activeUser) {
          setCurrentUser(activeUser);
        }
        setIsInitialLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [reloadData, showToast]);

  // Complete Sale
  const handleCompleteSale = (
    saleData: Omit<Sale, 'id' | 'invoiceNumber' | 'timestamp'>
  ): Sale => {
    const newSale = storageService.recordSale(saleData);
    reloadData();
    crossDeviceSyncService.syncNow();
    return newSale;
  };

  // Customer Management
  const handleSaveCustomer = (customer: Customer) => {
    storageService.saveCustomer(customer);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  const handleRecordPayment = (
    payment: Omit<CreditPayment, 'id' | 'timestamp' | 'receiptNumber'> & { timestamp?: string }
  ) => {
    storageService.recordCreditPayment(payment);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  const handleAdjustCredit = (customerId: string, amountDelta: number, reason: string) => {
    const cust = customers.find((c) => c.id === customerId);
    setCriticalChallenge({
      actionName: 'Manual Debt Adjustment',
      actionDescription: `Adjust outstanding credit balance for "${cust?.name || customerId}" by ${amountDelta > 0 ? '+' : ''}${amountDelta} ${config.currencySymbol}. Reason: ${reason || 'Manual override'}`,
      onExecute: () => {
        storageService.adjustCustomerCredit(customerId, amountDelta, reason);
        reloadData();
        crossDeviceSyncService.syncNow();
      },
    });
  };

  // Product Management
  const handleSaveProduct = (product: Product) => {
    storageService.saveProduct(product);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setCriticalChallenge({
      actionName: 'Delete Inventory Product',
      actionDescription: `Permanently delete product "${prod?.name || productId}" (${prod?.sku || 'SKU'}) from store catalog.`,
      onExecute: () => {
        storageService.deleteProduct(productId);
        reloadData();
        crossDeviceSyncService.syncNow();
      },
    });
  };

  const handleAdjustStock = (productId: string, delta: number) => {
    storageService.adjustStock(productId, delta);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  // Expense Management
  const handleSaveExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    storageService.saveExpense(expense);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  const handleDeleteExpense = (expenseId: string) => {
    const exp = expenses.find((e) => e.id === expenseId);
    setCriticalChallenge({
      actionName: 'Delete Expense Entry',
      actionDescription: `Permanently delete expense record "${exp?.title || expenseId}" (${config.currencySymbol}${exp?.amount.toFixed(2)}).`,
      onExecute: () => {
        storageService.deleteExpense(expenseId);
        reloadData();
        crossDeviceSyncService.syncNow();
      },
    });
  };

  // Config Management
  const handleSaveConfig = (updatedConfig: StoreConfig) => {
    storageService.saveStoreConfig(updatedConfig);
    reloadData();
    crossDeviceSyncService.broadcastLocalChange();
    crossDeviceSyncService.syncNow();
  };

  // User Authentication
  const handleAuthSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    crossDeviceSyncService.syncNow();
  };

  const handleSignOut = () => {
    storageService.setCurrentUser(null);
    setCurrentUser(null);
    showToast('Signed Out', 'Please sign in to access terminal', 'info', 2500);
  };

  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  // Initial startup loading screen with golden SAPPY branding
  if (isInitialLoading) {
    return (
      <LoadingScreen
        message="Connecting SAPPY Cloud Sync..."
        submessage="Synchronizing stationery catalog, inventory, and sales ledgers across devices"
      />
    );
  }

  // Login is strictly required: if no staff user is logged in, show the full-screen Login page
  if (!currentUser) {
    const hasUsers = storageService.hasUsers();
    return (
      <div className="min-h-screen bg-charcoal-950 text-charcoal-100 flex flex-col font-sans selection:bg-forest-700 selection:text-white">
        <AuthPage
          onAuthSuccess={handleAuthSuccess}
          initialMode={hasUsers ? 'login' : 'setup'}
          isModal={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-100 flex flex-col font-sans selection:bg-forest-700 selection:text-white">
      
      {/* Top Bar Navigation with Live Sync Pulse */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cartItemCount={activeCartData.cart.reduce((sum, item) => sum + item.quantity, 0)}
        dbConnected={dbConnected}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenAuth={handleOpenAuth}
        syncStatus={syncState.status}
        isSyncing={syncState.status === 'syncing'}
        onManualSync={() => crossDeviceSyncService.syncNow()}
        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenCustomerDisplay={() => setIsCustomerDisplayOpen(true)}
        isSoundMuted={isSoundMuted}
        onToggleSound={handleToggleSound}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col pb-20 md:pb-6">
        {activeTab === 'dashboard' && (
          <DashboardTab
            sales={sales}
            products={products}
            customers={customers}
            expenses={expenses}
            config={config}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
          />
        )}

        {activeTab === 'register' && (
          <RegisterTab
            products={products}
            customers={customers}
            config={config}
            onCompleteSale={handleCompleteSale}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
            onAddNewCustomer={handleSaveCustomer}
            onCartChange={setActiveCartData}
            onOpenCustomerDisplay={() => setIsCustomerDisplayOpen(true)}
            onLoadStarterPack={handleLoadStarterPack}
          />
        )}

        {activeTab === 'sales' && (
          <SalesLedgerTab
            sales={sales}
            config={config}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
          />
        )}

        {activeTab === 'credit' && (
          <CreditDebtTab
            customers={customers}
            sales={sales}
            creditPayments={creditPayments}
            config={config}
            onSaveCustomer={handleSaveCustomer}
            onRecordPayment={handleRecordPayment}
            onAdjustCredit={handleAdjustCredit}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            products={products}
            config={config}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onAdjustStock={handleAdjustStock}
            onRefreshData={reloadData}
            onLoadStarterPack={handleLoadStarterPack}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesTab
            expenses={expenses}
            config={config}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            sales={sales}
            expenses={expenses}
            creditPayments={creditPayments}
            products={products}
            customers={customers}
            config={config}
          />
        )}

        {activeTab === 'qrstudio' && (
          <QRBarcodeStudioTab
            products={products}
            config={config}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            currentUser={currentUser}
            config={config}
            users={users}
            onUserChanged={(u) => {
              setCurrentUser(u);
              reloadData();
            }}
            onRefreshData={reloadData}
            syncState={syncState}
            onSyncNow={async () => {
              const res = await crossDeviceSyncService.syncNow();
              reloadData();
              return res;
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            onSaveConfig={handleSaveConfig}
            onDataReset={reloadData}
            sales={sales}
            expenses={expenses}
            products={products}
            customers={customers}
            onNavigate={(tab) => setActiveTab(tab)}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'sync' && (
          <SupabaseSyncTab
            config={config}
            onRefreshData={reloadData}
          />
        )}
      </main>

      {/* Full-Page A4 Tax Invoice Modal */}
      {activeInvoice && (
        <A4InvoiceModal
          sale={activeInvoice}
          config={config}
          onClose={() => setActiveInvoice(null)}
        />
      )}

      {/* Switch User / Auth Modal */}
      {isAuthModalOpen && (
        <AuthPage
          onAuthSuccess={handleAuthSuccess}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode="login"
          isModal={true}
        />
      )}

      {/* Cloud Sync Connection & Settings Modal */}
      {isCloudSyncModalOpen && (
        <CloudSyncModal
          isOpen={isCloudSyncModalOpen}
          onClose={() => setIsCloudSyncModalOpen(false)}
          syncState={syncState}
          onNavigateToSyncTab={() => setActiveTab('sync')}
          onRefreshData={reloadData}
        />
      )}

      {/* Master Passcode Challenge Modal for Critical System Operations */}
      {criticalChallenge && (
        <MasterPasscodeModal
          isOpen={Boolean(criticalChallenge)}
          title="Master Passcode Required"
          actionName={criticalChallenge.actionName}
          actionDescription={criticalChallenge.actionDescription}
          onSuccess={() => {
            const action = criticalChallenge.onExecute;
            setCriticalChallenge(null);
            action();
          }}
          onCancel={() => setCriticalChallenge(null)}
        />
      )}

      {/* Customer Facing Counter Display & 80mm Thermal Slip Modal */}
      <CustomerDisplayModal
        isOpen={isCustomerDisplayOpen}
        onClose={() => setIsCustomerDisplayOpen(false)}
        cart={activeCartData.cart}
        subtotal={activeCartData.subtotal}
        discountAmount={activeCartData.discountAmount}
        taxAmount={activeCartData.taxAmount}
        taxRate={activeCartData.taxRate}
        grandTotal={activeCartData.grandTotal}
        customer={activeCartData.customer}
        config={config}
        currentUser={currentUser}
        completedSale={activeInvoice}
      />

      {/* Global Command Palette / Omni-Search Modal (Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        customers={customers}
        config={config}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenSwitchUser={() => setIsAuthModalOpen(true)}
        onLoadStarterPack={handleLoadStarterPack}
        currentUser={currentUser}
      />

      {/* Floating System Feedback Toasts */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      {/* Footer */}
      <footer className="no-print bg-charcoal-900 border-t border-charcoal-800 py-4 px-6 text-center text-xs text-charcoal-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 {config.storeName} — Commercial Point of Sale & Financial Management Hub</p>
          <div className="flex items-center gap-4 text-[11px] text-charcoal-400 font-mono">
            <span className="text-forest-400 font-semibold">Currency: {config.currencySymbol.trim()} ({config.currencyCode})</span>
            <span>·</span>
            <span className="text-forest-400 font-semibold">Supabase Free Tier (PostgreSQL)</span>
            <span>·</span>
            <span>Tax Reg: {config.taxId}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

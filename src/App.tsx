import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Navbar, TabType } from './components/Navbar.tsx';
import { ToastNotification, ToastMessage } from './components/ToastNotification.tsx';
import { soundEffects } from './utils/soundEffects.ts';
import { storageService } from './services/storageService.ts';
import { crossDeviceSyncService, SyncState } from './services/crossDeviceSyncService.ts';
import { LoadingScreen } from './components/LoadingAnimation.tsx';
import { checkAndApplyUrlPairing } from './services/pairingService.ts';
import { extractVerifyToken } from './utils/invoiceAuth.ts';
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

const AuthPage = lazy(() => import('./components/AuthPage.tsx').then((m) => ({ default: m.AuthPage })));
const DashboardTab = lazy(() => import('./components/DashboardTab.tsx').then((m) => ({ default: m.DashboardTab })));
const RegisterTab = lazy(() => import('./components/RegisterTab.tsx').then((m) => ({ default: m.RegisterTab })));
const SalesLedgerTab = lazy(() => import('./components/SalesLedgerTab.tsx').then((m) => ({ default: m.SalesLedgerTab })));
const ActivityTab = lazy(() => import('./components/ActivityTab.tsx').then((m) => ({ default: m.ActivityTab })));
const CreditDebtTab = lazy(() => import('./components/CreditDebtTab.tsx').then((m) => ({ default: m.CreditDebtTab })));
const InventoryTab = lazy(() => import('./components/InventoryTab.tsx').then((m) => ({ default: m.InventoryTab })));
const ExpensesTab = lazy(() => import('./components/ExpensesTab.tsx').then((m) => ({ default: m.ExpensesTab })));
const ReportsTab = lazy(() => import('./components/ReportsTab.tsx').then((m) => ({ default: m.ReportsTab })));
const QRBarcodeStudioTab = lazy(() => import('./components/QRBarcodeStudioTab.tsx').then((m) => ({ default: m.QRBarcodeStudioTab })));
const UsersTab = lazy(() => import('./components/UsersTab.tsx').then((m) => ({ default: m.UsersTab })));
const SettingsTab = lazy(() => import('./components/SettingsTab.tsx').then((m) => ({ default: m.SettingsTab })));
const SupabaseSyncTab = lazy(() => import('./components/SupabaseSyncTab.tsx').then((m) => ({ default: m.SupabaseSyncTab })));
const A4InvoiceModal = lazy(() => import('./components/A4InvoiceModal.tsx').then((m) => ({ default: m.A4InvoiceModal })));
const CloudSyncModal = lazy(() => import('./components/CloudSyncModal.tsx').then((m) => ({ default: m.CloudSyncModal })));
const MasterPasscodeModal = lazy(() => import('./components/MasterPasscodeModal.tsx').then((m) => ({ default: m.MasterPasscodeModal })));
const CustomerDisplayModal = lazy(() => import('./components/CustomerDisplayModal.tsx').then((m) => ({ default: m.CustomerDisplayModal })));
const CommandPaletteModal = lazy(() => import('./components/CommandPaletteModal.tsx').then((m) => ({ default: m.CommandPaletteModal })));
const WelcomeAnimationModal = lazy(() => import('./components/WelcomeAnimationModal.tsx').then((m) => ({ default: m.WelcomeAnimationModal })));
const ChangeCredentialsModal = lazy(() => import('./components/ChangeCredentialsModal.tsx').then((m) => ({ default: m.ChangeCredentialsModal })));
const InvoiceVerificationPage = lazy(() => import('./components/InvoiceVerificationPage.tsx').then((m) => ({ default: m.InvoiceVerificationPage })));

const TabFallback = () => (
  <div className="flex-1 flex items-center justify-center p-12 min-h-[280px]">
    <div className="flex items-center gap-3 text-xs font-mono text-charcoal-400">
      <span className="w-4 h-4 rounded-full border-2 border-forest-500 border-t-transparent animate-spin" />
      <span>Loading view...</span>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => storageService.getCurrentUser());
  const [welcomeUser, setWelcomeUser] = useState<AppUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState<boolean>(false);
  const [isChangeCredentialsOpen, setIsChangeCredentialsOpen] = useState<boolean>(false);
  const [criticalChallenge, setCriticalChallenge] = useState<{
    actionName: string;
    actionDescription: string;
    onExecute: () => void;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>(() => storageService.getProducts());
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [sales, setSales] = useState<Sale[]>(() => storageService.getSales());
  const [expenses, setExpenses] = useState<Expense[]>(() => storageService.getExpenses());
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>(() => storageService.getCreditPayments());
  const [users, setUsers] = useState<AppUser[]>(() => storageService.getUsers());
  const [config, setConfig] = useState<StoreConfig>(() => storageService.getStoreConfig());

  // Cross-device sync state
  const [syncState, setSyncState] = useState<SyncState>(() => crossDeviceSyncService.getState());
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => !storageService.hasUsers());

  // Invoice Modal State
  const [activeInvoice, setActiveInvoice] = useState<Sale | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractVerifyToken(window.location.hash || window.location.search);
  });

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
    const prods = storageService.getProducts();
    const custs = storageService.getCustomers();
    const txSales = storageService.getSales();
    const exps = storageService.getExpenses();
    const pays = storageService.getCreditPayments();
    const usrs = storageService.getUsers();

    setProducts(prods);
    setCustomers(custs);
    setSales(txSales);
    setExpenses(exps);
    setCreditPayments(pays);
    setUsers(usrs);
    setConfig(storageService.getStoreConfig());

    if (prods.length === 0) {
      setActiveCartData({
        cart: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        taxRate: 0,
        grandTotal: 0,
        customer: null,
      });
    }
    if (txSales.length === 0) {
      setActiveInvoice(null);
    }

    // If all users have been wiped (e.g. Reset Everything), sign out immediately to prompt First-Time Setup
    if (usrs.length === 0) {
      setCurrentUser(null);
    } else {
      const freshSession = storageService.getCurrentUser();
      if (freshSession) {
        setCurrentUser(freshSession);
      }
    }
  }, []);

  // Load 16 Stationery Essentials Starter Pack
  const handleLoadStarterPack = useCallback(async () => {
    const { STARTER_STATIONERY_PRODUCTS } = await import('./data/starterCatalog.ts');
    const now = Date.now();
    STARTER_STATIONERY_PRODUCTS.forEach((starterItem, index) => {
      const p: Product = {
        ...starterItem,
        id: `prod-stn-${now}-${index + 1}`,
      };
      storageService.saveProduct(p);
    });

    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
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
      showToast(
        'Database Paired Successfully',
        'Cloud database connected! Please enter your PIN or password to sign in.',
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

    // Initial server state fetch: run immediately without blocking cached devices
    const startupPromise = crossDeviceSyncService.initialSync();
    const safetyTimeoutPromise = new Promise((resolve) => setTimeout(resolve, 300));

    Promise.race([startupPromise, safetyTimeoutPromise]).then(() => {
      if (isMounted) {
        reloadData();
        const activeUser = storageService.getCurrentUser();
        if (activeUser) {
          setCurrentUser(activeUser);
          if (!storageService.hasUserCompletedWelcome(activeUser.id)) {
            setWelcomeUser(activeUser);
          }
        }
        setIsInitialLoading(false);
      }
    });

    // If background initialSync finishes after the 300ms budget, hydrate UI seamlessly
    startupPromise.then(() => {
      if (isMounted) {
        reloadData();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [reloadData, showToast]);

  // Listen for QR verification URL hash changes (#verify=...)
  useEffect(() => {
    const syncVerifyFromUrl = () => {
      const token = extractVerifyToken(window.location.hash || window.location.search);
      if (token) {
        setVerifyToken(token);
      }
    };
    window.addEventListener('hashchange', syncVerifyFromUrl);
    return () => window.removeEventListener('hashchange', syncVerifyFromUrl);
  }, []);

  const handleExitVerification = useCallback(() => {
    setVerifyToken(null);
    try {
      if (
        typeof window !== 'undefined' &&
        (window.location.hash.includes('verify=') || window.location.search.includes('verify='))
      ) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      // Ignore history errors
    }
  }, []);

  // Complete Sale
  const handleCompleteSale = (
    saleData: Omit<Sale, 'id' | 'invoiceNumber' | 'timestamp'>
  ): Sale => {
    const newSale = storageService.recordSale(saleData);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
    return newSale;
  };

  // Return & Reverse Sale
  const handleReturnSale = (
    sale: Sale,
    reason: string,
    refundMethod: string
  ) => {
    const totalItemsCount = sale.items.reduce((acc, i) => acc + i.quantity, 0);
    setCriticalChallenge({
      actionName: 'Reverse Sale & Return Stock',
      actionDescription: `Reverse invoice "${sale.invoiceNumber}" (${config.currencySymbol}${sale.totalAmount.toFixed(2)}), restore ${totalItemsCount} item(s) back into inventory stock, and reverse realized revenue. Reason: ${reason}`,
      onExecute: () => {
        const result = storageService.returnSale(sale.id, {
          reason,
          refundMethod: refundMethod as any,
          returnedBy: currentUser ? currentUser.fullName : 'Store Staff',
        });
        if (result.success) {
          reloadData();
          crossDeviceSyncService.triggerActionSync(10);
          showToast(
            'Sale Reversed & Stock Restored',
            `Invoice ${sale.invoiceNumber} reversed. ${totalItemsCount} item(s) returned to inventory stock.`,
            'success'
          );
        } else {
          showToast(
            'Return Failed',
            result.error || 'Failed to process sale return.',
            'error'
          );
        }
      },
    });
  };

  // Customer Management
  const handleSaveCustomer = (customer: Customer) => {
    storageService.saveCustomer(customer);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
  };

  const handleRecordPayment = (
    payment: Omit<CreditPayment, 'id' | 'timestamp' | 'receiptNumber'> & { timestamp?: string }
  ) => {
    storageService.recordCreditPayment(payment);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
  };

  const handleAdjustCredit = (customerId: string, amountDelta: number, reason: string) => {
    const cust = customers.find((c) => c.id === customerId);
    setCriticalChallenge({
      actionName: 'Manual Debt Adjustment',
      actionDescription: `Adjust outstanding credit balance for "${cust?.name || customerId}" by ${amountDelta > 0 ? '+' : ''}${amountDelta} ${config.currencySymbol}. Reason: ${reason || 'Manual override'}`,
      onExecute: () => {
        storageService.adjustCustomerCredit(customerId, amountDelta, reason);
        reloadData();
        crossDeviceSyncService.triggerActionSync(10);
      },
    });
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    if (cust.creditBalance > 0) {
      setCriticalChallenge({
        actionName: 'Delete Customer with Debt',
        actionDescription: `Permanently delete customer "${cust.name}" who has an active outstanding debt of ${config.currencySymbol}${cust.creditBalance.toFixed(2)}. This will remove their credit record.`,
        onExecute: () => {
          storageService.deleteCustomer(customerId);
          reloadData();
          crossDeviceSyncService.triggerActionSync(10);
          showToast(
            'Customer Deleted',
            `Customer "${cust.name}" and credit record removed.`,
            'info'
          );
        },
      });
    } else {
      storageService.deleteCustomer(customerId);
      reloadData();
      crossDeviceSyncService.triggerActionSync(10);
      showToast(
        'Customer Deleted',
        `Customer "${cust.name}" removed from accounts.`,
        'info'
      );
    }
  };

  // Product Management
  const handleSaveProduct = (product: Product) => {
    storageService.saveProduct(product);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setCriticalChallenge({
      actionName: 'Delete Inventory Product',
      actionDescription: `Permanently delete product "${prod?.name || productId}" (${prod?.sku || 'SKU'}) from store catalog.`,
      onExecute: () => {
        storageService.deleteProduct(productId);
        reloadData();
        crossDeviceSyncService.triggerActionSync(10);
      },
    });
  };

  const handleAdjustStock = (productId: string, delta: number) => {
    storageService.adjustStock(productId, delta);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
  };

  // Expense Management
  const handleSaveExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    storageService.saveExpense(expense);
    reloadData();
    crossDeviceSyncService.triggerActionSync(10);
  };

  const handleDeleteExpense = (expenseId: string) => {
    const exp = expenses.find((e) => e.id === expenseId);
    setCriticalChallenge({
      actionName: 'Delete Expense Entry',
      actionDescription: `Permanently delete expense record "${exp?.title || expenseId}" (${config.currencySymbol}${exp?.amount.toFixed(2)}).`,
      onExecute: () => {
        storageService.deleteExpense(expenseId);
        reloadData();
        crossDeviceSyncService.triggerActionSync(10);
      },
    });
  };

  // Config Management
  const handleSaveConfig = (updatedConfig: StoreConfig) => {
    storageService.saveStoreConfig(updatedConfig);
    reloadData();
    crossDeviceSyncService.broadcastLocalChange();
    crossDeviceSyncService.triggerActionSync(10);
  };

  // User Authentication
  const handleAuthSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    crossDeviceSyncService.triggerActionSync(10);
    if (!storageService.hasUserCompletedWelcome(user.id)) {
      setWelcomeUser(user);
    }
  };

  const handleSignOut = () => {
    storageService.setCurrentUser(null);
    setCurrentUser(null);
    showToast('Signed Out', 'Please sign in to access terminal', 'info', 2500);
  };

  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  // Public / In-App Invoice QR Verification View (accessible directly on customer smartphones without POS login)
  if (verifyToken) {
    return (
      <Suspense fallback={<LoadingScreen message="Opening Invoice Verification..." submessage="Preparing cryptographic authenticity check" />}>
        <InvoiceVerificationPage
          tokenOrUrl={verifyToken}
          localSales={sales}
          isLoggedIn={Boolean(currentUser)}
          onExit={handleExitVerification}
          onOpenFullInvoice={(sale) => {
            handleExitVerification();
            setActiveInvoice(sale);
          }}
        />
      </Suspense>
    );
  }

  // Initial startup loading screen with golden SAPPY branding
  if (isInitialLoading) {
    return (
      <LoadingScreen
        message="Connecting SAPPY Cloud Sync..."
        submessage="Synchronizing stationery catalog, inventory, and sales ledgers across devices"
      />
    );
  }

  // Login is strictly required: every device must authenticate through the staff login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-charcoal-950 text-charcoal-100 flex flex-col font-sans selection:bg-forest-700 selection:text-white">
        <Suspense fallback={<LoadingScreen message="Loading Sappy Stationary POS..." submessage="Preparing staff login terminal" />}>
          <AuthPage
            onAuthSuccess={handleAuthSuccess}
            initialMode={storageService.hasUsers() ? 'login' : 'setup'}
            isModal={false}
          />
        </Suspense>
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
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenAuth={handleOpenAuth}
        syncStatus={syncState.status}
        onManualSync={() => crossDeviceSyncService.syncNow()}
        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenCustomerDisplay={() => setIsCustomerDisplayOpen(true)}
        isSoundMuted={isSoundMuted}
        onToggleSound={handleToggleSound}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenChangeCredentials={currentUser ? () => setIsChangeCredentialsOpen(true) : undefined}
      />

      {/* Main Tab Content */}
      <main className={`flex-1 flex flex-col pb-20 md:pb-6 ${activeInvoice ? 'print:hidden' : ''}`}>
        <Suspense fallback={<TabFallback />}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            sales={sales}
            products={products}
            customers={customers}
            expenses={expenses}
            config={config}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
            onAdjustStock={handleAdjustStock}
            onSaveProduct={handleSaveProduct}
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
            onVerifyInvoiceToken={(token) => setVerifyToken(token)}
          />
        )}

        {activeTab === 'sales' && (
          <SalesLedgerTab
            sales={sales}
            config={config}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
            onReturnSale={handleReturnSale}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityTab
            sales={sales}
            creditPayments={creditPayments}
            expenses={expenses}
            products={products}
            customers={customers}
            users={users}
            config={config}
            onOpenInvoice={(sale) => setActiveInvoice(sale)}
            onNavigate={(tab) => setActiveTab(tab)}
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
            onDeleteCustomer={handleDeleteCustomer}
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
            onPlayWelcome={(u) => setWelcomeUser(u)}
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
            onPlayWelcome={(u) => setWelcomeUser(u)}
          />
        )}

        {activeTab === 'sync' && (
          <SupabaseSyncTab
            config={config}
            onRefreshData={reloadData}
          />
        )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
      {/* Full-Page A4 Tax Invoice Modal */}
      {activeInvoice && (
        <A4InvoiceModal
          sale={activeInvoice}
          config={config}
          onClose={() => setActiveInvoice(null)}
          onVerifyPreview={(tokenOrUrl) => {
            const token = extractVerifyToken(tokenOrUrl);
            if (token) setVerifyToken(token);
          }}
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

      {/* Change Password (PW) & 4-Digit Quick PIN Modal */}
      {isChangeCredentialsOpen && currentUser && (
        <ChangeCredentialsModal
          isOpen={isChangeCredentialsOpen}
          targetUser={currentUser}
          currentUser={currentUser}
          onClose={() => setIsChangeCredentialsOpen(false)}
          onSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
            reloadData();
            showToast(
              'Security Credentials Updated',
              `Password / 4-digit PIN updated for ${updatedUser.fullName}.`,
              'success',
              3500
            );
          }}
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
      {isCustomerDisplayOpen && (
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
      )}

      {/* Global Command Palette / Omni-Search Modal (Cmd+K) */}
      {isCommandPaletteOpen && (
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
      )}

      {/* First Login Welcome Animation Modal */}
      {welcomeUser && (
        <WelcomeAnimationModal
          user={welcomeUser}
          config={config}
          isFirstLogin={!storageService.hasUserCompletedWelcome(welcomeUser.id)}
          onComplete={() => {
            storageService.setUserCompletedWelcome(welcomeUser.id);
            setWelcomeUser(null);
          }}
        />
      )}
      </Suspense>

      {/* Floating System Feedback Toasts */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      {/* Footer */}
      <footer className="no-print bg-charcoal-900 border-t border-charcoal-800 py-4 px-6 text-center text-xs text-charcoal-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 {config.storeName} — Commercial Point of Sale & Financial Management Hub</p>
          <div className="flex items-center gap-4 text-[11px] text-charcoal-400 font-mono">
            <span className="text-forest-400 font-semibold">Currency: {(config?.currencySymbol || 'Br').trim()} ({config?.currencyCode || 'ETB'})</span>
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

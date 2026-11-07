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
import { SettingsTab } from './components/SettingsTab.tsx';
import { SupabaseSyncTab } from './components/SupabaseSyncTab.tsx';
import { A4InvoiceModal } from './components/A4InvoiceModal.tsx';
import { AuthPage } from './components/AuthPage.tsx';
import { CloudSyncModal } from './components/CloudSyncModal.tsx';
import { storageService } from './services/storageService.ts';
import { crossDeviceSyncService, SyncState } from './services/crossDeviceSyncService.ts';
import { LoadingScreen } from './components/LoadingAnimation.tsx';
import { isSupabaseConfigured } from './lib/supabase.ts';
import {
  Customer,
  CreditPayment,
  Expense,
  Product,
  Sale,
  StoreConfig,
  AppUser,
} from './types/pos.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => storageService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [config, setConfig] = useState<StoreConfig>(storageService.getStoreConfig());

  // Cross-device sync state
  const [syncState, setSyncState] = useState<SyncState>(() => crossDeviceSyncService.getState());
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Invoice Modal State
  const [activeInvoice, setActiveInvoice] = useState<Sale | null>(null);

  // Supabase connection flag
  const [dbConnected, setDbConnected] = useState<boolean>(isSupabaseConfigured());

  // Load data from storage service
  const reloadData = useCallback(() => {
    setProducts(storageService.getProducts());
    setCustomers(storageService.getCustomers());
    setSales(storageService.getSales());
    setExpenses(storageService.getExpenses());
    setCreditPayments(storageService.getCreditPayments());
    setConfig(storageService.getStoreConfig());
    setDbConnected(isSupabaseConfigured());
  }, []);

  // Initialize data and cross-device sync service
  useEffect(() => {
    reloadData();

    // Subscribe to cross-device sync state changes
    const unsubscribe = crossDeviceSyncService.subscribe((state) => {
      setSyncState(state);
    });

    // Start background syncing with server
    crossDeviceSyncService.init(reloadData);

    // Initial smooth startup loader
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [reloadData]);

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
    storageService.adjustCustomerCredit(customerId, amountDelta, reason);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  // Product Management
  const handleSaveProduct = (product: Product) => {
    storageService.saveProduct(product);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  const handleDeleteProduct = (productId: string) => {
    storageService.deleteProduct(productId);
    reloadData();
    crossDeviceSyncService.syncNow();
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
    storageService.deleteExpense(expenseId);
    reloadData();
    crossDeviceSyncService.syncNow();
  };

  // Config Management
  const handleSaveConfig = (updatedConfig: StoreConfig) => {
    storageService.saveStoreConfig(updatedConfig);
    reloadData();
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

  // If no staff user is logged in, show the full-screen First-Launch Setup or Login page
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
        cartItemCount={0}
        dbConnected={dbConnected}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenAuth={handleOpenAuth}
        syncStatus={syncState.status}
        isSyncing={syncState.status === 'syncing'}
        onManualSync={() => crossDeviceSyncService.syncNow()}
        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
      />

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col">
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

        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            onSaveConfig={handleSaveConfig}
            onDataReset={reloadData}
            sales={sales}
            expenses={expenses}
            products={products}
            customers={customers}
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

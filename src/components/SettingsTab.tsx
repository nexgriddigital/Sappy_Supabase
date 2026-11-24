import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Building,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Upload,
  Database,
  CheckCircle,
  FileText,
  Trash2,
  RefreshCw,
  Info,
  ShieldAlert,
  UserCog,
  KeyRound,
  Lock,
  Sparkles,
  FileSpreadsheet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { StoreConfig, Sale, Expense, Product, Customer, AppUser } from '../types/pos.ts';
import { storageService, DEFAULT_MASTER_PASSCODE } from '../services/storageService.ts';
import {
  crossDeviceSyncService,
  AutoSyncMode,
  SyncState,
} from '../services/crossDeviceSyncService.ts';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { MasterPasscodeModal, ChangeMasterPasscodeModal } from './MasterPasscodeModal.tsx';
import { ChangeCredentialsModal } from './ChangeCredentialsModal.tsx';
import {
  exportStoreBackupToExcel,
  exportStoreBackupToPdf,
  restoreStoreBackupFromFile,
} from '../utils/exportHelpers.ts';

interface SettingsTabProps {
  config: StoreConfig;
  onSaveConfig: (updated: StoreConfig) => void;
  onDataReset: () => void;
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  onNavigate?: (tab: any) => void;
  currentUser?: AppUser | null;
  onPlayWelcome?: (user: AppUser) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  config,
  onSaveConfig,
  onDataReset,
  sales,
  expenses,
  products,
  customers,
  onNavigate,
  currentUser = null,
  onPlayWelcome,
}) => {
  // Master Passcode Security State
  const [criticalChallenge, setCriticalChallenge] = useState<{
    actionName: string;
    actionDescription: string;
    onExecute: () => void;
  } | null>(null);
  const [showChangePasscodeModal, setShowChangePasscodeModal] = useState(false);
  const [showChangeCredentialsModal, setShowChangeCredentialsModal] = useState(false);
  const [credentialsUpdatedMsg, setCredentialsUpdatedMsg] = useState<string | null>(null);
  // Form State
  const [formData, setFormData] = useState<StoreConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Yearly Reset State
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [carryDebt, setCarryDebt] = useState<boolean>(true);
  const [showYearlyModal, setShowYearlyModal] = useState(false);
  const [yearlyConfirmText, setYearlyConfirmText] = useState('');
  const [yearlySuccessMsg, setYearlySuccessMsg] = useState<string | null>(null);

  // Reset Everything State
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [resetAllConfirmText, setResetAllConfirmText] = useState('');
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [resetAllSuccessMsg, setResetAllSuccessMsg] = useState<string | null>(null);

  // Reset Transactions Only State
  const [showResetTxModal, setShowResetTxModal] = useState(false);
  const [resetTxConfirmText, setResetTxConfirmText] = useState('');

  // Backup / Restore State
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Supabase test state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Sync Settings (Live Sync vs Manual Sync Only)
  const [syncState, setSyncState] = useState<SyncState>(() => crossDeviceSyncService.getState());
  const [manualSyncBusy, setManualSyncBusy] = useState(false);

  useEffect(() => {
    return crossDeviceSyncService.subscribe((nextState) => {
      setSyncState(nextState);
    });
  }, []);

  const autoSyncMode: AutoSyncMode = syncState.autoSyncMode;

  const handleSetAutoSyncMode = (mode: AutoSyncMode) => {
    crossDeviceSyncService.setAutoSyncMode(mode);
  };

  const handleTriggerManualSync = async () => {
    setManualSyncBusy(true);
    try {
      await crossDeviceSyncService.syncNow();
      onDataReset();
    } finally {
      setManualSyncBusy(false);
    }
  };

  // Calculate year stats for preview
  const yearSalesCount = sales.filter((s) => s.timestamp.startsWith(selectedYear.toString())).length;
  const yearExpensesCount = expenses.filter((e) => e.date.startsWith(selectedYear.toString())).length;

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  // Export full backup in Excel (.xlsx)
  const handleExportBackup = () => {
    exportStoreBackupToExcel(formData);
  };

  // Export executive store snapshot in PDF (.pdf)
  const handleExportBackupPdf = () => {
    exportStoreBackupToPdf(formData);
  };

  // Import backup (.xlsx / .xls / .json)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ok = await restoreStoreBackupFromFile(file);
      if (ok) {
        setImportStatus('Backup restored successfully!');
        onDataReset();
        setTimeout(() => setImportStatus(null), 4000);
      } else {
        setImportStatus('Failed: Invalid backup file structure. Upload an exported .xlsx or .json backup.');
      }
    } catch {
      setImportStatus('Error reading backup file. Ensure valid Excel (.xlsx) or JSON backup.');
    }
    e.target.value = '';
  };

  // Perform Yearly Reset (Requires Master Passcode)
  const handleExecuteYearlyReset = () => {
    if (yearlyConfirmText.trim().toUpperCase() !== 'YEARLY RESET') return;

    setCriticalChallenge({
      actionName: `Yearly Fiscal Reset (${selectedYear})`,
      actionDescription: `Archive and permanently clear sales, expenses, and payment records for the year ${selectedYear}. Product inventory and customer catalog will be preserved.`,
      onExecute: () => {
        // Automatically trigger backup download first
        handleExportBackup();

        const result = storageService.yearlyReset(selectedYear, {
          resetCustomerBalances: !carryDebt,
        });

        onDataReset();
        setShowYearlyModal(false);
        setYearlyConfirmText('');
        setYearlySuccessMsg(
          `Year ${selectedYear} reset complete! Cleared ${result.clearedSalesCount} sales, ${result.clearedExpensesCount} expenses, and ${result.clearedPaymentsCount} payment receipts. Inventory & product catalog preserved.`
        );
        setTimeout(() => setYearlySuccessMsg(null), 8000);
      },
    });
  };

  // Perform Reset Everything (Full Clean Wipe - Requires Master Passcode)
  const handleExecuteResetAll = () => {
    if (isResettingAll || resetAllConfirmText.trim().toUpperCase() !== 'RESET ALL') return;

    setCriticalChallenge({
      actionName: 'Factory Reset (Wipe Everything)',
      actionDescription:
        'Permanently wipe all users, products (manual and bulk imported), customer accounts, sales invoices, debts, and expenses to an empty clean slate across all devices.',
      onExecute: async () => {
        setIsResettingAll(true);
        try {
          await crossDeviceSyncService.resetAllDevices();
          onDataReset();
          setShowResetAllModal(false);
          setResetAllConfirmText('');
        } finally {
          setIsResettingAll(false);
        }
      },
    });
  };

  // Perform Reset Transactions Only (Requires Master Passcode)
  const handleExecuteResetTx = () => {
    if (resetTxConfirmText.trim().toUpperCase() !== 'RESET TRANSACTIONS') return;

    setCriticalChallenge({
      actionName: 'Reset Transactions Only',
      actionDescription: `Clear all transaction ledgers (${sales.length} sales, ${expenses.length} expenses) while preserving all products and customer profiles.`,
      onExecute: () => {
        const result = storageService.resetTransactionsOnly();
        onDataReset();
        setShowResetTxModal(false);
        setResetTxConfirmText('');
        setResetAllSuccessMsg(
          `Transaction ledgers cleared (${result.clearedSalesCount} sales, ${result.clearedExpensesCount} expenses). All products and customer profiles preserved.`
        );
        setTimeout(() => setResetAllSuccessMsg(null), 8000);
      },
    });
  };

  // Supabase Push Sync
  const handleSupabaseSync = async () => {
    const client = await getSupabase();
    if (!isSupabaseConfigured() || !client) {
      setSyncStatus('Supabase credentials not configured in environment.');
      return;
    }
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const prods = storageService.getProducts();
      if (prods.length > 0) {
        const { error } = await client.from('products').upsert(
          prods.map((p) => ({
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
            description: p.description || '',
            updated_at: new Date().toISOString(),
          }))
        );
        if (error) throw error;
      }
      setSyncStatus('Successfully synchronized catalog to Supabase cloud!');
    } catch (err: any) {
      setSyncStatus(`Sync error: ${err.message || 'Check database connection'}`);
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSyncStatus(null), 6000);
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-8">
      {/* Header Banner */}
      <div className="bg-charcoal-900 rounded-2xl p-6 border border-charcoal-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-forest-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-forest-400">
              Control Panel & System Maintenance
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-forest-400" />
            Settings & Reset Manager
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-300 mt-1">
            Manage store profile, tax parameters, data backups, yearly ledger rollovers, and database resets.
          </p>
        </div>

        {/* Global Quick Action: Download Backup */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-forest-200" />
            <span>Export Backup (Excel)</span>
          </button>
          <button
            onClick={handleExportBackupPdf}
            className="px-4 py-2.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-white font-bold text-xs flex items-center gap-2 border border-charcoal-700 shadow-md transition-all cursor-pointer active:scale-95"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Store Snapshot (PDF)</span>
          </button>
        </div>
      </div>

      {/* Success / Notification Banners */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-forest-950 border border-forest-600 text-forest-200 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle className="w-5 h-5 text-forest-400 shrink-0" />
          <span>Store configuration and invoice details saved successfully!</span>
        </div>
      )}

      {yearlySuccessMsg && (
        <div className="p-4 rounded-xl bg-forest-950 border border-forest-500 text-forest-100 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle className="w-5 h-5 text-forest-400 shrink-0" />
          <span>{yearlySuccessMsg}</span>
        </div>
      )}

      {resetAllSuccessMsg && (
        <div className="p-4 rounded-xl bg-forest-950 border border-forest-500 text-forest-100 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle className="w-5 h-5 text-forest-400 shrink-0" />
          <span>{resetAllSuccessMsg}</span>
        </div>
      )}

      {importStatus && (
        <div className="p-4 rounded-xl bg-charcoal-900 border border-forest-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
          <Info className="w-5 h-5 text-forest-400 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Grid: 2 Columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Store Profile & Commercial Parameters (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleConfigSubmit} className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-forest-400" />
                <h2 className="text-base font-bold text-white">Store Identity & Invoice Header</h2>
              </div>
              <span className="text-[11px] font-mono text-forest-400 font-semibold">Ethiopian Birr (Br)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Store / Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Business Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Quality Stationery & Office Supplies"
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-charcoal-300 font-medium mb-1.5">Physical Address / Branch *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">TIN / Tax Registration Number *</label>
                <input
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Standard VAT / Tax Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.defaultTaxRate}
                    onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-2 text-charcoal-400 font-mono">%</span>
                </div>
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Currency Display Symbol</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Currency ISO Code</label>
                <input
                  type="text"
                  value={formData.currencyCode}
                  onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-charcoal-300 font-medium mb-1.5">Bank & Wire Payment Details (Printed on Invoices)</label>
                <textarea
                  rows={2}
                  value={formData.bankDetails}
                  onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
                  placeholder="e.g. Commercial Bank of Ethiopia (CBE) A/C: 1000234567890 | Telebirr: 0911234567"
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-charcoal-300 font-medium mb-1.5">Invoice / Receipt Terms & Policy Footer</label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  placeholder="e.g. Goods once sold cannot be returned without original receipt within 7 days."
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl px-3.5 py-2 text-white placeholder-charcoal-600 focus:outline-none focus:border-forest-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4 text-forest-200" />
                <span>Save Store Settings</span>
              </button>
            </div>
          </form>

          {/* Backup & Restore Panel */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-forest-400" />
                <h2 className="text-base font-bold text-white">Data Backup & Migration</h2>
              </div>
              <span className="text-[10px] font-mono text-charcoal-400">Excel & PDF Archive</span>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              Maintain full offline control of your stationery database. Download a timestamped Excel workbook (restorable) or a formatted PDF executive snapshot, or restore from previous backups.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                onClick={handleExportBackup}
                className="p-3.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-charcoal-700 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-forest-400" />
                <span>Backup (.xlsx)</span>
              </button>

              <button
                onClick={handleExportBackupPdf}
                className="p-3.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-charcoal-700 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                <span>Snapshot (.pdf)</span>
              </button>

              <label className="p-3.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-charcoal-700 transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-forest-400" />
                <span>Restore Backup</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Staff Accounts & Permissions Panel */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-forest-400" />
                <h2 className="text-base font-bold text-white">Staff Accounts & Terminal Access</h2>
              </div>
              <span className="text-[10px] font-mono text-forest-400">RBAC Security</span>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              Manage cashier accounts, store manager permissions, 4-digit quick register PINs, and shift assignments for your stationery counter terminals.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('users')}
                  className="px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <UserCog className="w-4 h-4 text-forest-200" />
                  <span>Open Users & Staff Directory</span>
                </button>
              )}

              {onPlayWelcome && currentUser && (
                <button
                  type="button"
                  onClick={() => onPlayWelcome(currentUser)}
                  className="px-4 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-2 border border-charcoal-700 transition-all cursor-pointer active:scale-95"
                  title="Replay the Welcome Animation for the active user"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Replay Welcome Experience</span>
                </button>
              )}
            </div>
          </div>

          {/* Account Login Password (PW) & 4-Digit Quick PIN Panel */}
          {currentUser && (
            <div className="bg-charcoal-900 rounded-2xl border border-forest-700/60 p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-forest-400" />
                  <h2 className="text-base font-bold text-white">My Account Password & Quick PIN</h2>
                </div>
                <span className="text-[10px] font-mono text-forest-300 font-semibold px-2 py-0.5 rounded-full bg-forest-950 border border-forest-700/70">
                  {currentUser.fullName}
                </span>
              </div>

              <p className="text-xs text-charcoal-300 leading-relaxed">
                Update your personal login Password (PW) or 4-digit Quick Terminal PIN for <strong className="text-white font-mono">{currentUser.email}</strong>. Changes synchronize across all paired terminals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 flex items-center justify-between">
                  <span className="text-charcoal-400">Login Password:</span>
                  <span className={currentUser.password ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {currentUser.password ? 'Custom PW Active' : 'Default Fallback'}
                  </span>
                </div>
                <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 flex items-center justify-between">
                  <span className="text-charcoal-400">Terminal PIN:</span>
                  <span className={currentUser.pinCode ? 'text-emerald-400 font-bold' : 'text-charcoal-400 font-bold'}>
                    {currentUser.pinCode ? '•••• (Active)' : 'Not Set'}
                  </span>
                </div>
              </div>

              {credentialsUpdatedMsg && (
                <div className="p-3 rounded-xl bg-forest-950 border border-forest-600 text-forest-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-forest-400 shrink-0" />
                  <span>{credentialsUpdatedMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChangeCredentialsModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <KeyRound className="w-4 h-4 text-forest-200" />
                  <span>Change Password & PIN</span>
                </button>
              </div>
            </div>
          )}

          {/* Master Security Passcode Panel */}
          <div className="bg-charcoal-900 rounded-2xl border border-amber-600/50 p-6 shadow-md space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Master Security Passcode</h2>
              </div>
              <span className="text-[10px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-950 border border-amber-600/60">
                Owner Protected
              </span>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              The Master Passcode is required to authorize critical actions across Sappy POS, including database wipes, fiscal resets, staff account removals, and sensitive catalog changes.
            </p>

            <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-charcoal-400">Current Status:</span>
                <span className="text-white font-bold">
                  {storageService.getMasterPasscode() === DEFAULT_MASTER_PASSCODE
                    ? 'Passcode Active (Default)'
                    : 'Custom Master Passcode Active'}
                </span>
              </div>
              {currentUser?.role === 'owner' ? (
                <span className="text-[10px] text-forest-400 font-bold">Authorized Owner</span>
              ) : (
                <span className="text-[10px] text-charcoal-500">Owner Access Only</span>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowChangePasscodeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-charcoal-950 font-bold text-xs flex items-center gap-2 border border-amber-400 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <KeyRound className="w-4 h-4" />
                <span>Change Master Passcode</span>
              </button>
            </div>
          </div>

          {/* Supabase Cloud Connection Panel */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-forest-400" />
                <h2 className="text-base font-bold text-white">Supabase Cloud Sync</h2>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                isSupabaseConfigured()
                  ? 'bg-forest-950 text-forest-300 border-forest-700'
                  : 'bg-charcoal-950 text-charcoal-400 border-charcoal-700'
              }`}>
                {isSupabaseConfigured() ? 'Cloud Ready' : 'Local Storage Mode'}
              </span>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              Cross-device synchronization connects your local POS terminal to the free-tier Supabase PostgreSQL cloud database for multi-device sync across mobile, tablet, and desktop.
            </p>

            {syncStatus && (
              <div className="p-3 rounded-xl bg-forest-950 border border-forest-600 text-forest-200 text-xs font-medium">
                {syncStatus}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSupabaseSync}
                disabled={syncLoading}
                className="px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 text-forest-200 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>{syncLoading ? 'Syncing to Supabase...' : 'Push Local Catalog to Supabase'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sync Settings, Resets & Fiscal Operations (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* 0. SYNC SETTINGS (Live Sync vs Manual Sync Only) */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-charcoal-800">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    autoSyncMode === 'live'
                      ? 'bg-forest-950 border-forest-700/80 text-forest-400'
                      : 'bg-amber-950 border-amber-700/80 text-amber-400'
                  }`}
                >
                  {autoSyncMode === 'live' ? (
                    <Wifi className="w-4 h-4" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">Sync Settings</h2>
                  <p className="text-[11px] text-charcoal-400">
                    Bandwidth & background synchronization control
                  </p>
                </div>
              </div>

              {/* Accessible Live / Manual Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={autoSyncMode === 'live'}
                aria-label="Toggle Live Sync"
                onClick={() =>
                  handleSetAutoSyncMode(autoSyncMode === 'live' ? 'manual' : 'live')
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                  autoSyncMode === 'live'
                    ? 'bg-forest-600 border-forest-500'
                    : 'bg-charcoal-800 border-amber-600/70'
                }`}
                title={
                  autoSyncMode === 'live'
                    ? 'Switch to Manual Sync Only (low-bandwidth mode)'
                    : 'Switch to Live Sync (automatic)'
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    autoSyncMode === 'live' ? 'translate-x-5.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Selectable Mode Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSetAutoSyncMode('live')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  autoSyncMode === 'live'
                    ? 'bg-forest-950/70 border-forest-500 ring-1 ring-forest-500/40'
                    : 'bg-charcoal-950 border-charcoal-800 hover:border-charcoal-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-forest-400" />
                    <span>Live Sync</span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-forest-400">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-charcoal-400 leading-relaxed">
                  Syncs automatically after every action and every 15s in the background.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSetAutoSyncMode('manual')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  autoSyncMode === 'manual'
                    ? 'bg-amber-950/50 border-amber-500 ring-1 ring-amber-500/40'
                    : 'bg-charcoal-950 border-charcoal-800 hover:border-charcoal-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Manual Sync Only</span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-amber-400">
                    Low Data
                  </span>
                </div>
                <p className="text-[11px] text-charcoal-400 leading-relaxed">
                  Pauses background polling & auto-sync for low-bandwidth connections.
                </p>
              </button>
            </div>

            {/* Active Mode Summary & On-Demand Sync Action */}
            <div className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 text-[11px]">
                <p className="font-mono font-bold text-white flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      autoSyncMode === 'live' ? 'bg-forest-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {autoSyncMode === 'live' ? 'Live Sync Enabled' : 'Manual Sync Only Active'}
                  </span>
                </p>
                <p className="text-charcoal-400 font-mono text-[10px]">
                  {syncState.lastSyncedAt
                    ? `Last synced: ${new Date(syncState.lastSyncedAt).toLocaleTimeString()}`
                    : syncState.message}
                </p>
              </div>

              <button
                type="button"
                onClick={handleTriggerManualSync}
                disabled={manualSyncBusy || syncState.status === 'syncing'}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                  autoSyncMode === 'manual'
                    ? 'bg-amber-600 hover:bg-amber-500 text-charcoal-950 border-amber-400'
                    : 'bg-charcoal-800 hover:bg-charcoal-700 text-white border-charcoal-700'
                }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    manualSyncBusy || syncState.status === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {manualSyncBusy || syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </span>
              </button>
            </div>
          </div>
          
          {/* 1. YEARLY RESET OPTION */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-forest-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2.5 pb-3 border-b border-charcoal-800">
              <span className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-700/80 flex items-center justify-center text-forest-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Yearly Fiscal Reset</h2>
                <p className="text-[11px] text-charcoal-400">Annual financial rollover & ledger closure</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-forest-950/60 border border-forest-800/80 text-xs text-forest-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-forest-300">
                <Info className="w-4 h-4 shrink-0 text-forest-400" />
                <span>What does Yearly Reset do?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-forest-300/90 leading-relaxed">
                <li>Archives and clears sales transactions for the chosen fiscal year.</li>
                <li>Clears recorded business expenses for that year.</li>
                <li>Clears historical credit payment receipts.</li>
                <li><strong className="text-white">PRESERVES 100%</strong> of your Master Product Catalog and current inventory stock levels.</li>
                <li><strong className="text-white">PRESERVES 100%</strong> of your Customer profiles.</li>
              </ul>
            </div>

            {/* Year Selector */}
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="block text-charcoal-300 font-medium mb-1.5">Fiscal Year to Reset</label>
                <div className="grid grid-cols-3 gap-2">
                  {[currentYear, currentYear - 1, currentYear - 2].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`py-2 px-3 rounded-xl font-mono font-bold text-center cursor-pointer border transition-colors ${
                        selectedYear === yr
                          ? 'bg-forest-700 text-white border-forest-500 shadow-sm'
                          : 'bg-charcoal-950 text-charcoal-400 border-charcoal-800 hover:bg-charcoal-800'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ledger Impact Preview */}
              <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 space-y-1 text-xs">
                <div className="flex justify-between text-charcoal-400">
                  <span>Sales in {selectedYear}:</span>
                  <span className="font-mono font-bold text-white">{yearSalesCount} invoices</span>
                </div>
                <div className="flex justify-between text-charcoal-400">
                  <span>Expenses in {selectedYear}:</span>
                  <span className="font-mono font-bold text-white">{yearExpensesCount} records</span>
                </div>
              </div>

              {/* Carry Debt Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-charcoal-950 border border-charcoal-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carryDebt}
                  onChange={(e) => setCarryDebt(e.target.checked)}
                  className="mt-0.5 rounded border-charcoal-700 text-forest-500 focus:ring-forest-500"
                />
                <div className="text-[11px] leading-tight">
                  <span className="font-semibold text-white block">Carry forward unpaid customer debts</span>
                  <span className="text-charcoal-400">Keep outstanding credit balances active for recovery in the new year.</span>
                </div>
              </label>

              <button
                type="button"
                onClick={() => {
                  setYearlyConfirmText('');
                  setShowYearlyModal(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-forest-600 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-forest-300" />
                <span>Perform Yearly Reset for {selectedYear}</span>
              </button>
            </div>
          </div>

          {/* 2. RESET EVERYTHING (FACTORY RESET) */}
          <div className="bg-charcoal-900 rounded-2xl border border-rose-950/60 p-6 shadow-md space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2.5 pb-3 border-b border-charcoal-800">
              <span className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Reset Everything</h2>
                <p className="text-[11px] text-rose-400 font-semibold">Destructive Action / Factory Wipe</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Full System Clean Slate (Includes Users & All Data)</span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                Permanently wipes everything: all staff and owner accounts, all products (both manually created and bulk-imported), customer accounts and debts, sales invoices, payment receipts, and expenses across all connected devices and cloud databases. The terminal will return to clean First-Time Store Setup mode.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetAllConfirmText('');
                  setShowResetAllModal(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 border border-rose-500 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>Reset Everything</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetTxConfirmText('');
                  setShowResetTxModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 border border-charcoal-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Transactions Only (Keep Products & Customers)</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* --- MODAL 1: Yearly Reset Confirmation --- */}
      {showYearlyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-forest-400">
              <Calendar className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black">Confirm Yearly Reset ({selectedYear})</h3>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              This will archive and delete all sales invoices, recorded expenses, and payment records for the year <strong className="text-white">{selectedYear}</strong>.
            </p>

            <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 text-xs space-y-1 font-mono">
              <p className="text-forest-400">✓ Automatic Excel (.xlsx) backup will download first.</p>
              <p className="text-forest-400">✓ All {products.length} products & stock levels are safe.</p>
              <p className="text-forest-400">
                {carryDebt
                  ? `✓ Customer debts will carry over into ${selectedYear + 1}.`
                  : `! Customer debts will be reset to 0.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-charcoal-400">
                Type <strong className="text-white font-mono">YEARLY RESET</strong> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="YEARLY RESET"
                value={yearlyConfirmText}
                onChange={(e) => setYearlyConfirmText(e.target.value)}
                className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-forest-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowYearlyModal(false)}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={yearlyConfirmText.trim().toUpperCase() !== 'YEARLY RESET'}
                onClick={handleExecuteYearlyReset}
                className="px-5 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm & Reset Year</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Reset Everything Confirmation --- */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-rose-900/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black">Reset Everything (Factory Reset)</h3>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to proceed? This will permanently wipe all stored records:
            </p>

            <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 text-xs space-y-1 font-mono text-rose-300">
              <p>• ALL staff & owner profiles ({storageService.getUsers().length} accounts) will be erased.</p>
              <p>• ALL products ({products.length} items, manual & bulk) will be erased.</p>
              <p>• ALL customers ({customers.length} records) & debts will be erased.</p>
              <p>• ALL sales invoices ({sales.length} transactions) will be erased.</p>
              <p>• ALL expenses ({expenses.length} records) will be erased.</p>
              <p>• Central Server & Supabase database will be completely wiped.</p>
              <p>• System will immediately log out and prompt First-Time Store Owner Setup.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-charcoal-400">
                Type <strong className="text-white font-mono">RESET ALL</strong> to proceed:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="RESET ALL"
                value={resetAllConfirmText}
                onChange={(e) => setResetAllConfirmText(e.target.value)}
                className="w-full bg-charcoal-950 border border-rose-800/80 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isResettingAll}
                onClick={() => setShowResetAllModal(false)}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResettingAll || resetAllConfirmText.trim().toUpperCase() !== 'RESET ALL'}
                onClick={handleExecuteResetAll}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 border border-rose-500 shadow-md transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResettingAll ? 'Wiping All Data...' : 'Confirm Factory Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Reset Transactions Only Confirmation --- */}
      {showResetTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-xs">
          <div className="bg-charcoal-900 border border-amber-900/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-amber-400">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black">Reset Transactions Only</h3>
            </div>

            <p className="text-xs text-charcoal-300 leading-relaxed">
              This will clear all sales history and expenses, and set customer credit balances to 0, while keeping all your products and customer contacts intact.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-charcoal-400">
                Type <strong className="text-white font-mono">RESET TRANSACTIONS</strong> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="RESET TRANSACTIONS"
                value={resetTxConfirmText}
                onChange={(e) => setResetTxConfirmText(e.target.value)}
                className="w-full bg-charcoal-950 border border-charcoal-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetTxModal(false)}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetTxConfirmText.trim().toUpperCase() !== 'RESET TRANSACTIONS'}
                onClick={handleExecuteResetTx}
                className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 border border-amber-500 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Critical Action Master Passcode Challenge --- */}
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

      {/* --- MODAL 5: Change Master Passcode Modal --- */}
      {showChangePasscodeModal && (
        <ChangeMasterPasscodeModal
          isOpen={showChangePasscodeModal}
          currentUser={currentUser}
          onClose={() => setShowChangePasscodeModal(false)}
          onSuccess={() => {
            onDataReset();
          }}
        />
      )}

      {/* --- MODAL 6: Change Account Password & PIN Modal --- */}
      {showChangeCredentialsModal && currentUser && (
        <ChangeCredentialsModal
          isOpen={showChangeCredentialsModal}
          targetUser={currentUser}
          currentUser={currentUser}
          onClose={() => setShowChangeCredentialsModal(false)}
          onSuccess={() => {
            setCredentialsUpdatedMsg('Password / 4-digit PIN updated successfully!');
            onDataReset();
            setTimeout(() => setCredentialsUpdatedMsg(null), 5000);
          }}
        />
      )}

    </div>
  );
};

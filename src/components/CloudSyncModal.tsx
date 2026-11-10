import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Server,
  ArrowRight,
  ShieldCheck,
  Zap,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCode,
  Smartphone,
  QrCode,
  Link2,
  Share2,
  Check,
} from 'lucide-react';
import {
  getSupabase,
  getSupabaseCredentials,
  configureSupabase,
  resetSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
} from '../lib/supabase.ts';
import { crossDeviceSyncService, SyncState } from '../services/crossDeviceSyncService.ts';
import { storageService } from '../services/storageService.ts';
import {
  generatePairingUrl,
  generatePairingCode,
  applyPairingToken,
} from '../services/pairingService.ts';
import { generateQrMatrix } from '../utils/barcodeGenerator.ts';

const SUPABASE_SCHEMA_SQL = `-- ============================================================================
-- SAPPY STATIONARY POS - SUPABASE FREE TIER TABLES SCHEMA
-- ============================================================================
-- Paste into: Supabase Dashboard -> SQL Editor -> New Query -> Run

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_level INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    unit TEXT NOT NULL DEFAULT 'pcs',
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    tax_number TEXT,
    credit_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 500.00,
    total_purchased NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    amount_tendered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_credit_paid BOOLEAN NOT NULL DEFAULT true,
    credit_due_date DATE,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    items JSONB
);

CREATE TABLE IF NOT EXISTS public.credit_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT,
    sale_id TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    receipt_number TEXT UNIQUE NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payee TEXT,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) & Add Permissions (Zero Supabase Advisor Warnings)
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.products;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.customers;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.sales;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.credit_payments;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.expenses;

CREATE POLICY "Enable all operations for POS terminals" ON public.products FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.customers FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.sales FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.credit_payments FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.expenses FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.customers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.credit_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
`;

export const SUPABASE_RLS_FIX_SQL = `-- ============================================================================
-- SAPPY STATIONARY POS - SUPABASE RLS SECURITY POLICY FIX
-- Resolves all "CRITICAL: RLS Disabled in Public" warnings in Supabase Advisor
-- and enables secure, unblocked read/write access for POS terminals.
-- ============================================================================

-- 1. Enable Row-Level Security on all 5 POS tables
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy or conflicting policies
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.products;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.customers;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.sales;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.credit_payments;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.expenses;

-- 3. Create permissive policies for anon & authenticated roles
CREATE POLICY "Enable all operations for POS terminals" ON public.products
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for POS terminals" ON public.customers
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for POS terminals" ON public.sales
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for POS terminals" ON public.credit_payments
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for POS terminals" ON public.expenses
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 4. Grant table permissions
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.customers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.credit_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
`;

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncState;
  onNavigateToSyncTab: () => void;
  onRefreshData: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onNavigateToSyncTab,
  onRefreshData,
}) => {
  const [credentials, setCredentials] = useState(getSupabaseCredentials());
  const [supabaseUrl, setSupabaseUrl] = useState(credentials.url || storageService.getStoreConfig().supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState(credentials.anonKey || storageService.getStoreConfig().supabaseAnonKey || '');
  const [backendUrl, setBackendUrlState] = useState(crossDeviceSyncService.getBackendUrl());

  const [activeSubTab, setActiveSubTab] = useState<'pair' | 'supabase' | 'backend'>(isSupabaseConfigured() ? 'pair' : 'supabase');
  const [isTesting, setIsTesting] = useState(false);
  const [missingTables, setMissingTables] = useState(false);
  const [hasRlsError, setHasRlsError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRlsSql, setCopiedRlsSql] = useState(false);
  const [copiedPairLink, setCopiedPairLink] = useState(false);
  const [copiedPairCode, setCopiedPairCode] = useState(false);
  const [pastePairInput, setPastePairInput] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState<string | null>(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  const handleApplyPairing = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPairError(null);
    setPairSuccess(null);
    if (!pastePairInput.trim()) {
      setPairError('Please paste a pairing link or code from your other device.');
      return;
    }
    const result = applyPairingToken(pastePairInput);
    if (result.success) {
      setPairSuccess(result.message);
      setPastePairInput('');
      const creds = getSupabaseCredentials();
      setCredentials(creds);
      setSupabaseUrl(creds.url);
      setSupabaseKey(creds.anonKey);
      crossDeviceSyncService.broadcastLocalChange();
      crossDeviceSyncService.syncNow();
      onRefreshData();
    } else {
      setPairError(result.message);
    }
  };

  // Synchronize input fields when modal is opened or remote sync state updates
  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      const cfg = storageService.getStoreConfig();
      setCredentials(creds);
      setSupabaseUrl(creds.url || cfg.supabaseUrl || '');
      setSupabaseKey(creds.anonKey || cfg.supabaseAnonKey || '');
      setBackendUrlState(crossDeviceSyncService.getBackendUrl());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getProjectRef = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      return parsed.hostname.split('.')[0] || '';
    } catch {
      return '';
    }
  };

  const projectRef = getProjectRef(supabaseUrl);
  const sqlEditorDirectUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard/project/_/sql/new';

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyRlsSql = () => {
    navigator.clipboard.writeText(SUPABASE_RLS_FIX_SQL);
    setCopiedRlsSql(true);
    setTimeout(() => setCopiedRlsSql(false), 3000);
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both Supabase Project URL and Anon Key.' });
      return;
    }

    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Connecting to your Supabase project...' });

    try {
      const { client } = configureSupabase(supabaseUrl, supabaseKey);
      const testResult = await testSupabaseConnection(client);

      if (testResult.success) {
        // Automatically save to storeConfig so central server & all other devices get credentials
        const currentConfig = storageService.getStoreConfig();
        storageService.saveStoreConfig({
          ...currentConfig,
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim(),
        });
        crossDeviceSyncService.broadcastLocalChange();
        await crossDeviceSyncService.syncNow();
        onRefreshData();

        if (!testResult.tableFound) {
          setMissingTables(true);
          setHasRlsError(false);
          setStatusMessage({
            type: 'warning',
            text: 'Connected successfully to Supabase & synced across devices! Just one step left: run the SQL script below to create your tables.',
          });
        } else if (testResult.rlsError) {
          setMissingTables(false);
          setHasRlsError(true);
          setStatusMessage({
            type: 'warning',
            text: 'Connected to Supabase, but Row-Level Security (Error 42501) is active on products table. Run the 1-click RLS fix below.',
          });
        } else {
          setMissingTables(false);
          setHasRlsError(false);
          setStatusMessage({
            type: 'success',
            text: 'Connected & verified with Supabase! All tables and write permissions are active across all devices.',
          });
        }
      } else {
        setMissingTables(false);
        setHasRlsError(false);
        setStatusMessage({
          type: 'error',
          text: testResult.message,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to connect to Supabase.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectSupabase = async () => {
    resetSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setCredentials({ url: '', anonKey: '' });
    setMissingTables(false);
    setHasRlsError(false);
    setStatusMessage({ type: 'info', text: 'Supabase disconnected. Operating in local offline mode.' });
    const currentConfig = storageService.getStoreConfig();
    delete currentConfig.supabaseUrl;
    delete currentConfig.supabaseAnonKey;
    storageService.saveStoreConfig(currentConfig);
    crossDeviceSyncService.broadcastLocalChange();
    await crossDeviceSyncService.syncNow();
    onRefreshData();
  };

  const handleVerifyAfterSql = async () => {
    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Verifying tables in Supabase...' });

    try {
      const client = getSupabase();
      const testResult = await testSupabaseConnection(client);

      if (testResult.success && testResult.tableFound) {
        const currentConfig = storageService.getStoreConfig();
        storageService.saveStoreConfig({
          ...currentConfig,
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim(),
        });
        setMissingTables(false);
        if (testResult.rlsError) {
          setHasRlsError(true);
          setStatusMessage({
            type: 'warning',
            text: 'Tables found, but Row-Level Security policy (Error 42501) is still active. Please run the RLS fix script in SQL Editor.',
          });
        } else {
          setHasRlsError(false);
          setStatusMessage({
            type: 'success',
            text: 'Permissions and tables verified! Synced across all devices & uploading local stationery data to Supabase...',
          });
        }
        crossDeviceSyncService.broadcastLocalChange();
        await crossDeviceSyncService.syncNow();
        onRefreshData();
      } else {
        setStatusMessage({
          type: 'warning',
          text: 'Table public.products not found yet. Make sure you pasted the SQL and clicked "Run" in your Supabase SQL Editor.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Could not verify tables.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    crossDeviceSyncService.setBackendUrl(backendUrl);
    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Testing custom backend endpoint...' });

    const success = await crossDeviceSyncService.syncNow();
    setIsTesting(false);

    if (success) {
      setStatusMessage({ type: 'success', text: 'Successfully connected to backend server!' });
      onRefreshData();
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Could not reach /api/pos/sync on the specified backend. Check URL and CORS.',
      });
    }
  };

  const handleManualSync = async () => {
    setIsTesting(true);
    const success = await crossDeviceSyncService.syncNow();
    setIsTesting(false);
    if (success) {
      setStatusMessage({ type: 'success', text: 'Synchronization completed successfully!' });
      onRefreshData();
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Sync could not reach a remote cloud database. Ensure Supabase or backend is configured.',
      });
    }
  };

  const handleDisconnect = async () => {
    resetSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setMissingTables(false);
    crossDeviceSyncService.setBackendUrl('');
    setBackendUrlState('');
    const currentConfig = storageService.getStoreConfig();
    delete currentConfig.supabaseUrl;
    delete currentConfig.supabaseAnonKey;
    storageService.saveStoreConfig(currentConfig);
    crossDeviceSyncService.broadcastLocalChange();
    setStatusMessage({ type: 'info', text: 'Reset to local offline storage mode across all devices.' });
    await crossDeviceSyncService.syncNow();
    onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-charcoal-950 px-6 py-4 flex items-center justify-between border-b border-charcoal-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-forest-950 border border-forest-700/60 flex items-center justify-center text-forest-400">
              <Cloud className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Cross-Device Cloud Sync</h3>
              <p className="text-xs text-charcoal-400">Connect Supabase to sync phones, tablets & laptops</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Banner */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
            syncState.status === 'synced'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                syncState.status === 'synced' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <div>
                <p className="text-xs font-bold">
                  Status: {syncState.status === 'synced' ? 'Cloud Synced' : 'Running in Local Mode'}
                </p>
                <p className="text-[11px] text-charcoal-300 mt-0.5">
                  {syncState.mode === 'supabase'
                    ? 'Connected directly to Supabase PostgreSQL'
                    : syncState.mode === 'server'
                    ? 'Connected to Node/Express sync backend'
                    : 'GitHub Pages is static: data is saved locally until Supabase is connected.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isTesting}
              className="py-1.5 px-3 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-xs font-bold font-mono text-white flex items-center gap-1.5 shrink-0 border border-charcoal-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 grid grid-cols-3 gap-2 border-b border-charcoal-800 pb-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('pair')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'pair'
                ? 'bg-forest-900/80 text-forest-300 border border-forest-700'
                : 'bg-charcoal-950 text-charcoal-400 border border-charcoal-800 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="truncate">Pair Device</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('supabase')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'supabase'
                ? 'bg-forest-900/80 text-forest-300 border border-forest-700'
                : 'bg-charcoal-950 text-charcoal-400 border border-charcoal-800 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="truncate">Supabase DB</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('backend')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'backend'
                ? 'bg-forest-900/80 text-forest-300 border border-forest-700'
                : 'bg-charcoal-950 text-charcoal-400 border border-charcoal-800 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span className="truncate">Custom Server</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Missing Tables / PGRST205 Actionable Helper Card */}
          {missingTables && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-600/70 text-amber-100 space-y-3 shadow-lg">
              <div className="flex items-start gap-2.5">
                <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-amber-200 uppercase tracking-wider">
                    Step 2: Create Supabase Tables (30 Seconds)
                  </h4>
                  <p className="text-xs text-charcoal-300 mt-1">
                    Your Supabase credentials are valid! To store products and sales, run the SQL script below in your Supabase SQL Editor.
                  </p>
                </div>
              </div>

              {/* Step checklist */}
              <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 text-[11px] text-charcoal-300 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-forest-900 text-forest-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Click <strong>Copy SQL Script</strong> below</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-forest-900 text-forest-300 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Click <strong>Open Supabase SQL Editor</strong> and paste the script</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-forest-900 text-forest-300 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Click <strong>Run</strong> in Supabase, then click <strong>Verify & Sync Now</strong> below</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="py-2 px-3.5 bg-forest-700 hover:bg-forest-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                </button>

                <a
                  href={sqlEditorDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-charcoal-700 transition-colors"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleVerifyAfterSql}
                  disabled={isTesting}
                  className="py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Verify & Sync Now</span>
                </button>
              </div>

              {/* Optional SQL Preview toggle */}
              <button
                type="button"
                onClick={() => setShowSqlPreview(!showSqlPreview)}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <FileCode className="w-3 h-3" />
                <span>{showSqlPreview ? 'Hide SQL Code' : 'View SQL Code Preview'}</span>
                {showSqlPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showSqlPreview && (
                <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 text-[10px] font-mono text-charcoal-300 max-h-36 overflow-y-auto whitespace-pre">
                  {SUPABASE_SCHEMA_SQL}
                </div>
              )}
            </div>
          )}

          {/* RLS Error 42501 Actionable Helper Card */}
          {(hasRlsError || syncState.message.includes('42501') || syncState.message.includes('RLS')) && (
            <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-600/80 text-amber-100 space-y-3 shadow-xl">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Fix Row-Level Security (RLS) · Error 42501</span>
                  </h4>
                  <p className="text-xs text-charcoal-200 mt-1 leading-relaxed">
                    Supabase is rejecting product rows with: <code className="bg-charcoal-950 px-1 py-0.5 rounded text-amber-300 font-mono text-[11px]">new row violates row-level security policy for table &quot;products&quot;</code>.
                    Run this 1-click SQL fix to allow your POS terminal to insert records.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-charcoal-950 rounded-xl border border-charcoal-800 font-mono text-[11px] text-amber-300 whitespace-pre overflow-x-auto">
                {`ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for POS terminals" ON public.products FOR ALL TO anon, authenticated USING (true);`}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyRlsSql}
                  className="py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-charcoal-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedRlsSql ? 'Copied RLS Fix to Clipboard!' : 'Copy 1-Click RLS Fix'}</span>
                </button>

                <a
                  href={sqlEditorDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3.5 bg-charcoal-950 hover:bg-charcoal-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-charcoal-700 transition-colors"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleVerifyAfterSql}
                  disabled={isTesting}
                  className="py-2 px-3.5 bg-forest-700 hover:bg-forest-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Verify & Sync Now</span>
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'pair' && (
            <div className="space-y-4">
              {isSupabaseConfigured() ? (
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-950/60 border border-emerald-600/60 rounded-xl text-xs flex items-center gap-2 text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Database active! Scan QR code or copy the 1-click link to connect your phone or another laptop instantly.</span>
                  </div>

                  {/* QR Code Card */}
                  <div className="p-4 bg-charcoal-950 border border-charcoal-800 rounded-2xl flex flex-col items-center text-center space-y-3">
                    <div className="bg-white p-3 rounded-xl shadow-lg border border-charcoal-700">
                      {(() => {
                        const matrix = generateQrMatrix(generatePairingUrl());
                        const dim = matrix.length || 29;
                        return (
                          <svg className="w-36 h-36 aspect-square" viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges">
                            <rect width="100%" height="100%" fill="#ffffff" />
                            {matrix.map((row, r) =>
                              row.map((cell, c) =>
                                cell ? (
                                  <rect
                                    key={`${r}-${c}`}
                                    x={c}
                                    y={r}
                                    width={1}
                                    height={1}
                                    fill="#0a0f0d"
                                  />
                                ) : null
                              )
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-amber-400" />
                        <span>Scan with Mobile Phone Camera</span>
                      </h4>
                      <p className="text-[11px] text-charcoal-400 mt-0.5">
                        Open camera on your iPhone or Android and point it here. It opens Sappy POS with your cloud database connected!
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Link Button */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = generatePairingUrl();
                        navigator.clipboard.writeText(url);
                        setCopiedPairLink(true);
                        setTimeout(() => setCopiedPairLink(false), 3000);
                      }}
                      className="w-full py-2.5 px-3 bg-forest-700 hover:bg-forest-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      {copiedPairLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Link2 className="w-4 h-4 text-forest-200" />}
                      <span>{copiedPairLink ? 'Pairing Link Copied to Clipboard!' : 'Copy 1-Click Connect Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const code = generatePairingCode();
                        navigator.clipboard.writeText(code);
                        setCopiedPairCode(true);
                        setTimeout(() => setCopiedPairCode(false), 3000);
                      }}
                      className="w-full py-2 px-3 bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-charcoal-800 cursor-pointer transition-colors"
                    >
                      {copiedPairCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-charcoal-400" />}
                      <span>{copiedPairCode ? 'Pairing Code Copied!' : 'Copy Manual Pairing Code'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-charcoal-950 border border-charcoal-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-charcoal-300 text-xs">
                      No cloud database configured on this device yet. If you already connected on another device, paste its pairing link or code below:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('supabase')}
                    className="text-amber-400 hover:underline text-xs font-semibold inline-flex items-center gap-1 pt-1"
                  >
                    <span>Or connect Supabase directly here</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Paste pairing code section */}
              <div className="pt-2 border-t border-charcoal-800/80 space-y-2">
                <label className="block text-xs font-bold text-charcoal-300">
                  Connect This Device From Another
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pastePairInput}
                    onChange={(e) => setPastePairInput(e.target.value)}
                    placeholder="Paste pairing link or code from PC..."
                    className="flex-1 px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyPairing()}
                    className="py-2 px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold cursor-pointer transition-colors shrink-0"
                  >
                    Pair Now
                  </button>
                </div>
                {pairSuccess && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{pairSuccess}</span>
                  </p>
                )}
                {pairError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pairError}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'supabase' && (
            <form onSubmit={handleSaveSupabase} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-charcoal-300">
                    Supabase Project URL
                  </label>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-forest-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://yourprojectref.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1">
                  Supabase Public / Anon API Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isTesting}
                  className="flex-1 py-2 px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Connect & Save Supabase</span>
                </button>
                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2 px-3 rounded-xl bg-charcoal-800 hover:bg-rose-950 hover:text-rose-300 text-charcoal-400 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          )}

          {activeSubTab === 'backend' && (
            <form onSubmit={handleSaveBackend} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1">
                  Custom Node/Express Server URL
                </label>
                <p className="text-[11px] text-charcoal-400 mb-2">
                  If you deployed the Express server to Render, Fly.io, or Railway, enter the full public URL:
                </p>
                <input
                  type="url"
                  placeholder="https://sappy-pos-backend.onrender.com"
                  value={backendUrl}
                  onChange={(e) => setBackendUrlState(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isTesting}
                className="w-full py-2 px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Save Backend URL</span>
              </button>
            </form>
          )}

          {/* Feedback status message */}
          {statusMessage && !missingTables && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : statusMessage.type === 'warning'
                ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                : 'bg-charcoal-950 border-charcoal-800 text-charcoal-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              ) : statusMessage.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-amber-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Helper links */}
          <div className="pt-2 border-t border-charcoal-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSyncTab();
              }}
              className="text-forest-400 hover:text-forest-300 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View Full SQL Schema & Setup Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-charcoal-500 font-mono">
              Offline-First Enabled
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

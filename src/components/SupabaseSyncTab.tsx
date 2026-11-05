import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getSupabase,
  isSupabaseConfigured,
  getSupabaseCredentials,
  configureSupabase,
} from '../lib/supabase.ts';
import { storageService } from '../services/storageService.ts';
import { StoreConfig } from '../types/pos.ts';

interface SupabaseSyncTabProps {
  config: StoreConfig;
  onRefreshData: () => void;
}

export const SupabaseSyncTab: React.FC<SupabaseSyncTabProps> = ({
  config,
  onRefreshData,
}) => {
  const [credentials, setCredentials] = useState(getSupabaseCredentials());
  const [urlInput, setUrlInput] = useState(credentials.url);
  const [keyInput, setKeyInput] = useState(credentials.anonKey);
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [testMessage, setTestMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'syncing' | 'success' | 'error'
  >('idle');
  const [syncProgress, setSyncProgress] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // SQL script tailored for Supabase SQL Editor
  const supabaseSql = `-- ============================================================================
-- SAPPY STATIONARY POS - SUPABASE FREE TIER SQL SCHEMA
-- ============================================================================
-- Paste this script into your Supabase Dashboard: SQL Editor -> New Query -> Run

-- 1. Products Table
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

-- 2. Customers Table
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

-- 3. Sales Table
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
    payment_method TEXT NOT NULL,
    amount_tendered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_credit_paid BOOLEAN NOT NULL DEFAULT TRUE,
    credit_due_date DATE,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 4. Credit Debt Payments Table
CREATE TABLE IF NOT EXISTS public.credit_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    sale_id TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    receipt_number TEXT UNIQUE NOT NULL,
    notes TEXT
);

-- 5. Store Operating Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payee TEXT NOT NULL,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) with open read/write access for POS client
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to credit_payments" ON public.credit_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
`;

  // Test Connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Connecting to Supabase...');

    try {
      // Re-configure in case user modified inputs
      const { client } = configureSupabase(urlInput, keyInput);
      setCredentials(getSupabaseCredentials());

      // Attempt test ping query
      const { data, error } = await client
        .from('products')
        .select('count', { count: 'exact', head: true });

      if (error && error.code !== 'PGRST116') {
        // If table doesn't exist yet, it still connects to Supabase auth!
        if (error.message.includes('relation "public.products" does not exist') || error.code === '42P01') {
          setTestStatus('success');
          setTestMessage('Successfully connected to Supabase project! (Tables not yet created - run the SQL script below).');
          return;
        }
        throw error;
      }

      setTestStatus('success');
      setTestMessage('Connected to Supabase PostgreSQL! Connection verified and ready for live sync.');
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Could not connect to Supabase. Check Project URL and Publishable Key.');
    }
  };

  // Push Local Data to Supabase
  const handlePushToSupabase = async () => {
    const client = getSupabase();
    if (!client) {
      alert('Please configure and test your Supabase connection first.');
      return;
    }

    setSyncStatus('syncing');
    setSyncProgress('Preparing local stationery datasets...');

    try {
      const products = storageService.getProducts();
      const customers = storageService.getCustomers();
      const sales = storageService.getSales();
      const payments = storageService.getCreditPayments();
      const expenses = storageService.getExpenses();

      // 1. Sync Products
      setSyncProgress(`Syncing ${products.length} stationery products...`);
      const mappedProducts = products.map((p) => ({
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
      }));
      const { error: prodErr } = await client.from('products').upsert(mappedProducts);
      if (prodErr) throw new Error(`Products sync failed: ${prodErr.message}`);

      // 2. Sync Customers
      setSyncProgress(`Syncing ${customers.length} customer accounts...`);
      const mappedCustomers = customers.map((c) => ({
        id: c.id,
        name: c.name,
        company_name: c.companyName,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tax_number: c.taxNumber,
        credit_balance: c.creditBalance,
        credit_limit: c.creditLimit,
        total_purchased: c.totalPurchased,
        notes: c.notes,
      }));
      const { error: custErr } = await client.from('customers').upsert(mappedCustomers);
      if (custErr) throw new Error(`Customers sync failed: ${custErr.message}`);

      // 3. Sync Sales
      setSyncProgress(`Syncing ${sales.length} sales ledger transactions...`);
      const mappedSales = sales.map((s) => ({
        id: s.id,
        invoice_number: s.invoiceNumber,
        timestamp: s.timestamp,
        customer_id: s.customerId,
        customer_name: s.customerName,
        customer_phone: s.customerPhone,
        customer_email: s.customerEmail,
        customer_address: s.customerAddress,
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
        credit_due_date: s.creditDueDate,
        paid_amount: s.paidAmount,
        notes: s.notes,
        items: s.items,
      }));
      const { error: salesErr } = await client.from('sales').upsert(mappedSales);
      if (salesErr) throw new Error(`Sales sync failed: ${salesErr.message}`);

      // 4. Sync Credit Payments
      if (payments.length > 0) {
        setSyncProgress(`Syncing ${payments.length} debt payment receipts...`);
        const mappedPayments = payments.map((p) => ({
          id: p.id,
          customer_id: p.customerId,
          customer_name: p.customerName,
          sale_id: p.saleId,
          amount: p.amount,
          payment_method: p.paymentMethod,
          timestamp: p.timestamp,
          receipt_number: p.receiptNumber,
          notes: p.notes,
        }));
        const { error: payErr } = await client.from('credit_payments').upsert(mappedPayments);
        if (payErr) throw new Error(`Payments sync failed: ${payErr.message}`);
      }

      // 5. Sync Expenses
      if (expenses.length > 0) {
        setSyncProgress(`Syncing ${expenses.length} operating expenses...`);
        const mappedExpenses = expenses.map((e) => ({
          id: e.id,
          date: e.date,
          category: e.category,
          title: e.title,
          amount: e.amount,
          payment_method: e.paymentMethod,
          payee: e.payee,
          receipt_number: e.receiptNumber,
          notes: e.notes,
        }));
        const { error: expErr } = await client.from('expenses').upsert(mappedExpenses);
        if (expErr) throw new Error(`Expenses sync failed: ${expErr.message}`);
      }

      setSyncStatus('success');
      setSyncProgress('All local records successfully synced to Supabase Free Tier!');
      onRefreshData();
    } catch (err: any) {
      setSyncStatus('error');
      setSyncProgress(err.message || 'Sync failed. Ensure tables are created in Supabase SQL Editor.');
    }
  };

  // Copy SQL Schema to Clipboard
  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Download Local Backup JSON
  const handleDownloadBackup = () => {
    const json = storageService.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sappy_Stationary_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restore Backup JSON
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = storageService.importBackup(content);
      if (success) {
        setImportStatus('Backup successfully restored! Refreshing data...');
        onRefreshData();
        setTimeout(() => setImportStatus(''), 4000);
      } else {
        setImportStatus('Failed to restore backup. Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-charcoal-900">
          Supabase Free Tier & Cross-Device Cloud Sync
        </h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Connect your free Supabase PostgreSQL instance to synchronize register sales, stock, and debtor ledgers across mobile, tablet, and desktop.
        </p>
      </div>

      {/* Cloud Status Banner */}
      <div className="bg-forest-950 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-forest-900">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-forest-800 text-white flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6 text-forest-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-forest-300">
                Connected Project
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-forest-900 text-forest-200 px-2 py-0.5 rounded border border-forest-800">
                <ShieldCheck className="w-3 h-3 text-forest-300" />
                Active
              </span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight mt-0.5 font-mono">
              fegfrjhxxpojmalytbku.supabase.co
            </h2>
            <p className="text-xs text-forest-200 mt-0.5">
              Sappy Stationary is wired to your live Supabase Free Tier PostgreSQL instance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="px-4 py-2 bg-forest-800 hover:bg-forest-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer border border-forest-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>

          <button
            onClick={handlePushToSupabase}
            disabled={syncStatus === 'syncing'}
            className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-95 border border-forest-600/50"
          >
            <Zap className="w-3.5 h-3.5 text-forest-200" />
            <span>Push Local Data to Cloud</span>
          </button>
        </div>
      </div>

      {/* Test / Sync Status Messages */}
      {testMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            testStatus === 'success'
              ? 'bg-forest-950/90 border-forest-700/80 text-forest-300'
              : 'bg-rose-950/90 border-rose-800/80 text-rose-300'
          }`}
        >
          {testStatus === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-forest-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{testMessage}</span>
        </div>
      )}

      {syncProgress && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            syncStatus === 'success'
              ? 'bg-forest-950/90 border-forest-700/80 text-forest-300'
              : syncStatus === 'error'
              ? 'bg-rose-950/90 border-rose-800/80 text-rose-300'
              : 'bg-charcoal-900 border-forest-700/80 text-forest-300'
          }`}
        >
          <RefreshCw className={`w-4 h-4 shrink-0 ${syncStatus === 'syncing' ? 'animate-spin text-forest-400' : 'text-forest-400'}`} />
          <span>{syncProgress}</span>
        </div>
      )}

      {/* Grid: 2 Columns (Credentials & SQL Schema Setup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Supabase Project Credentials Form */}
        <div className="lg:col-span-6 bg-charcoal-900 p-6 rounded-2xl border border-charcoal-800 shadow-2xs space-y-4 text-charcoal-100">
          <div className="flex items-center gap-2 pb-3 border-b border-charcoal-800">
            <Database className="w-4 h-4 text-forest-400" />
            <h3 className="text-sm font-bold text-white">Supabase Connection Credentials</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-mono text-white focus:border-forest-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-300 mb-1">
              Supabase Publishable / Anon API Key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-mono text-white focus:border-forest-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-charcoal-400">Credentials saved to browser cache</span>
            <button
              onClick={handleTestConnection}
              className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-xl cursor-pointer border border-forest-600/50"
            >
              Save & Test Connection
            </button>
          </div>

          {/* Quick Steps Card */}
          <div className="mt-4 p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 text-xs space-y-2">
            <h4 className="font-bold text-white">How to Setup Tables in Supabase:</h4>
            <ol className="list-decimal pl-4 space-y-1 text-charcoal-300">
              <li>Open your Supabase Project: <a href="https://supabase.com/dashboard/project/fegfrjhxxpojmalytbku" target="_blank" rel="noreferrer" className="text-forest-400 font-semibold underline inline-flex items-center gap-1">Dashboard <ExternalLink className="w-3 h-3" /></a></li>
              <li>Click on the <strong>SQL Editor</strong> tab on the left sidebar.</li>
              <li>Click <strong>&quot;New query&quot;</strong>, paste the SQL schema on the right, and click <strong>&quot;Run&quot;</strong>.</li>
              <li>Return here and click <strong>&quot;Push Local Data to Cloud&quot;</strong> to upload your entire stationery catalog!</li>
            </ol>
          </div>
        </div>

        {/* Right Column: SQL Schema for Supabase SQL Editor */}
        <div className="lg:col-span-6 bg-charcoal-900 p-6 rounded-2xl border border-charcoal-800 shadow-2xs space-y-3 text-charcoal-100">
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
            <div>
              <h3 className="text-sm font-bold text-white">Supabase SQL Editor Schema</h3>
              <p className="text-[11px] text-charcoal-400">Ready to copy and run in your Supabase dashboard</p>
            </div>
            <button
              onClick={handleCopySql}
              className="px-3 py-1.5 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-forest-600/50"
            >
              <Copy className="w-3.5 h-3.5 text-forest-200" />
              <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <pre className="p-3 bg-charcoal-950 text-charcoal-200 rounded-xl text-[11px] font-mono max-h-[300px] overflow-y-auto leading-relaxed border border-charcoal-800">
            {supabaseSql}
          </pre>
        </div>

      </div>

      {/* Manual Backup & Migration Tools */}
      <div className="bg-charcoal-900 p-6 rounded-2xl border border-charcoal-800 shadow-2xs space-y-4 text-charcoal-100">
        <div>
          <h3 className="text-sm font-bold text-white">Cross-Device JSON Backup & Restore</h3>
          <p className="text-xs text-charcoal-400">
            Export a full standalone snapshot of your products, sales, customers, and expenses for manual transfer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 border border-charcoal-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-forest-400" />
            <span>Download Store Backup (.JSON)</span>
          </button>

          <label className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 border border-charcoal-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-forest-400" />
            <span>Restore Backup (.JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              className="hidden"
            />
          </label>
        </div>

        {importStatus && (
          <p className="text-xs font-semibold text-forest-400 pt-1">{importStatus}</p>
        )}
      </div>

    </div>
  );
};

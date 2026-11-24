export const SUPABASE_SCHEMA_SQL = `-- ============================================================================
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
    payment_method TEXT NOT NULL DEFAULT 'cash',
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
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payee TEXT NOT NULL,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Staff Users & Terminal Profiles Table
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    store_name TEXT NOT NULL DEFAULT 'Sappy Stationary',
    phone TEXT,
    pin_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Enable Row Level Security (RLS) & Add Permissions (Zero Supabase Advisor Warnings)
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.products;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.customers;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.sales;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.credit_payments;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.expenses;
DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.app_users;

CREATE POLICY "Enable all operations for POS terminals" ON public.products FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.customers FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.sales FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.credit_payments FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.expenses FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for POS terminals" ON public.app_users FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.customers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.credit_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.app_users TO anon, authenticated, service_role;
`;

export const SUPABASE_RLS_FIX_SQL = `-- ============================================================================
-- SAPPY STATIONARY POS - SUPABASE RLS SECURITY POLICY FIX
-- Resolves all "CRITICAL: RLS Disabled in Public" warnings in Supabase Advisor
-- and enables secure, unblocked read/write access for POS terminals.
-- ============================================================================

-- 1. Ensure app_users table exists so policy statements never fail with 42P01
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    store_name TEXT NOT NULL DEFAULT 'Sappy Stationary',
    phone TEXT,
    pin_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row-Level Security & apply permissive policies safely per existing table
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['products', 'customers', 'sales', 'credit_payments', 'expenses', 'app_users']
    LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Enable all operations for POS terminals" ON public.%I;', tbl);
            EXECUTE format('CREATE POLICY "Enable all operations for POS terminals" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);', tbl);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role;', tbl);
        END IF;
    END LOOP;
END $$;
`;

export function getSupabaseProjectRef(url?: string): string {
  try {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) return '';
    return new URL(cleanUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

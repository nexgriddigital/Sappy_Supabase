# Sappy Stationary POS — Supabase Free Tier Setup & GitHub Guide

This guide gives you step-by-step instructions to connect your **Sappy Stationary POS** to your free **Supabase PostgreSQL** database, push your inventory and sales across devices, and host the app on GitHub.

---

## Your Supabase Project Details
- **Project URL**: `https://fegfrjhxxpojmalytbku.supabase.co`
- **Publishable Key**: `sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2`
- **Dashboard**: [https://supabase.com/dashboard/project/fegfrjhxxpojmalytbku](https://supabase.com/dashboard/project/fegfrjhxxpojmalytbku)

---

## Step 1: Create the Database Tables in Supabase (2 Minutes)

1. Open your browser and go to your [Supabase Dashboard](https://supabase.com/dashboard/project/fegfrjhxxpojmalytbku).
2. On the left navigation sidebar, click on **SQL Editor** (icon looking like `>_` or SQL).
3. Click the green **"New query"** button.
4. Copy and paste the following SQL script into the query editor:

```sql
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

-- 5. Operating Expenses Table
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
```

5. Click the green **Run** button at the bottom right.
6. You will see `Success: No rows returned` — all 5 tables are now live in your Supabase database!

---

## Step 2: Push Your Local Stationery Data to Supabase

1. In the Sappy Stationary web application, click the **"Supabase Sync"** tab in the top navigation bar.
2. Click **"Test Connection"** to verify connection to `https://fegfrjhxxpojmalytbku.supabase.co`.
3. Click **"Push Local Data to Cloud"**.
4. You will see your products, sales, customers, and expenses upload directly into your Supabase database!

Now, you can open **Table Editor** in Supabase and see all your products, sales, and customer debtor records live.

---

## Step 3: GitHub Hosting & Deployment

This application is ready to be hosted on GitHub:

```bash
# 1. Initialize Git and commit
git init
git add .
git commit -m "Initial commit: Sappy Stationary POS with Supabase and A4 Invoices"

# 2. Push to your GitHub repository
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/sappy-stationary-pos.git
git push -u origin main
```

To deploy on Vercel, Netlify, or Render:
1. Import the GitHub repository.
2. Add the Environment Variables:
   - `VITE_SUPABASE_URL=https://fegfrjhxxpojmalytbku.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2`
3. Click **Deploy**!

---

## Features Summary

- **POS Register**: Rapid touchscreen checkout with search, categories, and cash change calculator.
- **A4 Commercial Tax Invoices**: Full-page vector-sharp invoices with one-click PDF export and print styling.
- **Customer Credit & Debt**: Debtor tracking, credit limits, due dates, and debt settlement receipts.
- **Inventory & Restock**: Stock alerts, wholesale buying cost, and profit margin analysis.
- **Store Expenses**: Categorized business expense tracking.
- **Daily Profit & Loss**: Detailed P&L accounting deducting COGS and operating expenses from revenue.

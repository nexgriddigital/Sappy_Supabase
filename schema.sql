-- ============================================================================
-- SAPPY STATIONARY POS - POSTGRESQL PRODUCTION SCHEMA (SUPABASE FREE TIER)
-- ============================================================================
-- Compatible with PostgreSQL 14, 15, 16, and Supabase PostgreSQL database.
-- Run this script in the Supabase SQL Editor or via direct psql connection.

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Products & Inventory Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) UNIQUE NOT NULL,
    barcode VARCHAR(64) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_level INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    unit VARCHAR(32) NOT NULL DEFAULT 'pcs',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 2. Customers & Credit Accounts Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(64) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    tax_number VARCHAR(64),
    credit_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 500.00,
    total_purchased NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 3. Sales Header Table
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(64),
    customer_email VARCHAR(255),
    customer_address TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(32) NOT NULL, -- 'cash', 'card', 'digital', 'credit'
    amount_tendered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_credit_paid BOOLEAN NOT NULL DEFAULT TRUE,
    credit_due_date DATE,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment_method);

-- 4. Sale Line Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
    sku VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    quantity INT NOT NULL DEFAULT 1,
    unit VARCHAR(32) DEFAULT 'pcs',
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_cost_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- 5. Customer Credit Payments Table
CREATE TABLE IF NOT EXISTS credit_payments (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    sale_id VARCHAR(64) REFERENCES sales(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'cash',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receipt_number VARCHAR(64) UNIQUE NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_timestamp ON credit_payments(timestamp);

-- 6. Operating Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'cash',
    payee VARCHAR(255) NOT NULL,
    receipt_number VARCHAR(64),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 7. Store Configuration & Sync Metadata
CREATE TABLE IF NOT EXISTS store_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

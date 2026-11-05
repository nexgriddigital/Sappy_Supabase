# Sappy Stationary — Touchscreen POS, Credit Ledger & Supabase Free Tier

A modern, touch-optimized Point of Sale (POS) and retail management system tailored for **Sappy Stationary**, featuring rapid checkout, real-time stock control, customer credit debt tracking, expense logging, comprehensive daily Profit & Loss (P&L) reports, full-page A4 tax invoice generation with PDF export, and seamless cross-device syncing powered by **Supabase Free Tier (PostgreSQL)** with an offline-first local fallback.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The database backend has been updated to **Supabase Free Tier**:
> - **Database Platform**: **Supabase Free Tier (Managed PostgreSQL)** with 500MB free database storage, connection pooling, and built-in SQL Editor.
> - **Persistence**: Instant offline-first local storage (IndexedDB/LocalStorage) out of the box, with one-click synchronization to Supabase once credentials are configured.
> - **Invoicing**: Full-page A4 commercial tax invoice format with itemized tables and vector-sharp PDF export/print.
> - **Credit Debt**: Full debtor tracking with balances, credit limits, due dates, and partial payment settlement receipts.

- **Confirmed Decision 1 (Updated)**: Built for **Supabase Free Tier**. Supabase provides a hosted PostgreSQL instance with an intuitive web dashboard, built-in SQL Editor, connection pooler (`pooler.supabase.com`), and REST API.
- **Confirmed Decision 2**: Zero-friction onboarding. The app functions 100% locally out of the box so staff can ring up sales immediately. A step-by-step interactive **"Supabase Cloud Sync Center"** guides the owner through creating a free Supabase project, copying connection keys, and syncing data.
- **Confirmed Decision 3**: Vector-sharp A4 commercial invoices with `@page { size: A4 portrait; margin: 12mm 15mm; }` print stylesheets for crystal-clear PDF downloads and thermal/desktop printing.
- **Confirmed Decision 4**: True financial reporting with Cost of Goods Sold (COGS), gross margins, operational expenses, and net profit calculated automatically across all daily transactions.

---

## 1. Overview & Core Concept

**Sappy Stationary POS** empowers stationery store operators, cashiers, and managers to handle high-frequency retail transactions on touchscreens (tablets, mobile, and desktop) while keeping rigorous financial control over inventory, expenses, and credit sales.

### Target Audience & Persona
- **Cashiers & Shop Staff**: Need a tactile, fast, mistake-proof touchscreen register with big tap targets, quick search, barcode entry, instant category filtering, and cash change calculation.
- **Store Owner & Accountant**: Requires accurate real-time inventory tracking, low-stock warnings, expense records, customer credit balances with payment collection, and daily Profit & Loss statements to know exact net profit every evening.
- **Stationery Customers**: Receive clear, professional A4 commercial invoices for corporate, school, or retail purchases with itemized VAT/tax breakdowns.

### Key Value Delivered
- **Rapid Touch Transaction Workflow**: Under 5 seconds from item scan/tap to completed transaction.
- **Elimination of Bad Debt**: Strict tracking of credit customers, overdue balances, and partial payment receipts.
- **Real Profit Transparency**: Daily P&L automatically deducts item wholesale costs (COGS) and daily operating expenses from revenue to display true gross and net margins.
- **Supabase Cloud Ready**: Step-by-step in-app onboarding with ready-to-run SQL schemas for instant multi-device deployment.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Touch Register  │ ───>  │  Cart & Tender  │ ───>  │ Completed Sale  │
│ Tap stationery  │       │ Cash / Card /   │       │ Instant A4 Tax  │
│ items & search  │       │ Credit Account  │       │ Invoice / PDF   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Inventory Deduct│       │ Credit Balance  │       │ Sales Ledger &  │
│ Real-time stock │       │ Customer ledger │       │ Daily P&L Sync  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Register / POS View**: Cashier filters products by category tabs (Pens & Writing, Paper & Notebooks, Art & Craft, Office & Desk, Filing, School Supplies) or searches by name/SKU. Tapping an item adds it to the active cart with instant tactile feedback.
2. **Cart & Tender**: Cashier adjusts quantities via large touch buttons or numpad, applies custom order discounts or tax toggles, and selects payment:
   - *Cash*: Quick-tap tender buttons ($10, $20, $50, $100, exact) with real-time change calculation.
   - *Card / Digital*: Transaction ID and slip recording.
   - *Credit Sale*: Selects or creates a customer profile, sets due date, and records optional initial deposit.
3. **Sales Ledger & A4 Tax Invoice**: Searchable history of all past sales with date range filters. Any sale can be opened to view, print, or export as an A4 commercial tax invoice with custom Sappy Stationary branding.
4. **Customer Credit & Debt Ledger**: Displays all debtor accounts, outstanding balances, payment terms, and past receipts. Cashier can record partial or full debt settlement with payment receipts.
5. **Inventory Management**: Stock level monitoring, cost price vs selling price, low-stock alert thresholds, quick restock actions, and overall inventory valuation.
6. **Expenses Tracker**: Categorized expense entries (Rent, Utilities, Restock, Packaging, Transport, Salaries) directly impacting net profit.
7. **Daily P&L Report**: Executive financial dashboard displaying Gross Sales, COGS, Gross Profit, Total Expenses, Net Profit/Loss, and daily breakdown charts.
8. **Supabase & Cloud Sync Center**: Interactive step-by-step setup guide with copyable SQL schemas, connection tester, one-click synchronization, and JSON export/import.

### Visual Identity & Theme
- **Aesthetic Direction**: Clean, tactile retail utilitarianism with stationery craft heritage. High-contrast layout designed for rapid touch accuracy on tablets, phones, and POS terminals.
- **Color Palette (Updated to Forest Green & Charcoal)**:
  - Neutral Canvas: Charcoal Off-White (`#f7f8fa` / `charcoal-50`) with Charcoal Slate borders (`#e2e5eb` / `charcoal-200`).
  - Dark Charcoal: Primary deep charcoal surfaces (`#1a1d22` / `charcoal-900`) and headings (`#121417` / `charcoal-950`).
  - Forest Green Brand Accent: Deep classic Forest Green (`#1b4332` / `forest-800`, `#2d6a4f` / `forest-700`, `#081c15` / `forest-950`) representing stationery heritage and fiscal reliability.
  - Functional Accents: Amber (`#d97706`) for credit debt, Rose (`#be123c`) for operating expenses.
- **Typography**: `Plus Jakarta Sans` for clean, modern interfaces paired with `JetBrains Mono` / `tabular-nums` for precise currency, receipt numbers, and barcode alignment.
- **Touch Geometry**: Minimum $44 \times 44\text{px}$ touch targets for all buttons and list items; large $48\text{px}$+ numpad buttons for cashiers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Layer Persistence (Offline IndexedDB + Supabase PostgreSQL)**
  - *Chosen Approach*: The client uses a local reactive store (IndexedDB/LocalStorage) that works immediately in the preview sandbox with zero external configuration. A built-in Express backend route (`/api/sync`) connects to Supabase PostgreSQL whenever `DATABASE_URL` is configured, allowing bidirectional sync.
  - *Why*: Allows zero-friction instant testing, continuous offline operation during internet hiccups at the cash register, and seamless multi-device cloud synchronization once Supabase is connected.
  - *Alternatives Considered*: Direct-only Postgres was rejected because it would immediately fail until the user provisions and configures external cloud infrastructure.

- **Decision 2: Native A4 Print Engine with Precise CSS Paged Media**
  - *Chosen Approach*: Implement a dedicated A4 invoice component styled with CSS `@media print` rules (`size: A4; margin: 15mm;`), clean typography, and a direct browser print-to-PDF trigger.
  - *Why*: Produces pristine, vector-sharp PDF invoices with selectable text and crisp barcodes at 300+ DPI without heavy external canvas rendering dependencies that blur on print.

- **Decision 3: Integrated Double-Entry Profit & Loss Tracking**
  - *Chosen Approach*: Every product retains both `costPrice` (wholesale cost) and `sellingPrice`. Every sale stores historical item snapshot costs so past P&L reports remain historically accurate even if retail prices change later.
  - *Why*: Ensures retail stationery margins are accurately reflected against daily operational expenses (e.g., electricity, bags, store rent).

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Sappy Stationary Client                         │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ POS Register │  │ Sales Ledger │  │ Credit & Debt│  │  Inventory │  │
│  │ (Touch Grid) │  │  (A4 Invoices│  │  (Customers) │  │ (Stock/SKU)│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
│         └─────────────────┼─────────────────┴────────────────┘         │
│                           ▼                                            │
│            ┌───────────────────────────────┐                           │
│            │   Local Reactive Store Hub    │                           │
│            │ (IndexedDB / LocalStorage)    │                           │
│            └──────────────┬────────────────┘                           │
└───────────────────────────┼────────────────────────────────────────────┘
                            │ Bidirectional Cloud Sync
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Supabase Free Tier (PostgreSQL)                        │
│                                                                        │
│   • products            • sales           • sale_items                 │
│   • customers           • credit_payments • expenses                   │
│   • store_settings                                                     │
│                                                                        │
│   Accessible via:                                                      │
│   1. Pooled Postgres URI (port 6543 / 5432)                            │
│   2. Express Backend / In-App Sync Engine                              │
│   3. Supabase Web Dashboard & Table Editor                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Data Models

- **Product**: `id`, `sku`, `name`, `category`, `costPrice`, `sellingPrice`, `stockLevel`, `lowStockThreshold`, `barcode`, `unit` (e.g. piece, pack, ream).
- **Sale**: `id`, `invoiceNumber`, `timestamp`, `items` (productId, name, qty, unitPrice, unitCost, lineTotal), `subtotal`, `taxRate`, `taxAmount`, `discountAmount`, `totalAmount`, `paymentMethod` (`cash` | `card` | `digital` | `credit`), `amountTendered`, `changeGiven`, `customerId`, `isCreditPaid`, `notes`.
- **Customer**: `id`, `name`, `phone`, `email`, `address`, `creditBalance`, `creditLimit`, `createdAt`.
- **CreditPayment**: `id`, `customerId`, `saleId`, `amount`, `paymentMethod`, `timestamp`, `receiptNumber`, `notes`.
- **Expense**: `id`, `date`, `category`, `title`, `amount`, `paymentMethod`, `receiptUrl`, `notes`.
- **StoreSettings**: `storeName`, `storeAddress`, `storePhone`, `storeTaxId`, `currencySymbol`, `defaultTaxRate`, `databaseUrl`, `lastSyncTimestamp`.

---

## 5. Step-by-Step Supabase Free Tier & GitHub Deployment Guide (Built-in)

The application includes both an in-app interactive modal/tab and a comprehensive `SUPABASE_SETUP.md` document covering:
1. **Setting up Free Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and click **"Start your project"**.
   - Create project named `sappy-stationary-pos`, select a strong password and nearest cloud region.
2. **Retrieving Your Connection String**:
   - In Supabase dashboard: **Project Settings** -> **Database** -> **Connection string** -> Select **URI** (Pooled mode, port 6543):
     `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
3. **Automated Schema Execution**:
   - Open Supabase **SQL Editor**, paste `schema.sql`, and click **Run** (or click **"Run Schema Auto-Migration"** in the POS app).
4. **One-Click Cloud Sync**:
   - In the Sappy POS **"Supabase Cloud Sync"** tab, enter your connection string and click **"Push Local Data to Supabase"**!
5. **GitHub Hosting Ready**:
   - Clean modular codebase ready for GitHub push and deployment to Vercel, Netlify, or Railway.

---

## 6. Execution Steps & Verification Checklist

- [ ] Initialize application metadata in `metadata.json` and sync `index.html` headers.
- [ ] Create robust TypeScript data models, seed data with realistic stationery items, and local persistence layer.
- [ ] Implement Touchscreen POS Register with category filter, search, cart numpad, and tender modal.
- [ ] Implement Sales Ledger with itemized views and full-page A4 Tax Invoice with print/PDF export.
- [ ] Implement Customer Credit Debt Ledger with due dates, payment history, and debt settlement modal.
- [ ] Implement Inventory & Stock Management with restock calculation and low stock warnings.
- [ ] Implement Expenses Tracker and Daily Profit & Loss (P&L) reporting engine with margin analytics.
- [ ] Build the Supabase PostgreSQL sync engine, setup modal, interactive guide, and deployment configs (`schema.sql`, `SUPABASE_SETUP.md`).
- [ ] Run `compile_applet` and `lint_applet` to verify clean build and flawless execution.

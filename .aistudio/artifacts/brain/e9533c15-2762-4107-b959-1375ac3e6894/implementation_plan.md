# Sappy Stationary POS — Client Handoff & Clean Slate Implementation Plan

This plan details the exact procedure to remove all demo users and test data, introduce a dedicated First-Launch Store Owner Onboarding wizard, and perform rigorous quality audits to ensure the system is completely clean and ready for the client.

---

### User Decisions & Confirmed Scope
- **Initial User Account**: First-launch setup screen to register a new store owner upon first opening the POS terminal.
- **Database & Inventory State**: Wipe everything to 0 for a completely blank slate ($0$ products, $0$ sales, $0$ customers, $0$ debts, $0$ expenses).
- **Client Branding**: Luxury golden serif "SAPPY" branding, dark forest green & charcoal visual identity, Birr (`Br`) currency.

---

## 1. Architecture & State Management Updates

### A. Authentication & First-Launch Experience
- **User Detection**: Enhance `storageService.hasUsers()` and `storageService.getUsers()`. When zero users exist in the system, `storageService.getCurrentUser()` returns `null`.
- **First-Launch Wizard (`FirstLaunchSetupModal.tsx` / `AuthPage.tsx`)**:
  - Automatically presents an onboarding screen when no users exist:
    - **Store Owner Full Name** (e.g., Client Name)
    - **Email Address** (login credential)
    - **Master Password**
    - **Store Name** (defaults to `"Sappy Stationary"`)
    - **Store Phone / Receipt Header**
    - **Default Currency** (defaults to `Br - Ethiopian Birr`)
  - Submitting registers the primary Store Owner (`role: 'owner'`), saves the profile to local storage and the server sync store, and logs in immediately without requiring a second login step.
  - Normal Login/Signup remains accessible afterwards for adding cashiers or logging in on additional devices.

### B. Complete Zero-Data Wipe
- **`src/services/storageService.ts`**:
  - Replace hardcoded demo arrays (`INITIAL_USERS`, `INITIAL_PRODUCTS`, `INITIAL_CUSTOMERS`, `INITIAL_SALES`, `INITIAL_EXPENSES`) with empty arrays `[]`.
  - Set `INITIALIZED_FLAG` so the app knows it is in production mode and will **never** regenerate demo items on refresh or device wipe.
  - Reset `localStorage` keys (`sappy_pos_users`, `sappy_pos_products`, `sappy_pos_customers`, `sappy_pos_sales`, `sappy_pos_expenses`, `sappy_pos_credit_payments`, `sappy_current_user`).
- **`server.ts` & Local Persistence**:
  - Clear `data/pos_store.json` so the local node server starts with empty collections across all entities.
  - Ensure cross-device sync broadcasts the pristine blank state.

---

## 2. Empty State Audits Across All Tabs

Every tab must provide a functional empty state with helpful call-to-action prompts so the store owner can immediately begin configuring their store:

1. **POS Register Tab**:
   - Zero-product state: Friendly illustration / icon with message: *"Your catalog is empty. Add products to start selling."*
   - Direct button: `+ Add First Product` (opens product modal) and `Import from Excel / PDF`.
2. **Sales Ledger Tab**:
   - Zero-sales state: *"No sales recorded yet. Completed transactions will appear here with instant A4 invoice printing."*
3. **Credit & Customer Debts Tab**:
   - Zero-customers state: *"No credit customers registered. Create credit accounts during checkout or add debtors here."*
4. **Inventory Management Tab**:
   - Empty catalog banner: Shows total stock count `0 items`, inventory value `Br 0.00`.
   - Action buttons: `+ Add Stationery Item` and `Bulk Import Catalog`.
5. **Expenses Tracker Tab**:
   - Zero-expenses state: *"No expenses logged. Track store rent, utilities, paper stock, and supplies here."*
   - Action button: `+ Record Expense`.
6. **Reports & Profit/Loss Tab**:
   - Zero-data financial summary: Revenue `Br 0.00`, COGS `Br 0.00`, Expenses `Br 0.00`, Net Margin `0.0%`.
   - Guard against division by zero (`0 / 0` returning `NaN` or `Infinity`).
7. **Supabase Cloud Sync Tab**:
   - Unpolluted settings: No dummy connection strings or test project IDs.
   - Clean setup instructions with 1-click table creation SQL ready for the client's own Supabase project.

---

## 3. Implementation Steps & Verification

1. **Update `src/services/storageService.ts`**:
   - Remove all default sample stationery items and demo user accounts (`Abebe Hailu`, etc.).
   - Implement `isFirstLaunch()` and update `resetEverything()` to guarantee a pure zero baseline.
2. **Create / Refine First-Launch Setup in `src/components/AuthPage.tsx`**:
   - Build a Store Owner Setup View with golden "SAPPY" header, welcoming the owner to configure their store.
   - Instantly create the owner account and transition directly to the POS dashboard.
3. **Clear Server Sync File (`data/pos_store.json`)**:
   - Reset the server data file to empty arrays.
4. **Audit Empty States & Zero-Division Protections**:
   - Check `ReportsTab.tsx`, `InventoryTab.tsx`, `PosTab.tsx`, and `SalesTab.tsx` for zero-state handling.
5. **Production Build & Verification**:
   - Co-execute `compile_applet` and `lint_applet` to confirm 0 compilation and lint errors.
   - Verify `npm run build` succeeds cleanly for GitHub Pages.

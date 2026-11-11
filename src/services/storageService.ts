import {
  Customer,
  CreditPayment,
  Expense,
  Product,
  Sale,
  StoreConfig,
  DailyProfitLossReport,
  AppUser,
  PaymentMethod,
} from '../types/pos.ts';
import {
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_STORE_CONFIG,
} from '../data/seedData.ts';
import {
  configureSupabase,
  getSupabaseCredentials,
  isSupabaseConfigured,
} from '../lib/supabase.ts';

const STORAGE_KEYS = {
  INITIALIZED: 'sappy_pos_initialized_v2',
  PRODUCTS: 'sappy_pos_products_v1',
  SALES: 'sappy_pos_sales_v1',
  CUSTOMERS: 'sappy_pos_customers_v1',
  PAYMENTS: 'sappy_pos_credit_payments_v1',
  EXPENSES: 'sappy_pos_expenses_v1',
  CONFIG: 'sappy_pos_config_v1',
  USERS: 'sappy_pos_users_v1',
  CURRENT_USER: 'sappy_pos_current_user_v1',
  DELETED_USER_IDS: 'sappy_pos_deleted_user_ids_v1',
  DELETED_CUSTOMER_IDS: 'sappy_pos_deleted_customer_ids_v1',
  WELCOMED_USER_IDS: 'sappy_pos_welcomed_user_ids_v1',
};

export const DEFAULT_INITIAL_USERS: AppUser[] = [
  {
    id: 'usr-owner-amanuel',
    email: 'amanuealhailu007@gmail.com',
    fullName: 'Amanuel Hailu',
    role: 'owner',
    storeName: 'Sappy Stationary',
    phone: '+251 91 123 4567',
    pinCode: '1313',
    status: 'active',
    createdAt: '2026-01-01T08:00:00Z',
    notes: 'Store Owner & Commercial Administrator',
  },
];

const INITIAL_USERS: AppUser[] = DEFAULT_INITIAL_USERS;
export const DEFAULT_MASTER_PASSCODE = 'Sappy#1313';

class StorageService {
  private changeListeners: Set<() => void> = new Set();

  /**
   * Subscribes to any local storage data mutation (product, sale, customer, payment, expense, config, user).
   * Called immediately whenever any action completes.
   */
  public subscribeToChanges(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => {
      this.changeListeners.delete(fn);
    };
  }

  public notifyChange(): void {
    this.changeListeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('Storage change listener warning:', err);
      }
    });
  }

  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return fallback;
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T, notify = true): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (notify) {
        this.notifyChange();
      }
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  // --- Store Configuration ---
  getStoreConfig(): StoreConfig {
    const config = this.get<StoreConfig>(STORAGE_KEYS.CONFIG, INITIAL_STORE_CONFIG);
    let changed = false;

    // Ensure master passcode exists with fallback Sappy#1313
    if (!config.masterPasscode) {
      config.masterPasscode = DEFAULT_MASTER_PASSCODE;
      changed = true;
    }

    // Auto-migrate old dollar currency symbol to Ethiopian Birr (Br)
    if (config.currencySymbol === '$' || config.currencyCode === 'USD') {
      config.currencySymbol = 'Br ';
      config.currencyCode = 'ETB';
      config.defaultTaxRate = config.defaultTaxRate || 15;
      changed = true;
    }

    // Auto-populate Supabase DB secrets from build environment or permanent defaults
    const envUrl = (((import.meta as any).env?.VITE_SUPABASE_URL || 'https://fegfrjhxxpojmalytbku.supabase.co') as string).trim();
    const envKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2') as string).trim();
    if (!config.supabaseUrl || config.supabaseUrl.includes('your-project')) {
      config.supabaseUrl = envUrl;
      changed = true;
    }
    if (!config.supabaseAnonKey || config.supabaseAnonKey.includes('...')) {
      config.supabaseAnonKey = envKey;
      changed = true;
    }

    if (changed) {
      this.saveStoreConfig(config);
    }
    return config;
  }

  saveStoreConfig(config: StoreConfig): void {
    if (!config.masterPasscode) {
      config.masterPasscode = DEFAULT_MASTER_PASSCODE;
    }
    this.set(STORAGE_KEYS.CONFIG, config);

    if (config.supabaseUrl && config.supabaseAnonKey) {
      try {
        const creds = getSupabaseCredentials();
        if (
          creds.url !== config.supabaseUrl ||
          creds.anonKey !== config.supabaseAnonKey ||
          !isSupabaseConfigured()
        ) {
          configureSupabase(config.supabaseUrl, config.supabaseAnonKey);
        }
      } catch (e) {
        console.warn('Error auto-configuring Supabase from store config:', e);
      }
    }
  }

  getMasterPasscode(): string {
    return this.getStoreConfig().masterPasscode || DEFAULT_MASTER_PASSCODE;
  }

  verifyMasterPasscode(entered: string): boolean {
    if (!entered) return false;
    const current = this.getMasterPasscode();
    return entered.trim() === current.trim();
  }

  updateMasterPasscode(
    newPasscode: string,
    requester: AppUser | null
  ): { success: boolean; error?: string } {
    if (!requester || requester.role !== 'owner') {
      return {
        success: false,
        error: 'Permission denied. The Master Passcode can only be changed by Store Owner(s).',
      };
    }
    const clean = newPasscode ? newPasscode.trim() : '';
    if (clean.length < 4) {
      return {
        success: false,
        error: 'Master Passcode must be at least 4 characters long.',
      };
    }
    const config = this.getStoreConfig();
    config.masterPasscode = clean;
    this.saveStoreConfig(config);
    return { success: true };
  }

  // --- Products & Inventory ---
  getProducts(): Product[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as Product[];
      } catch {
        return [];
      }
    }
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
      return [];
    }
    this.set(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  }

  saveProduct(product: Product): Product[] {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    let updated: Product[];
    const now = new Date().toISOString();
    const toSave = { ...product, updatedAt: now };

    if (index >= 0) {
      updated = [...products];
      updated[index] = toSave;
    } else {
      updated = [toSave, ...products];
    }
    this.set(STORAGE_KEYS.PRODUCTS, updated);
    return updated;
  }

  deleteProduct(productId: string): Product[] {
    const products = this.getProducts().filter((p) => p.id !== productId);
    this.set(STORAGE_KEYS.PRODUCTS, products);
    return products;
  }

  adjustStock(productId: string, quantityDelta: number): Product[] {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === productId);
    if (index >= 0) {
      products[index] = {
        ...products[index],
        stockLevel: Math.max(0, products[index].stockLevel + quantityDelta),
        updatedAt: new Date().toISOString(),
      };
      this.set(STORAGE_KEYS.PRODUCTS, products);
    }
    return products;
  }

  // --- Customers & Credit Accounts ---
  getDeletedCustomerIds(): string[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_CUSTOMER_IDS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  recordDeletedCustomerId(customerId: string): void {
    if (!customerId) return;
    const current = this.getDeletedCustomerIds();
    if (!current.includes(customerId)) {
      const updated = [...current, customerId];
      this.set(STORAGE_KEYS.DELETED_CUSTOMER_IDS, updated, false);
    }
  }

  clearDeletedCustomerId(customerId: string): void {
    if (!customerId) return;
    const current = this.getDeletedCustomerIds();
    if (current.includes(customerId)) {
      this.set(STORAGE_KEYS.DELETED_CUSTOMER_IDS, current.filter((id) => id !== customerId), false);
    }
  }

  getCustomers(): Customer[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as Customer[];
        const deletedIds = new Set(this.getDeletedCustomerIds());
        return parsed.filter((c) => !deletedIds.has(c.id));
      } catch {
        return [];
      }
    }
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
      return [];
    }
    const deletedIds = new Set(this.getDeletedCustomerIds());
    const initial = INITIAL_CUSTOMERS.filter((c) => !deletedIds.has(c.id));
    this.set(STORAGE_KEYS.CUSTOMERS, initial);
    return initial;
  }

  saveCustomer(customer: Customer): Customer[] {
    this.clearDeletedCustomerId(customer.id);
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === customer.id);
    let updated: Customer[];
    if (index >= 0) {
      updated = [...customers];
      updated[index] = customer;
    } else {
      updated = [customer, ...customers];
    }
    this.set(STORAGE_KEYS.CUSTOMERS, updated);
    return updated;
  }

  deleteCustomer(customerId: string): Customer[] {
    const customers = this.getCustomers().filter((c) => c.id !== customerId);
    this.set(STORAGE_KEYS.CUSTOMERS, customers);
    this.recordDeletedCustomerId(customerId);
    return customers;
  }

  recordCreditPayment(
    payment: Omit<CreditPayment, 'id' | 'timestamp' | 'receiptNumber'> & { timestamp?: string }
  ): {
    payment: CreditPayment;
    customers: Customer[];
  } {
    const count = this.getCreditPayments().length + 1;
    const prefix = payment.isExternal ? 'RCPT-EXT' : 'RCPT-PAY';
    const receiptNumber = `${prefix}-${String(count).padStart(4, '0')}`;
    const newPayment: CreditPayment = {
      ...payment,
      id: `pay-${Date.now()}`,
      timestamp: payment.timestamp || new Date().toISOString(),
      receiptNumber,
    };

    const payments = [newPayment, ...this.getCreditPayments()];
    this.set(STORAGE_KEYS.PAYMENTS, payments);

    // Reduce customer's credit balance
    const customers = this.getCustomers();
    const custIndex = customers.findIndex((c) => c.id === payment.customerId);
    if (custIndex >= 0) {
      customers[custIndex] = {
        ...customers[custIndex],
        creditBalance: Math.max(0, customers[custIndex].creditBalance - payment.amount),
      };
      this.set(STORAGE_KEYS.CUSTOMERS, customers);
    }

    return { payment: newPayment, customers };
  }

  // Manually add or adjust customer credit balance
  adjustCustomerCredit(
    customerId: string,
    amountDelta: number,
    reason: string
  ): Customer[] {
    const customers = this.getCustomers();
    const custIndex = customers.findIndex((c) => c.id === customerId);
    if (custIndex >= 0) {
      const updatedBalance = Math.max(0, customers[custIndex].creditBalance + amountDelta);
      customers[custIndex] = {
        ...customers[custIndex],
        creditBalance: updatedBalance,
        notes: reason
          ? `${customers[custIndex].notes ? customers[custIndex].notes + ' • ' : ''}[Manual Credit Adjustment: ${amountDelta > 0 ? '+' : ''}${amountDelta} Br - ${reason}]`
          : customers[custIndex].notes,
      };
      this.set(STORAGE_KEYS.CUSTOMERS, customers);
    }
    return customers;
  }

  getCreditPayments(): CreditPayment[] {
    return this.get<CreditPayment[]>(STORAGE_KEYS.PAYMENTS, []);
  }

  // --- Sales & Invoicing ---
  getSales(): Sale[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SALES);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as Sale[];
      } catch {
        return [];
      }
    }
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
      return [];
    }
    this.set(STORAGE_KEYS.SALES, INITIAL_SALES);
    return INITIAL_SALES;
  }

  recordSale(saleData: Omit<Sale, 'id' | 'invoiceNumber' | 'timestamp'>): Sale {
    const sales = this.getSales();
    const count = sales.length + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(count).padStart(4, '0')}`;

    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}`,
      invoiceNumber,
      timestamp: new Date().toISOString(),
    };

    // 1. Save Sale
    const updatedSales = [newSale, ...sales];
    this.set(STORAGE_KEYS.SALES, updatedSales);

    // 2. Deduct Inventory Stock
    const products = this.getProducts();
    newSale.items.forEach((item) => {
      const pIndex = products.findIndex((p) => p.id === item.productId);
      if (pIndex >= 0) {
        products[pIndex] = {
          ...products[pIndex],
          stockLevel: Math.max(0, products[pIndex].stockLevel - item.quantity),
          updatedAt: new Date().toISOString(),
        };
      }
    });
    this.set(STORAGE_KEYS.PRODUCTS, products);

    // 3. If Credit Sale, add debt to Customer Account
    if (newSale.paymentMethod === 'credit' && newSale.customerId) {
      const customers = this.getCustomers();
      const cIndex = customers.findIndex((c) => c.id === newSale.customerId);
      if (cIndex >= 0) {
        const remainingUnpaid = newSale.totalAmount - (newSale.paidAmount || 0);
        customers[cIndex] = {
          ...customers[cIndex],
          creditBalance: customers[cIndex].creditBalance + remainingUnpaid,
          totalPurchased: customers[cIndex].totalPurchased + newSale.totalAmount,
        };
        this.set(STORAGE_KEYS.CUSTOMERS, customers);
      }
    } else if (newSale.customerId) {
      // Cash/card sale for existing customer
      const customers = this.getCustomers();
      const cIndex = customers.findIndex((c) => c.id === newSale.customerId);
      if (cIndex >= 0) {
        customers[cIndex] = {
          ...customers[cIndex],
          totalPurchased: customers[cIndex].totalPurchased + newSale.totalAmount,
        };
        this.set(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    return newSale;
  }

  // --- Sales Reversals & Returns ---
  returnSale(
    saleId: string,
    returnData: {
      reason: string;
      refundMethod?: PaymentMethod | 'credit_reversal' | 'store_credit';
      returnedBy?: string;
    }
  ): { success: boolean; sale?: Sale; error?: string } {
    const sales = this.getSales();
    const saleIndex = sales.findIndex((s) => s.id === saleId);
    if (saleIndex < 0) {
      return { success: false, error: 'Sale transaction not found.' };
    }

    const targetSale = sales[saleIndex];
    if (targetSale.isReturned) {
      return { success: false, error: 'This sale has already been returned / reversed.' };
    }

    const nowIso = new Date().toISOString();
    const refundMethod =
      returnData.refundMethod ||
      (targetSale.paymentMethod === 'credit' ? 'credit_reversal' : targetSale.paymentMethod);

    // 1. Mark sale as returned
    const updatedSale: Sale = {
      ...targetSale,
      isReturned: true,
      status: 'returned',
      returnedAt: nowIso,
      returnReason: returnData.reason || 'Customer Return',
      refundMethod,
      returnedBy: returnData.returnedBy || 'Store Staff',
    };

    sales[saleIndex] = updatedSale;
    this.set(STORAGE_KEYS.SALES, sales);

    // 2. Automatically increment product stock back into inventory
    const products = this.getProducts();
    let productsModified = false;
    targetSale.items.forEach((item) => {
      const pIndex = products.findIndex((p) => p.id === item.productId);
      if (pIndex >= 0) {
        products[pIndex] = {
          ...products[pIndex],
          stockLevel: products[pIndex].stockLevel + item.quantity,
          updatedAt: nowIso,
        };
        productsModified = true;
      }
    });
    if (productsModified) {
      this.set(STORAGE_KEYS.PRODUCTS, products);
    }

    // 3. Reverse customer debt if credit sale or adjust customer spend
    if (targetSale.customerId) {
      const customers = this.getCustomers();
      const cIndex = customers.findIndex((c) => c.id === targetSale.customerId);
      if (cIndex >= 0) {
        const cust = customers[cIndex];
        const newTotalPurchased = Math.max(0, cust.totalPurchased - targetSale.totalAmount);
        let newCreditBalance = cust.creditBalance;

        if (targetSale.paymentMethod === 'credit') {
          const unpaidOnThisSale = targetSale.totalAmount - (targetSale.paidAmount || 0);
          newCreditBalance = Math.max(0, cust.creditBalance - unpaidOnThisSale);
        }

        customers[cIndex] = {
          ...cust,
          creditBalance: newCreditBalance,
          totalPurchased: newTotalPurchased,
          notes: cust.notes
            ? `${cust.notes} • [Return: Reversed ${targetSale.invoiceNumber}]`
            : `[Return: Reversed ${targetSale.invoiceNumber}]`,
        };
        this.set(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    return { success: true, sale: updatedSale };
  }

  // --- Expenses ---
  getExpenses(): Expense[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as Expense[];
      } catch {
        return [];
      }
    }
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
      return [];
    }
    this.set(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
    return INITIAL_EXPENSES;
  }

  saveExpense(expenseData: Omit<Expense, 'id' | 'createdAt'>): Expense[] {
    const expenses = this.getExpenses();
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newExpense, ...expenses];
    this.set(STORAGE_KEYS.EXPENSES, updated);
    return updated;
  }

  deleteExpense(expenseId: string): Expense[] {
    const expenses = this.getExpenses().filter((e) => e.id !== expenseId);
    this.set(STORAGE_KEYS.EXPENSES, expenses);
    return expenses;
  }

  // --- Daily Profit & Loss Calculations ---
  getDailyProfitLoss(dateStr: string): DailyProfitLossReport {
    // dateStr format: YYYY-MM-DD
    const allSales = this.getSales();
    const allExpenses = this.getExpenses();
    const allPayments = this.getCreditPayments();

    const daySales = allSales.filter((s) => s.timestamp.startsWith(dateStr));
    const activeDaySales = daySales.filter((s) => !s.isReturned);
    const returnedDaySales = daySales.filter((s) => s.isReturned);

    const dayExpenses = allExpenses.filter((e) => e.date === dateStr);
    const dayCreditPayments = allPayments.filter((p) => p.timestamp.startsWith(dateStr));

    const grossSales = activeDaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const taxCollected = activeDaySales.reduce((acc, s) => acc + s.taxAmount, 0);
    const netSales = grossSales - taxCollected;
    const cogs = activeDaySales.reduce((acc, s) => acc + s.totalCost, 0);
    const grossProfit = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    const totalExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    const creditSalesTotal = activeDaySales
      .filter((s) => s.paymentMethod === 'credit')
      .reduce((acc, s) => acc + s.totalAmount, 0);

    const creditCollectedTotal = dayCreditPayments.reduce((acc, p) => acc + p.amount, 0);
    const returnsTotal = returnedDaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const returnedCount = returnedDaySales.length;

    return {
      date: dateStr,
      grossSales,
      taxCollected,
      netSales,
      cogs,
      grossProfit,
      grossMarginPercent,
      totalExpenses,
      netProfit,
      netMarginPercent,
      transactionCount: activeDaySales.length,
      creditSalesTotal,
      creditCollectedTotal,
      returnsTotal,
      returnedCount,
    };
  }

  // Range-based P&L Summary
  getRangeProfitLoss(startDateStr: string, endDateStr: string): {
    grossSales: number;
    taxCollected: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    totalExpenses: number;
    netProfit: number;
    netMarginPercent: number;
    totalTransactions: number;
    returnsTotal: number;
    returnedCount: number;
    dailyBreakdown: DailyProfitLossReport[];
  } {
    const allSales = this.getSales();
    const allExpenses = this.getExpenses();
    const allPayments = this.getCreditPayments();

    const filteredSales = allSales.filter((s) => {
      const d = s.timestamp.slice(0, 10);
      return d >= startDateStr && d <= endDateStr;
    });

    const activeSales = filteredSales.filter((s) => !s.isReturned);
    const returnedSales = filteredSales.filter((s) => s.isReturned);

    const filteredExpenses = allExpenses.filter((e) => {
      return e.date >= startDateStr && e.date <= endDateStr;
    });

    const grossSales = activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const taxCollected = activeSales.reduce((acc, s) => acc + s.taxAmount, 0);
    const netSales = grossSales - taxCollected;
    const cogs = activeSales.reduce((acc, s) => acc + s.totalCost, 0);
    const grossProfit = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const returnsTotal = returnedSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const returnedCount = returnedSales.length;

    // Collect all unique dates in the range
    const datesSet = new Set<string>();
    filteredSales.forEach((s) => datesSet.add(s.timestamp.slice(0, 10)));
    filteredExpenses.forEach((e) => datesSet.add(e.date));

    // Sort dates descending
    const sortedDates = Array.from(datesSet).sort().reverse();
    const dailyBreakdown = sortedDates.map((date) => this.getDailyProfitLoss(date));

    return {
      grossSales,
      taxCollected,
      netSales,
      cogs,
      grossProfit,
      grossMarginPercent,
      totalExpenses,
      netProfit,
      netMarginPercent,
      totalTransactions: activeSales.length,
      returnsTotal,
      returnedCount,
      dailyBreakdown,
    };
  }

  // --- Full Cross-Device Export & Import ---
  exportBackup(): string {
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      storeName: 'Sappy Stationary',
      config: this.getStoreConfig(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      sales: this.getSales(),
      creditPayments: this.getCreditPayments(),
      expenses: this.getExpenses(),
      users: this.getUsers(),
    };
    return JSON.stringify(payload, null, 2);
  }

  importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.products && Array.isArray(data.products)) {
        this.set(STORAGE_KEYS.PRODUCTS, data.products);
      }
      if (data.customers && Array.isArray(data.customers)) {
        this.set(STORAGE_KEYS.CUSTOMERS, data.customers);
      }
      if (data.sales && Array.isArray(data.sales)) {
        this.set(STORAGE_KEYS.SALES, data.sales);
      }
      if (data.creditPayments && Array.isArray(data.creditPayments)) {
        this.set(STORAGE_KEYS.PAYMENTS, data.creditPayments);
      }
      if (data.expenses && Array.isArray(data.expenses)) {
        this.set(STORAGE_KEYS.EXPENSES, data.expenses);
      }
      if (data.config) {
        this.set(STORAGE_KEYS.CONFIG, data.config);
      }
      if (data.users && Array.isArray(data.users)) {
        this.set(STORAGE_KEYS.USERS, data.users);
      }
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  // --- Reset Operations ---
  yearlyReset(year: number, options: { resetCustomerBalances?: boolean } = {}): {
    clearedSalesCount: number;
    clearedExpensesCount: number;
    clearedPaymentsCount: number;
  } {
    const yearStr = year.toString();
    const allSales = this.getSales();
    const allExpenses = this.getExpenses();
    const allPayments = this.getCreditPayments();

    const remainingSales = allSales.filter((s) => !s.timestamp.startsWith(yearStr));
    const remainingExpenses = allExpenses.filter((e) => !e.date.startsWith(yearStr));
    const remainingPayments = allPayments.filter((p) => !p.timestamp.startsWith(yearStr));

    const clearedSalesCount = allSales.length - remainingSales.length;
    const clearedExpensesCount = allExpenses.length - remainingExpenses.length;
    const clearedPaymentsCount = allPayments.length - remainingPayments.length;

    this.set(STORAGE_KEYS.SALES, remainingSales);
    this.set(STORAGE_KEYS.EXPENSES, remainingExpenses);
    this.set(STORAGE_KEYS.PAYMENTS, remainingPayments);

    // If requested, zero-out customer credit balances
    if (options.resetCustomerBalances) {
      const customers = this.getCustomers().map((c) => ({
        ...c,
        creditBalance: 0,
        updatedAt: new Date().toISOString(),
      }));
      this.set(STORAGE_KEYS.CUSTOMERS, customers);
    }

    return {
      clearedSalesCount,
      clearedExpensesCount,
      clearedPaymentsCount,
    };
  }

  resetTransactionsOnly(): {
    clearedSalesCount: number;
    clearedExpensesCount: number;
  } {
    const salesCount = this.getSales().length;
    const expCount = this.getExpenses().length;

    this.set(STORAGE_KEYS.SALES, []);
    this.set(STORAGE_KEYS.EXPENSES, []);
    this.set(STORAGE_KEYS.PAYMENTS, []);

    // Also zero out customer balances
    const customers = this.getCustomers().map((c) => ({
      ...c,
      creditBalance: 0,
      updatedAt: new Date().toISOString(),
    }));
    this.set(STORAGE_KEYS.CUSTOMERS, customers);

    return { clearedSalesCount: salesCount, clearedExpensesCount: expCount };
  }

  resetEverything(): void {
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    this.set(STORAGE_KEYS.PRODUCTS, []);
    this.set(STORAGE_KEYS.CUSTOMERS, []);
    this.set(STORAGE_KEYS.SALES, []);
    this.set(STORAGE_KEYS.EXPENSES, []);
    this.set(STORAGE_KEYS.PAYMENTS, []);
    this.set(STORAGE_KEYS.USERS, []);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.DELETED_USER_IDS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_CUSTOMER_IDS);
  }

  // --- User Authentication & Session Management ---
  hasUsers(): boolean {
    return this.getUsers().length > 0;
  }

  getUsers(): AppUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as AppUser[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out the three unknown mock users: Abebe, Bethelhem, and Dawit
          let filtered = parsed.filter((u) => {
            const email = (u?.email || '').toLowerCase().trim();
            return (
              email !== 'owner@sappystationery.et' &&
              email !== 'cashier@sappystationery.et' &&
              email !== 'manager@sappystationery.et'
            );
          });

          // Ensure Amanuel Hailu (store owner) exists in the accounts list
          const hasAmanuel = filtered.some((u) => u.email.toLowerCase() === 'amanuealhailu007@gmail.com');
          if (!hasAmanuel) {
            filtered = [DEFAULT_INITIAL_USERS[0], ...filtered];
          }

          if (filtered.length !== parsed.length || !hasAmanuel) {
            this.set(STORAGE_KEYS.USERS, filtered);
          }
          return filtered;
        }
      } catch {
        // Fallback to defaults
      }
    }
    this.set(STORAGE_KEYS.USERS, DEFAULT_INITIAL_USERS);
    return DEFAULT_INITIAL_USERS;
  }

  getCurrentUser(): AppUser | null {
    if (typeof window === 'undefined') return null;
    // Wipe any legacy localStorage auto-login if present
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {}

    // Strictly check active tab sessionStorage
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!raw || raw === 'null' || raw === 'logged_out') {
        return null;
      }
      const user = JSON.parse(raw) as AppUser;
      const users = this.getUsers();
      const match = users.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      return match || null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: AppUser | null): void {
    if (typeof window === 'undefined') return;
    try {
      // Clear legacy localStorage
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

      if (user === null) {
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } else {
        user.lastLoginAt = new Date().toISOString();
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Session write error:', e);
    }
  }

  // --- First-Login Welcome Animation Tracking ---
  hasUserCompletedWelcome(userId: string): boolean {
    if (typeof window === 'undefined' || !userId) return true;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WELCOMED_USER_IDS);
      if (!raw) return false;
      const ids = JSON.parse(raw) as string[];
      return ids.includes(userId);
    } catch {
      return false;
    }
  }

  setUserCompletedWelcome(userId: string): void {
    if (typeof window === 'undefined' || !userId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WELCOMED_USER_IDS);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(userId)) {
        ids.push(userId);
        localStorage.setItem(STORAGE_KEYS.WELCOMED_USER_IDS, JSON.stringify(ids));
      }
    } catch (e) {
      console.warn('Failed to save welcomed user status:', e);
    }
  }

  resetUserWelcome(userId: string): void {
    if (typeof window === 'undefined' || !userId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WELCOMED_USER_IDS);
      if (!raw) return;
      const ids: string[] = JSON.parse(raw);
      const updated = ids.filter((id) => id !== userId);
      localStorage.setItem(STORAGE_KEYS.WELCOMED_USER_IDS, JSON.stringify(updated));
    } catch {}
  }

  registerUser(userData: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = this.getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      // Update existing
      const updated: AppUser = {
        ...existing,
        ...userData,
        status: userData.status || existing.status || 'active',
        lastLoginAt: new Date().toISOString(),
      };
      const list = users.map((u) => (u.id === existing.id ? updated : u));
      this.set(STORAGE_KEYS.USERS, list);
      this.setCurrentUser(updated);
      return updated;
    }

    const newUser: AppUser = {
      ...userData,
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status: userData.status || 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const updatedList = [newUser, ...users];
    this.set(STORAGE_KEYS.USERS, updatedList);
    this.setCurrentUser(newUser);
    return newUser;
  }

  getDeletedUserIds(): string[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USER_IDS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  recordDeletedUserId(userId: string): void {
    if (!userId) return;
    const current = this.getDeletedUserIds();
    if (!current.includes(userId)) {
      const updated = [...current, userId];
      this.set(STORAGE_KEYS.DELETED_USER_IDS, updated);
    }
  }

  clearDeletedUserId(userId: string): void {
    if (!userId) return;
    const current = this.getDeletedUserIds();
    if (current.includes(userId)) {
      this.set(STORAGE_KEYS.DELETED_USER_IDS, current.filter((id) => id !== userId));
    }
  }

  saveUser(user: AppUser): AppUser[] {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    let updated: AppUser[];

    const sanitizedUser: AppUser = {
      ...user,
      status: user.status || 'active',
      updatedAt: new Date().toISOString(),
    };

    this.clearDeletedUserId(user.id);

    if (index >= 0) {
      updated = [...users];
      updated[index] = sanitizedUser;
    } else {
      updated = [sanitizedUser, ...users];
    }

    this.set(STORAGE_KEYS.USERS, updated);

    // If current session user is being edited, sync current user
    const current = this.getCurrentUser();
    if (current && current.id === sanitizedUser.id) {
      this.setCurrentUser({ ...current, ...sanitizedUser });
    }

    return updated;
  }

  deleteUser(userId: string): { success: boolean; error?: string; users: AppUser[] } {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'User account not found', users };
    }

    // Safeguard: Check if this is the only owner
    if (target.role === 'owner') {
      const ownerCount = users.filter((u) => u.role === 'owner').length;
      if (ownerCount <= 1) {
        return {
          success: false,
          error: 'Cannot delete the only remaining Store Owner. Sappy POS requires at least one active Owner account.',
          users,
        };
      }
    }

    // Safeguard: Cannot delete self
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      return {
        success: false,
        error: 'You cannot delete your own currently active staff account.',
        users,
      };
    }

    const updated = users.filter((u) => u.id !== userId);
    this.set(STORAGE_KEYS.USERS, updated);
    this.recordDeletedUserId(userId);
    return { success: true, users: updated };
  }

  updateUserStatus(userId: string, status: 'active' | 'suspended'): AppUser[] {
    const users = this.getUsers();
    const now = new Date().toISOString();
    const updated = users.map((u) => (u.id === userId ? { ...u, status, updatedAt: now } : u));
    this.set(STORAGE_KEYS.USERS, updated);

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, status, updatedAt: now });
    }

    return updated;
  }

  setUserPin(userId: string, pin: string): AppUser[] {
    const users = this.getUsers();
    const cleanPin = pin.trim();
    const now = new Date().toISOString();
    const updated = users.map((u) => (u.id === userId ? { ...u, pinCode: cleanPin || undefined, updatedAt: now } : u));
    this.set(STORAGE_KEYS.USERS, updated);

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, pinCode: cleanPin || undefined, updatedAt: now });
    }

    return updated;
  }

  verifyUserPin(pin: string): AppUser | null {
    if (!pin) return null;
    const cleanPin = pin.trim();
    const users = this.getUsers();
    return users.find((u) => u.pinCode === cleanPin && u.status !== 'suspended') || null;
  }

  seedDemoStaff(): AppUser[] {
    return this.getUsers();
  }

  findUserByEmail(email: string): AppUser | null {
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }


  // --- Cross-Device Cloud Synchronization Helpers ---
  getAllData() {
    return {
      products: this.getProducts(),
      customers: this.getCustomers(),
      sales: this.getSales(),
      expenses: this.getExpenses(),
      creditPayments: this.getCreditPayments(),
      config: this.getStoreConfig(),
      users: this.getUsers(),
      deletedUserIds: this.getDeletedUserIds(),
      deletedCustomerIds: this.getDeletedCustomerIds(),
    };
  }

  hydrateFromServer(state: {
    products?: Product[];
    customers?: Customer[];
    sales?: Sale[];
    expenses?: Expense[];
    creditPayments?: CreditPayment[];
    config?: StoreConfig;
    users?: AppUser[];
    deletedUserIds?: string[];
    deletedCustomerIds?: string[];
  }): void {
    if (state.products && Array.isArray(state.products)) {
      this.set(STORAGE_KEYS.PRODUCTS, state.products, false);
    }
    if (state.customers && Array.isArray(state.customers)) {
      const localDeleted = new Set(this.getDeletedCustomerIds());
      const filtered = state.customers.filter((c) => !localDeleted.has(c.id));
      this.set(STORAGE_KEYS.CUSTOMERS, filtered, false);
    }
    if (state.sales && Array.isArray(state.sales)) {
      this.set(STORAGE_KEYS.SALES, state.sales, false);
    }
    if (state.expenses && Array.isArray(state.expenses)) {
      this.set(STORAGE_KEYS.EXPENSES, state.expenses, false);
    }
    if (state.creditPayments && Array.isArray(state.creditPayments)) {
      this.set(STORAGE_KEYS.PAYMENTS, state.creditPayments, false);
    }
    if (state.config && typeof state.config === 'object') {
      this.set(STORAGE_KEYS.CONFIG, state.config, false);
      if (state.config.supabaseUrl && state.config.supabaseAnonKey) {
        try {
          const creds = getSupabaseCredentials();
          if (
            creds.url !== state.config.supabaseUrl ||
            creds.anonKey !== state.config.supabaseAnonKey ||
            !isSupabaseConfigured()
          ) {
            configureSupabase(state.config.supabaseUrl, state.config.supabaseAnonKey);
          }
        } catch (e) {
          console.warn('Auto-configuring Supabase from server state failed:', e);
        }
      }
    }
    if (state.users && Array.isArray(state.users)) {
      const localDeleted = new Set(this.getDeletedUserIds());
      const filtered = state.users.filter((u) => !localDeleted.has(u.id));
      this.set(STORAGE_KEYS.USERS, filtered, false);
    }
  }
}

export const storageService = new StorageService();

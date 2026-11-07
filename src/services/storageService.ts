import {
  Customer,
  CreditPayment,
  Expense,
  Product,
  Sale,
  StoreConfig,
  DailyProfitLossReport,
  AppUser,
} from '../types/pos.ts';
import {
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_STORE_CONFIG,
} from '../data/seedData.ts';

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
};
const INITIAL_USERS: AppUser[] = [];

class StorageService {
  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return fallback;
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  // --- Store Configuration ---
  getStoreConfig(): StoreConfig {
    const config = this.get<StoreConfig>(STORAGE_KEYS.CONFIG, INITIAL_STORE_CONFIG);
    // Auto-migrate old dollar currency symbol to Ethiopian Birr (Br)
    if (config.currencySymbol === '$' || config.currencyCode === 'USD') {
      const updatedConfig: StoreConfig = {
        ...config,
        currencySymbol: 'Br ',
        currencyCode: 'ETB',
        defaultTaxRate: config.defaultTaxRate || 15,
      };
      this.saveStoreConfig(updatedConfig);
      return updatedConfig;
    }
    return config;
  }

  saveStoreConfig(config: StoreConfig): void {
    this.set(STORAGE_KEYS.CONFIG, config);
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
  getCustomers(): Customer[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as Customer[];
      } catch {
        return [];
      }
    }
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
      return [];
    }
    this.set(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    return INITIAL_CUSTOMERS;
  }

  saveCustomer(customer: Customer): Customer[] {
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
    const dayExpenses = allExpenses.filter((e) => e.date === dateStr);
    const dayCreditPayments = allPayments.filter((p) => p.timestamp.startsWith(dateStr));

    const grossSales = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const taxCollected = daySales.reduce((acc, s) => acc + s.taxAmount, 0);
    const netSales = grossSales - taxCollected;
    const cogs = daySales.reduce((acc, s) => acc + s.totalCost, 0);
    const grossProfit = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    const totalExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    const creditSalesTotal = daySales
      .filter((s) => s.paymentMethod === 'credit')
      .reduce((acc, s) => acc + s.totalAmount, 0);

    const creditCollectedTotal = dayCreditPayments.reduce((acc, p) => acc + p.amount, 0);

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
      transactionCount: daySales.length,
      creditSalesTotal,
      creditCollectedTotal,
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
    dailyBreakdown: DailyProfitLossReport[];
  } {
    const allSales = this.getSales();
    const allExpenses = this.getExpenses();
    const allPayments = this.getCreditPayments();

    const filteredSales = allSales.filter((s) => {
      const d = s.timestamp.slice(0, 10);
      return d >= startDateStr && d <= endDateStr;
    });

    const filteredExpenses = allExpenses.filter((e) => {
      return e.date >= startDateStr && e.date <= endDateStr;
    });

    const grossSales = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const taxCollected = filteredSales.reduce((acc, s) => acc + s.taxAmount, 0);
    const netSales = grossSales - taxCollected;
    const cogs = filteredSales.reduce((acc, s) => acc + s.totalCost, 0);
    const grossProfit = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

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
      totalTransactions: filteredSales.length,
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
  }

  // --- User Authentication & Session Management ---
  hasUsers(): boolean {
    return this.getUsers().length > 0;
  }

  getUsers(): AppUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as AppUser[];
      } catch {
        return [];
      }
    }
    this.set(STORAGE_KEYS.USERS, []);
    return [];
  }

  getCurrentUser(): AppUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw === 'null' || raw === 'logged_out' || !raw) {
      return null;
    }
    try {
      const user = JSON.parse(raw) as AppUser;
      // Verify user is in registered list
      const users = this.getUsers();
      const match = users.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      return match || null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: AppUser | null): void {
    if (user === null) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, 'logged_out');
    } else {
      user.lastLoginAt = new Date().toISOString();
      this.set(STORAGE_KEYS.CURRENT_USER, user);
    }
  }

  registerUser(userData: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = this.getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      // Update existing
      const updated: AppUser = {
        ...existing,
        ...userData,
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
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const updatedList = [newUser, ...users];
    this.set(STORAGE_KEYS.USERS, updatedList);
    this.setCurrentUser(newUser);
    return newUser;
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
  }): void {
    if (state.products && Array.isArray(state.products)) {
      this.set(STORAGE_KEYS.PRODUCTS, state.products);
    }
    if (state.customers && Array.isArray(state.customers)) {
      this.set(STORAGE_KEYS.CUSTOMERS, state.customers);
    }
    if (state.sales && Array.isArray(state.sales)) {
      this.set(STORAGE_KEYS.SALES, state.sales);
    }
    if (state.expenses && Array.isArray(state.expenses)) {
      this.set(STORAGE_KEYS.EXPENSES, state.expenses);
    }
    if (state.creditPayments && Array.isArray(state.creditPayments)) {
      this.set(STORAGE_KEYS.PAYMENTS, state.creditPayments);
    }
    if (state.config && typeof state.config === 'object') {
      this.set(STORAGE_KEYS.CONFIG, state.config);
    }
    if (state.users && Array.isArray(state.users)) {
      this.set(STORAGE_KEYS.USERS, state.users);
    }
  }
}

export const storageService = new StorageService();

export type ProductCategory =
  | 'Writing & Pens'
  | 'Paper & Notebooks'
  | 'Desk & Office'
  | 'Filing & Folders'
  | 'Art & Craft'
  | 'School & Math'
  | 'Printing & Services'
  | 'General';

export type PaymentMethod = 'cash' | 'card' | 'digital' | 'credit';

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: number;     // Wholesale / buying price for COGS
  sellingPrice: number;  // Retail selling price
  stockLevel: number;
  lowStockThreshold: number;
  unit: string;          // e.g. 'pcs', 'pack', 'ream', 'box', 'set'
  description?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number; // 0 to 100
  customPrice?: number;    // optional override
  lineTotal: number;
  lineCostTotal: number;
}

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  lineCostTotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string; // e.g. "INV-2026-0001"
  timestamp: string;      // ISO string
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: SaleItem[];
  subtotal: number;
  taxRate: number;        // e.g. 0 or 15 for 15%
  taxAmount: number;
  discountAmount: number; // Flat discount
  totalAmount: number;
  totalCost: number;      // Total COGS for this sale
  grossProfit: number;    // totalAmount - taxAmount - totalCost
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeGiven: number;
  isCreditPaid: boolean;  // For credit sales
  creditDueDate?: string;
  paidAmount: number;     // For partial payments on credit
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  companyName?: string;
  taxNumber?: string;
  creditBalance: number;  // Amount owed to Sappy Stationary
  creditLimit: number;
  totalPurchased: number;
  createdAt: string;
  notes?: string;
}

export type CreditPaymentMethod =
  | 'cash'
  | 'card'
  | 'digital'
  | 'telebirr'
  | 'bank_transfer'
  | 'check'
  | 'other_external';

export interface CreditPayment {
  id: string;
  customerId: string;
  customerName: string;
  saleId?: string;
  amount: number;
  paymentMethod: CreditPaymentMethod | string;
  timestamp: string;
  receiptNumber: string;
  notes?: string;
  isExternal?: boolean;
  externalReference?: string; // Transaction ID, CBE slip, Telebirr code, or check number
  externalChannel?: string;   // e.g. "Telebirr", "Commercial Bank of Ethiopia (CBE)", "Awash Bank", "Bank Check"
  collectedBy?: string;       // Officer or cashier who recorded the payment
}

export type ExpenseCategory =
  | 'Rent & Lease'
  | 'Electricity & Utilities'
  | 'Stationery Stock & Freight'
  | 'Packaging & Bags'
  | 'Staff Wages'
  | 'Maintenance & Repairs'
  | 'Transport & Delivery'
  | 'Office & Admin'
  | 'Miscellaneous';

export interface Expense {
  id: string;
  date: string;          // YYYY-MM-DD
  category: ExpenseCategory;
  title: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'digital';
  payee: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface StoreConfig {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  currencySymbol: string;
  currencyCode: string;
  defaultTaxRate: number; // e.g. 15 for 15% VAT
  receiptFooter: string;
  bankDetails: string;
  databaseUrl?: string;
  lastSyncedAt?: string;
}

export interface DailyProfitLossReport {
  date: string; // YYYY-MM-DD
  grossSales: number;
  taxCollected: number;
  netSales: number;
  cogs: number; // Cost of goods sold
  grossProfit: number;
  grossMarginPercent: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
  transactionCount: number;
  creditSalesTotal: number;
  creditCollectedTotal: number;
}

export type UserRole = 'owner' | 'manager' | 'cashier';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  storeName?: string;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
}

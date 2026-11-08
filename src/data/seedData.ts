import { Customer, Expense, Product, Sale, StoreConfig } from '../types/pos.ts';
import { STARTER_STATIONERY_PRODUCTS } from './starterCatalog.ts';

export const INITIAL_STORE_CONFIG: StoreConfig = {
  storeName: 'Sappy Stationary',
  tagline: 'Quality Paper, Pens, Art & Office Essentials',
  address: 'Shop 14, Central Market Plaza, Commercial Avenue',
  phone: '+251 91 123 4567',
  email: 'amanuealhailu007@gmail.com',
  taxId: 'TIN-00982412',
  currencySymbol: 'Br ',
  currencyCode: 'ETB',
  defaultTaxRate: 15, // 15% VAT standard
  receiptFooter: 'Thank you for shopping at Sappy Stationary! Inquiries: accounts@sappystationary.com',
  bankDetails: 'Commercial Bank of Ethiopia (CBE) | Acc: 1000123456789 | Telebirr: 0911234567',
  masterPasscode: 'Sappy#1313',
};

export const INITIAL_PRODUCTS: Product[] = STARTER_STATIONERY_PRODUCTS.map((p, idx) => ({
  ...p,
  id: `prod-stn-init-${String(idx + 1).padStart(3, '0')}`,
}));

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-init-001',
    name: 'Addis Commercial Traders',
    companyName: 'ACT Plc',
    phone: '+251 91 122 3344',
    email: 'purchasing@actplc.com',
    creditBalance: 0,
    creditLimit: 5000,
    totalPurchased: 2400,
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'cust-init-002',
    name: 'Bole Academy School',
    companyName: 'Bole Education Group',
    phone: '+251 91 233 4455',
    email: 'admin@boleacademy.et',
    creditBalance: 0,
    creditLimit: 10000,
    totalPurchased: 5800,
    createdAt: '2026-01-01T08:00:00Z',
  },
];

export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_SALES: Sale[] = [];


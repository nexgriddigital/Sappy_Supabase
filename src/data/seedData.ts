import { Customer, Expense, Product, Sale, StoreConfig } from '../types/pos.ts';

export const INITIAL_STORE_CONFIG: StoreConfig = {
  storeName: 'Sappy Stationary',
  tagline: 'Quality Paper, Pens, Art & Office Essentials',
  address: 'Commercial Avenue',
  phone: '',
  email: '',
  taxId: '',
  currencySymbol: 'Br ',
  currencyCode: 'ETB',
  defaultTaxRate: 15, // 15% VAT standard
  receiptFooter: 'Thank you for shopping at Sappy Stationary!',
  bankDetails: '',
  masterPasscode: 'Sappy#1313',
};

export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_SALES: Sale[] = [];


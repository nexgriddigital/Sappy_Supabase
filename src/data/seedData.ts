import { Customer, Expense, PaymentAccount, Product, Sale, StoreConfig } from '../types/pos.ts';
import { STARTER_STATIONERY_PRODUCTS } from './starterCatalog.ts';

export const STORE_PAYMENT_ACCOUNTS: PaymentAccount[] = [
  {
    id: 'cbe-yohannes',
    provider: 'Commercial Bank of Ethiopia (CBE)',
    shortLabel: 'CBE',
    accountNumber: '1000452354504',
    accountHolder: 'Yohannes Leulseged',
    type: 'bank',
  },
  {
    id: 'cbe-azeb',
    provider: 'Commercial Bank of Ethiopia (CBE)',
    shortLabel: 'CBE',
    accountNumber: '1000126845883',
    accountHolder: 'Azeb Eshetu',
    type: 'bank',
  },
  {
    id: 'awash-yohannes',
    provider: 'Awash Bank',
    shortLabel: 'Awash',
    accountNumber: '013201292764800',
    accountHolder: 'Yohannes Leulseged',
    type: 'bank',
  },
  {
    id: 'telebirr-yohannes',
    provider: 'Telebirr',
    shortLabel: 'Telebirr',
    accountNumber: '0980442353',
    accountHolder: 'Yohannes Leulseged',
    type: 'mobile',
  },
  {
    id: 'abyssinia-yohannes',
    provider: 'Bank of Abyssinia',
    shortLabel: 'Abyssinia',
    accountNumber: '194809058',
    accountHolder: 'Yohannes Leulseged',
    type: 'bank',
  },
  {
    id: 'dashen-yohannes',
    provider: 'Dashen Bank',
    shortLabel: 'Dashen',
    accountNumber: '5889696877011',
    accountHolder: 'Yohannes Leulseged',
    type: 'bank',
  },
];

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
  bankDetails:
    'CBE: 1000452354504 (Yohannes Leulseged) / 1000126845883 (Azeb Eshetu) | Awash: 013201292764800 (Yohannes Leulseged) | Telebirr: 0980442353 (Yohannes Leulseged) | Abyssinia: 194809058 (Yohannes Leulseged) | Dashen: 5889696877011 (Yohannes Leulseged)',
  paymentAccounts: STORE_PAYMENT_ACCOUNTS,
  masterPasscode: 'Sappy#1313',
  supabaseUrl: 'https://fegfrjhxxpojmalytbku.supabase.co',
  supabaseAnonKey: 'sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2',
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


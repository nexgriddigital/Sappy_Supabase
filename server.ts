import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cliPortIdx = process.argv.indexOf('--port');
const cliPort = cliPortIdx !== -1 ? process.argv[cliPortIdx + 1] : undefined;
const envPort =
  process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
    ? process.env.PORT
    : undefined;
const port = parseInt(cliPort || envPort || process.env.DEFAULT_APP_PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Universal CORS Middleware for GitHub Pages and Cross-Device Access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// PostgreSQL Connection Pool Setup
let dbPool: pg.Pool | null = null;

function getPool(customUrl?: string): pg.Pool | null {
  const connectionString = customUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  if (customUrl && dbPool) {
    dbPool.end().catch(() => {});
    dbPool = null;
  }
  if (!dbPool) {
    dbPool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  }
  return dbPool;
}

// ============================================================================
// Multi-Device Central Sync Store (Persistent JSON Storage)
// ============================================================================
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'pos_store.json');

interface PosState {
  products: any[];
  customers: any[];
  sales: any[];
  expenses: any[];
  creditPayments: any[];
  config: any;
  users: any[];
  lastSyncedAt: string;
  version: number;
  isReset?: boolean;
}

const DEFAULT_STARTER_PRODUCTS = [
  {
    id: 'prod-stn-001',
    sku: 'PEN-PAR-001',
    barcode: '3026981254321',
    name: 'Parker Jotter Stainless Steel Ballpoint Pen',
    category: 'Writing & Pens',
    costPrice: 280,
    sellingPrice: 420,
    stockLevel: 35,
    lowStockThreshold: 8,
    reorderThreshold: 12,
    unit: 'pcs',
    description: 'Iconic classic refillable ballpoint pen with signature arrow clip and smooth Quinkflow ink.',
  },
  {
    id: 'prod-stn-002',
    sku: 'PEN-BIC-050',
    barcode: '3086126600213',
    name: 'Bic Cristal Medium Blue Ballpoint Pens (Box of 50)',
    category: 'Writing & Pens',
    costPrice: 450,
    sellingPrice: 650,
    stockLevel: 24,
    lowStockThreshold: 5,
    reorderThreshold: 10,
    unit: 'box',
    description: 'The world reliable everyday pen, 1.0mm medium point, crystal clear barrel with blue caps.',
  },
  {
    id: 'prod-stn-003',
    sku: 'PAP-DBL-500',
    barcode: '8851961120018',
    name: 'Double A Premium Photocopy Paper A4 80gsm (Ream of 500)',
    category: 'Paper & Notebooks',
    costPrice: 580,
    sellingPrice: 750,
    stockLevel: 80,
    lowStockThreshold: 20,
    reorderThreshold: 30,
    unit: 'ream',
    description: 'Ultra-smooth high opacity paper engineered for jam-free printing and sharp monochrome photocopying.',
  },
  {
    id: 'prod-stn-004',
    sku: 'NOT-OXF-192',
    barcode: '5010356123456',
    name: 'Oxford Black n Red A4 Hardcover Ruled Notebook (192 Pages)',
    category: 'Paper & Notebooks',
    costPrice: 220,
    sellingPrice: 340,
    stockLevel: 45,
    lowStockThreshold: 10,
    reorderThreshold: 15,
    unit: 'pcs',
    description: 'Premium 90gsm Optik paper notebook with durable wipe-clean hard cover and red ribbon marker.',
  },
  {
    id: 'prod-stn-005',
    sku: 'DES-CAL-012',
    barcode: '6921734912014',
    name: 'Deli Desktop Calculator 12-Digit Large Angle Screen',
    category: 'Desk & Office',
    costPrice: 380,
    sellingPrice: 550,
    stockLevel: 22,
    lowStockThreshold: 5,
    reorderThreshold: 8,
    unit: 'pcs',
    description: 'Solar & battery dual power with durable plastic buttons, grand total and tax calculation keys.',
  },
  {
    id: 'prod-stn-006',
    sku: 'SCH-CAS-991',
    barcode: '4549526603328',
    name: 'Casio FX-991EX ClassWiz Advanced Scientific Calculator',
    category: 'School & Math',
    costPrice: 1250,
    sellingPrice: 1750,
    stockLevel: 18,
    lowStockThreshold: 4,
    reorderThreshold: 8,
    unit: 'pcs',
    description: 'High-resolution Natural Textbook Display with 552 functions, matrix, equation, and spreadsheet solver.',
  },
  {
    id: 'prod-stn-007',
    sku: 'DES-KNG-010',
    barcode: '8901238120104',
    name: 'Kangaro Heavy Duty Desktop Stapler & Staples (No. 10)',
    category: 'Desk & Office',
    costPrice: 190,
    sellingPrice: 290,
    stockLevel: 30,
    lowStockThreshold: 6,
    reorderThreshold: 10,
    unit: 'set',
    description: 'All-metal construction with quick-load mechanism, staples up to 25 sheets effortlessly.',
  },
  {
    id: 'prod-stn-008',
    sku: 'DES-TP-048',
    barcode: '051131640023',
    name: 'Scotch Heavy Duty Clear Packaging Tape 48mm x 50m',
    category: 'Desk & Office',
    costPrice: 120,
    sellingPrice: 180,
    stockLevel: 65,
    lowStockThreshold: 15,
    reorderThreshold: 25,
    unit: 'pcs',
    description: 'Strong solvent-free hot melt adhesive tape for secure parcel sealing and office carton packing.',
  }
];

const DEFAULT_SERVER_CONFIG = {
  storeName: 'Sappy Stationary',
  tagline: 'Quality Paper, Pens, Art & Office Essentials',
  address: 'Shop 14, Central Market Plaza, Commercial Avenue',
  phone: '+251 91 123 4567',
  email: 'amanuealhailu007@gmail.com',
  taxId: 'TIN-00982412',
  currencySymbol: 'Br ',
  currencyCode: 'ETB',
  defaultTaxRate: 15,
  receiptFooter: 'Thank you for shopping at Sappy Stationary! Inquiries: accounts@sappystationary.com',
  bankDetails: 'Commercial Bank of Ethiopia (CBE) | Acc: 1000123456789 | Telebirr: 0911234567',
  masterPasscode: 'Sappy#1313',
  supabaseUrl: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fegfrjhxxpojmalytbku.supabase.co').trim(),
  supabaseAnonKey: (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim(),
  databaseUrl: (process.env.DATABASE_URL || '').trim(),
};

const DEFAULT_SERVER_USERS = [
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
  {
    id: 'usr-owner-yohannes',
    email: 'yohannesleulseged802@gmail.com',
    fullName: 'Yohannes Leulseged',
    role: 'owner',
    storeName: 'Sappy Stationary',
    phone: '+251 91 222 3344',
    pinCode: '1313',
    status: 'active',
    createdAt: '2026-01-02T08:00:00Z',
    notes: 'Store Owner & Commercial Administrator',
  },
];

function loadServerState(): PosState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content) as PosState;

      if (parsed.isReset) {
        return parsed;
      }

      let changed = false;

      if (!parsed.products || parsed.products.length === 0) {
        parsed.products = DEFAULT_STARTER_PRODUCTS;
        changed = true;
      }

      if (!parsed.config) {
        parsed.config = DEFAULT_SERVER_CONFIG;
        changed = true;
      } else {
        // Inject DB secrets from env if missing
        const envSupabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fegfrjhxxpojmalytbku.supabase.co').trim();
        const envSupabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
        if (envSupabaseUrl && (!parsed.config.supabaseUrl || parsed.config.supabaseUrl.includes('your-project'))) {
          parsed.config.supabaseUrl = envSupabaseUrl;
          changed = true;
        }
        if (envSupabaseKey && (!parsed.config.supabaseAnonKey || parsed.config.supabaseAnonKey.includes('...'))) {
          parsed.config.supabaseAnonKey = envSupabaseKey;
          changed = true;
        }
      }

      // Filter out the three unknown mock users: Abebe, Bethelhem, and Dawit
      const purgedUsers = (parsed.users || []).filter((u: any) => {
        const email = (u?.email || '').toLowerCase().trim();
        return email !== 'owner@sappystationery.et' &&
               email !== 'cashier@sappystationery.et' &&
               email !== 'manager@sappystationery.et';
      });
      if (purgedUsers.length !== (parsed.users || []).length) {
        parsed.users = purgedUsers;
        changed = true;
      }

      if (!parsed.users || parsed.users.length === 0) {
        parsed.users = DEFAULT_SERVER_USERS;
        changed = true;
      } else {
        if (!parsed.users.some((u: any) => u.email.toLowerCase() === 'amanuealhailu007@gmail.com')) {
          parsed.users.unshift(DEFAULT_SERVER_USERS[0]);
          changed = true;
        }
        if (!parsed.users.some((u: any) => u.email.toLowerCase() === 'yohannesleulseged802@gmail.com')) {
          parsed.users.push(DEFAULT_SERVER_USERS[1]);
          changed = true;
        }
      }

      if (changed) {
        saveServerState(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error loading server state:', err);
  }

  const defaultState: PosState = {
    products: DEFAULT_STARTER_PRODUCTS,
    customers: [],
    sales: [],
    expenses: [],
    creditPayments: [],
    config: DEFAULT_SERVER_CONFIG,
    users: DEFAULT_SERVER_USERS,
    lastSyncedAt: new Date().toISOString(),
    version: 1,
  };
  saveServerState(defaultState);
  return defaultState;
}

function saveServerState(state: PosState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving server state:', err);
  }
}

let serverState: PosState = loadServerState();
// Ensure unknown demo users are purged immediately
serverState.users = (serverState.users || []).filter((u: any) => {
  const email = (u?.email || '').toLowerCase().trim();
  return email !== 'owner@sappystationery.et' &&
         email !== 'cashier@sappystationery.et' &&
         email !== 'manager@sappystationery.et';
});
saveServerState(serverState);

// Multi-Device Sync: Fetch Canonical Server State
app.get('/api/pos/state', (_req: Request, res: Response) => {
  serverState.users = (serverState.users || []).filter((u: any) => {
    const email = (u?.email || '').toLowerCase().trim();
    return email !== 'owner@sappystationery.et' &&
           email !== 'cashier@sappystationery.et' &&
           email !== 'manager@sappystationery.et';
  });
  return res.json({
    success: true,
    state: serverState,
    serverTime: new Date().toISOString(),
    records: {
      products: serverState.products.length,
      customers: serverState.customers.length,
      sales: serverState.sales.length,
      expenses: serverState.expenses.length,
      creditPayments: serverState.creditPayments.length,
      users: serverState.users.length,
    },
  });
});

// Multi-Device Sync: Bi-Directional Merge & Push
app.post('/api/pos/sync', (req: Request, res: Response) => {
  const { payload, isNewSetup } = req.body;
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Payload is required' });
  }

  // Prevent background timers from stale peer tabs re-uploading data after Factory Reset
  if (serverState.isReset && !isNewSetup) {
    return res.json({
      success: true,
      wasReset: true,
      message: 'Server is in factory reset state; peer wiped',
      state: serverState,
      serverTime: serverState.lastSyncedAt,
      version: serverState.version,
    });
  }

  try {
    const parseUpdatedTime = (iso?: string) => {
      if (!iso) return 0;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    // 1. Merge Products (keep newest updatedAt so stock deductions never revert)
    if (serverState.products.length === 0 && payload.products && payload.products.length > 0) {
      serverState.products = payload.products;
    } else if (payload.products && Array.isArray(payload.products) && payload.products.length > 0) {
      const prodMap = new Map(serverState.products.map((p: any) => [p.id, p]));
      for (const p of payload.products) {
        const existing: any = prodMap.get(p.id);
        if (!existing) {
          prodMap.set(p.id, p);
        } else {
          const existingTime = parseUpdatedTime(existing.updatedAt);
          const incomingTime = parseUpdatedTime(p.updatedAt);
          if (incomingTime >= existingTime) {
            prodMap.set(p.id, p);
          }
        }
      }
      serverState.products = Array.from(prodMap.values());
    }

    // 2. Merge Customers (keep newest updatedAt so credit balances never revert)
    const deletedCustIds: string[] = Array.isArray(payload.deletedCustomerIds) ? payload.deletedCustomerIds : [];
    if (deletedCustIds.length > 0) {
      const delSet = new Set(deletedCustIds);
      serverState.customers = serverState.customers.filter((c: any) => !delSet.has(c.id));
    }

    if (serverState.customers.length === 0 && payload.customers && payload.customers.length > 0) {
      const delSet = new Set(deletedCustIds);
      serverState.customers = payload.customers.filter((c: any) => !delSet.has(c.id));
    } else if (payload.customers && Array.isArray(payload.customers) && payload.customers.length > 0) {
      const delSet = new Set(deletedCustIds);
      const custMap = new Map(
        serverState.customers.filter((c: any) => !delSet.has(c.id)).map((c: any) => [c.id, c])
      );
      for (const c of payload.customers) {
        if (!delSet.has(c.id)) {
          const existing: any = custMap.get(c.id);
          if (!existing) {
            custMap.set(c.id, c);
          } else {
            const existingTime = parseUpdatedTime(existing.updatedAt);
            const incomingTime = parseUpdatedTime(c.updatedAt);
            if (incomingTime >= existingTime) {
              custMap.set(c.id, c);
            }
          }
        }
      }
      serverState.customers = Array.from(custMap.values());
    }

    // 3. Merge Sales (union by id, preserve returned status, sorted by timestamp descending)
    if (payload.sales && Array.isArray(payload.sales) && payload.sales.length > 0) {
      const salesMap = new Map(serverState.sales.map((s: any) => [s.id, s]));
      for (const s of payload.sales) {
        const existing: any = salesMap.get(s.id);
        if (existing && existing.isReturned && !s.isReturned) {
          continue;
        }
        salesMap.set(s.id, s);
      }
      serverState.sales = Array.from(salesMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    // 4. Merge Expenses
    if (payload.expenses && Array.isArray(payload.expenses) && payload.expenses.length > 0) {
      const expMap = new Map(serverState.expenses.map((e) => [e.id, e]));
      for (const e of payload.expenses) {
        expMap.set(e.id, e);
      }
      serverState.expenses = Array.from(expMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    // 5. Merge Credit Payments
    if (payload.creditPayments && Array.isArray(payload.creditPayments) && payload.creditPayments.length > 0) {
      const payMap = new Map(serverState.creditPayments.map((p) => [p.id, p]));
      for (const p of payload.creditPayments) {
        payMap.set(p.id, p);
      }
      serverState.creditPayments = Array.from(payMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    // 6. Merge Config (protect against blank overrides, allow clean disconnects)
    if (payload.config && typeof payload.config === 'object') {
      if (!serverState.config) {
        serverState.config = payload.config;
      } else {
        const cleanPayloadEntries = Object.entries(payload.config).filter(([k, v]) => {
          if (k === 'supabaseUrl' || k === 'supabaseAnonKey') return true;
          return v !== '' && v !== null && v !== undefined;
        });
        serverState.config = {
          ...serverState.config,
          ...Object.fromEntries(cleanPayloadEntries),
          masterPasscode: payload.config.masterPasscode || serverState.config.masterPasscode || 'Sappy#1313',
        };
        if (payload.config.supabaseUrl === '' || payload.config.supabaseUrl === null) {
          delete serverState.config.supabaseUrl;
        }
        if (payload.config.supabaseAnonKey === '' || payload.config.supabaseAnonKey === null) {
          delete serverState.config.supabaseAnonKey;
        }
      }
    }

    // 7. Handle Deleted Users
    if (payload.deletedUserIds && Array.isArray(payload.deletedUserIds) && payload.deletedUserIds.length > 0) {
      const delSet = new Set(payload.deletedUserIds);
      serverState.users = serverState.users.filter((u: any) => !delSet.has(u.id));
    }

    // 8. Merge Users (retaining newest updates and PINs)
    if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
      const userMap = new Map(serverState.users.map((u: any) => [u.id || u.email.toLowerCase(), u]));
      for (const u of payload.users) {
        const key = u.id || (u.email ? u.email.toLowerCase() : '');
        if (!key) continue;
        const existing = userMap.get(key);
        if (!existing) {
          userMap.set(key, u);
        } else {
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const incomingTime = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
          if (incomingTime >= existingTime) {
            userMap.set(key, {
              ...existing,
              ...u,
              pinCode: u.pinCode !== undefined ? u.pinCode : existing.pinCode,
            });
          }
        }
      }
      if (payload.deletedUserIds && Array.isArray(payload.deletedUserIds)) {
        for (const delId of payload.deletedUserIds) {
          userMap.delete(delId);
        }
      }
      serverState.users = Array.from(userMap.values()).filter((u: any) => {
        const email = (u?.email || '').toLowerCase().trim();
        return email !== 'owner@sappystationery.et' &&
               email !== 'cashier@sappystationery.et' &&
               email !== 'manager@sappystationery.et';
      });
    }

    if (
      (payload.products && payload.products.length > 0) ||
      (payload.users && payload.users.length > 0)
    ) {
      serverState.isReset = false;
    }

    serverState.lastSyncedAt = new Date().toISOString();
    serverState.version += 1;
    saveServerState(serverState);

    return res.json({
      success: true,
      message: 'Cross-device sync merged successfully',
      state: serverState,
      serverTime: serverState.lastSyncedAt,
      version: serverState.version,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
});

// Multi-Device Sync: Reset Server Store
app.post('/api/pos/reset', async (_req: Request, res: Response) => {
  serverState = {
    products: [],
    customers: [],
    sales: [],
    expenses: [],
    creditPayments: [],
    config: null,
    users: [],
    lastSyncedAt: new Date().toISOString(),
    version: serverState.version + 1,
    isReset: true,
  };
  saveServerState(serverState);

  // If Postgres database is connected, clear tables
  const pool = getPool();
  if (pool) {
    try {
      const client = await pool.connect();
      await client.query('DELETE FROM sale_items').catch(() => {});
      await client.query('DELETE FROM sales').catch(() => {});
      await client.query('DELETE FROM credit_payments').catch(() => {});
      await client.query('DELETE FROM expenses').catch(() => {});
      await client.query('DELETE FROM products').catch(() => {});
      await client.query('DELETE FROM customers').catch(() => {});
      await client.query('DELETE FROM store_settings').catch(() => {});
      client.release();
    } catch (err: any) {
      console.warn('Postgres reset warning:', err.message);
    }
  }

  return res.json({ success: true, message: 'Server state and all records cleared' });
});

// Multi-Device Sync: Status & Diagnostics
app.get('/api/pos/status', (_req: Request, res: Response) => {
  const pool = getPool();
  return res.json({
    success: true,
    cloudSyncMode: pool ? 'supabase_postgres' : 'server_central_store',
    postgresConnected: Boolean(pool),
    lastSyncedAt: serverState.lastSyncedAt,
    version: serverState.version,
    records: {
      products: serverState.products.length,
      customers: serverState.customers.length,
      sales: serverState.sales.length,
      expenses: serverState.expenses.length,
      creditPayments: serverState.creditPayments.length,
      users: serverState.users.length,
    },
  });
});

// 1. Health & Database Status
app.get('/api/health', async (_req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) {
    return res.json({
      status: 'ok',
      mode: 'local_storage',
      database: {
        connected: false,
        message: 'No DATABASE_URL configured. Running in offline-first local mode.',
      },
    });
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version()');
    client.release();
    return res.json({
      status: 'ok',
      mode: 'supabase_postgres',
      database: {
        connected: true,
        time: result.rows[0].current_time,
        version: result.rows[0].version,
      },
    });
  } catch (err: any) {
    return res.json({
      status: 'degraded',
      mode: 'local_storage',
      database: {
        connected: false,
        error: err.message,
      },
    });
  }
});

// 2. Test Custom Database Connection
app.post('/api/test-db', async (req: Request, res: Response) => {
  const { connectionString } = req.body;
  if (!connectionString || typeof connectionString !== 'string') {
    return res.status(400).json({ success: false, error: 'Connection string is required' });
  }

  const testPool = new pg.Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT current_database(), current_user, version()');
    client.release();
    await testPool.end();

    // Cache as active pool if successful
    process.env.DATABASE_URL = connectionString;
    dbPool = null; // Re-initialize with new URL

    return res.json({
      success: true,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      version: result.rows[0].version,
    });
  } catch (err: any) {
    await testPool.end().catch(() => {});
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to connect to PostgreSQL instance',
    });
  }
});

// 3. Run Automated Schema Migration
app.post('/api/migrate', async (req: Request, res: Response) => {
  const { connectionString } = req.body;
  const pool = getPool(connectionString);

  if (!pool) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a PostgreSQL connection string to run schema migrations.',
    });
  }

  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({ success: false, error: 'schema.sql not found on server' });
    }

    const ddl = fs.readFileSync(schemaPath, 'utf-8');
    const client = await pool.connect();
    await client.query(ddl);
    client.release();

    return res.json({
      success: true,
      message: 'Schema successfully applied to PostgreSQL database! All tables ready.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error executing schema.sql',
    });
  }
});

// 4. Synchronize Data (Push & Pull)
app.post('/api/sync', async (req: Request, res: Response) => {
  const { connectionString, payload } = req.body;
  const pool = getPool(connectionString);

  if (!pool) {
    return res.status(400).json({
      success: false,
      error: 'Database not configured. Using local storage.',
    });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Sync Products
      if (payload.products && Array.isArray(payload.products)) {
        for (const p of payload.products) {
          await client.query(
            `INSERT INTO products (id, sku, barcode, name, category, cost_price, selling_price, stock_level, low_stock_threshold, unit, description, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               sku = EXCLUDED.sku,
               barcode = EXCLUDED.barcode,
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               cost_price = EXCLUDED.cost_price,
               selling_price = EXCLUDED.selling_price,
               stock_level = EXCLUDED.stock_level,
               low_stock_threshold = EXCLUDED.low_stock_threshold,
               unit = EXCLUDED.unit,
               description = EXCLUDED.description,
               updated_at = CURRENT_TIMESTAMP`,
            [
              p.id,
              p.sku,
              p.barcode || null,
              p.name,
              p.category,
              p.costPrice,
              p.sellingPrice,
              p.stockLevel,
              p.lowStockThreshold,
              p.unit || 'pcs',
              p.description || null,
            ]
          );
        }
      }

      // Sync Customers
      if (payload.customers && Array.isArray(payload.customers)) {
        for (const c of payload.customers) {
          await client.query(
            `INSERT INTO customers (id, name, company_name, phone, email, address, tax_number, credit_balance, credit_limit, total_purchased, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               company_name = EXCLUDED.company_name,
               phone = EXCLUDED.phone,
               email = EXCLUDED.email,
               address = EXCLUDED.address,
               tax_number = EXCLUDED.tax_number,
               credit_balance = EXCLUDED.credit_balance,
               credit_limit = EXCLUDED.credit_limit,
               total_purchased = EXCLUDED.total_purchased,
               notes = EXCLUDED.notes`,
            [
              c.id,
              c.name,
              c.companyName || null,
              c.phone,
              c.email || null,
              c.address || null,
              c.taxNumber || null,
              c.creditBalance || 0,
              c.creditLimit || 500,
              c.totalPurchased || 0,
              c.notes || null,
            ]
          );
        }
      }

      // Sync Sales
      if (payload.sales && Array.isArray(payload.sales)) {
        for (const s of payload.sales) {
          await client.query(
            `INSERT INTO sales (id, invoice_number, timestamp, customer_id, customer_name, customer_phone, customer_email, customer_address, subtotal, tax_rate, tax_amount, discount_amount, total_amount, total_cost, gross_profit, payment_method, amount_tendered, change_given, is_credit_paid, credit_due_date, paid_amount, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
             ON CONFLICT (id) DO UPDATE SET
               paid_amount = EXCLUDED.paid_amount,
               is_credit_paid = EXCLUDED.is_credit_paid,
               notes = EXCLUDED.notes`,
            [
              s.id,
              s.invoiceNumber,
              s.timestamp,
              s.customerId || null,
              s.customerName,
              s.customerPhone || null,
              s.customerEmail || null,
              s.customerAddress || null,
              s.subtotal,
              s.taxRate,
              s.taxAmount,
              s.discountAmount,
              s.totalAmount,
              s.totalCost,
              s.grossProfit,
              s.paymentMethod,
              s.amountTendered,
              s.changeGiven,
              s.isCreditPaid,
              s.creditDueDate || null,
              s.paidAmount || 0,
              s.notes || null,
            ]
          );

          // Sale Items
          if (s.items && Array.isArray(s.items)) {
            for (const item of s.items) {
              await client.query(
                `INSERT INTO sale_items (sale_id, product_id, sku, name, category, quantity, unit, unit_cost, unit_price, discount_percent, line_total, line_cost_total)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT DO NOTHING`,
                [
                  s.id,
                  item.productId || null,
                  item.sku || null,
                  item.name,
                  item.category || null,
                  item.quantity,
                  item.unit || 'pcs',
                  item.unitCost,
                  item.unitPrice,
                  item.discountPercent || 0,
                  item.lineTotal,
                  item.lineCostTotal,
                ]
              );
            }
          }
        }
      }

      // Sync Credit Payments
      if (payload.creditPayments && Array.isArray(payload.creditPayments)) {
        for (const cp of payload.creditPayments) {
          await client.query(
            `INSERT INTO credit_payments (id, customer_id, customer_name, sale_id, amount, payment_method, timestamp, receipt_number, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`,
            [
              cp.id,
              cp.customerId,
              cp.customerName,
              cp.saleId || null,
              cp.amount,
              cp.paymentMethod,
              cp.timestamp,
              cp.receiptNumber,
              cp.notes || null,
            ]
          );
        }
      }

      // Sync Expenses
      if (payload.expenses && Array.isArray(payload.expenses)) {
        for (const exp of payload.expenses) {
          await client.query(
            `INSERT INTO expenses (id, date, category, title, amount, payment_method, payee, receipt_number, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               amount = EXCLUDED.amount,
               category = EXCLUDED.category,
               notes = EXCLUDED.notes`,
            [
              exp.id,
              exp.date,
              exp.category,
              exp.title,
              exp.amount,
              exp.paymentMethod,
              exp.payee,
              exp.receiptNumber || null,
              exp.notes || null,
              exp.createdAt || new Date().toISOString(),
            ]
          );
        }
      }

      // Sync Settings
      if (payload.config) {
        await client.query(
          `INSERT INTO store_settings (key, value, updated_at)
           VALUES ('store_config', $1, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET
             value = EXCLUDED.value,
             updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(payload.config)]
        );
      }

      await client.query('COMMIT');

      // Fetch latest stats
      const prodCount = await client.query('SELECT COUNT(*) FROM products');
      const salesCount = await client.query('SELECT COUNT(*) FROM sales');
      const custCount = await client.query('SELECT COUNT(*) FROM customers');

      client.release();

      return res.json({
        success: true,
        message: 'PostgreSQL database successfully synchronized!',
        syncedCounts: {
          products: parseInt(prodCount.rows[0].count, 10),
          sales: parseInt(salesCount.rows[0].count, 10),
          customers: parseInt(custCount.rows[0].count, 10),
        },
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Sync failed',
    });
  }
});

// Vite Middleware or Static Assets
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Sappy Stationary POS Server running at http://0.0.0.0:${port}`);
  });
}

startServer();

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
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

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
}

function loadServerState(): PosState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(content) as PosState;
    }
  } catch (err) {
    console.error('Error loading server state:', err);
  }

  const defaultState: PosState = {
    products: [],
    customers: [],
    sales: [],
    expenses: [],
    creditPayments: [],
    config: null,
    users: [],
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

// Multi-Device Sync: Fetch Canonical Server State
app.get('/api/pos/state', (_req: Request, res: Response) => {
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
    },
  });
});

// Multi-Device Sync: Bi-Directional Merge & Push
app.post('/api/pos/sync', (req: Request, res: Response) => {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Payload is required' });
  }

  try {
    // 1. Merge Products (keep latest updates)
    if (serverState.products.length === 0 && payload.products && payload.products.length > 0) {
      serverState.products = payload.products;
    } else if (payload.products && Array.isArray(payload.products)) {
      const prodMap = new Map(serverState.products.map((p) => [p.id, p]));
      for (const p of payload.products) {
        prodMap.set(p.id, p);
      }
      serverState.products = Array.from(prodMap.values());
    }

    // 2. Merge Customers
    if (serverState.customers.length === 0 && payload.customers && payload.customers.length > 0) {
      serverState.customers = payload.customers;
    } else if (payload.customers && Array.isArray(payload.customers)) {
      const custMap = new Map(serverState.customers.map((c) => [c.id, c]));
      for (const c of payload.customers) {
        custMap.set(c.id, c);
      }
      serverState.customers = Array.from(custMap.values());
    }

    // 3. Merge Sales (union by id, sorted by timestamp descending)
    if (payload.sales && Array.isArray(payload.sales)) {
      const salesMap = new Map(serverState.sales.map((s) => [s.id, s]));
      for (const s of payload.sales) {
        salesMap.set(s.id, s);
      }
      serverState.sales = Array.from(salesMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    // 4. Merge Expenses
    if (payload.expenses && Array.isArray(payload.expenses)) {
      const expMap = new Map(serverState.expenses.map((e) => [e.id, e]));
      for (const e of payload.expenses) {
        expMap.set(e.id, e);
      }
      serverState.expenses = Array.from(expMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    // 5. Merge Credit Payments
    if (payload.creditPayments && Array.isArray(payload.creditPayments)) {
      const payMap = new Map(serverState.creditPayments.map((p) => [p.id, p]));
      for (const p of payload.creditPayments) {
        payMap.set(p.id, p);
      }
      serverState.creditPayments = Array.from(payMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    // 6. Merge Config
    if (payload.config) {
      serverState.config = payload.config;
    }

    // 7. Merge Users
    if (payload.users && Array.isArray(payload.users)) {
      const userMap = new Map(serverState.users.map((u) => [u.id || u.email, u]));
      for (const u of payload.users) {
        userMap.set(u.id || u.email, u);
      }
      serverState.users = Array.from(userMap.values());
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
app.post('/api/pos/reset', (_req: Request, res: Response) => {
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
  };
  saveServerState(serverState);
  return res.json({ success: true, message: 'Server state cleared' });
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

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

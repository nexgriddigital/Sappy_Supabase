import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  Package,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
  FileText,
  QrCode,
  Layers,
  ArrowRight,
  Calendar,
  Settings,
} from 'lucide-react';
import { Sale, Product, Customer, Expense, StoreConfig } from '../types/pos.ts';

interface DashboardTabProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  expenses: Expense[];
  config: StoreConfig;
  onNavigate: (tab: any) => void;
  onOpenInvoice: (sale: Sale) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  sales,
  products,
  customers,
  expenses,
  config,
  onNavigate,
  onOpenInvoice,
}) => {
  // Current date calculations
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Filter today's transactions
  const todaySales = useMemo(() => sales.filter((s) => s.timestamp.startsWith(todayStr)), [sales, todayStr]);
  const todayRevenue = useMemo(() => todaySales.reduce((acc, s) => acc + s.totalAmount, 0), [todaySales]);
  const todayGrossProfit = useMemo(() => todaySales.reduce((acc, s) => acc + s.grossProfit, 0), [todaySales]);
  const todayExpenses = useMemo(() => expenses.filter((e) => e.date === todayStr).reduce((acc, e) => acc + e.amount, 0), [expenses, todayStr]);
  const todayNetProfit = todayGrossProfit - todayExpenses;

  // Monthly stats
  const mtdSales = useMemo(() => sales.filter((s) => s.timestamp.startsWith(currentMonthStr)), [sales, currentMonthStr]);
  const mtdRevenue = useMemo(() => mtdSales.reduce((acc, s) => acc + s.totalAmount, 0), [mtdSales]);
  const mtdExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(currentMonthStr)).reduce((acc, e) => acc + e.amount, 0), [expenses, currentMonthStr]);
  const mtdGrossProfit = useMemo(() => mtdSales.reduce((acc, s) => acc + s.grossProfit, 0), [mtdSales]);
  const mtdNetProfit = mtdGrossProfit - mtdExpenses;

  // Inventory stats
  const totalCatalogItems = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stockLevel, 0);
  const lowStockProducts = products.filter((p) => p.stockLevel <= p.lowStockThreshold);
  const totalInventoryValuation = products.reduce((acc, p) => acc + p.stockLevel * p.sellingPrice, 0);

  // Debtor stats
  const debtorCustomers = customers.filter((c) => c.creditBalance > 0);
  const totalCreditDebtOutstanding = customers.reduce((acc, c) => acc + c.creditBalance, 0);

  // Recent 6 Sales
  const recentSales = useMemo(() => sales.slice(0, 6), [sales]);

  // Top 5 Selling items
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.productId) || { name: item.name, sku: item.sku, qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.lineTotal;
        map.set(item.productId, existing);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 rounded-2xl p-6 sm:p-7 border border-forest-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-forest-600/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-forest-800/80 text-forest-200 border border-forest-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-pulse" />
                Store Management Hub
              </span>
              <span className="text-xs text-forest-300 font-mono">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {config.storeName}
            </h1>
            <p className="text-xs sm:text-sm text-forest-200 mt-1 max-w-xl">
              Track live daily sales, inventory levels, customer credit accounts, and profit & loss in Ethiopian Birr ({config.currencySymbol.trim()}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('register')}
              className="px-4 py-2.5 bg-forest-500 hover:bg-forest-400 text-forest-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md hover:shadow-forest-500/20 transition-all cursor-pointer active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Open POS Register</span>
            </button>
            <button
              onClick={() => onNavigate('qrstudio')}
              className="px-3.5 py-2.5 bg-charcoal-900/90 hover:bg-charcoal-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 border border-charcoal-700 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-forest-400" />
              <span>QR & Barcode Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid - Highlighted in Forest Green & Charcoal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Sales */}
        <div className="bg-charcoal-900 p-4 sm:p-5 rounded-2xl border border-charcoal-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-400">Today&apos;s Revenue</span>
            <span className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-700/60 flex items-center justify-center text-forest-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-white mt-2">
            {config.currencySymbol}{todayRevenue.toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-forest-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{todaySales.length} sale{todaySales.length === 1 ? '' : 's'} recorded today</span>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="bg-charcoal-900 p-4 sm:p-5 rounded-2xl border border-charcoal-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-400">Today&apos;s Net Profit</span>
            <span className="w-8 h-8 rounded-lg bg-forest-900/80 border border-forest-600 flex items-center justify-center text-forest-300">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-2xl font-black font-mono mt-2 ${todayNetProfit >= 0 ? 'text-forest-400' : 'text-rose-400'}`}>
            {config.currencySymbol}{todayNetProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-2 font-mono">
            Gross: +{config.currencySymbol}{todayGrossProfit.toFixed(2)} | Exp: -{config.currencySymbol}{todayExpenses.toFixed(2)}
          </p>
        </div>

        {/* Month-to-Date Revenue */}
        <div className="bg-charcoal-900 p-4 sm:p-5 rounded-2xl border border-charcoal-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-400">Month-to-Date Net</span>
            <span className="w-8 h-8 rounded-lg bg-forest-950 border border-forest-700/60 flex items-center justify-center text-forest-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-white mt-2">
            {config.currencySymbol}{mtdNetProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-300 mt-2 font-mono">
            Total Sales: {config.currencySymbol}{mtdRevenue.toFixed(2)}
          </p>
        </div>

        {/* Customer Credit Outstanding */}
        <div className="bg-charcoal-900 p-4 sm:p-5 rounded-2xl border border-charcoal-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-400">Credit Debt Active</span>
            <span className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-amber-400 mt-2">
            {config.currencySymbol}{totalCreditDebtOutstanding.toFixed(2)}
          </p>
          <div className="flex items-center justify-between mt-2 text-[11px]">
            <span className="text-amber-300/80">{debtorCustomers.length} debtor customer{debtorCustomers.length === 1 ? '' : 's'}</span>
            <button
              onClick={() => onNavigate('credit')}
              className="text-forest-400 hover:text-forest-300 font-semibold cursor-pointer underline flex items-center gap-0.5"
            >
              Collect
            </button>
          </div>
        </div>

      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Cols: Recent Invoices & Quick Inventory Alerts */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Recent Sales Ledger Card */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 overflow-hidden shadow-md">
            <div className="p-4 sm:p-5 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-forest-400" />
                  <span>Recent Sales & A4 Invoices</span>
                </h3>
                <p className="text-xs text-charcoal-400 mt-0.5">Quickly view or print commercial invoices for recent transactions.</p>
              </div>
              <button
                onClick={() => onNavigate('sales')}
                className="text-xs text-forest-400 hover:text-forest-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/60 text-charcoal-400 uppercase text-[10px] tracking-wider border-b border-charcoal-800">
                    <th className="py-2.5 px-4 font-semibold">Invoice #</th>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Method</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800/80">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-charcoal-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-charcoal-200">
                        <span className="font-medium truncate max-w-[140px] block">{sale.customerName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-[11px] font-mono px-2 py-0.5 rounded bg-charcoal-800 text-charcoal-300">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-white">
                        {config.currencySymbol}{sale.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sale.paymentMethod === 'credit' && !sale.isCreditPaid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest-300 bg-forest-950/60 border border-forest-700 px-2 py-0.5 rounded">
                            <CheckCircle className="w-3 h-3 text-forest-400" />
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onOpenInvoice(sale)}
                          className="px-2.5 py-1 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer border border-forest-600/50 active:scale-95"
                          title="Generate A4 Tax Invoice / PDF"
                        >
                          Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recentSales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-charcoal-400">
                        No sales recorded yet. Ring up transactions in POS Register!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Warning Banner */}
          {lowStockProducts.length > 0 && (
            <div className="bg-charcoal-900 rounded-2xl border border-amber-900/60 p-5 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Low Stock Reorder Alerts ({lowStockProducts.length})</h3>
                    <p className="text-xs text-charcoal-400">Stationery items at or below minimum threshold.</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs text-forest-400 hover:text-forest-300 font-bold underline cursor-pointer"
                >
                  Manage Stock
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white truncate max-w-[180px]">{p.name}</p>
                      <p className="text-[10px] text-charcoal-400 font-mono">SKU: {p.sku}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-950 border border-rose-800 text-rose-300">
                        {p.stockLevel} {p.unit} left
                      </span>
                      <p className="text-[10px] text-charcoal-500 mt-0.5">Min: {p.lowStockThreshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right 4 Cols: Quick Navigation & Top Selling Stationery */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Hub Launchers */}
          <div className="bg-charcoal-900 p-5 rounded-2xl border border-charcoal-800 shadow-md space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-forest-400" />
              <span>Quick Navigation</span>
            </h3>

            <div className="grid grid-cols-1 gap-2 pt-1 text-xs font-semibold">
              <button
                onClick={() => onNavigate('register')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-white flex items-center justify-between transition-colors cursor-pointer border border-forest-600/50"
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="w-4 h-4 text-forest-300" />
                  <span>Cash Register (Touch POS)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-forest-300" />
              </button>

              <button
                onClick={() => onNavigate('qrstudio')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-100 flex items-center justify-between transition-colors cursor-pointer border border-charcoal-800"
              >
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-4 h-4 text-forest-400" />
                  <span>QR & Barcode Studio</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-charcoal-500" />
              </button>

              <button
                onClick={() => onNavigate('inventory')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-100 flex items-center justify-between transition-colors cursor-pointer border border-charcoal-800"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-forest-400" />
                  <span>Inventory Control ({totalCatalogItems} SKUs)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-charcoal-500" />
              </button>

              <button
                onClick={() => onNavigate('credit')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-100 flex items-center justify-between transition-colors cursor-pointer border border-charcoal-800"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Customer Debt Ledger</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-charcoal-500" />
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-100 flex items-center justify-between transition-colors cursor-pointer border border-charcoal-800"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-forest-400" />
                  <span>Daily P&L Statements</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-charcoal-500" />
              </button>

              <button
                onClick={() => onNavigate('settings')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-100 flex items-center justify-between transition-colors cursor-pointer border border-charcoal-800"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-forest-300" />
                  <span>Settings & Reset Options</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-charcoal-500" />
              </button>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-charcoal-900 p-5 rounded-2xl border border-charcoal-800 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-charcoal-800">
              <h3 className="text-sm font-bold text-white">Best Sellers (Units)</h3>
              <span className="text-[10px] text-charcoal-400 font-mono">By Volume</span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {topProducts.map((p, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-center justify-between">
                  <div className="truncate max-w-[180px]">
                    <p className="font-semibold text-charcoal-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-charcoal-500 font-mono">SKU: {p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-forest-300">
                      {config.currencySymbol}{p.revenue.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-charcoal-400 font-mono">{p.qty} sold</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-xs text-charcoal-400 text-center py-4">No product sales recorded yet</p>
              )}
            </div>
          </div>

          {/* Store Details Card */}
          <div className="bg-forest-950/70 p-4 rounded-2xl border border-forest-800/80 text-xs text-forest-200 space-y-1.5 font-mono">
            <p className="font-bold text-white font-sans text-sm">{config.storeName}</p>
            <p className="text-[11px] text-forest-300">{config.address}</p>
            <div className="flex justify-between pt-1 border-t border-forest-800/60 text-[10px]">
              <span>TIN / Tax: {config.taxId}</span>
              <span>VAT: {config.defaultTaxRate}%</span>
            </div>
            <p className="text-[10px] text-forest-400 pt-0.5 truncate">{config.bankDetails}</p>
          </div>

        </div>

      </div>

    </div>
  );
};

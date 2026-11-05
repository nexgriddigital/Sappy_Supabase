import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
} from 'lucide-react';
import { Sale, Expense, CreditPayment, StoreConfig } from '../types/pos.ts';

interface ReportsTabProps {
  sales: Sale[];
  expenses: Expense[];
  creditPayments: CreditPayment[];
  config: StoreConfig;
}

type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export const ReportsTab: React.FC<ReportsTabProps> = ({
  sales,
  expenses,
  creditPayments,
  config,
}) => {
  const [rangePreset, setRangePreset] = useState<RangePreset>('month');

  // Compute start and end dates based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (rangePreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (rangePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return { startDate: yStr, endDate: yStr };
    }
    if (rangePreset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { startDate: w.toISOString().slice(0, 10), endDate: todayStr };
    }
    if (rangePreset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: m.toISOString().slice(0, 10), endDate: todayStr };
    }
    // All time
    return { startDate: '2020-01-01', endDate: '2030-12-31' };
  }, [rangePreset]);

  // Filter Sales & Expenses within date range
  const rangeSales = useMemo(() => {
    return sales.filter((s) => {
      const d = s.timestamp.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [sales, startDate, endDate]);

  const rangeExpenses = useMemo(() => {
    return expenses.filter((e) => {
      return e.date >= startDate && e.date <= endDate;
    });
  }, [expenses, startDate, endDate]);

  const rangePayments = useMemo(() => {
    return creditPayments.filter((p) => {
      const d = p.timestamp.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [creditPayments, startDate, endDate]);

  // High-Level Financial Calculations
  const grossSales = rangeSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const taxCollected = rangeSales.reduce((acc, s) => acc + s.taxAmount, 0);
  const netSales = grossSales - taxCollected;
  const cogs = rangeSales.reduce((acc, s) => acc + s.totalCost, 0);
  const grossProfit = netSales - cogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const totalExpenses = rangeExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  const creditSalesSum = rangeSales
    .filter((s) => s.paymentMethod === 'credit')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const creditCollectedSum = rangePayments.reduce((acc, p) => acc + p.amount, 0);

  // Group by Date for Day-by-Day Table
  const dailyBreakdown = useMemo(() => {
    const datesSet = new Set<string>();
    rangeSales.forEach((s) => datesSet.add(s.timestamp.slice(0, 10)));
    rangeExpenses.forEach((e) => datesSet.add(e.date));

    const sortedDates = Array.from(datesSet).sort().reverse();

    return sortedDates.map((dStr) => {
      const daySales = rangeSales.filter((s) => s.timestamp.startsWith(dStr));
      const dayExpenses = rangeExpenses.filter((e) => e.date === dStr);

      const dGross = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      const dTax = daySales.reduce((acc, s) => acc + s.taxAmount, 0);
      const dNetSales = dGross - dTax;
      const dCogs = daySales.reduce((acc, s) => acc + s.totalCost, 0);
      const dGrossProfit = dNetSales - dCogs;
      const dExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
      const dNetProfit = dGrossProfit - dExpenses;
      const dNetMargin = dNetSales > 0 ? (dNetProfit / dNetSales) * 100 : 0;

      return {
        date: dStr,
        orderCount: daySales.length,
        grossSales: dGross,
        cogs: dCogs,
        grossProfit: dGrossProfit,
        expenses: dExpenses,
        netProfit: dNetProfit,
        netMargin: dNetMargin,
      };
    });
  }, [rangeSales, rangeExpenses]);

  // Top Selling Stationery Items by Revenue & Profit
  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; sku: string; qty: number; revenue: number; profit: number }
    >();

    rangeSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.productId) || {
          name: item.name,
          sku: item.sku,
          qty: 0,
          revenue: 0,
          profit: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += item.lineTotal;
        existing.profit += item.lineTotal - item.lineCostTotal;
        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [rangeSales]);

  // Export P&L as CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Transactions',
      'Gross Sales',
      'Cost of Goods Sold (COGS)',
      'Gross Profit',
      'Operating Expenses',
      'Net Profit / Loss',
      'Net Margin %',
    ];

    const rows = dailyBreakdown.map((row) => [
      row.date,
      row.orderCount,
      row.grossSales.toFixed(2),
      row.cogs.toFixed(2),
      row.grossProfit.toFixed(2),
      row.expenses.toFixed(2),
      row.netProfit.toFixed(2),
      `${row.netMargin.toFixed(1)}%`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sappy_Stationary_Daily_PL_Report_${rangePreset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header & Date Preset Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal-900">
            Daily Profit & Loss (P&L) Reports
          </h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Real-time financial performance deducting wholesale stationery costs (COGS) and operational overhead.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-charcoal-950 border border-charcoal-800 p-1 rounded-xl">
            {[
              { id: 'today' as RangePreset, label: 'Today' },
              { id: 'yesterday' as RangePreset, label: 'Yesterday' },
              { id: 'week' as RangePreset, label: 'Last 7 Days' },
              { id: 'month' as RangePreset, label: 'This Month' },
              { id: 'all' as RangePreset, label: 'All Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setRangePreset(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  rangePreset === p.id
                    ? 'bg-forest-700 text-white shadow-xs font-bold'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Export P&L breakdown to CSV"
          >
            <Download className="w-4 h-4 text-forest-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Gross Sales Revenue</p>
          <p className="text-2xl font-black font-mono text-white mt-1">
            {config.currencySymbol}{grossSales.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1 font-mono">
            Net Sales: {config.currencySymbol}{netSales.toFixed(2)} (excl. VAT)
          </p>
        </div>

        {/* COGS (Cost of Goods Sold) */}
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Cost of Goods Sold (COGS)</p>
          <p className="text-2xl font-black font-mono text-charcoal-300 mt-1">
            {config.currencySymbol}{cogs.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">
            Wholesale buying price of sold stationery
          </p>
        </div>

        {/* Gross Profit */}
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal-400 font-medium">Gross Profit</p>
            <span className="text-[11px] font-mono font-bold text-forest-300 bg-forest-950/80 px-1.5 py-0.5 rounded border border-forest-800/80">
              {grossMarginPct.toFixed(1)}% margin
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-forest-400 mt-1">
            {config.currencySymbol}{grossProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-400/80 mt-1">Revenue minus COGS</p>
        </div>

        {/* Operating Expenses */}
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Store Operating Expenses</p>
          <p className="text-2xl font-black font-mono text-rose-400 mt-1">
            {config.currencySymbol}{totalExpenses.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">Rent, electricity, packaging, courier</p>
        </div>
      </div>

      {/* NET PROFIT / NET LOSS CALLOUT BANNER */}
      <div
        className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
          netProfit >= 0
            ? 'bg-forest-950/90 border-forest-700/60 text-white'
            : 'bg-rose-950/90 border-rose-800/60 text-white'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              netProfit >= 0 ? 'bg-forest-700 text-white shadow-md shadow-forest-950' : 'bg-rose-700 text-white shadow-md shadow-rose-950'
            }`}
          >
            {netProfit >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-charcoal-300">
              {netProfit >= 0 ? 'Net Store Profit (Bottom Line)' : 'Net Operating Loss'}
            </span>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className={`text-3xl font-black font-mono ${netProfit >= 0 ? 'text-forest-400' : 'text-rose-400'}`}>
                {config.currencySymbol}{netProfit.toFixed(2)}
              </span>
              <span
                className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                  netProfit >= 0 ? 'bg-forest-900/80 text-forest-300 border border-forest-700/80' : 'bg-rose-900/80 text-rose-300 border border-rose-700/80'
                }`}
              >
                {netMarginPct.toFixed(1)}% Net Margin
              </span>
            </div>
            <p className="text-xs text-charcoal-300 mt-1">
              Calculated as Gross Profit ({config.currencySymbol}{grossProfit.toFixed(2)}) minus Expenses ({config.currencySymbol}{totalExpenses.toFixed(2)}).
            </p>
          </div>
        </div>

        {/* Credit Debt Flow info */}
        <div className="bg-charcoal-950/90 p-3 rounded-xl border border-charcoal-800 text-xs space-y-1 w-full sm:w-64 font-mono text-charcoal-300">
          <div className="flex justify-between">
            <span className="font-sans text-charcoal-400">Credit Sales Issued:</span>
            <span className="font-bold text-amber-400">{config.currencySymbol}{creditSalesSum.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-charcoal-400">Debt Collected:</span>
            <span className="font-bold text-forest-400">+{config.currencySymbol}{creditCollectedSum.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Grid: Daily Breakdown Table & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Daily Breakdown Table */}
        <div className="lg:col-span-8 bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Day-by-Day Financial Breakdown</h3>
            <span className="text-xs text-charcoal-400 font-mono">{dailyBreakdown.length} active dates</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3 text-center">Orders</th>
                  <th className="py-3 px-3 text-right">Gross Sales</th>
                  <th className="py-3 px-3 text-right">COGS</th>
                  <th className="py-3 px-3 text-right">Gross Profit</th>
                  <th className="py-3 px-3 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800">
                {dailyBreakdown.map((row) => (
                  <tr key={row.date} className="hover:bg-charcoal-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-forest-400">{row.date}</td>
                    <td className="py-3 px-3 text-center font-mono text-charcoal-300">{row.orderCount}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                      {config.currencySymbol}{row.grossSales.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-charcoal-400">
                      {config.currencySymbol}{row.cogs.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-forest-400">
                      {config.currencySymbol}{row.grossProfit.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400">
                      {row.expenses > 0 ? `-${config.currencySymbol}${row.expenses.toFixed(2)}` : `${config.currencySymbol}0.00`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-sm">
                      <span className={row.netProfit >= 0 ? 'text-forest-400' : 'text-rose-400'}>
                        {config.currencySymbol}{row.netProfit.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dailyBreakdown.length === 0 && (
            <div className="p-8 text-center text-charcoal-400 text-xs">
              No transactions or expenses recorded in this date range.
            </div>
          )}
        </div>

        {/* Top 5 Products by Revenue */}
        <div className="lg:col-span-4 bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
            <h3 className="text-sm font-bold text-white">Top Performing Items</h3>
            <span className="text-[11px] text-charcoal-400">By Revenue</span>
          </div>

          <div className="space-y-3">
            {topProducts.map((p, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-charcoal-950/80 border border-charcoal-800 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-white leading-tight">{p.name}</span>
                  <span className="font-mono font-extrabold text-forest-400 shrink-0">
                    {config.currencySymbol}{p.revenue.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-charcoal-400 font-mono pt-1 border-t border-charcoal-800/80">
                  <span>{p.qty} units sold</span>
                  <span className="text-forest-400 font-bold">
                    +{config.currencySymbol}{p.profit.toFixed(2)} profit
                  </span>
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <p className="text-xs text-charcoal-400 text-center py-6">No product sales yet</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

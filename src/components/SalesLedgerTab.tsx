import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { PaymentMethod, Sale, StoreConfig } from '../types/pos.ts';

interface SalesLedgerTabProps {
  sales: Sale[];
  config: StoreConfig;
  onOpenInvoice: (sale: Sale) => void;
}

type DateFilterOption = 'all' | 'today' | 'yesterday' | 'week' | 'month';

export const SalesLedgerTab: React.FC<SalesLedgerTabProps> = ({
  sales,
  config,
  onOpenInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');

  // Filter sales
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    return sales.filter((sale) => {
      const saleDate = sale.timestamp.slice(0, 10);

      // Date check
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = saleDate === todayStr;
      } else if (dateFilter === 'yesterday') {
        matchesDate = saleDate === yesterdayStr;
      } else if (dateFilter === 'week') {
        matchesDate = saleDate >= sevenDaysAgoStr;
      } else if (dateFilter === 'month') {
        matchesDate = saleDate >= monthStartStr;
      }

      // Method check
      const matchesMethod = methodFilter === 'all' || sale.paymentMethod === methodFilter;

      // Search query check
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sale.invoiceNumber.toLowerCase().includes(q) ||
        sale.customerName.toLowerCase().includes(q) ||
        sale.items.some((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));

      return matchesDate && matchesMethod && matchesSearch;
    });
  }, [sales, dateFilter, methodFilter, searchQuery]);

  // Aggregate Metrics for filtered set
  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalProfit = filteredSales.reduce((acc, s) => acc + s.grossProfit, 0);
  const uncollectedCredit = filteredSales
    .filter((s) => s.paymentMethod === 'credit' && !s.isCreditPaid)
    .reduce((acc, s) => acc + (s.totalAmount - (s.paidAmount || 0)), 0);

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Date & Time',
      'Customer',
      'Payment Method',
      'Items Count',
      'Subtotal',
      'Tax Amount',
      'Discount',
      'Total Amount',
      'Total Cost (COGS)',
      'Gross Profit',
      'Credit Status',
    ];

    const rows = filteredSales.map((s) => [
      s.invoiceNumber,
      s.timestamp,
      `"${s.customerName.replace(/"/g, '""')}"`,
      s.paymentMethod,
      s.items.length,
      s.subtotal.toFixed(2),
      s.taxAmount.toFixed(2),
      s.discountAmount.toFixed(2),
      s.totalAmount.toFixed(2),
      s.totalCost.toFixed(2),
      s.grossProfit.toFixed(2),
      s.paymentMethod === 'credit' ? (s.isCreditPaid ? 'Paid' : 'Unpaid') : 'N/A',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sappy_Stationary_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header & KPI Metrics Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Sales Ledger & Invoicing</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            View, search, and generate official A4 commercial tax invoices with PDF export for all transactions.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredSales.length === 0}
          className="px-4 py-2 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-forest-400" />
          <span>Export Ledger as CSV</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Filtered Sales Revenue</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}{totalRevenue.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">{filteredSales.length} invoices recorded</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Gross Profit (after COGS)</p>
          <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
            {config.currencySymbol}{totalProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-400/80 mt-1">
            {totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}% gross margin` : '0% margin'}
          </p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Outstanding Credit Sales</p>
          <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">
            {config.currencySymbol}{uncollectedCredit.toFixed(2)}
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">Pending debtor collection</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Average Basket Value</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}
            {filteredSales.length > 0 ? (totalRevenue / filteredSales.length).toFixed(2) : '0.00'}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">Across selected filter</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search invoice #, customer, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Date presets */}
          <div className="flex items-center gap-1 bg-charcoal-950 border border-charcoal-800 p-1 rounded-lg shrink-0">
            {[
              { id: 'all' as DateFilterOption, label: 'All Time' },
              { id: 'today' as DateFilterOption, label: 'Today' },
              { id: 'yesterday' as DateFilterOption, label: 'Yesterday' },
              { id: 'week' as DateFilterOption, label: '7 Days' },
              { id: 'month' as DateFilterOption, label: 'This Month' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-forest-700 text-white font-semibold shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payment Method filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-medium text-white shrink-0 cursor-pointer focus:border-forest-500"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash Only</option>
            <option value="card">Card Terminal</option>
            <option value="digital">Digital / Mobile</option>
            <option value="credit">Credit Sales Only</option>
          </select>
        </div>

      </div>

      {/* Sales Transactions Table */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {filteredSales.map((sale) => {
                const isCredit = sale.paymentMethod === 'credit';
                const isPaid = !isCredit || sale.isCreditPaid;
                const formattedDate = new Date(sale.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = new Date(sale.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={sale.id} className="hover:bg-charcoal-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-forest-400">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 text-charcoal-300">
                      <span>{formattedDate}</span>
                      <span className="block text-[10px] text-charcoal-400 font-mono">{formattedTime}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white truncate max-w-[180px]">
                        {sale.customerName}
                      </p>
                      {sale.customerPhone && (
                        <p className="text-[10px] text-charcoal-400 font-mono">{sale.customerPhone}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize font-medium text-charcoal-300 bg-charcoal-950 border border-charcoal-700/60 px-2 py-0.5 rounded text-[11px]">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-charcoal-300">
                      {sale.items.reduce((acc, i) => acc + i.quantity, 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white">
                      {config.currencySymbol}{sale.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-forest-400">
                      +{config.currencySymbol}{sale.grossProfit.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest-300 bg-forest-950/80 px-2 py-0.5 rounded-md border border-forest-800/80">
                          <CheckCircle className="w-3 h-3 text-forest-400" />
                          <span>Paid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/80">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onOpenInvoice(sale)}
                        className="px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs border border-forest-700/50 active:scale-95"
                        title="View, Print or Export A4 Tax Invoice"
                      >
                        <FileText className="w-3.5 h-3.5 text-forest-300" />
                        <span>A4 Invoice</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="p-10 text-center text-charcoal-400">
            <FileText className="w-8 h-8 mx-auto text-charcoal-600 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-charcoal-200">No sales transactions found</p>
            <p className="text-xs text-charcoal-400 mt-1">Try adjusting your filters or complete a new sale in the Register tab.</p>
          </div>
        )}
      </div>

    </div>
  );
};

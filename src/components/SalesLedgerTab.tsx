import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  RotateCcw,
  AlertTriangle,
  X,
  ShieldAlert,
  Boxes,
  ArrowRight,
  Receipt,
  Info,
} from 'lucide-react';
import { PaymentMethod, Sale, StoreConfig } from '../types/pos.ts';

interface SalesLedgerTabProps {
  sales: Sale[];
  config: StoreConfig;
  onOpenInvoice: (sale: Sale) => void;
  onReturnSale?: (sale: Sale, reason: string, refundMethod: string) => Promise<void> | void;
}

type DateFilterOption = 'all' | 'today' | 'yesterday' | 'week' | 'month';
type StatusFilterOption = 'all' | 'active' | 'returned';

export const SalesLedgerTab: React.FC<SalesLedgerTabProps> = ({
  sales,
  config,
  onOpenInvoice,
  onReturnSale,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');

  // Return Modal State
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null);
  const [returnReasonPreset, setReturnReasonPreset] = useState<string>('Customer Return (Defective/Damaged)');
  const [customReason, setCustomReason] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('cash');
  const [isProcessingReturn, setIsProcessingReturn] = useState<boolean>(false);

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

      // Status check (active vs returned)
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = !sale.isReturned;
      } else if (statusFilter === 'returned') {
        matchesStatus = Boolean(sale.isReturned);
      }

      // Search query check
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sale.invoiceNumber.toLowerCase().includes(q) ||
        sale.customerName.toLowerCase().includes(q) ||
        sale.items.some((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)) ||
        (sale.returnReason && sale.returnReason.toLowerCase().includes(q));

      return matchesDate && matchesMethod && matchesStatus && matchesSearch;
    });
  }, [sales, dateFilter, methodFilter, statusFilter, searchQuery]);

  // Aggregate Metrics for filtered set
  const activeSales = useMemo(() => filteredSales.filter((s) => !s.isReturned), [filteredSales]);
  const returnedSales = useMemo(() => filteredSales.filter((s) => s.isReturned), [filteredSales]);

  const netRealizedRevenue = activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const netGrossProfit = activeSales.reduce((acc, s) => acc + s.grossProfit, 0);
  const returnsTotalAmount = returnedSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const uncollectedCredit = activeSales
    .filter((s) => s.paymentMethod === 'credit' && !s.isCreditPaid)
    .reduce((acc, s) => acc + (s.totalAmount - (s.paidAmount || 0)), 0);

  // Open Return Modal handler
  const handleOpenReturnModal = (sale: Sale) => {
    setReturnModalSale(sale);
    setReturnReasonPreset('Customer Return (Defective/Damaged)');
    setCustomReason('');
    // Default refund method based on original payment
    if (sale.paymentMethod === 'credit') {
      setRefundMethod('credit_reversal');
    } else {
      setRefundMethod(sale.paymentMethod || 'cash');
    }
  };

  // Confirm Return submission
  const handleConfirmReturn = async () => {
    if (!returnModalSale || !onReturnSale) return;
    const finalReason = returnReasonPreset === 'Other' ? (customReason.trim() || 'Custom Return Reason') : returnReasonPreset;
    
    setIsProcessingReturn(true);
    try {
      await onReturnSale(returnModalSale, finalReason, refundMethod);
      setReturnModalSale(null);
    } finally {
      setIsProcessingReturn(false);
    }
  };

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
      'Sale Status',
      'Credit Status',
      'Return Date',
      'Return Reason',
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
      s.isReturned ? '0.00 (Reversed)' : s.grossProfit.toFixed(2),
      s.isReturned ? 'RETURNED / REVERSED' : 'COMPLETED',
      s.paymentMethod === 'credit' ? (s.isCreditPaid ? 'Paid' : 'Unpaid') : 'N/A',
      s.returnedAt || 'N/A',
      s.returnReason ? `"${s.returnReason.replace(/"/g, '""')}"` : 'N/A',
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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Sales Ledger & Invoicing</span>
          </h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            View, search, generate official A4 tax invoices, and process authorized sales returns with automatic stock restoration.
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
          <p className="text-xs text-charcoal-400 font-medium">Realized Net Sales</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}{netRealizedRevenue.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">{activeSales.length} completed transactions</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Realized Gross Profit</p>
          <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
            {config.currencySymbol}{netGrossProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-400/80 mt-1">
            {netRealizedRevenue > 0 ? `${((netGrossProfit / netRealizedRevenue) * 100).toFixed(1)}% gross margin` : '0% margin'}
          </p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Returned / Reversed</p>
          <p className="text-xl font-extrabold font-mono text-rose-400 mt-1">
            {returnedSales.length > 0 ? `-${config.currencySymbol}${returnsTotalAmount.toFixed(2)}` : `${config.currencySymbol}0.00`}
          </p>
          <p className="text-[11px] text-rose-400/80 mt-1">
            {returnedSales.length} {returnedSales.length === 1 ? 'sale reversed' : 'sales reversed'}
          </p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Outstanding Credit Sales</p>
          <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">
            {config.currencySymbol}{uncollectedCredit.toFixed(2)}
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">Active debtor balance</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-72">
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
          
          {/* Status Filter (All / Completed / Returned) */}
          <div className="flex items-center gap-1 bg-charcoal-950 border border-charcoal-800 p-1 rounded-lg shrink-0">
            {[
              { id: 'all' as StatusFilterOption, label: 'All Invoices' },
              { id: 'active' as StatusFilterOption, label: 'Completed' },
              { id: 'returned' as StatusFilterOption, label: 'Returned' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? tab.id === 'returned'
                      ? 'bg-rose-900/80 text-rose-200 border border-rose-700 font-semibold shadow-xs'
                      : 'bg-forest-700 text-white font-semibold shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
          <table className="w-full min-w-[840px] text-left text-xs border-collapse">
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
                  <tr
                    key={sale.id}
                    className={`transition-colors ${
                      sale.isReturned ? 'bg-rose-950/15 hover:bg-rose-950/25' : 'hover:bg-charcoal-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={sale.isReturned ? 'text-charcoal-400 line-through' : 'text-forest-400'}>
                        {sale.invoiceNumber}
                      </span>
                      {sale.isReturned && (
                        <span className="block text-[9px] font-mono text-rose-400 font-normal uppercase tracking-wider">
                          Reversed
                        </span>
                      )}
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
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                      {sale.isReturned ? (
                        <div>
                          <span className="text-charcoal-500 line-through text-[11px]">
                            {config.currencySymbol}{sale.totalAmount.toFixed(2)}
                          </span>
                          <span className="block text-rose-400 text-xs font-bold">
                            -{config.currencySymbol}{sale.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white">
                          {config.currencySymbol}{sale.totalAmount.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {sale.isReturned ? (
                        <span className="text-charcoal-500">0.00</span>
                      ) : (
                        <span className="text-forest-400">
                          +{config.currencySymbol}{sale.grossProfit.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {sale.isReturned ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800/80"
                          title={sale.returnReason ? `Return reason: ${sale.returnReason}` : 'Reversed Sale'}
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          <span>Returned</span>
                        </span>
                      ) : isPaid ? (
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
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenInvoice(sale)}
                          className="px-2.5 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs border border-forest-700/50 active:scale-95"
                          title="View, Print or Export A4 Tax Invoice"
                        >
                          <FileText className="w-3.5 h-3.5 text-forest-300" />
                          <span>Invoice</span>
                        </button>

                        {!sale.isReturned && onReturnSale && (
                          <button
                            onClick={() => handleOpenReturnModal(sale)}
                            className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
                            title="Reverse sale, replenish product stock into inventory, and reverse revenue"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                            <span>Return</span>
                          </button>
                        )}
                      </div>
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

      {/* Return & Stock Replenishment Modal */}
      {returnModalSale && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-charcoal-950/80 border-b border-charcoal-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                    Reverse Sale & Restock Inventory
                  </h3>
                  <p className="text-xs text-charcoal-400 mt-0.5 font-mono">
                    Invoice: <span className="text-forest-400 font-semibold">{returnModalSale.invoiceNumber}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReturnModalSale(null)}
                className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors cursor-pointer"
                title="Cancel return"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Financial & Items Summary Card */}
              <div className="bg-charcoal-950/60 rounded-xl p-3.5 border border-charcoal-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-charcoal-800/60">
                  <span className="text-charcoal-400">Customer:</span>
                  <span className="font-semibold text-white">{returnModalSale.customerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-charcoal-800/60">
                  <span className="text-charcoal-400">Original Payment Method:</span>
                  <span className="font-semibold capitalize text-charcoal-200">{returnModalSale.paymentMethod}</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-charcoal-800/60">
                  <span className="text-charcoal-400">Original Total Sale Amount:</span>
                  <span className="font-mono font-bold text-white">
                    {config.currencySymbol}{returnModalSale.totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-charcoal-400 font-semibold">Net Refund / Credit Reversal:</span>
                  <span className="font-mono font-extrabold text-rose-400 text-sm">
                    -{config.currencySymbol}{returnModalSale.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items to be Restocked Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-charcoal-300 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-forest-400" />
                    <span>Inventory Stock to be Restored ({returnModalSale.items.reduce((a, b) => a + b.quantity, 0)} units):</span>
                  </label>
                </div>

                <div className="bg-charcoal-950/40 rounded-xl border border-charcoal-800 divide-y divide-charcoal-800/60 max-h-40 overflow-y-auto">
                  {returnModalSale.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-[10px] text-charcoal-400 font-mono">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-forest-400 bg-forest-950/60 border border-forest-800/60 px-2 py-0.5 rounded">
                          +{item.quantity} {item.unit || 'units'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Return Reason Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-charcoal-300">
                  Reason for Return / Reversal:
                </label>
                <select
                  value={returnReasonPreset}
                  onChange={(e) => setReturnReasonPreset(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 cursor-pointer"
                >
                  <option value="Customer Return (Defective/Damaged)">Customer Return (Defective or Damaged)</option>
                  <option value="Customer Changed Mind / Exchange">Customer Changed Mind / Wants Exchange</option>
                  <option value="Cashier Scanning Error / Wrong Item">Cashier Error / Wrong Item or Quantity Scanned</option>
                  <option value="Customer Cancelled Order">Customer Cancelled Order at Counter</option>
                  <option value="Duplicate Invoice / Voided">Duplicate Invoice Voided</option>
                  <option value="Other">Other (Enter custom reason below)</option>
                </select>

                {returnReasonPreset === 'Other' && (
                  <input
                    type="text"
                    placeholder="Describe reason for returning this sale..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full mt-2 px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Refund Method Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-charcoal-300">
                  Refund Disbursement Method:
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 cursor-pointer"
                >
                  {returnModalSale.paymentMethod === 'credit' ? (
                    <>
                      <option value="credit_reversal">Reverse Credit Balance (Cancel Debtor Debt)</option>
                      <option value="cash">Disburse Cash Refund</option>
                    </>
                  ) : (
                    <>
                      <option value="cash">Cash Refund from Register</option>
                      <option value="digital">Digital / Mobile Money Refund (Telebirr / CBE)</option>
                      <option value="card">Card Terminal Reversal</option>
                      <option value="store_credit">Issue Store Credit</option>
                    </>
                  )}
                </select>
              </div>

              {/* Warning Card */}
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-200/90 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-semibold text-amber-300">Stock & Financial Impact:</p>
                  <p>
                    Reversing this transaction will restore stock for all sold items back into active inventory, remove this sale's revenue from P&L reports, and require Master Passcode security authorization.
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-charcoal-950/80 border-t border-charcoal-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReturnModalSale(null)}
                disabled={isProcessingReturn}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={isProcessingReturn}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isProcessingReturn ? 'Processing...' : 'Authorize Return & Restock'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

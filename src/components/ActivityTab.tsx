import React, { useMemo, useState } from 'react';
import {
  Activity,
  ShoppingBag,
  RotateCcw,
  HandCoins,
  Wallet,
  Package,
  AlertTriangle,
  UserCheck,
  Search,
  Download,
  FileSpreadsheet,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  X,
} from 'lucide-react';
import {
  Sale,
  CreditPayment,
  Expense,
  Product,
  Customer,
  AppUser,
  StoreConfig,
} from '../types/pos.ts';
import { TabType } from './Navbar.tsx';
import { exportSheetsToExcel, exportReportToPdf } from '../utils/exportHelpers.ts';

interface ActivityTabProps {
  sales: Sale[];
  creditPayments: CreditPayment[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  users: AppUser[];
  config: StoreConfig;
  onOpenInvoice: (sale: Sale) => void;
  onNavigate: (tab: TabType) => void;
}

type ActivityCategory = 'all' | 'sales' | 'payments' | 'expenses' | 'inventory' | 'staff';
type TimeWindow = 'today' | '7d' | '30d' | 'all';

interface ActivityEvent {
  id: string;
  timestamp: string;
  epoch: number;
  group: Exclude<ActivityCategory, 'all'>;
  kindLabel: string;
  title: string;
  reference: string;
  actorOrParty: string;
  detailLine: string;
  amount?: number;
  flow?: 'in' | 'out' | 'neutral';
  tone: 'emerald' | 'rose' | 'amber' | 'sky' | 'slate';
  targetTab: TabType;
  actionLabel: string;
  saleRef?: Sale;
}

const getSafeEpoch = (iso?: string): number => {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateKey = (epoch: number): string => {
  if (!epoch) return 'Undated';
  const d = new Date(epoch);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateHeading = (dateKey: string, todayKey: string, yesterdayKey: string): string => {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  if (dateKey === 'Undated') return 'Earlier Records';
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTimeShort = (epoch: number): string => {
  if (!epoch) return '--:--';
  return new Date(epoch).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimestampFull = (epoch: number): string => {
  if (!epoch) return 'N/A';
  return new Date(epoch).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ActivityTab: React.FC<ActivityTabProps> = ({
  sales,
  creditPayments,
  expenses,
  products,
  customers,
  users,
  config,
  onOpenInvoice,
  onNavigate,
}) => {
  const [category, setCategory] = useState<ActivityCategory>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const cur = (config?.currencySymbol || 'Br').trim();
  const formatMoney = (amount: number) => `${cur} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const { todayKey, yesterdayKey } = useMemo(() => {
    const now = new Date();
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    return {
      todayKey: formatDateKey(now.getTime()),
      yesterdayKey: formatDateKey(yest.getTime()),
    };
  }, []);

  // Aggregate live chronological store activity across all operational ledgers
  const allEvents = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];

    // 1. Sales & Returns
    sales.forEach((sale) => {
      const itemSummary = sale.items
        .slice(0, 3)
        .map((i) => `${i.quantity}× ${i.name}`)
        .join(', ');
      const extraItems = sale.items.length > 3 ? ` +${sale.items.length - 3} more` : '';
      const methodLabel =
        sale.paymentMethod === 'digital'
          ? 'Bank / Mobile'
          : sale.paymentMethod.toUpperCase();

      const saleEpoch = getSafeEpoch(sale.timestamp);
      events.push({
        id: `evt-sale-${sale.id}`,
        timestamp: sale.timestamp,
        epoch: saleEpoch,
        group: 'sales',
        kindLabel: sale.paymentMethod === 'credit' ? 'Credit Sale' : 'POS Sale',
        title: `${sale.invoiceNumber} — ${sale.customerName || 'Walk-in Customer'}`,
        reference: sale.invoiceNumber,
        actorOrParty: sale.customerName || 'Walk-in Customer',
        detailLine: `${itemSummary}${extraItems} · ${methodLabel}`,
        amount: sale.totalAmount,
        flow: sale.paymentMethod === 'credit' ? 'neutral' : 'in',
        tone: sale.paymentMethod === 'credit' ? 'amber' : 'emerald',
        targetTab: 'sales',
        actionLabel: 'Invoice',
        saleRef: sale,
      });

      if (sale.isReturned) {
        const retIso = sale.returnedAt || sale.timestamp;
        const retEpoch = getSafeEpoch(retIso) + 1; // Ensure reversal sorts above original sale if same second
        events.push({
          id: `evt-ret-${sale.id}`,
          timestamp: retIso,
          epoch: retEpoch,
          group: 'sales',
          kindLabel: 'Sale Return',
          title: `Reversed ${sale.invoiceNumber} — ${sale.customerName || 'Walk-in Customer'}`,
          reference: sale.invoiceNumber,
          actorOrParty: sale.returnedBy || sale.customerName || 'Store Staff',
          detailLine: `${sale.returnReason || 'Stock returned'} · Refund: ${String(sale.refundMethod || sale.paymentMethod).toUpperCase()}`,
          amount: sale.totalAmount,
          flow: 'out',
          tone: 'rose',
          targetTab: 'sales',
          actionLabel: 'Invoice',
          saleRef: sale,
        });
      }
    });

    // 2. Customer Credit Collections
    creditPayments.forEach((cp) => {
      const cpEpoch = getSafeEpoch(cp.timestamp);
      const channel = cp.externalChannel || String(cp.paymentMethod).toUpperCase();
      const refStr = cp.externalReference ? `Ref ${cp.externalReference}` : '';
      const collector = cp.collectedBy ? `By ${cp.collectedBy}` : '';
      events.push({
        id: `evt-cp-${cp.id}`,
        timestamp: cp.timestamp,
        epoch: cpEpoch,
        group: 'payments',
        kindLabel: 'Credit Payment',
        title: `${cp.customerName} settled credit balance`,
        reference: cp.receiptNumber,
        actorOrParty: cp.customerName,
        detailLine: [channel, refStr, collector].filter(Boolean).join(' · '),
        amount: cp.amount,
        flow: 'in',
        tone: 'emerald',
        targetTab: 'credit',
        actionLabel: 'Ledger',
      });
    });

    // 3. Expenses
    expenses.forEach((exp) => {
      const iso = exp.createdAt || `${exp.date}T12:00:00.000Z`;
      const expEpoch = getSafeEpoch(iso);
      events.push({
        id: `evt-exp-${exp.id}`,
        timestamp: iso,
        epoch: expEpoch,
        group: 'expenses',
        kindLabel: 'Expense',
        title: exp.title,
        reference: exp.receiptNumber || exp.date,
        actorOrParty: exp.payee || exp.category,
        detailLine: `${exp.category} · ${exp.paymentMethod.toUpperCase()}${exp.payee ? ` · Payee: ${exp.payee}` : ''}`,
        amount: exp.amount,
        flow: 'out',
        tone: 'rose',
        targetTab: 'expenses',
        actionLabel: 'Expenses',
      });
    });

    // 4. Inventory Alerts & Updates
    products.forEach((p) => {
      const reorderPt = p.reorderThreshold ?? p.lowStockThreshold ?? 5;
      const isLow = p.stockLevel <= reorderPt;
      const isOut = p.stockLevel <= 0;
      const updatedEpoch = getSafeEpoch(p.updatedAt);

      if (isLow) {
        events.push({
          id: `evt-stock-alert-${p.id}`,
          timestamp: p.updatedAt || new Date().toISOString(),
          epoch: updatedEpoch || Date.now() - 1000,
          group: 'inventory',
          kindLabel: isOut ? 'Out of Stock' : 'Low Stock Alert',
          title: `${p.name} (${p.sku})`,
          reference: p.sku,
          actorOrParty: p.category,
          detailLine: `${p.stockLevel} ${p.unit} left · Reorder point: ${reorderPt} ${p.unit}`,
          flow: 'neutral',
          tone: isOut ? 'rose' : 'amber',
          targetTab: 'inventory',
          actionLabel: 'Restock',
        });
      } else if (updatedEpoch > 0) {
        events.push({
          id: `evt-stock-upd-${p.id}`,
          timestamp: p.updatedAt!,
          epoch: updatedEpoch,
          group: 'inventory',
          kindLabel: 'Catalog Update',
          title: `${p.name} (${p.sku})`,
          reference: p.sku,
          actorOrParty: p.category,
          detailLine: `Stock: ${p.stockLevel} ${p.unit} · Price: ${formatMoney(p.sellingPrice)}`,
          flow: 'neutral',
          tone: 'sky',
          targetTab: 'inventory',
          actionLabel: 'Inventory',
        });
      }
    });

    // 5. Customer Profile Additions (only recent / dated customers without double noise)
    customers.forEach((c) => {
      const createdEpoch = getSafeEpoch(c.createdAt);
      if (createdEpoch > 0) {
        events.push({
          id: `evt-cust-${c.id}`,
          timestamp: c.createdAt,
          epoch: createdEpoch,
          group: 'payments',
          kindLabel: 'Customer Account',
          title: `Account registered: ${c.name}`,
          reference: c.phone || 'Credit Client',
          actorOrParty: c.companyName || c.name,
          detailLine: `Limit: ${formatMoney(c.creditLimit)} · Balance: ${formatMoney(c.creditBalance)}`,
          flow: 'neutral',
          tone: 'slate',
          targetTab: 'credit',
          actionLabel: 'Account',
        });
      }
    });

    // 6. Staff Logins & Account Changes
    users.forEach((u) => {
      const loginEpoch = getSafeEpoch(u.lastLoginAt);
      if (loginEpoch > 0) {
        events.push({
          id: `evt-login-${u.id}`,
          timestamp: u.lastLoginAt!,
          epoch: loginEpoch,
          group: 'staff',
          kindLabel: 'Staff Sign-In',
          title: `${u.fullName} signed in`,
          reference: u.role.toUpperCase(),
          actorOrParty: u.email,
          detailLine: `Role: ${u.role} · Status: ${u.status || 'active'}`,
          flow: 'neutral',
          tone: 'sky',
          targetTab: 'users',
          actionLabel: 'Staff',
        });
      }

      const updEpoch = getSafeEpoch(u.updatedAt);
      if (updEpoch > 0 && Math.abs(updEpoch - loginEpoch) > 5000) {
        events.push({
          id: `evt-staff-upd-${u.id}`,
          timestamp: u.updatedAt!,
          epoch: updEpoch,
          group: 'staff',
          kindLabel: 'Staff Update',
          title: `Account updated: ${u.fullName}`,
          reference: u.role.toUpperCase(),
          actorOrParty: u.email,
          detailLine: `Credentials / profile modified · Status: ${u.status || 'active'}`,
          flow: 'neutral',
          tone: 'slate',
          targetTab: 'users',
          actionLabel: 'Staff',
        });
      }
    });

    return events.sort((a, b) => b.epoch - a.epoch);
  }, [sales, creditPayments, expenses, products, customers, users, cur]);

  // Apply Time Window, Category, and Search Filters
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.trim().toLowerCase();

    return allEvents.filter((evt) => {
      if (category !== 'all' && evt.group !== category) return false;

      if (timeWindow === 'today') {
        if (formatDateKey(evt.epoch) !== todayKey) return false;
      } else if (timeWindow === '7d') {
        if (now - evt.epoch > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (timeWindow === '30d') {
        if (now - evt.epoch > 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (q) {
        const haystack = [
          evt.title,
          evt.kindLabel,
          evt.reference,
          evt.actorOrParty,
          evt.detailLine,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allEvents, category, timeWindow, searchQuery, todayKey]);

  // Group filtered events by calendar date
  const groupedSections = useMemo(() => {
    const groups: Array<{ dateKey: string; label: string; items: ActivityEvent[] }> = [];
    const map = new Map<string, ActivityEvent[]>();

    filteredEvents.forEach((evt) => {
      const key = formatDateKey(evt.epoch);
      const list = map.get(key);
      if (list) {
        list.push(evt);
      } else {
        const nextList = [evt];
        map.set(key, nextList);
        groups.push({
          dateKey: key,
          label: formatDateHeading(key, todayKey, yesterdayKey),
          items: nextList,
        });
      }
    });

    return groups;
  }, [filteredEvents, todayKey, yesterdayKey]);

  // Live KPI metrics for the current filtered window
  const metrics = useMemo(() => {
    let todayCount = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    allEvents.forEach((evt) => {
      if (formatDateKey(evt.epoch) === todayKey) todayCount += 1;
    });

    filteredEvents.forEach((evt) => {
      if (evt.amount) {
        if (evt.flow === 'in') totalInflow += evt.amount;
        else if (evt.flow === 'out') totalOutflow += evt.amount;
      }
    });

    const reorderCount = products.filter(
      (p) => p.stockLevel <= (p.reorderThreshold ?? p.lowStockThreshold ?? 5)
    ).length;

    return {
      todayCount,
      totalInflow,
      totalOutflow,
      reorderCount,
    };
  }, [allEvents, filteredEvents, products, todayKey]);

  // Category filter counts within current timeWindow
  const categoryOptions: Array<{ id: ActivityCategory; label: string }> = [
    { id: 'all', label: 'All Activity' },
    { id: 'sales', label: 'Sales & Returns' },
    { id: 'payments', label: 'Credit & Clients' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'inventory', label: 'Stock Alerts' },
    { id: 'staff', label: 'Staff' },
  ];

  // Exports (Strictly Excel .xlsx & PDF .pdf)
  const handleExportExcel = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    exportSheetsToExcel(`Sappy_Activity_Log_${dateStamp}.xlsx`, [
      {
        sheetName: 'Activity_Log',
        headers: [
          'Timestamp',
          'Category',
          'Event Type',
          'Reference',
          'Title',
          'Party / Actor',
          'Details',
          'Flow',
          `Amount (${cur})`,
        ],
        rows: filteredEvents.map((e) => [
          formatTimestampFull(e.epoch),
          e.group.toUpperCase(),
          e.kindLabel,
          e.reference,
          e.title,
          e.actorOrParty,
          e.detailLine,
          e.flow ? e.flow.toUpperCase() : 'INFO',
          e.amount !== undefined ? Number(e.amount.toFixed(2)) : '',
        ]),
      },
    ]);
  };

  const handleExportPdf = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    exportReportToPdf({
      filename: `Sappy_Activity_Log_${dateStamp}.pdf`,
      title: 'Store Activity Audit Log',
      subtitle: `Filter: ${category.toUpperCase()} · Window: ${timeWindow.toUpperCase()} · ${filteredEvents.length} events`,
      storeConfig: config,
      orientation: 'landscape',
      summaryPairs: [
        { label: 'Filtered Events', value: `${filteredEvents.length} events` },
        { label: 'Events Today', value: `${metrics.todayCount} logged` },
        { label: 'Cash/Digital Inflow', value: formatMoney(metrics.totalInflow) },
        { label: 'Expenses & Returns', value: formatMoney(metrics.totalOutflow) },
      ],
      sections: [
        {
          title: 'Chronological Store Events',
          headers: ['Timestamp', 'Type', 'Reference', 'Event & Details', 'Party / Actor', 'Amount'],
          columnAlignments: ['left', 'left', 'left', 'left', 'left', 'right'],
          rows: filteredEvents.slice(0, 250).map((e) => [
            formatTimestampFull(e.epoch),
            e.kindLabel,
            e.reference,
            `${e.title} — ${e.detailLine}`,
            e.actorOrParty,
            e.amount !== undefined
              ? `${e.flow === 'out' ? '-' : e.flow === 'in' ? '+' : ''}${formatMoney(e.amount)}`
              : '-',
          ]),
        },
      ],
    });
  };

  const renderEventIcon = (evt: ActivityEvent) => {
    const iconColor =
      evt.tone === 'emerald'
        ? 'bg-forest-950 text-forest-400 border-forest-800/80'
        : evt.tone === 'rose'
          ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
          : evt.tone === 'amber'
            ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
            : evt.tone === 'sky'
              ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
              : 'bg-charcoal-950 text-charcoal-300 border-charcoal-800';

    const IconComponent =
      evt.kindLabel === 'Sale Return'
        ? RotateCcw
        : evt.group === 'sales'
          ? ShoppingBag
          : evt.group === 'payments'
            ? HandCoins
            : evt.group === 'expenses'
              ? Wallet
              : evt.kindLabel.includes('Stock Alert') || evt.kindLabel === 'Out of Stock'
                ? AlertTriangle
                : evt.group === 'inventory'
                  ? Package
                  : UserCheck;

    return (
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColor}`}
      >
        <IconComponent className="w-4.5 h-4.5" />
      </div>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-charcoal-900 border border-charcoal-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-forest-950 border border-forest-700/60 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-forest-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Store Activity Feed
            </h1>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Chronological stream of sales, returns, credit collections, expenses, low-stock alerts, and staff logins.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-forest-300 hover:text-white border border-charcoal-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white border border-forest-500/70 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip — Single-elevation flat cards with tabular figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-charcoal-400">Events Logged Today</p>
          <p className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {metrics.todayCount}
          </p>
          <p className="text-[11px] text-charcoal-500 font-mono tabular-nums mt-0.5">
            {filteredEvents.length} in current view
          </p>
        </div>

        <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-charcoal-400 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-forest-400" />
            <span>Inflow (Sales & Debt)</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold text-forest-400 font-mono tabular-nums mt-1 truncate">
            {formatMoney(metrics.totalInflow)}
          </p>
          <p className="text-[11px] text-charcoal-500 mt-0.5">Cash, card & bank payments</p>
        </div>

        <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-charcoal-400 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            <span>Outflow & Reversals</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold text-rose-400 font-mono tabular-nums mt-1 truncate">
            {formatMoney(metrics.totalOutflow)}
          </p>
          <p className="text-[11px] text-charcoal-500 mt-0.5">Expenses & returned invoices</p>
        </div>

        <button
          type="button"
          onClick={() => setCategory(category === 'inventory' ? 'all' : 'inventory')}
          className="text-left bg-charcoal-900 hover:bg-charcoal-800/70 border border-charcoal-800 rounded-2xl p-3.5 sm:p-4 transition-colors cursor-pointer"
        >
          <p className="text-[11px] font-medium text-charcoal-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Reorder Alerts</span>
          </p>
          <p className="text-xl sm:text-2xl font-bold text-amber-400 font-mono tabular-nums mt-1">
            {metrics.reorderCount}
          </p>
          <p className="text-[11px] text-charcoal-500 mt-0.5">
            {category === 'inventory' ? 'Showing stock events · Tap to reset' : 'Tap to filter stock alerts'}
          </p>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, receipt #, product SKU, customer, payee..."
              className="w-full min-h-[42px] pl-10 pr-9 py-2 rounded-xl bg-charcoal-950 border border-charcoal-800 focus:border-forest-500 focus:outline-hidden text-xs sm:text-sm text-white placeholder-charcoal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-charcoal-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Time Window Segmented Control */}
          <div className="flex items-center bg-charcoal-950 border border-charcoal-800 rounded-xl p-1 shrink-0 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' },
              ] as Array<{ id: TimeWindow; label: string }>
            ).map((win) => (
              <button
                key={win.id}
                type="button"
                onClick={() => setTimeWindow(win.id)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  timeWindow === win.id
                    ? 'bg-forest-700 text-white'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                {win.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categoryOptions.map((opt) => {
            const isSelected = category === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCategory(opt.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-forest-900/90 text-forest-100 border-forest-500/70'
                    : 'bg-charcoal-950 text-charcoal-400 hover:text-white border-charcoal-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chronological Activity Stream */}
      {groupedSections.length === 0 ? (
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal-950 border border-charcoal-800 flex items-center justify-center mx-auto">
            <Clock className="w-5 h-5 text-charcoal-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">No matching activity recorded</p>
            <p className="text-xs text-charcoal-400 mt-1 max-w-md mx-auto">
              Complete a sale in the POS Register, log an expense, or clear your current filters to see store history.
            </p>
          </div>
          {(category !== 'all' || timeWindow !== 'all' || searchQuery) ? (
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setTimeWindow('all');
                setSearchQuery('');
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-white text-xs font-semibold cursor-pointer"
            >
              Reset All Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold cursor-pointer"
            >
              Open POS Register
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSections.map((group) => (
            <section
              key={group.dateKey}
              className="bg-charcoal-900 border border-charcoal-800 rounded-2xl overflow-hidden"
            >
              {/* Date Group Header */}
              <div className="px-4 py-2.5 bg-charcoal-950/70 border-b border-charcoal-800 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-300">
                  {group.label}
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-charcoal-500">
                  {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {/* Event Rows */}
              <div className="divide-y divide-charcoal-800/80">
                {group.items.map((evt) => {
                  const amountColor =
                    evt.flow === 'in'
                      ? 'text-forest-400'
                      : evt.flow === 'out'
                        ? 'text-rose-400'
                        : 'text-amber-300';

                  const kindTextColor =
                    evt.tone === 'emerald'
                      ? 'text-forest-400'
                      : evt.tone === 'rose'
                        ? 'text-rose-400'
                        : evt.tone === 'amber'
                          ? 'text-amber-400'
                          : evt.tone === 'sky'
                            ? 'text-sky-400'
                            : 'text-charcoal-400';

                  return (
                    <div
                      key={evt.id}
                      className="px-3.5 sm:px-4 py-3 hover:bg-charcoal-800/35 transition-colors flex items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        {renderEventIcon(evt)}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums">
                            <span className="text-charcoal-400">{formatTimeShort(evt.epoch)}</span>
                            <span className="text-charcoal-600">·</span>
                            <span className={`font-semibold ${kindTextColor}`}>
                              {evt.kindLabel}
                            </span>
                            <span className="text-charcoal-600">·</span>
                            <span className="text-charcoal-400 truncate max-w-[160px]">
                              {evt.reference}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate mt-0.5">
                            {evt.title}
                          </p>
                          <p className="text-xs text-charcoal-400 truncate mt-0.5">
                            {evt.detailLine}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                        {evt.amount !== undefined && (
                          <span
                            className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${amountColor}`}
                          >
                            {evt.flow === 'in' ? '+' : evt.flow === 'out' ? '-' : ''}
                            {formatMoney(evt.amount)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (evt.saleRef) {
                              onOpenInvoice(evt.saleRef);
                            } else {
                              onNavigate(evt.targetTab);
                            }
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white border border-charcoal-800 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>{evt.actionLabel}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

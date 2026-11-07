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
  Printer,
  Boxes,
  Users,
  CreditCard,
  Smartphone,
  ShieldAlert,
  PieChart,
  Receipt,
  ShoppingBag,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { Sale, Expense, CreditPayment, Product, Customer, StoreConfig } from '../types/pos.ts';

interface ReportsTabProps {
  sales: Sale[];
  expenses: Expense[];
  creditPayments: CreditPayment[];
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
}

type ReportType =
  | 'pl'
  | 'sales'
  | 'inventory'
  | 'products'
  | 'credit'
  | 'expenses'
  | 'tax';

type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export const ReportsTab: React.FC<ReportsTabProps> = ({
  sales,
  expenses,
  creditPayments,
  products,
  customers,
  config,
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('pl');
  const [rangePreset, setRangePreset] = useState<RangePreset>('month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  // Compute start and end dates based on preset
  const { startDate, endDate, rangeLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (rangePreset === 'today') {
      return { startDate: todayStr, endDate: todayStr, rangeLabel: 'Today' };
    }
    if (rangePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return { startDate: yStr, endDate: yStr, rangeLabel: 'Yesterday' };
    }
    if (rangePreset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { startDate: w.toISOString().slice(0, 10), endDate: todayStr, rangeLabel: 'Last 7 Days' };
    }
    if (rangePreset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: m.toISOString().slice(0, 10), endDate: todayStr, rangeLabel: 'This Month' };
    }
    if (rangePreset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const q = new Date(now.getFullYear(), qMonth, 1);
      return { startDate: q.toISOString().slice(0, 10), endDate: todayStr, rangeLabel: 'This Quarter' };
    }
    if (rangePreset === 'year') {
      const yr = new Date(now.getFullYear(), 0, 1);
      return { startDate: yr.toISOString().slice(0, 10), endDate: todayStr, rangeLabel: 'This Year' };
    }
    if (rangePreset === 'custom') {
      return {
        startDate: customStart || '2020-01-01',
        endDate: customEnd || todayStr,
        rangeLabel: `Custom (${customStart} to ${customEnd})`,
      };
    }
    // All time
    return { startDate: '2020-01-01', endDate: '2030-12-31', rangeLabel: 'All Records' };
  }, [rangePreset, customStart, customEnd]);

  // Filter Sales, Expenses, and Credit Payments within date range
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

  // ----------------------------------------------------
  // 1. P&L & Core Financial Metrics
  // ----------------------------------------------------
  const grossSales = rangeSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const taxCollected = rangeSales.reduce((acc, s) => acc + s.taxAmount, 0);
  const netSales = grossSales - taxCollected;
  const cogs = rangeSales.reduce((acc, s) => acc + s.totalCost, 0);
  const grossProfit = netSales - cogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const totalExpenses = rangeExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // Day-by-Day P&L Breakdown
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

  // ----------------------------------------------------
  // 2. Sales by Payment Channel
  // ----------------------------------------------------
  const paymentChannelStats = useMemo(() => {
    let cashSum = 0;
    let cardSum = 0;
    let digitalSum = 0;
    let creditSum = 0;
    let cashCount = 0;
    let cardCount = 0;
    let digitalCount = 0;
    let creditCount = 0;

    rangeSales.forEach((s) => {
      if (s.paymentMethod === 'cash') {
        cashSum += s.totalAmount;
        cashCount++;
      } else if (s.paymentMethod === 'card') {
        cardSum += s.totalAmount;
        cardCount++;
      } else if (s.paymentMethod === 'digital') {
        digitalSum += s.totalAmount;
        digitalCount++;
      } else if (s.paymentMethod === 'credit') {
        creditSum += s.totalAmount;
        creditCount++;
      }
    });

    const total = grossSales || 1;
    return [
      { channel: 'Cash at Counter', amount: cashSum, count: cashCount, pct: (cashSum / total) * 100, color: 'text-emerald-400', bg: 'bg-emerald-500' },
      { channel: 'Digital & Mobile (Telebirr/CBE)', amount: digitalSum, count: digitalCount, pct: (digitalSum / total) * 100, color: 'text-blue-400', bg: 'bg-blue-500' },
      { channel: 'Customer Credit (Debt Ledger)', amount: creditSum, count: creditCount, pct: (creditSum / total) * 100, color: 'text-amber-400', bg: 'bg-amber-500' },
      { channel: 'Debit / Credit Card POS', amount: cardSum, count: cardCount, pct: (cardSum / total) * 100, color: 'text-purple-400', bg: 'bg-purple-500' },
    ];
  }, [rangeSales, grossSales]);

  // ----------------------------------------------------
  // 3. Product Sales & Performance Matrix
  // ----------------------------------------------------
  const productPerformance = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        category: string;
        qtySold: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    rangeSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.productId) || {
          id: item.productId,
          name: item.name,
          sku: item.sku,
          category: 'Stationery',
          qtySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
        existing.qtySold += item.quantity;
        existing.revenue += item.lineTotal;
        existing.cost += item.lineCostTotal;
        existing.profit += item.lineTotal - item.lineCostTotal;
        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values())
      .map((p) => {
        const prod = products.find((pr) => pr.id === p.id);
        const marginPct = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        return {
          ...p,
          category: prod?.category || 'Stationery',
          currentStock: prod?.stockLevel ?? 0,
          marginPct,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [rangeSales, products]);

  // ----------------------------------------------------
  // 4. Inventory Valuation & Stock Health Metrics
  // ----------------------------------------------------
  const inventoryReport = useMemo(() => {
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items = products.map((p) => {
      const costVal = p.costPrice * p.stockLevel;
      const retailVal = p.sellingPrice * p.stockLevel;
      const projectedProfit = retailVal - costVal;
      const marginPct = retailVal > 0 ? (projectedProfit / retailVal) * 100 : 0;
      const minStock = p.lowStockThreshold ?? 5;
      const isOutOfStock = p.stockLevel <= 0;
      const isLowStock = p.stockLevel > 0 && p.stockLevel <= minStock;

      totalCostVal += costVal;
      totalRetailVal += retailVal;
      totalUnits += p.stockLevel;
      if (isOutOfStock) outOfStockCount++;
      else if (isLowStock) lowStockCount++;

      return {
        ...p,
        costVal,
        retailVal,
        projectedProfit,
        marginPct,
        minStock,
        status: isOutOfStock ? 'out' : isLowStock ? 'low' : 'healthy',
      };
    });

    return {
      items,
      totalCostVal,
      totalRetailVal,
      projectedGrossProfit: totalRetailVal - totalCostVal,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      healthyCount: products.length - lowStockCount - outOfStockCount,
    };
  }, [products]);

  // ----------------------------------------------------
  // 5. Customer Credit & Debt Risk Report
  // ----------------------------------------------------
  const creditReport = useMemo(() => {
    const totalDebt = customers.reduce((acc, c) => acc + c.creditBalance, 0);
    const totalLimits = customers.reduce((acc, c) => acc + c.creditLimit, 0);
    const debtors = customers.filter((c) => c.creditBalance > 0);
    const overLimit = customers.filter((c) => c.creditBalance > c.creditLimit);
    const externalCollected = rangePayments
      .filter((p) => p.isExternal)
      .reduce((acc, p) => acc + p.amount, 0);
    const inStoreCollected = rangePayments
      .filter((p) => !p.isExternal)
      .reduce((acc, p) => acc + p.amount, 0);

    return {
      totalDebt,
      totalLimits,
      utilizationPct: totalLimits > 0 ? (totalDebt / totalLimits) * 100 : 0,
      debtorsCount: debtors.length,
      overLimitCount: overLimit.length,
      externalCollected,
      inStoreCollected,
      debtorsList: customers
        .map((c) => ({
          ...c,
          limitUsagePct: c.creditLimit > 0 ? (c.creditBalance / c.creditLimit) * 100 : 0,
          status: c.creditBalance > c.creditLimit ? 'over' : c.creditBalance > 0 ? 'debt' : 'clear',
        }))
        .sort((a, b) => b.creditBalance - a.creditBalance),
    };
  }, [customers, rangePayments]);

  // ----------------------------------------------------
  // 6. Expense Breakdown by Category
  // ----------------------------------------------------
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; amount: number; count: number }>();

    rangeExpenses.forEach((e) => {
      const existing = map.get(e.category) || { category: e.category, amount: 0, count: 0 };
      existing.amount += e.amount;
      existing.count++;
      map.set(e.category, existing);
    });

    const total = totalExpenses || 1;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        pct: (item.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [rangeExpenses, totalExpenses]);

  // ----------------------------------------------------
  // 7. Tax & VAT Compliance Report (ERCA Standard)
  // ----------------------------------------------------
  const taxReport = useMemo(() => {
    let taxableGross = 0;
    let vatCollected = 0;
    let exemptGross = 0;

    rangeSales.forEach((s) => {
      if (s.taxAmount > 0) {
        taxableGross += s.totalAmount;
        vatCollected += s.taxAmount;
      } else {
        exemptGross += s.totalAmount;
      }
    });

    const netTaxableSales = taxableGross - vatCollected;

    return {
      grossSales,
      taxableGross,
      netTaxableSales,
      vatCollected,
      exemptGross,
      vatRate: config.defaultTaxRate,
      invoiceCount: rangeSales.length,
    };
  }, [rangeSales, grossSales, config.defaultTaxRate]);

  // ----------------------------------------------------
  // Dedicated Bookkeeping & Accounting CSV Export: Financial Summary (Sales vs Expenses)
  // ----------------------------------------------------
  const handleExportFinancialSummaryCSV = () => {
    const safeStore = (config.storeName || 'Sappy_Stationery').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeStore}_Financial_Summary_Sales_vs_Expenses_${rangePreset}_${startDate}_to_${endDate}.csv`;

    const lines: string[] = [];

    const escapeCsv = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const addRow = (cols: (string | number)[]) => {
      lines.push(cols.map(escapeCsv).join(','));
    };

    // --- Header Block ---
    addRow([`=== ${config.storeName.toUpperCase()} — FINANCIAL SUMMARY (SALES VS EXPENSES) ===`]);
    addRow(['Store Name', config.storeName]);
    addRow(['Tax Registration / TIN', config.taxId]);
    addRow(['Store Address', config.address]);
    addRow(['Currency', `${config.currencySymbol.trim()} (${config.currencyCode})`]);
    addRow(['Reporting Period', `${rangeLabel} (${startDate} to ${endDate})`]);
    addRow(['Date Generated', new Date().toISOString()]);
    addRow([]);

    // --- Section 1: Executive Financial Summary (P&L KPIs) ---
    addRow(['--- SECTION 1: EXECUTIVE FINANCIAL SUMMARY (PROFIT & LOSS) ---']);
    addRow(['Financial Metric', `Amount (${config.currencySymbol.trim()})`, 'Accounting Context']);
    addRow(['Gross Sales Revenue (Invoiced)', grossSales.toFixed(2), 'Total retail transaction volume']);
    addRow(['Sales Tax / VAT Collected', taxCollected.toFixed(2), 'Statutory output sales tax']);
    addRow(['Net Sales Revenue (Excl. Tax)', netSales.toFixed(2), 'Gross sales revenue minus output tax']);
    addRow(['Cost of Goods Sold (COGS)', cogs.toFixed(2), 'Wholesale acquisition cost of items sold']);
    addRow(['Gross Profit Margin', grossProfit.toFixed(2), 'Net Sales minus COGS']);
    addRow(['Gross Profit Margin %', `${grossMarginPct.toFixed(2)}%`, 'Gross Profit as % of Net Sales']);
    addRow(['Total Operating Overhead & Expenses', totalExpenses.toFixed(2), 'Disbursements across all operating expense categories']);
    addRow(['Net Operating Income / Profit', netProfit.toFixed(2), 'Gross Profit minus total operating expenses']);
    addRow(['Net Profit Margin %', `${netMarginPct.toFixed(2)}%`, 'Net Profit as % of Net Sales']);
    addRow([]);

    // --- Section 2: Inflow by Payment Channel ---
    addRow(['--- SECTION 2: REVENUE INFLOWS BY PAYMENT CHANNEL ---']);
    addRow(['Payment Channel', `Total Invoiced (${config.currencySymbol.trim()})`, 'Invoices Count', 'Revenue Share %']);
    paymentChannelStats.forEach((c) => {
      addRow([c.channel, c.amount.toFixed(2), c.count, `${c.pct.toFixed(2)}%`]);
    });
    addRow(['Total Revenue Channels', grossSales.toFixed(2), rangeSales.length, '100.00%']);
    addRow([]);

    // --- Section 3: Expenses by Accounting Category ---
    addRow(['--- SECTION 3: OPERATING EXPENSES BY ACCOUNTING CATEGORY ---']);
    addRow(['Expense Category', `Disbursed Amount (${config.currencySymbol.trim()})`, 'Disbursements Count', 'Share of Overhead %']);
    if (expenseBreakdown.length === 0) {
      addRow(['No operating expenses recorded in period', '0.00', 0, '0.00%']);
    } else {
      expenseBreakdown.forEach((e) => {
        addRow([e.category, e.amount.toFixed(2), e.count, `${e.pct.toFixed(2)}%`]);
      });
      addRow(['Total Operating Expenses', totalExpenses.toFixed(2), rangeExpenses.length, '100.00%']);
    }
    addRow([]);

    // --- Section 4: Daily Sales vs Expenses Comparison Schedule ---
    addRow(['--- SECTION 4: DAILY SALES VS EXPENSES COMPARISON SCHEDULE ---']);
    addRow([
      'Date',
      'Transactions',
      `Gross Sales (${config.currencySymbol.trim()})`,
      `COGS (${config.currencySymbol.trim()})`,
      `Gross Profit (${config.currencySymbol.trim()})`,
      `Operating Expenses (${config.currencySymbol.trim()})`,
      `Net Profit (${config.currencySymbol.trim()})`,
      'Net Margin %',
    ]);
    if (dailyBreakdown.length === 0) {
      addRow(['No activity recorded in this period', 0, '0.00', '0.00', '0.00', '0.00', '0.00', '0.00%']);
    } else {
      dailyBreakdown.forEach((r) => {
        addRow([
          r.date,
          r.orderCount,
          r.grossSales.toFixed(2),
          r.cogs.toFixed(2),
          r.grossProfit.toFixed(2),
          r.expenses.toFixed(2),
          r.netProfit.toFixed(2),
          `${r.netMargin.toFixed(2)}%`,
        ]);
      });
    }
    addRow([]);

    // --- Section 5: Itemized Chronological Cash Flow & Audit Register ---
    addRow(['--- SECTION 5: ITEMIZED CHRONOLOGICAL CASH FLOW & AUDIT REGISTER ---']);
    addRow([
      'Date',
      'Time',
      'Transaction Type',
      'Reference / Invoice #',
      'Customer / Payee',
      'Channel / Category',
      `Inflow (Sales ${config.currencySymbol.trim()})`,
      `Outflow (Expense ${config.currencySymbol.trim()})`,
      `Net Cash Impact (${config.currencySymbol.trim()})`,
      'Notes',
    ]);

    type UnifiedEntry = {
      date: string;
      time: string;
      type: 'Sale' | 'Expense';
      ref: string;
      party: string;
      categoryOrChannel: string;
      inflow: number;
      outflow: number;
      net: number;
      notes: string;
    };

    const unifiedList: UnifiedEntry[] = [];

    rangeSales.forEach((s) => {
      const d = s.timestamp.slice(0, 10);
      const t = s.timestamp.slice(11, 19) || '12:00:00';
      unifiedList.push({
        date: d,
        time: t,
        type: 'Sale',
        ref: s.invoiceNumber,
        party: s.customerName || 'Walk-in Customer',
        categoryOrChannel: `Sale: ${s.paymentMethod.toUpperCase()}`,
        inflow: s.totalAmount,
        outflow: 0,
        net: s.totalAmount,
        notes: s.notes || '',
      });
    });

    rangeExpenses.forEach((e) => {
      const d = e.date;
      const t = '12:00:00';
      unifiedList.push({
        date: d,
        time: t,
        type: 'Expense',
        ref: e.receiptNumber || e.id,
        party: e.payee || config.storeName,
        categoryOrChannel: `Expense: ${e.category}`,
        inflow: 0,
        outflow: e.amount,
        net: -e.amount,
        notes: e.title + (e.notes ? ` (${e.notes})` : ''),
      });
    });

    unifiedList.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

    if (unifiedList.length === 0) {
      addRow(['No transactions recorded in this period', '', '', '', '', '', '0.00', '0.00', '0.00', '']);
    } else {
      unifiedList.forEach((entry) => {
        addRow([
          entry.date,
          entry.time,
          entry.type,
          entry.ref,
          entry.party,
          entry.categoryOrChannel,
          entry.inflow > 0 ? entry.inflow.toFixed(2) : '0.00',
          entry.outflow > 0 ? entry.outflow.toFixed(2) : '0.00',
          entry.net.toFixed(2),
          entry.notes,
        ]);
      });
    }

    // Export with UTF-8 BOM (\uFEFF) for compatibility with Excel, LibreOffice, and bookkeeping software
    const csvString = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // Dynamic CSV Export for the Current Report
  // ----------------------------------------------------
  const handleExportCSV = () => {
    if (activeReport === 'pl') {
      handleExportFinancialSummaryCSV();
      return;
    }

    let filename = `Sappy_Stationery_${activeReport.toUpperCase()}_Report_${rangePreset}.csv`;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeReport === 'sales') {
      headers = ['Payment Channel', 'Total Amount', 'Transaction Count', 'Share %'];
      rows = paymentChannelStats.map((r) => [
        r.channel,
        r.amount.toFixed(2),
        r.count,
        `${r.pct.toFixed(1)}%`,
      ]);
    } else if (activeReport === 'products') {
      headers = ['Product Name', 'SKU', 'Category', 'Units Sold', 'Revenue', 'Cost', 'Gross Profit', 'Margin %', 'Stock Level'];
      rows = productPerformance.map((p) => [
        `"${p.name}"`,
        p.sku,
        p.category,
        p.qtySold,
        p.revenue.toFixed(2),
        p.cost.toFixed(2),
        p.profit.toFixed(2),
        `${p.marginPct.toFixed(1)}%`,
        p.currentStock,
      ]);
    } else if (activeReport === 'inventory') {
      filename = `Sappy_Stationery_Inventory_Valuation_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Product Name', 'SKU', 'Category', 'Stock Level', 'Min Stock', 'Unit Cost', 'Unit Price', 'Asset Cost Value', 'Retail Value', 'Potential Profit', 'Stock Status'];
      rows = inventoryReport.items.map((i) => [
        `"${i.name}"`,
        i.sku,
        i.category,
        i.stockLevel,
        i.minStock,
        i.costPrice.toFixed(2),
        i.sellingPrice.toFixed(2),
        i.costVal.toFixed(2),
        i.retailVal.toFixed(2),
        i.projectedProfit.toFixed(2),
        i.status.toUpperCase(),
      ]);
    } else if (activeReport === 'credit') {
      headers = ['Customer Name', 'Company', 'Phone', 'Outstanding Debt', 'Credit Limit', 'Limit Usage %', 'Status'];
      rows = creditReport.debtorsList.map((c) => [
        `"${c.name}"`,
        c.companyName ? `"${c.companyName}"` : '',
        c.phone,
        c.creditBalance.toFixed(2),
        c.creditLimit.toFixed(2),
        `${c.limitUsagePct.toFixed(1)}%`,
        c.status.toUpperCase(),
      ]);
    } else if (activeReport === 'expenses') {
      headers = ['Expense Category', 'Total Amount', 'Disbursement Count', 'Share % of Total'];
      rows = expenseBreakdown.map((e) => [
        `"${e.category}"`,
        e.amount.toFixed(2),
        e.count,
        `${e.pct.toFixed(1)}%`,
      ]);
    } else if (activeReport === 'tax') {
      headers = ['Metric / Field', 'Amount (Br)'];
      rows = [
        ['Total Gross Invoices', taxReport.grossSales.toFixed(2)],
        ['Standard Taxable Sales Base (15% VAT)', taxReport.netTaxableSales.toFixed(2)],
        ['Output VAT Collected (15%)', taxReport.vatCollected.toFixed(2)],
        ['VAT-Exempt / Zero-Rated Sales', taxReport.exemptGross.toFixed(2)],
        ['Total Invoices Count', taxReport.invoiceCount],
      ];
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const reportTabs: { id: ReportType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'pl', label: 'Financial P&L', icon: TrendingUp },
    { id: 'sales', label: 'Sales & Channels', icon: Receipt },
    { id: 'products', label: 'Product Performance', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory Valuation', icon: Boxes },
    { id: 'credit', label: 'Credit & Debt Risk', icon: Users },
    { id: 'expenses', label: 'Overhead Expenses', icon: Wallet },
    { id: 'tax', label: 'Tax & VAT Compliance', icon: FileSpreadsheet },
  ];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Top Header & Export / Print Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-forest-400" />
            <span>General Reports & Financial Intelligence</span>
          </h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Auto-generated accounting statements, sales channel breakdowns, inventory valuation, and tax audit ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleExportFinancialSummaryCSV}
            className="px-3.5 py-2 bg-forest-800/80 hover:bg-forest-700 text-forest-100 hover:text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-transform cursor-pointer border border-forest-600/70 active:scale-95 shadow-xs"
            title="Export comprehensive Sales vs Expenses financial statement to CSV for bookkeeping & accounting"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-forest-300" />
            <span>Export Financial Summary (CSV)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer border border-charcoal-700 active:scale-95 shadow-2xs"
            title="Export currently displayed report to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-forest-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-95 border border-forest-600/50"
            title="Print or Save current report as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-forest-200" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Toolbar (Hidden during Print) */}
      <div className="no-print bg-charcoal-900 p-3.5 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-charcoal-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-forest-400" />
            <span>Period:</span>
          </span>
          {(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'all'] as RangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setRangePreset(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                rangePreset === preset
                  ? 'bg-forest-700 text-white font-semibold shadow-xs border border-forest-600/50'
                  : 'bg-charcoal-950 text-charcoal-400 hover:text-white border border-charcoal-800'
              }`}
            >
              {preset === 'today' && 'Today'}
              {preset === 'yesterday' && 'Yesterday'}
              {preset === 'week' && '7 Days'}
              {preset === 'month' && 'This Month'}
              {preset === 'quarter' && 'This Quarter'}
              {preset === 'year' && 'This Year'}
              {preset === 'all' && 'All Records'}
            </button>
          ))}
          <button
            onClick={() => setRangePreset('custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              rangePreset === 'custom'
                ? 'bg-forest-700 text-white font-semibold shadow-xs border border-forest-600/50'
                : 'bg-charcoal-950 text-charcoal-400 hover:text-white border border-charcoal-800'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Pickers */}
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono text-xs focus:border-forest-500"
            />
            <span className="text-charcoal-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono text-xs focus:border-forest-500"
            />
          </div>
        )}
      </div>

      {/* Report Switcher Tabs (Hidden during Print) */}
      <div className="no-print flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
                isActive
                  ? 'bg-forest-900/90 text-white border-forest-600/70 shadow-xs'
                  : 'bg-charcoal-900 text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-850 border-charcoal-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-forest-300' : 'text-charcoal-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Auto-Generated Official Header Badge for the Active Report */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-forest-950 border border-forest-800/80 text-forest-300 uppercase">
              Official Auto-Generated Report
            </span>
            <span className="text-xs text-charcoal-400 font-mono">
              Period: <strong className="text-white">{rangeLabel}</strong> ({startDate} to {endDate})
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            {activeReport === 'pl' && 'Profit & Loss Statement (P&L)'}
            {activeReport === 'sales' && 'Sales Channels & Revenue Stream Ledger'}
            {activeReport === 'products' && 'Product Sales & Margin Performance Matrix'}
            {activeReport === 'inventory' && 'Inventory Asset Valuation & Stock Health Report'}
            {activeReport === 'credit' && 'Customer Credit & Accounts Receivable Risk Ledger'}
            {activeReport === 'expenses' && 'Operating Overhead & Expense Categorization Report'}
            {activeReport === 'tax' && 'Tax & VAT Statutory Compliance Audit Report'}
          </h2>
        </div>

        <div className="text-left sm:text-right font-mono text-[11px] text-charcoal-400">
          <p>Store: <span className="text-white font-semibold">{config.storeName}</span></p>
          <p>TIN / Tax ID: <span className="text-forest-400">{config.taxId}</span></p>
          <p>Generated: <span className="text-charcoal-300">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. REPORT: FINANCIAL PROFIT & LOSS (P&L) */}
      {/* ======================================================== */}
      {activeReport === 'pl' && (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Gross Revenue</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {config.currencySymbol}{grossSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">{rangeSales.length} total orders recorded</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Cost of Goods (COGS)</p>
              <p className="text-xl font-extrabold font-mono text-rose-300 mt-1">
                {config.currencySymbol}{cogs.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Inventory cost basis of items sold</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Operating Overhead</p>
              <p className="text-xl font-extrabold font-mono text-amber-300 mt-1">
                {config.currencySymbol}{totalExpenses.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">{rangeExpenses.length} expense disbursements</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Net Operating Profit</p>
              <p className={`text-xl font-extrabold font-mono mt-1 ${netProfit >= 0 ? 'text-forest-400' : 'text-rose-400'}`}>
                {config.currencySymbol}{netProfit.toFixed(2)}
              </p>
              <p className={`text-[11px] font-mono mt-1 ${netProfit >= 0 ? 'text-forest-400/80' : 'text-rose-400/80'}`}>
                Net Margin: {netMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Daily P&L Ledger Table */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white">Daily Profit & Loss Ledger</h3>
                <p className="text-xs text-charcoal-400">Day-by-day revenue, cost of goods, overhead, and net earnings.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportFinancialSummaryCSV}
                  className="px-3 py-1.5 bg-forest-900/80 hover:bg-forest-800 text-forest-200 border border-forest-600/70 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
                  title="Download complete Sales vs Expenses CSV breakdown"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-forest-400" />
                  <span>Download Sales vs Expenses CSV</span>
                </button>
                <span className="text-xs font-mono text-charcoal-400">{dailyBreakdown.length} active dates</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">COGS</th>
                    <th className="py-3 px-4 text-right">Gross Profit</th>
                    <th className="py-3 px-4 text-right">Expenses</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-right">Net Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-charcoal-850/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-white">{row.date}</td>
                      <td className="py-3 px-4 text-center font-mono text-charcoal-300">{row.orderCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                        {config.currencySymbol}{row.grossSales.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-400">
                        {config.currencySymbol}{row.cogs.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-forest-300">
                        {config.currencySymbol}{row.grossProfit.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-300">
                        {config.currencySymbol}{row.expenses.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-extrabold ${row.netProfit >= 0 ? 'text-forest-400' : 'text-rose-400'}`}>
                        {config.currencySymbol}{row.netProfit.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-300">
                        {row.netMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {dailyBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-charcoal-400">
                        No financial activity found for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. REPORT: SALES CHANNELS & CASH INFLOWS */}
      {/* ======================================================== */}
      {activeReport === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentChannelStats.map((item) => (
              <div key={item.channel} className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
                <p className="text-xs text-charcoal-400 font-medium">{item.channel}</p>
                <p className={`text-xl font-extrabold font-mono mt-1 ${item.color}`}>
                  {config.currencySymbol}{item.amount.toFixed(2)}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-charcoal-400 font-mono">
                  <span>{item.count} invoices</span>
                  <span>{item.pct.toFixed(1)}% of total</span>
                </div>
                <div className="w-full h-1.5 bg-charcoal-950 rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full ${item.bg}`} style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Sales Transaction History Table */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Sales Invoices in Period</h3>
                <p className="text-xs text-charcoal-400">Complete itemized sales ledger with payment channels.</p>
              </div>
              <span className="text-xs font-mono text-forest-400 font-semibold">{rangeSales.length} Invoices</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Tax (VAT)</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {rangeSales.slice(0, 50).map((s) => (
                    <tr key={s.id} className="hover:bg-charcoal-850/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{s.invoiceNumber}</td>
                      <td className="py-3 px-4 font-mono text-charcoal-400">
                        {new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-charcoal-200">{s.customerName || 'Walk-in Retail'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-charcoal-950 border border-charcoal-700 text-charcoal-300">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-charcoal-300">{s.items.length}</td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-400">
                        {config.currencySymbol}{s.taxAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-forest-400">
                        {config.currencySymbol}{s.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {rangeSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-charcoal-400">
                        No sales found in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. REPORT: PRODUCT PERFORMANCE & VELOCITY */}
      {/* ======================================================== */}
      {activeReport === 'products' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Products Sold</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {productPerformance.reduce((acc, p) => acc + p.qtySold, 0)} Units
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">{productPerformance.length} distinct items moved</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Product Revenue Generated</p>
              <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
                {config.currencySymbol}{productPerformance.reduce((acc, p) => acc + p.revenue, 0).toFixed(2)}
              </p>
              <p className="text-[11px] text-forest-400/80 mt-1">Across all stationery catalog</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Gross Product Profit</p>
              <p className="text-xl font-extrabold font-mono text-emerald-400 mt-1">
                {config.currencySymbol}{productPerformance.reduce((acc, p) => acc + p.profit, 0).toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Revenue minus COGS</p>
            </div>
          </div>

          {/* Product Sales Ranking Matrix */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Stationery Product Performance Matrix</h3>
                <p className="text-xs text-charcoal-400">Ranked by revenue generation, profit margins, and sales volume.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Rank / Product</th>
                    <th className="py-3 px-4">SKU & Category</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-right">Cost (COGS)</th>
                    <th className="py-3 px-4 text-right">Profit Contribution</th>
                    <th className="py-3 px-4 text-right">Margin %</th>
                    <th className="py-3 px-4 text-center">Remaining Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {productPerformance.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-charcoal-850/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-charcoal-950 border border-charcoal-700 flex items-center justify-center font-mono text-[10px] text-charcoal-300">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-white">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-charcoal-300">{p.sku}</span>
                        <span className="text-charcoal-500 ml-1.5">· {p.category}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">{p.qtySold}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                        {config.currencySymbol}{p.revenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-400">
                        {config.currencySymbol}{p.cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-forest-300">
                        {config.currencySymbol}{p.profit.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-forest-400">
                        {p.marginPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.currentStock <= 0 ? 'bg-rose-950/80 text-rose-300 border border-rose-800' : 'bg-charcoal-950 text-charcoal-300'
                        }`}>
                          {p.currentStock} in stock
                        </span>
                      </td>
                    </tr>
                  ))}
                  {productPerformance.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-charcoal-400">
                        No product sales recorded in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. REPORT: INVENTORY VALUATION & STOCK HEALTH */}
      {/* ======================================================== */}
      {activeReport === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Inventory Asset (At Cost)</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {config.currencySymbol}{inventoryReport.totalCostVal.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Capital currently tied up in stock</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Retail Valuation</p>
              <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
                {config.currencySymbol}{inventoryReport.totalRetailVal.toFixed(2)}
              </p>
              <p className="text-[11px] text-forest-400/80 mt-1">Expected gross turnover</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Potential Gross Profit in Stock</p>
              <p className="text-xl font-extrabold font-mono text-emerald-400 mt-1">
                {config.currencySymbol}{inventoryReport.projectedGrossProfit.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Gross profit upon sell-out</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Stock Health Status</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {inventoryReport.totalUnits} Units
              </p>
              <p className="text-[11px] text-amber-400 mt-1">
                {inventoryReport.lowStockCount} low stock · {inventoryReport.outOfStockCount} out of stock
              </p>
            </div>
          </div>

          {/* Full Inventory Valuation Table */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Catalog Inventory Valuation Breakdown</h3>
                <p className="text-xs text-charcoal-400">Complete list of items with unit cost, selling price, and tied-up asset values.</p>
              </div>
              <span className="text-xs font-mono text-charcoal-400">{products.length} Products</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">SKU / Barcode</th>
                    <th className="py-3 px-4 text-center">On Hand</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Cost Asset Value</th>
                    <th className="py-3 px-4 text-right">Retail Value</th>
                    <th className="py-3 px-4 text-center">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {inventoryReport.items.map((i) => (
                    <tr key={i.id} className="hover:bg-charcoal-850/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{i.name}</td>
                      <td className="py-3 px-4 font-mono text-charcoal-300">{i.sku}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">{i.stockLevel}</td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-400">
                        {config.currencySymbol}{i.costPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                        {config.currencySymbol}{i.sellingPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-300">
                        {config.currencySymbol}{i.costVal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-forest-300">
                        {config.currencySymbol}{i.retailVal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {i.status === 'out' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                            Out of Stock
                          </span>
                        )}
                        {i.status === 'low' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                            Low Stock (≤{i.minStock})
                          </span>
                        )}
                        {i.status === 'healthy' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-forest-950/80 text-forest-300 border border-forest-800/80">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. REPORT: CUSTOMER CREDIT & DEBT RISK LEDGER */}
      {/* ======================================================== */}
      {activeReport === 'credit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Credit Outstanding</p>
              <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">
                {config.currencySymbol}{creditReport.totalDebt.toFixed(2)}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">{creditReport.debtorsCount} active debtor accounts</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Approved Credit Exposure</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {config.currencySymbol}{creditReport.totalLimits.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">{creditReport.utilizationPct.toFixed(1)}% total limit utilized</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">External Settlements (Telebirr/CBE)</p>
              <p className="text-xl font-extrabold font-mono text-emerald-400 mt-1">
                {config.currencySymbol}{creditReport.externalCollected.toFixed(2)}
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-1">Mobile & bank slips in period</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">High Risk / Over Limit</p>
              <p className="text-xl font-extrabold font-mono text-rose-400 mt-1">
                {creditReport.overLimitCount} Accounts
              </p>
              <p className="text-[11px] text-rose-400/80 mt-1">Exceeding approved limits</p>
            </div>
          </div>

          {/* Customer Risk Ledger Table */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Customer Credit Risk & Balances</h3>
                <p className="text-xs text-charcoal-400">Analysis of debt balances, approved limits, and exposure risks.</p>
              </div>
              <span className="text-xs font-mono text-charcoal-400">{customers.length} Accounts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Customer Account</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4 text-right">Current Debt</th>
                    <th className="py-3 px-4 text-right">Approved Limit</th>
                    <th className="py-3 px-4 text-center">Utilization</th>
                    <th className="py-3 px-4 text-center">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {creditReport.debtorsList.map((c) => (
                    <tr key={c.id} className="hover:bg-charcoal-850/60 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{c.name}</p>
                        {c.companyName && <p className="text-[10px] text-charcoal-400">{c.companyName}</p>}
                      </td>
                      <td className="py-3 px-4 font-mono text-charcoal-300">{c.phone}</td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold">
                        {c.creditBalance > 0 ? (
                          <span className="text-amber-400">{config.currencySymbol}{c.creditBalance.toFixed(2)}</span>
                        ) : (
                          <span className="text-forest-400">Clear</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-charcoal-300">
                        {config.currencySymbol}{c.creditLimit.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {c.limitUsagePct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.status === 'over' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                            Over Limit
                          </span>
                        ) : c.status === 'debt' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
                            Active Debt
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-forest-950/80 text-forest-300 border border-forest-800/80">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. REPORT: OPERATING EXPENSES & OVERHEAD */}
      {/* ======================================================== */}
      {activeReport === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Total Operating Expenses</p>
              <p className="text-xl font-extrabold font-mono text-rose-400 mt-1">
                {config.currencySymbol}{totalExpenses.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Overhead in selected period</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Disbursements Logged</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {rangeExpenses.length} Records
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Across {expenseBreakdown.length} expense categories</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Average Expense Size</p>
              <p className="text-xl font-extrabold font-mono text-amber-300 mt-1">
                {config.currencySymbol}
                {rangeExpenses.length > 0 ? (totalExpenses / rangeExpenses.length).toFixed(2) : '0.00'}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Per voucher entry</p>
            </div>
          </div>

          {/* Expense Category Distribution */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs p-5">
            <h3 className="text-sm font-bold text-white mb-3">Operating Expense Distribution</h3>
            <div className="space-y-3">
              {expenseBreakdown.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-charcoal-200">{item.category}</span>
                    <span className="font-mono text-white">
                      {config.currencySymbol}{item.amount.toFixed(2)}{' '}
                      <span className="text-charcoal-400 text-[11px]">({item.pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-charcoal-950 rounded-full overflow-hidden">
                    <div className="h-full bg-forest-600 rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
              {expenseBreakdown.length === 0 && (
                <p className="text-center py-6 text-charcoal-400 text-xs">No expenses recorded in this period.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. REPORT: TAX & VAT COMPLIANCE (ERCA STANDARD) */}
      {/* ======================================================== */}
      {activeReport === 'tax' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Gross Turnover Invoices</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">
                {config.currencySymbol}{taxReport.grossSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">{taxReport.invoiceCount} invoices filed</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Standard Taxable Base</p>
              <p className="text-xl font-extrabold font-mono text-forest-300 mt-1">
                {config.currencySymbol}{taxReport.netTaxableSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Excludes VAT amount</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Output VAT Collected ({taxReport.vatRate}%)</p>
              <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">
                {config.currencySymbol}{taxReport.vatCollected.toFixed(2)}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">Remittable to ERCA / MoR</p>
            </div>

            <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
              <p className="text-xs text-charcoal-400 font-medium">Exempt / Zero-Rated Sales</p>
              <p className="text-xl font-extrabold font-mono text-charcoal-300 mt-1">
                {config.currencySymbol}{taxReport.exemptGross.toFixed(2)}
              </p>
              <p className="text-[11px] text-charcoal-400 mt-1">Statutory non-taxable sales</p>
            </div>
          </div>

          {/* Statutory Tax Summary Table */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs p-5">
            <h3 className="text-sm font-bold text-white mb-2">Statutory Tax Filing Summary</h3>
            <p className="text-xs text-charcoal-400 mb-4">
              Official figures prepared for monthly or quarterly tax returns (Ministry of Revenues / ERCA).
            </p>

            <div className="divide-y divide-charcoal-800 font-mono text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">1. Taxpayer Name & Business Entity:</span>
                <span className="font-bold text-white">{config.storeName}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">2. Tax Identification Number (TIN):</span>
                <span className="font-bold text-forest-400">{config.taxId}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">3. Total Gross Sales (Inclusive of Tax):</span>
                <span className="font-bold text-white">{config.currencySymbol}{taxReport.grossSales.toFixed(2)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">4. Net Taxable Sales Base (15% VAT):</span>
                <span className="font-bold text-white">{config.currencySymbol}{taxReport.netTaxableSales.toFixed(2)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">5. Total Output VAT Liability (15%):</span>
                <span className="font-bold text-amber-400">{config.currencySymbol}{taxReport.vatCollected.toFixed(2)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-charcoal-300">6. Non-Taxable / Exempt Educational Goods:</span>
                <span className="font-bold text-charcoal-300">{config.currencySymbol}{taxReport.exemptGross.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

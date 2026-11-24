import { StoreConfig } from '../types/pos.ts';
import { storageService } from '../services/storageService.ts';

export type CellValue = string | number | boolean | null | undefined;

export interface ExcelSheetSpec {
  sheetName: string;
  headers: string[];
  rows: CellValue[][];
}

export interface PdfSectionSpec {
  title?: string;
  headers?: string[];
  rows: (string | number)[][];
  columnAlignments?: Array<'left' | 'right' | 'center'>;
}

export interface PdfReportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  storeConfig?: Partial<StoreConfig>;
  orientation?: 'portrait' | 'landscape';
  summaryPairs?: Array<{ label: string; value: string }>;
  sections: PdfSectionSpec[];
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = String(name || `Sheet_${index + 1}`)
    .replace(/[\\/*?:[\]]/g, '_')
    .trim()
    .slice(0, 31);
  return cleaned || `Sheet_${index + 1}`;
}

function ensureExt(filename: string, ext: '.xlsx' | '.pdf'): string {
  const base = String(filename || 'export').replace(/\.(csv|xlsx|xls|pdf|json)$/i, '');
  return `${base}${ext}`;
}

/**
 * Exports one or more structured tables into an Excel (.xlsx) workbook
 * with automatic column width sizing.
 */
export async function exportSheetsToExcel(filename: string, sheets: ExcelSheetSpec[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  sheets.forEach((spec, idx) => {
    let sheetName = sanitizeSheetName(spec.sheetName, idx);
    while (usedNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${sheetName.slice(0, 27)}_${idx + 1}`, idx);
    }
    usedNames.add(sheetName);

    const aoa: CellValue[][] =
      spec.headers.length > 0 ? [spec.headers, ...spec.rows] : [...spec.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Compute clean column widths
    const colCount = aoa.reduce((max, row) => Math.max(max, row.length), 0);
    const colWidths: { wch: number }[] = [];
    for (let c = 0; c < colCount; c++) {
      let maxLen = 10;
      for (let r = 0; r < Math.min(aoa.length, 250); r++) {
        const val = aoa[r]?.[c];
        if (val !== null && val !== undefined) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      }
      colWidths.push({ wch: Math.min(46, maxLen + 3) });
    }
    if (colWidths.length > 0) {
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, ensureExt(filename, '.xlsx'));
}

/**
 * Renders one or more structured report tables into a multi-page branded PDF (.pdf)
 * with wrapped cells, repeating headers, and executive KPI blocks.
 */
export async function exportReportToPdf(options: PdfReportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const orientation = options.orientation || 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;
  const storeName = options.storeConfig?.storeName || 'Sappy Stationary';
  const taxId = options.storeConfig?.taxId ? `TIN: ${options.storeConfig.taxId}` : '';
  const currency = (options.storeConfig?.currencySymbol || 'Br').trim();
  const generatedStr = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const drawHeaderBand = () => {
    doc.setFillColor(20, 83, 45); // Forest green header
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(storeName.toUpperCase(), marginX, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const metaRight = [taxId, `Currency: ${currency}`, `Generated: ${generatedStr}`]
      .filter(Boolean)
      .join('  |  ');
    doc.text(metaRight, pageWidth - marginX, 10, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(options.title, marginX, 17);

    if (options.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(220, 252, 231);
      doc.text(options.subtitle.slice(0, 120), marginX, 21.5);
    }
  };

  drawHeaderBand();
  let y = 30;

  // Optional executive KPI summary grid
  if (options.summaryPairs && options.summaryPairs.length > 0) {
    const cols = Math.min(4, Math.max(2, options.summaryPairs.length));
    const cardGap = 3;
    const cardW = (contentWidth - cardGap * (cols - 1)) / cols;
    const cardH = 14;

    options.summaryPairs.forEach((pair, idx) => {
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const cardX = marginX + colIdx * (cardW + cardGap);
      const cardY = y + rowIdx * (cardH + 3);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(String(pair.label).slice(0, 28), cardX + 2.5, cardY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(pair.value).slice(0, 26), cardX + 2.5, cardY + 11);
    });

    const totalSummaryRows = Math.ceil(options.summaryPairs.length / cols);
    y += totalSummaryRows * (cardH + 3) + 3;
  }

  const ensureSpace = (neededMm: number): boolean => {
    if (y + neededMm > pageHeight - 14) {
      doc.addPage();
      doc.setFillColor(20, 83, 45);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${storeName} — ${options.title}`, marginX, 8);
      y = 17;
      return true;
    }
    return false;
  };

  options.sections.forEach((section) => {
    ensureSpace(18);

    if (section.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 83, 45);
      doc.text(section.title, marginX, y);
      y += 4;
    }

    const colCount =
      section.headers?.length ||
      section.rows.reduce((max, r) => Math.max(max, r.length), 0) ||
      1;

    // Weight wider columns for text/descriptions vs short numeric/code columns
    const weights = Array.from({ length: colCount }, (_, c) => {
      const header = String(section.headers?.[c] || '').toLowerCase();
      if (
        header.includes('name') ||
        header.includes('product') ||
        header.includes('description') ||
        header.includes('context') ||
        header.includes('notes') ||
        header.includes('customer') ||
        header.includes('party')
      ) {
        return 1.8;
      }
      if (header.includes('category') || header.includes('channel') || header.includes('sku')) {
        return 1.25;
      }
      return 1;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (w / totalWeight) * contentWidth);

    const drawTableHeader = () => {
      if (!section.headers || section.headers.length === 0) return;
      doc.setFillColor(15, 23, 42);
      doc.rect(marginX, y, contentWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);

      let cx = marginX;
      section.headers.forEach((h, c) => {
        const w = colWidths[c];
        const align = section.columnAlignments?.[c] || 'left';
        const lines = doc.splitTextToSize(String(h), Math.max(8, w - 2.5));
        const textX =
          align === 'right' ? cx + w - 1.5 : align === 'center' ? cx + w / 2 : cx + 1.5;
        doc.text(lines[0] || '', textX, y + 4.7, { align });
        cx += w;
      });
      y += 7;
    };

    drawTableHeader();

    if (section.rows.length === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('No records in this section.', marginX + 2, y + 4.8);
      y += 9;
      return;
    }

    section.rows.forEach((row, rIdx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      const wrappedCols = colWidths.map((w, c) =>
        doc.splitTextToSize(String(row[c] ?? ''), Math.max(8, w - 2.5))
      );
      const maxLines = Math.max(1, ...wrappedCols.map((lines) => lines.length));
      const rowHeight = Math.max(6, maxLines * 3.4 + 2.4);

      const brokePage = ensureSpace(rowHeight + 2);
      if (brokePage) {
        drawTableHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      doc.setTextColor(30, 41, 59);
      let cx = marginX;
      wrappedCols.forEach((lines, c) => {
        const w = colWidths[c];
        const align = section.columnAlignments?.[c] || 'left';
        const textX =
          align === 'right' ? cx + w - 1.5 : align === 'center' ? cx + w / 2 : cx + 1.5;
        doc.text(lines, textX, y + 4.2, { align });
        cx += w;
      });

      y += rowHeight;
    });

    y += 6;
  });

  // Page footer numbering
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${storeName} · Commercial POS Export`,
      marginX,
      pageHeight - 6
    );
    doc.text(
      `Page ${p} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  doc.save(ensureExt(options.filename, '.pdf'));
}

/**
 * Exports full POS backup to a multi-sheet Excel workbook (.xlsx) that can be
 * viewed in Excel AND losslessly restored back into the POS.
 */
export async function exportStoreBackupToExcel(config?: StoreConfig): Promise<void> {
  const backupJson = storageService.exportBackup();
  const parsed = JSON.parse(backupJson);
  const dateStr = new Date().toISOString().slice(0, 10);

  // Split raw backup JSON cleanly into chunks below Excel's 32,767-char cell limit
  const chunkSize = 28000;
  const archiveChunks: CellValue[][] = [];
  for (let i = 0; i < backupJson.length; i += chunkSize) {
    archiveChunks.push([Math.floor(i / chunkSize) + 1, backupJson.slice(i, i + chunkSize)]);
  }

  const sheets: ExcelSheetSpec[] = [
    {
      sheetName: 'Products',
      headers: ['ID', 'SKU', 'Barcode', 'Name', 'Category', 'Cost Price', 'Selling Price', 'Stock Level', 'Reorder Point', 'Unit'],
      rows: (parsed.products || []).map((p: any) => [
        p.id,
        p.sku,
        p.barcode || '',
        p.name,
        p.category,
        Number(p.costPrice || 0),
        Number(p.sellingPrice || 0),
        Number(p.stockLevel || 0),
        Number(p.reorderThreshold ?? p.lowStockThreshold ?? 5),
        p.unit || 'pcs',
      ]),
    },
    {
      sheetName: 'Sales',
      headers: ['ID', 'Invoice #', 'Timestamp', 'Customer', 'Method', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Returned', 'Items Count'],
      rows: (parsed.sales || []).map((s: any) => [
        s.id,
        s.invoiceNumber,
        s.timestamp,
        s.customerName,
        s.paymentMethod,
        Number(s.subtotal || 0),
        Number(s.discountAmount || 0),
        Number(s.taxAmount || 0),
        Number(s.totalAmount || 0),
        Number(s.paidAmount ?? s.totalAmount ?? 0),
        s.isReturned ? 'YES' : 'NO',
        Array.isArray(s.items) ? s.items.length : 0,
      ]),
    },
    {
      sheetName: 'Customers',
      headers: ['ID', 'Name', 'Company', 'Phone', 'Email', 'Credit Balance', 'Credit Limit', 'Total Purchased'],
      rows: (parsed.customers || []).map((c: any) => [
        c.id,
        c.name,
        c.companyName || '',
        c.phone || '',
        c.email || '',
        Number(c.creditBalance || 0),
        Number(c.creditLimit || 0),
        Number(c.totalPurchased || 0),
      ]),
    },
    {
      sheetName: 'Credit_Payments',
      headers: ['ID', 'Receipt #', 'Timestamp', 'Customer', 'Amount', 'Method', 'Channel', 'External Ref'],
      rows: (parsed.creditPayments || []).map((cp: any) => [
        cp.id,
        cp.receiptNumber,
        cp.timestamp,
        cp.customerName,
        Number(cp.amount || 0),
        cp.paymentMethod,
        cp.externalChannel || '',
        cp.externalReference || '',
      ]),
    },
    {
      sheetName: 'Expenses',
      headers: ['ID', 'Date', 'Category', 'Title', 'Amount', 'Method', 'Payee', 'Receipt #'],
      rows: (parsed.expenses || []).map((e: any) => [
        e.id,
        e.date,
        e.category,
        e.title,
        Number(e.amount || 0),
        e.paymentMethod,
        e.payee || '',
        e.receiptNumber || '',
      ]),
    },
    {
      sheetName: 'Users',
      headers: ['ID', 'Full Name', 'Email', 'Role', 'Status', 'Phone'],
      rows: (parsed.users || []).map((u: any) => [
        u.id,
        u.fullName,
        u.email,
        u.role,
        u.status || 'active',
        u.phone || '',
      ]),
    },
    {
      sheetName: '_Restore_Archive',
      headers: ['Chunk', 'Payload'],
      rows: archiveChunks,
    },
  ];

  const safeStore = (config?.storeName || parsed?.config?.storeName || 'Sappy_Stationary').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  await exportSheetsToExcel(`${safeStore}_Backup_${dateStr}.xlsx`, sheets);
}

/**
 * Exports an executive Store Backup Summary in PDF format (.pdf).
 */
export async function exportStoreBackupToPdf(config?: StoreConfig): Promise<void> {
  const backupJson = storageService.exportBackup();
  const parsed = JSON.parse(backupJson);
  const storeCfg: StoreConfig = config || parsed.config;
  const cur = (storeCfg?.currencySymbol || 'Br ').trim() + ' ';
  const products = parsed.products || [];
  const sales = (parsed.sales || []).filter((s: any) => !s.isReturned);
  const customers = parsed.customers || [];
  const expenses = parsed.expenses || [];

  const totalRetailVal = products.reduce(
    (sum: number, p: any) => sum + Number(p.stockLevel || 0) * Number(p.sellingPrice || 0),
    0
  );
  const totalSalesRev = sales.reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
  const totalDebt = customers.reduce((sum: number, c: any) => sum + Number(c.creditBalance || 0), 0);
  const totalExp = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeStore = (storeCfg?.storeName || 'Sappy_Stationary').replace(/[^a-zA-Z0-9_-]/g, '_');

  await exportReportToPdf({
    filename: `${safeStore}_Store_Snapshot_${dateStr}.pdf`,
    title: 'Store Operations & Database Snapshot',
    subtitle: `Full offline summary of catalog, sales, customer credit balances, and overhead expenses as of ${dateStr}`,
    storeConfig: storeCfg,
    summaryPairs: [
      { label: 'Catalog SKUs', value: `${products.length} items` },
      { label: 'Retail Inventory Value', value: `${cur}${totalRetailVal.toFixed(2)}` },
      { label: 'Total Active Sales', value: `${cur}${totalSalesRev.toFixed(2)}` },
      { label: 'Customer Credit Debt', value: `${cur}${totalDebt.toFixed(2)}` },
    ],
    sections: [
      {
        title: `Inventory Catalog (${products.length} SKUs)`,
        headers: ['SKU', 'Product Name', 'Category', 'Stock', 'Reorder Pt', 'Price'],
        columnAlignments: ['left', 'left', 'left', 'right', 'right', 'right'],
        rows: products.slice(0, 100).map((p: any) => [
          p.sku,
          p.name,
          p.category,
          `${p.stockLevel} ${p.unit || ''}`.trim(),
          p.reorderThreshold ?? p.lowStockThreshold ?? 5,
          `${cur}${Number(p.sellingPrice || 0).toFixed(2)}`,
        ]),
      },
      {
        title: `Recent Sales Invoices (${sales.length} Active · Total ${cur}${totalSalesRev.toFixed(2)})`,
        headers: ['Invoice #', 'Date', 'Customer', 'Method', 'Total', 'Paid'],
        columnAlignments: ['left', 'left', 'left', 'center', 'right', 'right'],
        rows: sales.slice(0, 60).map((s: any) => [
          s.invoiceNumber,
          String(s.timestamp || '').slice(0, 10),
          s.customerName,
          String(s.paymentMethod || '').toUpperCase(),
          `${cur}${Number(s.totalAmount || 0).toFixed(2)}`,
          `${cur}${Number(s.paidAmount ?? s.totalAmount ?? 0).toFixed(2)}`,
        ]),
      },
      {
        title: `Customer Credit Ledger (${customers.length} Accounts)`,
        headers: ['Customer', 'Phone', 'Credit Balance', 'Credit Limit'],
        columnAlignments: ['left', 'left', 'right', 'right'],
        rows: customers.map((c: any) => [
          c.name,
          c.phone || '-',
          `${cur}${Number(c.creditBalance || 0).toFixed(2)}`,
          `${cur}${Number(c.creditLimit || 0).toFixed(2)}`,
        ]),
      },
      {
        title: `Expenses Summary (${expenses.length} Entries · Total ${cur}${totalExp.toFixed(2)})`,
        headers: ['Date', 'Category', 'Title', 'Payee', 'Amount'],
        columnAlignments: ['left', 'left', 'left', 'left', 'right'],
        rows: expenses.slice(0, 60).map((e: any) => [
          e.date,
          e.category,
          e.title,
          e.payee || '-',
          `${cur}${Number(e.amount || 0).toFixed(2)}`,
        ]),
      },
    ],
  });
}

/**
 * Restores a backup from either an exported Excel (.xlsx) backup workbook
 * or a legacy JSON (.json) backup file.
 */
export async function restoreStoreBackupFromFile(file: File): Promise<boolean> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const archiveSheet = wb.Sheets['_Restore_Archive'];
    if (archiveSheet) {
      const rows = XLSX.utils.sheet_to_json<{ Chunk?: number; Payload?: string }>(archiveSheet);
      const ordered = rows
        .slice()
        .sort((a, b) => Number(a.Chunk || 0) - Number(b.Chunk || 0))
        .map((r) => String(r.Payload || ''))
        .join('');
      if (ordered) {
        return storageService.importBackup(ordered);
      }
    }

    // Fallback: reconstruct from human-readable sheets if _Restore_Archive was edited/removed
    const productsSheet = wb.Sheets['Products'];
    if (!productsSheet) return false;
    const rawProds = XLSX.utils.sheet_to_json<Record<string, any>>(productsSheet);
    const products = rawProds.map((r, i) => ({
      id: String(r['ID'] || `prod-rest-${Date.now()}-${i}`),
      sku: String(r['SKU'] || `SKU-${i + 1}`),
      barcode: String(r['Barcode'] || ''),
      name: String(r['Name'] || 'Unnamed Item'),
      category: String(r['Category'] || 'General'),
      costPrice: Number(r['Cost Price'] || 0),
      sellingPrice: Number(r['Selling Price'] || 0),
      stockLevel: Number(r['Stock Level'] || 0),
      lowStockThreshold: Number(r['Reorder Point'] || 5),
      reorderThreshold: Number(r['Reorder Point'] || 5),
      unit: String(r['Unit'] || 'pcs'),
    }));
    return storageService.importBackup(JSON.stringify({ products }));
  }

  const text = await file.text();
  return storageService.importBackup(text);
}

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { Product, ProductCategory, StoreConfig } from '../types/pos.ts';
import { storageService } from './storageService.ts';

// Set up pdf.js worker URL for client-side execution in Vite
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  } catch {
    // Worker fallback
  }
}

export const VALID_CATEGORIES: ProductCategory[] = [
  'Writing & Pens',
  'Paper & Notebooks',
  'Desk & Office',
  'Filing & Folders',
  'Art & Craft',
  'School & Math',
  'Printing & Services',
  'General',
];

const SAMPLE_TEMPLATE_ROWS = [
  {
    sku: 'STN-1001',
    barcode: '890123001001',
    name: 'Spiral Notebook A4 (200 Pages, Ruled)',
    category: 'Paper & Notebooks',
    costPrice: 75.0,
    sellingPrice: 110.0,
    stockLevel: 45,
    lowStockThreshold: 10,
    unit: 'pcs',
    description: 'Durable hardcover spiral binding for school and office',
  },
  {
    sku: 'STN-1002',
    barcode: '890123001002',
    name: 'Ballpoint Pens Blue (Pack of 10)',
    category: 'Writing & Pens',
    costPrice: 90.0,
    sellingPrice: 135.0,
    stockLevel: 60,
    lowStockThreshold: 15,
    unit: 'pack',
    description: '0.7mm smooth oil-based blue ink pens',
  },
  {
    sku: 'STN-1003',
    barcode: '890123001003',
    name: 'All-Metal Desk Stapler (24/6 & 26/6)',
    category: 'Desk & Office',
    costPrice: 210.0,
    sellingPrice: 310.0,
    stockLevel: 14,
    lowStockThreshold: 4,
    unit: 'pcs',
    description: 'Capacity up to 25 sheets, includes staples box',
  },
  {
    sku: 'STN-1004',
    barcode: '890123001004',
    name: 'Lever Arch Box File (75mm Spine, A4)',
    category: 'Filing & Folders',
    costPrice: 130.0,
    sellingPrice: 195.0,
    stockLevel: 30,
    lowStockThreshold: 8,
    unit: 'pcs',
    description: 'Heavyboard cardboard with metal corner protectors',
  },
  {
    sku: 'STN-1005',
    barcode: '890123001005',
    name: 'Fluorescent Highlighter Set (4 Colors)',
    category: 'Writing & Pens',
    costPrice: 85.0,
    sellingPrice: 130.0,
    stockLevel: 35,
    lowStockThreshold: 8,
    unit: 'set',
    description: 'Yellow, pink, green, orange chisel tip markers',
  },
  {
    sku: 'STN-1006',
    barcode: '890123001006',
    name: 'Scientific Calculator (240 Functions)',
    category: 'School & Math',
    costPrice: 520.0,
    sellingPrice: 780.0,
    stockLevel: 6,
    lowStockThreshold: 3,
    unit: 'pcs',
    description: 'Two-line display college scientific calculator',
  },
  {
    sku: 'STN-1007',
    barcode: '890123001007',
    name: 'Colored Construction Paper Pack (50 Sheets)',
    category: 'Art & Craft',
    costPrice: 115.0,
    sellingPrice: 175.0,
    stockLevel: 25,
    lowStockThreshold: 5,
    unit: 'pack',
    description: '10 assorted vivid colors for craft and presentations',
  },
];

/**
 * Normalizes text to best matching ProductCategory
 */
function normalizeCategory(raw: string): ProductCategory {
  if (!raw) return 'General';
  const clean = raw.trim().toLowerCase();
  for (const cat of VALID_CATEGORIES) {
    if (cat.toLowerCase() === clean) return cat;
  }
  if (clean.includes('pen') || clean.includes('writ') || clean.includes('pencil') || clean.includes('marker')) {
    return 'Writing & Pens';
  }
  if (clean.includes('paper') || clean.includes('note') || clean.includes('pad') || clean.includes('ream')) {
    return 'Paper & Notebooks';
  }
  if (clean.includes('desk') || clean.includes('office') || clean.includes('staple') || clean.includes('tape')) {
    return 'Desk & Office';
  }
  if (clean.includes('file') || clean.includes('folder') || clean.includes('binder')) {
    return 'Filing & Folders';
  }
  if (clean.includes('art') || clean.includes('craft') || clean.includes('color') || clean.includes('paint')) {
    return 'Art & Craft';
  }
  if (clean.includes('school') || clean.includes('math') || clean.includes('geometry') || clean.includes('calc')) {
    return 'School & Math';
  }
  if (clean.includes('print') || clean.includes('service') || clean.includes('laminat')) {
    return 'Printing & Services';
  }
  return 'General';
}

/**
 * Generates and triggers download of Excel Template (.xlsx)
 */
export function downloadExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Products Data Template
  const headers = [
    'SKU',
    'Barcode',
    'Product Name',
    'Category',
    'Wholesale Cost (Br)',
    'Retail Selling Price (Br)',
    'Current Stock',
    'Minimum Stock Threshold',
    'Unit',
    'Description',
  ];

  const dataRows = SAMPLE_TEMPLATE_ROWS.map((r) => [
    r.sku,
    r.barcode,
    r.name,
    r.category,
    r.costPrice,
    r.sellingPrice,
    r.stockLevel,
    r.lowStockThreshold,
    r.unit,
    r.description,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // SKU
    { wch: 16 }, // Barcode
    { wch: 38 }, // Name
    { wch: 20 }, // Category
    { wch: 18 }, // Wholesale Cost
    { wch: 22 }, // Retail Price
    { wch: 14 }, // Stock
    { wch: 24 }, // Min Threshold
    { wch: 10 }, // Unit
    { wch: 45 }, // Description
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Products_Import');

  // Sheet 2: Categories Guide
  const catHeaders = ['Allowed Category Name', 'Sample Stationary Items'];
  const catData = [
    ['Writing & Pens', 'Ballpoint pens, gel pens, highlighters, pencils, whiteboard markers'],
    ['Paper & Notebooks', 'A4 ruled notebooks, copy paper reams, sticky notes, ledger books'],
    ['Desk & Office', 'Staplers, hole punchers, scissors, paperclips, tape dispensers'],
    ['Filing & Folders', 'Box files, display files, clip folders, envelope folders'],
    ['Art & Craft', 'Colored markers, sketchpads, glue sticks, modeling clay, construction paper'],
    ['School & Math', 'Scientific calculators, geometry sets, mathematical compass, erasers'],
    ['Printing & Services', 'Lamination pouches, binding combs, ID card holders'],
    ['General', 'Miscellaneous stationery and accessories'],
  ];

  const catWs = XLSX.utils.aoa_to_sheet([catHeaders, ...catData]);
  catWs['!cols'] = [{ wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, catWs, 'Categories_Reference');

  // Trigger download
  XLSX.writeFile(wb, 'Sappy_Stationery_Inventory_Template.xlsx');
}

/**
 * Generates and triggers download of PDF Template & Printable Spec Sheet (.pdf)
 */
export function downloadPdfTemplate(storeConfig?: StoreConfig): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const currency = storeConfig?.currencySymbol?.trim() || 'Br';
  const storeName = storeConfig?.storeName || 'Sappy Stationary';

  // Background Header
  doc.setFillColor(18, 20, 23); // Charcoal 950
  doc.rect(0, 0, 210, 36, 'F');

  // Brand Accent Line
  doc.setFillColor(45, 106, 79); // Forest 600
  doc.rect(0, 35, 210, 2.5, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName.toUpperCase(), 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(116, 198, 157); // Forest 300
  doc.text('BULK INVENTORY IMPORT TEMPLATE & FORMAT SPECIFICATION', 14, 23);

  doc.setFontSize(8);
  doc.setTextColor(170, 180, 190);
  doc.text(`Official specification guide for Excel (.xlsx/.csv) and PDF document imports. Currency: ${currency} (ETB)`, 14, 30);

  // Section 1: Required Columns & Layout
  doc.setTextColor(20, 25, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Required Data Columns & Header Names', 14, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 70, 80);
  const columnExplanations = [
    '• SKU: Unique product code (e.g., STN-0101). Required.',
    '• Barcode: 8-13 digit EAN/UPC or alphanumeric code. Optional (auto-generated if empty).',
    '• Product Name: Full descriptive title of the stationery item. Required.',
    '• Category: One of the 8 approved stationery categories listed below.',
    `• Wholesale Cost: Unit buying or wholesale cost price in ${currency}. For COGS & profit calculation.`,
    `• Retail Selling Price: Final sales price to customer in ${currency}. Required.`,
    '• Current Stock: Initial stock quantity available on shelf. Required integer.',
    '• Minimum Stock Threshold: Stock reorder level. Warning badge triggers if stock drops to or below this level.',
    '• Unit: Measure of unit (pcs, pack, box, ream, set, roll, dozen).',
    '• Description: Optional specifications, dimensions, color, manufacturer details.',
  ];

  let y = 52;
  columnExplanations.forEach((line) => {
    doc.text(line, 14, y);
    y += 5.2;
  });

  // Section 2: Approved Categories
  y += 4;
  doc.setTextColor(20, 25, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Approved Product Categories', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 60);

  const categoriesLeft = VALID_CATEGORIES.slice(0, 4);
  const categoriesRight = VALID_CATEGORIES.slice(4);

  categoriesLeft.forEach((cat, idx) => {
    doc.text(`[✓]  ${cat}`, 16, y + idx * 5);
  });
  categoriesRight.forEach((cat, idx) => {
    doc.text(`[✓]  ${cat}`, 110, y + idx * 5);
  });
  y += 24;

  // Section 3: Sample Product Table
  doc.setTextColor(20, 25, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. Sample Table Format (Accepted by PDF / Excel Parser)', 14, y);
  y += 5;

  // Table Header Box
  doc.setFillColor(30, 40, 35);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  doc.text('SKU', 16, y + 5);
  doc.text('Product Name', 40, y + 5);
  doc.text('Category', 96, y + 5);
  doc.text(`Cost (${currency})`, 134, y + 5);
  doc.text(`Price (${currency})`, 155, y + 5);
  doc.text('Stock', 178, y + 5);
  doc.text('Min', 190, y + 5);
  y += 7;

  // Table Sample Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  SAMPLE_TEMPLATE_ROWS.slice(0, 7).forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(245, 248, 246);
      doc.rect(14, y, 182, 6, 'F');
    }
    doc.setTextColor(30, 40, 50);
    doc.text(item.sku, 16, y + 4.2);
    doc.text(item.name.length > 32 ? item.name.slice(0, 31) + '…' : item.name, 40, y + 4.2);
    doc.text(item.category, 96, y + 4.2);
    doc.text(`${item.costPrice.toFixed(2)}`, 136, y + 4.2);
    doc.text(`${item.sellingPrice.toFixed(2)}`, 157, y + 4.2);
    doc.text(`${item.stockLevel} ${item.unit}`, 178, y + 4.2);
    doc.text(`${item.lowStockThreshold}`, 190, y + 4.2);
    y += 6;
  });

  // Footer Instructions
  y += 8;
  doc.setFillColor(240, 245, 242);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'F');
  doc.setDrawColor(45, 106, 79);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'S');

  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('How to Upload Your Product Catalog:', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 60, 50);
  doc.text('1. Fill your stationery inventory in Excel (.xlsx / .csv) or export your price list / invoice as PDF.', 18, y + 11);
  doc.text('2. In Sappy Stationary POS, open the Inventory Tab and click "Bulk Import".', 18, y + 15);
  doc.text('3. Upload your file. Review the instant preview of parsed items, then click "Confirm & Import".', 18, y + 19);

  // Bottom Notice
  doc.setFontSize(7);
  doc.setTextColor(140, 150, 160);
  doc.text(`Generated by Sappy Stationary POS • ${new Date().toLocaleDateString()}`, 14, 288);

  doc.save('Sappy_Stationery_Inventory_Template.pdf');
}

/**
 * Parses Excel (.xlsx, .xls, .csv) into Product objects
 */
export async function parseExcelFile(file: File): Promise<{ products: Product[]; errors: string[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { products: [], errors: ['No sheet found in uploaded Excel file.'] };
  }

  const ws = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { products: [], errors: ['Excel sheet is empty or contains no product rows.'] };
  }

  const products: Product[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    // Flexible header mapping (case-insensitive & trimmed)
    const normalizedRow: Record<string, any> = {};
    Object.keys(row).forEach((key) => {
      const cleanKey = key.trim().toLowerCase();
      normalizedRow[cleanKey] = row[key];
    });

    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        if (normalizedRow[k.toLowerCase()] !== undefined && normalizedRow[k.toLowerCase()] !== '') {
          return normalizedRow[k.toLowerCase()];
        }
      }
      return '';
    };

    const name = String(getVal('product name', 'name', 'item name', 'product', 'title', 'item')).trim();
    if (!name) {
      errors.push(`Row ${idx + 2}: Skipped because Product Name is missing.`);
      return;
    }

    const count = idx + 1;
    const defaultSku = `STN-${String(count).padStart(4, '0')}`;
    const defaultBarcode = `890123${String(count).padStart(6, '0')}`;

    const sku = String(getVal('sku', 'sku code', 'code', 'item code') || defaultSku).trim();
    const barcode = String(getVal('barcode', 'upc', 'ean', 'bar code') || defaultBarcode).trim();
    const categoryRaw = String(getVal('category', 'dept', 'department', 'type') || 'General');
    const category = normalizeCategory(categoryRaw);

    const costPrice = parseFloat(String(getVal('wholesale cost (br)', 'wholesale cost', 'cost price', 'cost', 'buying price'))) || 0;
    const sellingPrice = parseFloat(String(getVal('retail selling price (br)', 'retail selling price', 'selling price', 'retail price', 'price', 'sales price'))) || (costPrice > 0 ? costPrice * 1.4 : 10);
    const stockLevel = parseInt(String(getVal('current stock', 'stock level', 'stock', 'quantity', 'qty')), 10) || 0;
    const lowStockThreshold = parseInt(String(getVal('minimum stock threshold', 'min stock', 'low stock warning at', 'threshold', 'reorder level')), 10) || 5;
    const unit = String(getVal('unit', 'sale unit', 'uom') || 'pcs').trim().toLowerCase();
    const description = String(getVal('description', 'desc', 'notes', 'details') || '').trim();

    products.push({
      id: `prod-import-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      sku,
      barcode,
      name,
      category,
      costPrice: Math.max(0, costPrice),
      sellingPrice: Math.max(0, sellingPrice),
      stockLevel: Math.max(0, stockLevel),
      lowStockThreshold: Math.max(1, lowStockThreshold),
      unit: unit || 'pcs',
      description,
      updatedAt: new Date().toISOString(),
    });
  });

  return { products, errors };
}

/**
 * Parses PDF Document (.pdf) into Product objects
 */
export async function parsePdfFile(file: File): Promise<{ products: Product[]; errors: string[] }> {
  try {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;

    const allLines: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group text items by vertical position (Y)
      const linesMap = new Map<number, { x: number; text: string }[]>();
      
      textContent.items.forEach((item: any) => {
        if (!item.str || !item.str.trim()) return;
        // Round Y to nearest 2 pixels to group items on same line
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!linesMap.has(y)) {
          linesMap.set(y, []);
        }
        linesMap.get(y)!.push({ x: item.transform[4], text: item.str });
      });

      // Sort lines top to bottom (PDF coordinates Y decreases downward)
      const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);

      sortedYs.forEach((y) => {
        const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
        const lineStr = lineItems.map((i) => i.text.trim()).join('   ');
        if (lineStr.trim()) {
          allLines.push(lineStr);
        }
      });
    }

    if (allLines.length === 0) {
      return { products: [], errors: ['No readable text found in PDF. Make sure it is not an image-only scan.'] };
    }

    const products: Product[] = [];
    const errors: string[] = [];

    // Filter out header lines, notices, and instructions
    const candidateLines = allLines.filter((l) => {
      const lower = l.toLowerCase();
      if (lower.includes('sku') && lower.includes('product name')) return false;
      if (lower.includes('sappy stationary') || lower.includes('bulk inventory import')) return false;
      if (lower.includes('approved product categories') || lower.includes('how to upload')) return false;
      if (lower.includes('generated by') || lower.includes('official specification')) return false;
      if (lower.startsWith('•') || lower.startsWith('[✓]')) return false;
      return true;
    });

    candidateLines.forEach((line, idx) => {
      // Check if line contains numbers (like prices and quantities)
      const numbers = line.match(/\b\d+(\.\d+)?\b/g);
      if (!numbers || numbers.length < 2) {
        // Not a data row
        return;
      }

      // Try CSV/delimiter split or multi-space split
      let tokens: string[] = [];
      if (line.includes(',')) {
        tokens = line.split(',').map((t) => t.trim());
      } else if (line.includes('\t')) {
        tokens = line.split('\t').map((t) => t.trim());
      } else {
        tokens = line.split(/\s{2,}/).map((t) => t.trim());
      }

      tokens = tokens.filter((t) => t.length > 0);

      if (tokens.length >= 3) {
        // Try structured token extraction
        let sku = '';
        let name = '';
        let category: ProductCategory = 'General';
        let costPrice = 0;
        let sellingPrice = 0;
        let stockLevel = 10;
        let lowStockThreshold = 5;
        let unit = 'pcs';

        // Check first token for SKU pattern
        if (tokens[0].match(/^[a-zA-Z0-9_-]{3,15}$/)) {
          sku = tokens[0];
          name = tokens[1];
        } else {
          sku = `STN-${String(products.length + 1).padStart(4, '0')}`;
          name = tokens[0];
        }

        // Search tokens for category
        for (const token of tokens) {
          for (const cat of VALID_CATEGORIES) {
            if (token.toLowerCase().includes(cat.toLowerCase())) {
              category = cat;
              break;
            }
          }
        }

        // Extract numeric prices and stock from tokens
        const numValues = tokens
          .map((t) => parseFloat(t.replace(/[^0-9.]/g, '')))
          .filter((n) => !isNaN(n) && n > 0);

        if (numValues.length >= 2) {
          if (numValues.length >= 4) {
            costPrice = numValues[0];
            sellingPrice = numValues[1];
            stockLevel = Math.round(numValues[2]);
            lowStockThreshold = Math.round(numValues[3]);
          } else if (numValues.length === 3) {
            costPrice = numValues[0];
            sellingPrice = numValues[1];
            stockLevel = Math.round(numValues[2]);
          } else {
            sellingPrice = numValues[0];
            costPrice = Math.round(sellingPrice * 0.7);
            stockLevel = Math.round(numValues[1]);
          }
        } else if (numValues.length === 1) {
          sellingPrice = numValues[0];
          costPrice = Math.round(sellingPrice * 0.7);
        }

        // Detect unit
        for (const token of tokens) {
          const lowerToken = token.toLowerCase();
          if (['pcs', 'pack', 'box', 'ream', 'set', 'roll', 'dozen'].includes(lowerToken)) {
            unit = lowerToken;
            break;
          }
        }

        if (name && name.length >= 2) {
          products.push({
            id: `prod-pdf-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            sku,
            barcode: `890123${String(products.length + 1).padStart(6, '0')}`,
            name,
            category,
            costPrice: Math.max(0, costPrice),
            sellingPrice: Math.max(0, sellingPrice),
            stockLevel: Math.max(0, stockLevel),
            lowStockThreshold: Math.max(1, lowStockThreshold),
            unit,
            description: 'Imported from PDF document',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    if (products.length === 0) {
      errors.push('Could not detect product rows in PDF. Try using the Excel template or ensuring data is formatted in tabular rows.');
    }

    return { products, errors };
  } catch (err: any) {
    return {
      products: [],
      errors: [`PDF parsing failed: ${err.message || 'Ensure valid PDF file'}`],
    };
  }
}

/**
 * Saves imported products to storage
 */
export function saveBulkProducts(
  newProducts: Product[],
  mode: 'append' | 'replace' = 'append'
): { added: number; updated: number; total: number } {
  const existing = storageService.getProducts();

  if (mode === 'replace') {
    // Replace whole catalog
    newProducts.forEach((p) => storageService.saveProduct(p));
    return { added: newProducts.length, updated: 0, total: newProducts.length };
  }

  // Append & update existing by SKU
  let added = 0;
  let updated = 0;

  newProducts.forEach((newP) => {
    const existingIndex = existing.findIndex(
      (e) => e.sku.toLowerCase() === newP.sku.toLowerCase() || (newP.barcode && e.barcode === newP.barcode)
    );

    if (existingIndex >= 0) {
      // Update existing product
      storageService.saveProduct({
        ...existing[existingIndex],
        ...newP,
        id: existing[existingIndex].id, // Keep original ID
        updatedAt: new Date().toISOString(),
      });
      updated++;
    } else {
      // Add new
      storageService.saveProduct(newP);
      added++;
    }
  });

  const total = storageService.getProducts().length;
  return { added, updated, total };
}

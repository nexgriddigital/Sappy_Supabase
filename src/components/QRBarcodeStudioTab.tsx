import React, { useState, useMemo, useRef } from 'react';
import {
  Barcode,
  QrCode,
  Printer,
  Download,
  Search,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Scan,
} from 'lucide-react';
import { Product, StoreConfig } from '../types/pos.ts';
import { generateBarcodeSvgPath, generateQrMatrix } from '../utils/barcodeGenerator.ts';

interface QRBarcodeStudioTabProps {
  products: Product[];
  config: StoreConfig;
}

export type CodeFormat = 'barcode' | 'qr' | 'both';

export interface LabelItem {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  format: CodeFormat;
  copies: number;
}

interface PaperTemplate {
  id: string;
  name: string;
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  isSheet: boolean;
}

const PAPER_TEMPLATES: PaperTemplate[] = [
  {
    id: 'a4_30up',
    name: 'A4 Sheet — 30 Labels (3 x 10, 70mm x 29.7mm)',
    cols: 3,
    rows: 10,
    labelWidthMm: 70,
    labelHeightMm: 29.7,
    isSheet: true,
  },
  {
    id: 'a4_24up',
    name: 'A4 Sheet — 24 Labels (3 x 8, 70mm x 37mm)',
    cols: 3,
    rows: 8,
    labelWidthMm: 70,
    labelHeightMm: 37,
    isSheet: true,
  },
  {
    id: 'a4_21up',
    name: 'A4 Sheet — 21 Labels (3 x 7, 63.5mm x 38.1mm)',
    cols: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    isSheet: true,
  },
  {
    id: 'a4_40up',
    name: 'A4 Sheet — 40 Labels (4 x 10, 52.5mm x 29.7mm)',
    cols: 4,
    rows: 10,
    labelWidthMm: 52.5,
    labelHeightMm: 29.7,
    isSheet: true,
  },
  {
    id: 'thermal_50x30',
    name: 'Continuous Thermal Roll — 50mm x 30mm',
    cols: 1,
    rows: 1,
    labelWidthMm: 50,
    labelHeightMm: 30,
    isSheet: false,
  },
  {
    id: 'thermal_40x25',
    name: 'Continuous Thermal Roll — 40mm x 25mm',
    cols: 1,
    rows: 1,
    labelWidthMm: 40,
    labelHeightMm: 25,
    isSheet: false,
  },
];

export const QRBarcodeStudioTab: React.FC<QRBarcodeStudioTabProps> = ({
  products,
  config,
}) => {
  // Initialize queued items: either from initial products or sample stationery labels
  const [queuedItems, setQueuedItems] = useState<LabelItem[]>(() => {
    if (products.length >= 3) {
      return products.slice(0, 3).map((p) => ({
        id: `queue-${p.id}`,
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        price: p.sellingPrice,
        format: 'barcode',
        copies: 4,
      }));
    }
    // High-fidelity fallback sample if catalog was just wiped
    return [
      {
        id: 'q-sample-1',
        name: '2B Pencil Lead (Long) 0.5mm',
        sku: 'SAP-LEA-1001',
        barcode: 'SAP-LEA-1001',
        price: 80,
        format: 'barcode',
        copies: 4,
      },
      {
        id: 'q-sample-2',
        name: '2B Pencil Lead (Long) 0.7mm',
        sku: 'SAP-LEA-1002',
        barcode: 'SAP-LEA-1002',
        price: 80,
        format: 'barcode',
        copies: 4,
      },
      {
        id: 'q-sample-3',
        name: '3-Subject Notebook',
        sku: 'SAP-NOT-1003',
        barcode: 'SAP-NOT-1003',
        price: 450,
        format: 'barcode',
        copies: 4,
      },
    ];
  });

  // Paper & Template Settings
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('a4_30up');
  const [includeStoreName, setIncludeStoreName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeProductName, setIncludeProductName] = useState(true);
  const [includeSkuCode, setIncludeSkuCode] = useState(true);

  // Quick Add Product state
  const [quickSearch, setQuickSearch] = useState('');
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Custom Label Entry state
  const [customTitle, setCustomTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customFormat, setCustomFormat] = useState<CodeFormat>('barcode');

  // Product Selection Modal state
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelectedIds, setModalSelectedIds] = useState<Set<string>>(new Set());

  // Pagination for Sheet preview
  const [activeSheetPage, setActiveSheetPage] = useState(0);

  const currentTemplate = useMemo(
    () => PAPER_TEMPLATES.find((t) => t.id === selectedTemplateId) || PAPER_TEMPLATES[0],
    [selectedTemplateId]
  );

  // Expand queued items into flat list of individual stickers
  const expandedStickers = useMemo(() => {
    const list: LabelItem[] = [];
    queuedItems.forEach((item) => {
      for (let i = 0; i < item.copies; i++) {
        list.push(item);
      }
    });
    return list;
  }, [queuedItems]);

  const totalStickers = expandedStickers.length;
  const labelsPerSheet = currentTemplate.cols * currentTemplate.rows;
  const totalSheets = Math.max(1, Math.ceil(totalStickers / labelsPerSheet));

  // Current sheet's stickers
  const currentSheetStickers = useMemo(() => {
    const start = activeSheetPage * labelsPerSheet;
    return expandedStickers.slice(start, start + labelsPerSheet);
  }, [expandedStickers, activeSheetPage, labelsPerSheet]);

  // Quick search filtered catalog
  const filteredCatalog = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.toLowerCase().trim();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, quickSearch]);

  // Add catalog product to queue
  const handleAddProductToQueue = (product: Product, defaultCopies: number = 4) => {
    setQueuedItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, copies: item.copies + defaultCopies } : item
        );
      }
      return [
        ...prev,
        {
          id: `queue-${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || product.sku,
          price: product.sellingPrice,
          format: 'barcode',
          copies: defaultCopies,
        },
      ];
    });
    setQuickSearch('');
    setIsQuickSearchOpen(false);
  };

  // Add custom manual label
  const handleAddCustomLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() && !customCode.trim()) return;

    const labelName = customTitle.trim() || 'Custom Stationery Item';
    const labelCode = customCode.trim() || `CUST-${Date.now().toString().slice(-6)}`;
    const labelPrice = parseFloat(customPrice) || 0;

    setQueuedItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: labelName,
        sku: labelCode,
        barcode: labelCode,
        price: labelPrice,
        format: customFormat,
        copies: 4,
      },
    ]);

    setCustomTitle('');
    setCustomCode('');
    setCustomPrice('');
  };

  // Batch Copies
  const handleBatchCopies = (copies: number | 'stock') => {
    setQueuedItems((prev) =>
      prev.map((item) => {
        if (copies === 'stock' && item.productId) {
          const prod = products.find((p) => p.id === item.productId);
          return { ...item, copies: Math.max(1, prod ? prod.stockLevel : 1) };
        }
        return { ...item, copies: typeof copies === 'number' ? copies : 1 };
      })
    );
  };

  // Batch Format
  const handleBatchFormat = (format: CodeFormat) => {
    setQueuedItems((prev) => prev.map((item) => ({ ...item, format })));
  };

  // Select All Catalog
  const handleSelectAllCatalog = () => {
    if (products.length === 0) return;
    const newQueue: LabelItem[] = products.map((p) => ({
      id: `queue-${p.id}`,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || p.sku,
      price: p.sellingPrice,
      format: 'barcode',
      copies: 4,
    }));
    setQueuedItems(newQueue);
  };

  // Select Low Stock
  const handleSelectLowStock = () => {
    const lowStock = products.filter((p) => p.stockLevel <= p.lowStockThreshold);
    if (lowStock.length === 0) return;
    const newQueue: LabelItem[] = lowStock.map((p) => ({
      id: `queue-${p.id}`,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || p.sku,
      price: p.sellingPrice,
      format: 'barcode',
      copies: Math.max(1, p.lowStockThreshold - p.stockLevel + 2),
    }));
    setQueuedItems(newQueue);
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Export PDF (Trigger browser Print to PDF with pre-calibrated stylesheet)
  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="flex-1 w-full bg-charcoal-950 text-charcoal-100 min-h-screen flex flex-col font-sans selection:bg-forest-700 selection:text-white">
      
      {/* ========================================================================= */}
      {/* TOP HEADER BAR */}
      {/* ========================================================================= */}
      <header className="no-print bg-charcoal-900 border-b border-charcoal-800 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-forest-900/80 text-forest-300 border border-forest-600/50 flex items-center justify-center shadow-xs">
            <Barcode className="w-5 h-5 text-forest-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Barcode & QR Studio
              </h1>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-forest-950 text-forest-300 border border-forest-700/60">
                {queuedItems.length} Items
              </span>
            </div>
            <p className="text-[11px] text-charcoal-400">
              Design and batch print retail barcode & QR stickers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsSelectModalOpen(true)}
            className="px-3 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-charcoal-700 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-forest-400" />
            <span>Select Items</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-forest-300 hover:text-forest-200 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-forest-700/60 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-forest-600/50 active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* WORKSPACE: LEFT CONFIG PANEL + RIGHT INTERACTIVE SHEET CANVAS */}
      {/* ========================================================================= */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN: Controls & Queue (Approx 4.5 cols, scrollable) */}
        {/* ----------------------------------------------------------------------- */}
        <aside className="no-print lg:col-span-4 xl:col-span-4 bg-charcoal-900 border-r border-charcoal-800 p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-65px)]">
          
          {/* Card 1: SELECT ITEMS TO GENERATE */}
          <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-forest-400 tracking-wider uppercase flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-forest-400" />
                <span>Select Items to Generate</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forest-950 text-forest-300 border border-forest-800">
                {products.length} In Catalog
              </span>
            </div>

            <p className="text-[11px] text-charcoal-400 leading-relaxed">
              Pick multiple products, customize label copies, and choose Barcode (1D) or QR Code formats.
            </p>

            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="w-full py-2.5 px-3 bg-forest-950/70 hover:bg-forest-900 border border-forest-700 text-forest-200 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-forest-400" />
              <span>Browse & Select Items ({queuedItems.length} queued)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSelectAllCatalog}
                disabled={products.length === 0}
                className="py-1.5 px-2 bg-charcoal-900 hover:bg-charcoal-850 text-charcoal-300 hover:text-white border border-charcoal-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                + Select All Catalog
              </button>
              <button
                onClick={handleSelectLowStock}
                disabled={products.length === 0}
                className="py-1.5 px-2 bg-charcoal-900 hover:bg-charcoal-850 text-charcoal-300 hover:text-white border border-charcoal-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                + Select Low-Stock
              </button>
            </div>
          </div>

          {/* Card 2: Quick Add Single Product */}
          <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 p-3.5 space-y-2 relative">
            <label className="block text-xs font-bold text-charcoal-300">
              Quick Add Single Product
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-charcoal-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, SKU, or code..."
                value={quickSearch}
                onChange={(e) => {
                  setQuickSearch(e.target.value);
                  setIsQuickSearchOpen(true);
                }}
                onFocus={() => setIsQuickSearchOpen(true)}
                className="w-full pl-8 pr-3 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs text-white placeholder-charcoal-500 focus:outline-hidden focus:border-forest-500"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {isQuickSearchOpen && filteredCatalog.length > 0 && (
              <div className="absolute left-3.5 right-3.5 top-full mt-1 bg-charcoal-900 border border-charcoal-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto divide-y divide-charcoal-800">
                {filteredCatalog.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleAddProductToQueue(prod, 4)}
                    className="w-full text-left p-2.5 hover:bg-forest-950/60 flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  >
                    <div className="truncate pr-2">
                      <p className="font-semibold text-white group-hover:text-forest-300 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-charcoal-400 font-mono">
                        {prod.sku} • Stock: {prod.stockLevel}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-forest-400 shrink-0">
                      {config.currencySymbol}{prod.sellingPrice.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Or Custom Label Entry */}
          <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-charcoal-300">
                Or Custom Label Entry
              </span>
              <button
                type="button"
                onClick={() => {
                  const sampleCode = `SAP-${Date.now().toString().slice(-4)}`;
                  setCustomTitle('Custom Binding / Service');
                  setCustomCode(sampleCode);
                  setCustomPrice('50.00');
                }}
                className="text-[10px] font-semibold text-forest-400 hover:text-forest-300 flex items-center gap-1 cursor-pointer"
              >
                <Scan className="w-3 h-3" />
                <span>Scan Code</span>
              </button>
            </div>

            <form onSubmit={handleAddCustomLabel} className="space-y-2">
              <input
                type="text"
                placeholder="Label Title (e.g. Spiral Binding 10mm)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
              />

              <input
                type="text"
                placeholder="Barcode or QR data value..."
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs font-mono text-white placeholder-charcoal-500 focus:border-forest-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs font-mono text-white placeholder-charcoal-500 focus:border-forest-500"
                />

                <select
                  value={customFormat}
                  onChange={(e) => setCustomFormat(e.target.value as CodeFormat)}
                  className="w-full px-2 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs text-white font-medium focus:border-forest-500 cursor-pointer"
                >
                  <option value="barcode">Barcode (1D)</option>
                  <option value="qr">QR Code</option>
                  <option value="both">Both (1D & QR)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-lg border border-charcoal-700 transition-colors cursor-pointer"
              >
                Add Custom Code to Queue
              </button>
            </form>
          </div>

          {/* Card 4: Paper & Sticker Dimensions */}
          <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 p-3.5 space-y-3">
            <label className="block text-xs font-bold text-charcoal-300">
              Paper & Sticker Dimensions
            </label>

            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setActiveSheetPage(0);
              }}
              className="w-full px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs text-white font-medium focus:border-forest-500 cursor-pointer"
            >
              {PAPER_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-300 select-none">
                <input
                  type="checkbox"
                  checked={includeStoreName}
                  onChange={(e) => setIncludeStoreName(e.target.checked)}
                  className="rounded border-charcoal-700 bg-charcoal-900 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Store Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-300 select-none">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded border-charcoal-700 bg-charcoal-900 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Selling Price</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-300 select-none">
                <input
                  type="checkbox"
                  checked={includeProductName}
                  onChange={(e) => setIncludeProductName(e.target.checked)}
                  className="rounded border-charcoal-700 bg-charcoal-900 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Product Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-300 select-none">
                <input
                  type="checkbox"
                  checked={includeSkuCode}
                  onChange={(e) => setIncludeSkuCode(e.target.checked)}
                  className="rounded border-charcoal-700 bg-charcoal-900 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>SKU Code</span>
              </label>
            </div>
          </div>

          {/* Card 5: Queued Items List */}
          <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white">
                  Queued Items ({queuedItems.length} items / {totalStickers} stickers)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={() => setIsSelectModalOpen(true)}
                  className="text-forest-400 hover:text-forest-300 font-semibold cursor-pointer"
                >
                  Edit Selection
                </button>
                <span className="text-charcoal-600">|</span>
                <button
                  onClick={() => setQueuedItems([])}
                  className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Batch Controls */}
            <div className="space-y-1.5 pt-1 border-t border-charcoal-800">
              <div className="flex items-center justify-between text-xs text-charcoal-400">
                <span className="text-[11px] font-semibold">Batch Copies:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 4, 'Stock' as const].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleBatchCopies(c === 'Stock' ? 'stock' : c)}
                      className="px-2 py-0.5 bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-300 hover:text-white rounded border border-charcoal-700 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-charcoal-400">
                <span className="text-[11px] font-semibold">Batch Format:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'barcode' as const, label: 'Barcode' },
                    { id: 'qr' as const, label: 'QR' },
                    { id: 'both' as const, label: 'Both' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleBatchFormat(f.id)}
                      className="px-2 py-0.5 bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-300 hover:text-white rounded border border-charcoal-700 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {queuedItems.length === 0 ? (
                <div className="p-4 text-center text-charcoal-500 text-xs">
                  No items queued. Add from catalog or custom input above.
                </div>
              ) : (
                queuedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-charcoal-900 border border-charcoal-800 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-charcoal-400 font-mono">
                          {item.sku} • {item.price.toFixed(2)} {config.currencyCode}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setQueuedItems((prev) => prev.filter((i) => i.id !== item.id))
                        }
                        className="text-charcoal-500 hover:text-rose-400 p-1 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-charcoal-800/60">
                      {/* Format Pills */}
                      <div className="flex items-center gap-0.5 bg-charcoal-950 p-0.5 rounded border border-charcoal-800 text-[10px] font-semibold">
                        {(['barcode', 'qr', 'both'] as CodeFormat[]).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() =>
                              setQueuedItems((prev) =>
                                prev.map((i) => (i.id === item.id ? { ...i, format: fmt } : i))
                              )
                            }
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer capitalize ${
                              item.format === fmt
                                ? 'bg-forest-800 text-white font-bold'
                                : 'text-charcoal-400 hover:text-white'
                            }`}
                          >
                            {fmt === 'barcode' ? 'Bar' : fmt === 'qr' ? 'QR' : 'Both'}
                          </button>
                        ))}
                      </div>

                      {/* Copies Input */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-charcoal-400">Copies:</span>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={item.copies}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setQueuedItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, copies: Math.max(1, val) } : i))
                            );
                          }}
                          className="w-12 px-1.5 py-0.5 bg-charcoal-950 border border-charcoal-700 rounded text-center text-xs font-mono text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Sticky Action Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-2 sticky bottom-0 bg-charcoal-900 pb-2">
            <button
              onClick={handleExportPdf}
              className="py-2.5 bg-charcoal-950 hover:bg-charcoal-800 text-forest-300 font-bold text-xs rounded-xl border border-forest-600/50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs rounded-xl shadow-lg border border-forest-600/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT ({totalStickers})</span>
            </button>
          </div>

        </aside>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: Interactive Print Sheet Preview (A4 30UP / 3x10 Grid) */}
        {/* ----------------------------------------------------------------------- */}
        <main className="lg:col-span-8 xl:col-span-8 bg-charcoal-950/80 p-4 sm:p-6 flex flex-col items-center justify-start overflow-y-auto">
          
          {/* Header above Canvas */}
          <div className="no-print w-full max-w-[840px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-charcoal-800">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white">
                Interactive Print Sheet Preview ({totalStickers} stickers)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-forest-950 text-forest-300 border border-forest-800">
                {currentTemplate.cols}x{currentTemplate.rows} ({currentTemplate.cols * currentTemplate.rows} UP)
              </span>
            </div>

            {totalSheets > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-charcoal-400 font-mono">
                  Sheet {activeSheetPage + 1} of {totalSheets}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveSheetPage((p) => Math.max(0, p - 1))}
                    disabled={activeSheetPage === 0}
                    className="p-1 rounded bg-charcoal-800 text-charcoal-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSheetPage((p) => Math.min(totalSheets - 1, p + 1))}
                    disabled={activeSheetPage >= totalSheets - 1}
                    className="p-1 rounded bg-charcoal-800 text-charcoal-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* REALISTIC A4 WHITE PRINT SHEET CANVAS */}
          <div
            id="barcode-print-sheet"
            className="w-full max-w-[820px] bg-white text-black shadow-2xl rounded-sm p-4 sm:p-6 transition-all duration-200 select-none border border-charcoal-300"
            style={{
              aspectRatio: '210 / 297', // Exact ISO 216 A4 ratio
              minHeight: '880px',
            }}
          >
            {/* The 3x10 (or template) Sticker Grid */}
            <div
              className="grid gap-[2px] w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${currentTemplate.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${currentTemplate.rows}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: labelsPerSheet }).map((_, index) => {
                const sticker = currentSheetStickers[index];

                if (!sticker) {
                  // Blank placeholder sticker outline
                  return (
                    <div
                      key={`blank-${index}`}
                      className="border border-dashed border-gray-300 rounded-[2px] p-2 flex flex-col items-center justify-center text-gray-300 text-[10px]"
                    >
                      <span className="font-mono opacity-50">Empty #{index + 1}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`sticker-${activeSheetPage}-${index}`}
                    className="border border-dashed border-gray-300 hover:border-forest-600 rounded-[2px] p-1.5 sm:p-2 flex flex-col justify-between items-center text-center bg-white overflow-hidden transition-colors"
                  >
                    {/* Line 1: Store Name */}
                    {includeStoreName && (
                      <div className="w-full text-center leading-none">
                        <span className="text-[9px] font-black tracking-wider uppercase text-gray-800">
                          {config.storeName || 'SAPPY STATIONARY'}
                        </span>
                      </div>
                    )}

                    {/* Line 2: Product Title */}
                    {includeProductName && (
                      <div className="w-full text-center px-1">
                        <p className="text-[10px] sm:text-[11px] font-bold text-black leading-tight truncate">
                          {sticker.name}
                        </p>
                      </div>
                    )}

                    {/* Line 3: Vector Barcode / QR Code */}
                    <div className="w-full my-auto flex items-center justify-center px-1">
                      {sticker.format === 'barcode' && (
                        <div className="w-full flex flex-col items-center">
                          <svg
                            className="w-full max-h-7 object-contain"
                            preserveAspectRatio="none"
                            viewBox={generateBarcodeSvgPath(sticker.barcode).viewBox}
                          >
                            <path
                              d={generateBarcodeSvgPath(sticker.barcode).pathData}
                              fill="#000000"
                            />
                          </svg>
                        </div>
                      )}

                      {sticker.format === 'qr' && (
                        <div className="flex items-center justify-center">
                          <svg className="w-10 h-10" viewBox="0 0 21 21">
                            {generateQrMatrix(sticker.barcode).map((row, r) =>
                              row.map((cell, c) =>
                                cell ? (
                                  <rect
                                    key={`${r}-${c}`}
                                    x={c}
                                    y={r}
                                    width={1}
                                    height={1}
                                    fill="#000000"
                                  />
                                ) : null
                              )
                            )}
                          </svg>
                        </div>
                      )}

                      {sticker.format === 'both' && (
                        <div className="w-full flex items-center justify-between gap-1 px-1">
                          <svg className="w-7 h-7 shrink-0" viewBox="0 0 21 21">
                            {generateQrMatrix(sticker.barcode).map((row, r) =>
                              row.map((cell, c) =>
                                cell ? (
                                  <rect
                                    key={`${r}-${c}`}
                                    x={c}
                                    y={r}
                                    width={1}
                                    height={1}
                                    fill="#000000"
                                  />
                                ) : null
                              )
                            )}
                          </svg>
                          <svg
                            className="flex-1 max-h-6 object-contain"
                            preserveAspectRatio="none"
                            viewBox={generateBarcodeSvgPath(sticker.barcode).viewBox}
                          >
                            <path
                              d={generateBarcodeSvgPath(sticker.barcode).pathData}
                              fill="#000000"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Line 4: Bottom details (SKU, Value, Price) */}
                    <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] font-mono leading-none pt-0.5 border-t border-gray-100">
                      {includeSkuCode ? (
                        <span className="truncate max-w-[32%] text-left font-semibold text-gray-700">
                          {sticker.sku}
                        </span>
                      ) : (
                        <span />
                      )}

                      <span className="truncate font-semibold tracking-wider text-gray-900">
                        {sticker.barcode}
                      </span>

                      {includePrice ? (
                        <span className="font-extrabold text-black shrink-0 text-right">
                          {sticker.price.toFixed(2)} {config.currencyCode}
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="no-print text-xs text-charcoal-400 mt-4 text-center">
            Standard Avery 7160 / 30-UP format calibrated for laser and inkjet sticker sheets.
          </p>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: BROWSE & SELECT CATALOG PRODUCTS */}
      {/* ========================================================================= */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-charcoal-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-forest-400" />
                  <span>Select Products to Batch Print</span>
                </h3>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  Pick stationery catalog items to add to the label printing queue
                </p>
              </div>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="p-3 border-b border-charcoal-800 flex items-center gap-2 bg-charcoal-950">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-charcoal-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter catalog by name, category, or SKU..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              <button
                onClick={() => {
                  const allIds = new Set(products.map((p) => p.id));
                  setModalSelectedIds(allIds);
                }}
                className="px-2.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Select All
              </button>
            </div>

            {/* Modal Products List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-charcoal-800/60">
              {products.length === 0 ? (
                <div className="p-8 text-center text-charcoal-400 text-xs">
                  Inventory catalog is currently empty. Use "Custom Label Entry" or add stationery products in the Inventory tab first!
                </div>
              ) : (
                products
                  .filter((p) => {
                    const q = modalSearch.toLowerCase().trim();
                    return (
                      !q ||
                      p.name.toLowerCase().includes(q) ||
                      p.sku.toLowerCase().includes(q) ||
                      p.category.toLowerCase().includes(q)
                    );
                  })
                  .map((product) => {
                    const isSelected = modalSelectedIds.has(product.id);
                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          const next = new Set(modalSelectedIds);
                          if (next.has(product.id)) {
                            next.delete(product.id);
                          } else {
                            next.add(product.id);
                          }
                          setModalSelectedIds(next);
                        }}
                        className={`p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-forest-950/70 border border-forest-600/50' : 'hover:bg-charcoal-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded border-charcoal-700 bg-charcoal-950 text-forest-600 focus:ring-forest-500 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <div className="truncate">
                            <p className="font-bold text-white truncate">{product.name}</p>
                            <p className="text-[11px] text-charcoal-400 font-mono">
                              {product.sku} • {product.category} • Stock: {product.stockLevel}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-forest-400 shrink-0">
                          {config.currencySymbol}{product.sellingPrice.toFixed(2)}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <span className="text-xs text-charcoal-400">
                {modalSelectedIds.size} products selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSelectModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-charcoal-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const selectedProducts = products.filter((p) => modalSelectedIds.has(p.id));
                    const newQueueItems: LabelItem[] = selectedProducts.map((p) => ({
                      id: `queue-${p.id}`,
                      productId: p.id,
                      name: p.name,
                      sku: p.sku,
                      barcode: p.barcode || p.sku,
                      price: p.sellingPrice,
                      format: 'barcode',
                      copies: 4,
                    }));
                    setQueuedItems(newQueueItems);
                    setIsSelectModalOpen(false);
                  }}
                  className="px-4 py-1.5 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Apply to Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CSS PRINT STYLESHEET (Only prints the sheet, hides UI) */}
      {/* ========================================================================= */}
      <style>{`
        @media print {
          body, html {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, header, aside, nav, footer {
            display: none !important;
          }
          #barcode-print-sheet {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

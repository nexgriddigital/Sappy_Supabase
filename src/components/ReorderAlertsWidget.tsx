import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  PackageX,
  PackageCheck,
  Plus,
  Copy,
  Check,
  Sliders,
  ArrowRight,
  Pencil,
  TrendingDown,
  Boxes,
  X,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Product, StoreConfig } from '../types/pos.ts';
import { exportReportToPdf, exportSheetsToExcel } from '../utils/exportHelpers.ts';

interface ReorderAlertsWidgetProps {
  products: Product[];
  config: StoreConfig;
  onAdjustStock?: (productId: string, delta: number) => void;
  onSaveProduct?: (product: Product) => void;
  onNavigateToInventory: () => void;
}

type AlertFilter = 'reorder' | 'out' | 'watchlist';

export const ReorderAlertsWidget: React.FC<ReorderAlertsWidgetProps> = ({
  products,
  config,
  onAdjustStock,
  onSaveProduct,
  onNavigateToInventory,
}) => {
  const [thresholdMode, setThresholdMode] = useState<'item' | 'global'>(() => {
    try {
      const saved = localStorage.getItem('sappy_reorder_threshold_mode');
      return saved === 'global' ? 'global' : 'item';
    } catch {
      return 'item';
    }
  });

  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sappy_reorder_threshold_val');
      const parsed = saved ? parseInt(saved, 10) : 10;
      return isNaN(parsed) ? 10 : Math.max(1, parsed);
    } catch {
      return 10;
    }
  });

  const [activeFilter, setActiveFilter] = useState<AlertFilter>('reorder');
  const [showAll, setShowAll] = useState(false);
  const [copiedPO, setCopiedPO] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editReorderVal, setEditReorderVal] = useState<string>('');
  const [justRestockedId, setJustRestockedId] = useState<string | null>(null);

  const handleSetThresholdMode = (mode: 'item' | 'global') => {
    setThresholdMode(mode);
    try {
      localStorage.setItem('sappy_reorder_threshold_mode', mode);
    } catch {}
  };

  const handleSetGlobalThreshold = (val: number) => {
    const clamped = Math.max(1, Math.min(9999, val));
    setGlobalThreshold(clamped);
    try {
      localStorage.setItem('sappy_reorder_threshold_val', String(clamped));
    } catch {}
  };

  const getReorderPoint = (p: Product): number => {
    if (thresholdMode === 'global') return globalThreshold;
    return p.reorderThreshold ?? p.lowStockThreshold ?? 5;
  };

  const classified = useMemo(() => {
    const outOfStock: Array<{ product: Product; reorderPoint: number; suggestedQty: number; estCost: number }> = [];
    const belowReorder: Array<{ product: Product; reorderPoint: number; suggestedQty: number; estCost: number }> = [];
    const watchlist: Array<{ product: Product; reorderPoint: number; suggestedQty: number; estCost: number }> = [];

    products.forEach((p) => {
      const rop = Math.max(1, getReorderPoint(p));
      const targetLevel = Math.max(rop * 2, rop + 5);
      const suggestedQty = Math.max(1, targetLevel - p.stockLevel);
      const estCost = suggestedQty * (Number(p.costPrice) || 0);

      if (p.stockLevel <= 0) {
        outOfStock.push({ product: p, reorderPoint: rop, suggestedQty, estCost });
      } else if (p.stockLevel <= rop) {
        belowReorder.push({ product: p, reorderPoint: rop, suggestedQty, estCost });
      } else if (p.stockLevel <= Math.ceil(rop * 1.25)) {
        watchlist.push({ product: p, reorderPoint: rop, suggestedQty, estCost });
      }
    });

    const sortByUrgency = (
      a: { product: Product; reorderPoint: number },
      b: { product: Product; reorderPoint: number }
    ) => {
      const ratioA = a.product.stockLevel / Math.max(1, a.reorderPoint);
      const ratioB = b.product.stockLevel / Math.max(1, b.reorderPoint);
      if (ratioA !== ratioB) return ratioA - ratioB;
      return a.product.stockLevel - b.product.stockLevel;
    };

    outOfStock.sort(sortByUrgency);
    belowReorder.sort(sortByUrgency);
    watchlist.sort(sortByUrgency);

    const allNeedingReorder = [...outOfStock, ...belowReorder];
    const totalEstimatedRestockCost = allNeedingReorder.reduce((sum, item) => sum + item.estCost, 0);
    const totalSuggestedUnits = allNeedingReorder.reduce((sum, item) => sum + item.suggestedQty, 0);
    const healthyCount = Math.max(0, products.length - allNeedingReorder.length);
    const healthPercent = products.length > 0 ? Math.round((healthyCount / products.length) * 100) : 100;

    return {
      outOfStock,
      belowReorder,
      watchlist,
      allNeedingReorder,
      totalEstimatedRestockCost,
      totalSuggestedUnits,
      healthyCount,
      healthPercent,
    };
  }, [products, thresholdMode, globalThreshold]);

  const visibleList = useMemo(() => {
    const source =
      activeFilter === 'out'
        ? classified.outOfStock
        : activeFilter === 'watchlist'
          ? classified.watchlist
          : classified.allNeedingReorder;
    return showAll ? source : source.slice(0, 5);
  }, [activeFilter, classified, showAll]);

  const currentTotalForFilter =
    activeFilter === 'out'
      ? classified.outOfStock.length
      : activeFilter === 'watchlist'
        ? classified.watchlist.length
        : classified.allNeedingReorder.length;

  const handleQuickRestock = (productId: string, qty: number) => {
    if (!onAdjustStock || qty <= 0) return;
    onAdjustStock(productId, qty);
    setJustRestockedId(productId);
    setTimeout(() => {
      setJustRestockedId((prev) => (prev === productId ? null : prev));
    }, 1800);
  };

  const handleSaveInlineReorderPoint = (product: Product) => {
    if (!onSaveProduct) {
      setEditingProductId(null);
      return;
    }
    const parsed = parseInt(editReorderVal, 10);
    if (isNaN(parsed) || parsed < 1) {
      setEditingProductId(null);
      return;
    }
    onSaveProduct({
      ...product,
      reorderThreshold: parsed,
      lowStockThreshold: Math.min(product.lowStockThreshold || parsed, parsed),
      updatedAt: new Date().toISOString(),
    });
    setEditingProductId(null);
  };

  const handleCopyReorderList = async () => {
    const items = classified.allNeedingReorder;
    if (items.length === 0) return;
    const cur = (config.currencySymbol || 'Br ').trim();
    const lines = [
      `${config.storeName} - STATIONERY PURCHASE REORDER LIST (${new Date().toLocaleDateString()})`,
      `Items Below Reorder Point: ${items.length} | Total Units Needed: ${classified.totalSuggestedUnits}`,
      `Estimated Restock Cost: ${cur} ${classified.totalEstimatedRestockCost.toFixed(2)}`,
      '------------------------------------------------------------',
      ...items.map(
        (entry, idx) =>
          `${idx + 1}. ${entry.product.name} [${entry.product.sku}] — Stock: ${entry.product.stockLevel}/${entry.reorderPoint} ${entry.product.unit} | Order: +${entry.suggestedQty} ${entry.product.unit} (${cur} ${entry.estCost.toFixed(2)})`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedPO(true);
      setTimeout(() => setCopiedPO(false), 2500);
    } catch {}
  };

  const handleExportReorderExcel = () => {
    const items = classified.allNeedingReorder;
    if (items.length === 0) return;
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Reorder Point',
      'Deficit',
      'Recommended Order Qty',
      'Unit',
      'Unit Cost',
      'Est. Restock Cost',
    ];
    const rows = items.map(({ product: p, reorderPoint, suggestedQty, estCost }) => [
      p.sku || '',
      p.name || '',
      p.category || '',
      p.stockLevel,
      reorderPoint,
      Math.max(0, reorderPoint - p.stockLevel),
      suggestedQty,
      p.unit || 'pcs',
      Number(Number(p.costPrice || 0).toFixed(2)),
      Number(estCost.toFixed(2)),
    ]);

    exportSheetsToExcel(`sappy-reorder-list-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        sheetName: 'Purchase_Reorder_List',
        headers,
        rows,
      },
    ]);
  };

  const handleExportReorderPdf = () => {
    const items = classified.allNeedingReorder;
    if (items.length === 0) return;
    const cur = (config.currencySymbol || 'Br ').trim() + ' ';
    exportReportToPdf({
      filename: `sappy-reorder-list-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Stationery Purchase Reorder Order',
      subtitle: `Items at or below defined reorder point (${thresholdMode === 'global' ? `Custom <= ${globalThreshold}` : 'Item Reorder Points'})`,
      storeConfig: config,
      orientation: 'landscape',
      summaryPairs: [
        { label: 'SKUs Below Reorder', value: `${items.length} item(s)` },
        { label: 'Out of Stock', value: `${classified.outOfStock.length} item(s)` },
        { label: 'Suggested Order Units', value: `${classified.totalSuggestedUnits} units` },
        { label: 'Est. Restock Cost', value: `${cur}${classified.totalEstimatedRestockCost.toFixed(2)}` },
      ],
      sections: [
        {
          title: 'Recommended Supplier Restock Schedule',
          headers: ['SKU', 'Product Name', 'Category', 'Stock', 'Reorder Pt', 'Order Qty', 'Unit Cost', 'Est. Cost'],
          columnAlignments: ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right'],
          rows: items.map(({ product: p, reorderPoint, suggestedQty, estCost }) => [
            p.sku || '',
            p.name || '',
            p.category || '',
            `${p.stockLevel} ${p.unit || ''}`.trim(),
            `${reorderPoint} ${p.unit || ''}`.trim(),
            `+${suggestedQty} ${p.unit || ''}`.trim(),
            `${cur}${Number(p.costPrice || 0).toFixed(2)}`,
            `${cur}${estCost.toFixed(2)}`,
          ]),
        },
      ],
    });
  };

  const hasAlerts = classified.allNeedingReorder.length > 0;

  return (
    <div
      className={`bg-charcoal-900 rounded-2xl border shadow-md overflow-hidden transition-colors ${
        classified.outOfStock.length > 0
          ? 'border-rose-900/70'
          : hasAlerts
            ? 'border-amber-800/70'
            : 'border-forest-800/60'
      }`}
    >
      {/* Widget Header */}
      <div className="p-4 sm:p-5 border-b border-charcoal-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                classified.outOfStock.length > 0
                  ? 'bg-rose-950/90 border-rose-800 text-rose-400'
                  : hasAlerts
                    ? 'bg-amber-950/90 border-amber-700 text-amber-400'
                    : 'bg-forest-950 border-forest-700 text-forest-400'
              }`}
            >
              {hasAlerts ? (
                <AlertTriangle className="w-4.5 h-4.5" />
              ) : (
                <PackageCheck className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Supply Chain &amp; Reorder Point Alerts
                </h3>
                {hasAlerts ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950 border border-amber-700/70 text-amber-300">
                    {classified.allNeedingReorder.length} SKU{classified.allNeedingReorder.length === 1 ? '' : 's'} Below Reorder
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-forest-950 border border-forest-700 text-forest-300">
                    All Stocked
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal-400 mt-0.5">
                {hasAlerts
                  ? `Proactively restock ${classified.totalSuggestedUnits} unit(s) (Est. cost ${config.currencySymbol}${classified.totalEstimatedRestockCost.toFixed(2)}) before shelves run empty.`
                  : `All ${products.length} stationery items are currently above their defined reorder points.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAlerts && (
              <>
                <button
                  type="button"
                  onClick={handleCopyReorderList}
                  className="px-2.5 py-1.5 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-700 text-charcoal-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy purchase reorder list for supplier"
                >
                  {copiedPO ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-forest-400" />
                      <span className="text-forest-300">Copied PO</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-charcoal-400" />
                      <span>Copy PO List</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportReorderExcel}
                  className="px-2.5 py-1.5 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-700 text-charcoal-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download Reorder Sheet in Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-forest-400" />
                  <span>PO Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReorderPdf}
                  className="px-2.5 py-1.5 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-700 text-charcoal-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download Reorder Sheet as PDF (.pdf)"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>PO PDF</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onNavigateToInventory}
              className="px-2.5 py-1.5 rounded-lg bg-forest-800/80 hover:bg-forest-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-forest-600/40"
            >
              <span>Inventory</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Supply Health Bar + Filter & Reorder Rule Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveFilter('reorder');
                setShowAll(false);
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'reorder'
                  ? 'bg-amber-600 text-charcoal-950 border-amber-500 font-bold'
                  : 'bg-charcoal-950 text-charcoal-300 border-charcoal-800 hover:border-charcoal-700'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              <span>Needs Reorder ({classified.allNeedingReorder.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('out');
                setShowAll(false);
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'out'
                  ? 'bg-rose-600 text-white border-rose-500 font-bold'
                  : 'bg-charcoal-950 text-charcoal-300 border-charcoal-800 hover:border-charcoal-700'
              }`}
            >
              <PackageX className="w-3 h-3" />
              <span>Out of Stock ({classified.outOfStock.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('watchlist');
                setShowAll(false);
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'watchlist'
                  ? 'bg-forest-700 text-white border-forest-600 font-bold'
                  : 'bg-charcoal-950 text-charcoal-300 border-charcoal-800 hover:border-charcoal-700'
              }`}
            >
              <Boxes className="w-3 h-3" />
              <span>Near Reorder ({classified.watchlist.length})</span>
            </button>
          </div>

          {/* Reorder Threshold Rule Toggle */}
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-charcoal-400 flex items-center gap-1 font-medium">
              <Sliders className="w-3 h-3 text-forest-400" />
              <span>Rule:</span>
            </span>
            <div className="inline-flex p-0.5 rounded-lg bg-charcoal-950 border border-charcoal-800 font-semibold">
              <button
                type="button"
                onClick={() => handleSetThresholdMode('item')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  thresholdMode === 'item'
                    ? 'bg-forest-800 text-white'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                Item Reorder Pt
              </button>
              <button
                type="button"
                onClick={() => handleSetThresholdMode('global')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  thresholdMode === 'global'
                    ? 'bg-amber-600 text-charcoal-950 font-bold'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                Custom ≤ {globalThreshold}
              </button>
            </div>
            {thresholdMode === 'global' && (
              <div className="inline-flex items-center gap-1 bg-charcoal-950 border border-charcoal-700 rounded-lg px-1.5 py-0.5 font-mono">
                <button
                  type="button"
                  onClick={() => handleSetGlobalThreshold(globalThreshold - 1)}
                  className="text-charcoal-300 hover:text-white px-1 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={globalThreshold}
                  onChange={(e) => handleSetGlobalThreshold(parseInt(e.target.value, 10) || 1)}
                  className="w-10 bg-transparent text-center text-white font-bold focus:outline-none text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => handleSetGlobalThreshold(globalThreshold + 1)}
                  className="text-charcoal-300 hover:text-white px-1 cursor-pointer"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Catalog Stock Health Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-charcoal-400">
            <span>Catalog Reorder Health: {classified.healthyCount}/{products.length} SKUs healthy</span>
            <span className={classified.healthPercent >= 80 ? 'text-forest-400 font-bold' : 'text-amber-400 font-bold'}>
              {classified.healthPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-charcoal-950 overflow-hidden border border-charcoal-800/80">
            <div
              className={`h-full transition-all duration-300 ${
                classified.healthPercent >= 80
                  ? 'bg-forest-500'
                  : classified.healthPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${classified.healthPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Product Alert List */}
      <div className="p-4 sm:p-5 space-y-2.5">
        {visibleList.length === 0 ? (
          <div className="py-5 px-4 rounded-xl bg-charcoal-950/70 border border-charcoal-800 text-center space-y-1">
            <p className="text-xs font-semibold text-forest-300 flex items-center justify-center gap-1.5">
              <PackageCheck className="w-4 h-4" />
              <span>
                {activeFilter === 'out'
                  ? 'No out-of-stock stationery items.'
                  : activeFilter === 'watchlist'
                    ? 'No items currently near their reorder point.'
                    : 'All stationery products are above their defined reorder points.'}
              </span>
            </p>
            <p className="text-[11px] text-charcoal-400">
              {thresholdMode === 'item'
                ? 'Individual item reorder points are monitored automatically as sales are recorded.'
                : `Monitoring all items against custom reorder point ≤ ${globalThreshold} units.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleList.map(({ product: p, reorderPoint, suggestedQty, estCost }) => {
              const isOut = p.stockLevel <= 0;
              const isBelow = p.stockLevel > 0 && p.stockLevel < reorderPoint;
              const fillRatio = Math.min(100, Math.max(4, Math.round((p.stockLevel / Math.max(1, reorderPoint * 1.5)) * 100)));
              const isEditingThis = editingProductId === p.id;
              const wasJustRestocked = justRestockedId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl bg-charcoal-950 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOut
                      ? 'border-rose-900/70 hover:border-rose-700/80'
                      : isBelow
                        ? 'border-amber-900/60 hover:border-amber-700/80'
                        : 'border-charcoal-800 hover:border-charcoal-700'
                  }`}
                >
                  {/* Product Info + Stock Level Bar */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${
                          isOut
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : p.stockLevel <= reorderPoint
                              ? 'bg-amber-950 text-amber-300 border-amber-700/70'
                              : 'bg-charcoal-900 text-sky-300 border-sky-800/60'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isBelow ? 'Below Reorder' : p.stockLevel === reorderPoint ? 'At Reorder Pt' : 'Near Reorder'}
                      </span>
                      <p className="text-xs font-bold text-white truncate">{p.name}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-charcoal-400">
                      <span>SKU: {p.sku}</span>
                      <span>·</span>
                      <span>{p.category}</span>
                      <span>·</span>
                      {isEditingThis ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-charcoal-300">Reorder Pt:</span>
                          <input
                            type="number"
                            min={1}
                            value={editReorderVal}
                            onChange={(e) => setEditReorderVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineReorderPoint(p);
                              if (e.key === 'Escape') setEditingProductId(null);
                            }}
                            autoFocus
                            className="w-12 px-1 py-0.5 rounded bg-charcoal-900 border border-forest-500 text-white text-[10px] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineReorderPoint(p)}
                            className="p-0.5 text-forest-400 hover:text-forest-300 cursor-pointer"
                            title="Save reorder point"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProductId(null)}
                            className="p-0.5 text-charcoal-400 hover:text-white cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span>
                            Reorder Pt: <strong className="text-charcoal-200">{reorderPoint} {p.unit}</strong>
                          </span>
                          {onSaveProduct && thresholdMode === 'item' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProductId(p.id);
                                setEditReorderVal(String(reorderPoint));
                              }}
                              className="p-0.5 text-charcoal-500 hover:text-forest-400 cursor-pointer"
                              title="Edit product reorder point"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Visual Level vs Reorder Point Bar */}
                    <div className="flex items-center gap-2 max-w-md">
                      <div className="flex-1 h-1.5 rounded-full bg-charcoal-900 overflow-hidden border border-charcoal-800">
                        <div
                          className={`h-full rounded-full ${
                            isOut
                              ? 'bg-rose-500'
                              : p.stockLevel <= reorderPoint
                                ? 'bg-amber-500'
                                : 'bg-forest-500'
                          }`}
                          style={{ width: `${isOut ? 4 : fillRatio}%` }}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold shrink-0 ${
                          isOut ? 'text-rose-400' : p.stockLevel <= reorderPoint ? 'text-amber-300' : 'text-charcoal-300'
                        }`}
                      >
                        {p.stockLevel} / {reorderPoint} {p.unit}
                      </span>
                    </div>
                  </div>

                  {/* Quick Proactive Restock Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal-800/80">
                    <div className="text-left sm:text-right font-mono">
                      <p className="text-[10px] text-charcoal-400">
                        Suggest Order: <strong className="text-white">+{suggestedQty} {p.unit}</strong>
                      </p>
                      <p className="text-[10px] text-forest-400">
                        Est: {config.currencySymbol}{estCost.toFixed(2)}
                      </p>
                    </div>

                    {onAdjustStock && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickRestock(p.id, suggestedQty)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 border ${
                            wasJustRestocked
                              ? 'bg-forest-600 text-white border-forest-500'
                              : 'bg-forest-800/90 hover:bg-forest-700 text-white border-forest-600/50'
                          }`}
                          title={`Add +${suggestedQty} ${p.unit} to stock`}
                        >
                          {wasJustRestocked ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Restocked</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>+{suggestedQty}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentTotalForFilter > 5 && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-800 text-xs font-semibold text-forest-300 transition-colors cursor-pointer"
            >
              {showAll
                ? 'Show Fewer Items'
                : `Show All ${currentTotalForFilter} Items`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

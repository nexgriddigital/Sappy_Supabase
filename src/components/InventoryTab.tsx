import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  X,
  Layers,
  Upload,
  Sliders,
  Check,
  ClipboardList,
  Copy,
  Printer,
  ChevronDown,
  RotateCcw,
  AlertOctagon,
  Boxes,
} from 'lucide-react';
import { Product, ProductCategory, StoreConfig } from '../types/pos.ts';
import { BulkImportModal } from './BulkImportModal.tsx';

interface InventoryTabProps {
  products: Product[];
  config: StoreConfig;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onRefreshData?: () => void;
}

const CATEGORIES: ProductCategory[] = [
  'Writing & Pens',
  'Paper & Notebooks',
  'Desk & Office',
  'Filing & Folders',
  'Art & Craft',
  'School & Math',
  'Printing & Services',
  'General',
];

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products,
  config,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterBelowReorderOnly, setFilterBelowReorderOnly] = useState(false);

  // Configurable Reorder Threshold Settings
  const [thresholdMode, setThresholdMode] = useState<'item' | 'global'>(() => {
    return (localStorage.getItem('sappy_reorder_threshold_mode') as 'item' | 'global') || 'item';
  });

  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('sappy_reorder_threshold_val');
    return saved ? Math.max(1, parseInt(saved, 10)) : 10;
  });

  // Modals State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedPo, setCopiedPo] = useState(false);

  // Form State
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('Writing & Pens');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formStockLevel, setFormStockLevel] = useState('20');
  const [formLowThreshold, setFormLowThreshold] = useState('5');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formDesc, setFormDesc] = useState('');

  // Quick Restock State
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('10');

  // Persistence for Threshold Settings
  const handleSetThresholdMode = (mode: 'item' | 'global') => {
    setThresholdMode(mode);
    localStorage.setItem('sappy_reorder_threshold_mode', mode);
  };

  const handleSetGlobalThreshold = (val: number) => {
    const clamped = Math.max(1, val);
    setGlobalThreshold(clamped);
    localStorage.setItem('sappy_reorder_threshold_val', clamped.toString());
  };

  // Helper to determine the effective reorder threshold for any product
  const getEffectiveThreshold = (product: Product): number => {
    if (thresholdMode === 'global') {
      return globalThreshold;
    }
    return product.reorderThreshold ?? product.lowStockThreshold ?? 5;
  };

  // Helper to check if a product is at or below its reorder threshold
  const isBelowReorder = (product: Product): boolean => {
    const threshold = getEffectiveThreshold(product);
    return product.stockLevel <= threshold;
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchReorder = !filterBelowReorderOnly || isBelowReorder(p);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);

      return matchCat && matchReorder && matchSearch;
    });
  }, [products, selectedCategory, filterBelowReorderOnly, searchQuery, thresholdMode, globalThreshold]);

  // Aggregate Metrics
  const totalItems = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.stockLevel, 0);
  const totalCostValue = products.reduce((acc, p) => acc + p.stockLevel * p.costPrice, 0);
  const totalRetailValue = products.reduce((acc, p) => acc + p.stockLevel * p.sellingPrice, 0);
  const potentialProfit = totalRetailValue - totalCostValue;

  // Reorder Counts
  const itemsNeedingReorder = useMemo(() => {
    return products.filter((p) => isBelowReorder(p));
  }, [products, thresholdMode, globalThreshold]);

  const reorderCount = itemsNeedingReorder.length;
  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stockLevel <= 0).length;
  }, [products]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingProduct(null);
    const count = products.length + 1;
    setFormSku(`STN-${String(count).padStart(4, '0')}`);
    setFormBarcode(`890123${String(count).padStart(6, '0')}`);
    setFormName('');
    setFormCategory('Writing & Pens');
    setFormCostPrice('2.00');
    setFormSellingPrice('4.50');
    setFormStockLevel('25');
    setFormLowThreshold('5');
    setFormUnit('pcs');
    setFormDesc('');
    setIsProductModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormBarcode(p.barcode || '');
    setFormName(p.name);
    setFormCategory(p.category);
    setFormCostPrice(p.costPrice.toString());
    setFormSellingPrice(p.sellingPrice.toString());
    setFormStockLevel(p.stockLevel.toString());
    setFormLowThreshold((p.reorderThreshold ?? p.lowStockThreshold ?? 5).toString());
    setFormUnit(p.unit);
    setFormDesc(p.description || '');
    setIsProductModalOpen(true);
  };

  // Save Product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSku) return;

    const thresholdVal = parseInt(formLowThreshold, 10) || 5;

    const saved: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formSku.trim(),
      barcode: formBarcode.trim() || `890${Date.now().toString().slice(-9)}`,
      name: formName.trim(),
      category: formCategory,
      costPrice: parseFloat(formCostPrice) || 0,
      sellingPrice: parseFloat(formSellingPrice) || 0,
      stockLevel: parseInt(formStockLevel, 10) || 0,
      lowStockThreshold: thresholdVal,
      reorderThreshold: thresholdVal,
      unit: formUnit.trim() || 'pcs',
      description: formDesc.trim() || undefined,
    };

    onSaveProduct(saved);
    setIsProductModalOpen(false);
  };

  // Open Restock Modal
  const handleOpenRestock = (p: Product) => {
    setRestockProduct(p);
    const threshold = getEffectiveThreshold(p);
    const deficit = Math.max(0, threshold - p.stockLevel);
    // Suggest ordering enough to cover the deficit + a comfortable buffer
    const suggested = deficit > 0 ? Math.max(10, deficit + 10) : 10;
    setRestockQty(suggested.toString());
    setIsRestockModalOpen(true);
  };

  // Submit Restock
  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    const qty = parseInt(restockQty, 10);
    if (!qty || qty <= 0) return;

    onAdjustStock(restockProduct.id, qty);
    setIsRestockModalOpen(false);
  };

  // Copy Purchase Order to Clipboard
  const handleCopyPurchaseOrder = () => {
    const lines = itemsNeedingReorder.map((item, idx) => {
      const threshold = getEffectiveThreshold(item);
      const deficit = Math.max(0, threshold - item.stockLevel);
      const orderQty = Math.max(deficit, 10);
      return `${idx + 1}. ${item.name} (${item.sku})\n   Current Stock: ${item.stockLevel} ${item.unit} | Reorder Threshold: ${threshold} | Suggested Order: ${orderQty} ${item.unit} | Cost: ${config.currencySymbol}${(orderQty * item.costPrice).toFixed(2)}`;
    });

    const header = `=== REORDER PURCHASE ORDER — ${config.storeName.toUpperCase()} ===\nDate: ${new Date().toLocaleDateString()}\nTotal Items Requiring Reorder: ${itemsNeedingReorder.length}\n\n`;
    const totalEst = itemsNeedingReorder.reduce((acc, item) => {
      const threshold = getEffectiveThreshold(item);
      const orderQty = Math.max(Math.max(0, threshold - item.stockLevel), 10);
      return acc + orderQty * item.costPrice;
    }, 0);
    const footer = `\nEstimated Purchase Order Total: ${config.currencySymbol}${totalEst.toFixed(2)}`;

    navigator.clipboard.writeText(header + lines.join('\n\n') + footer);
    setCopiedPo(true);
    setTimeout(() => setCopiedPo(false), 2500);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Stationery Inventory & Stock Control
            </h1>
            {reorderCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-950 text-amber-300 border border-amber-600/70 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{reorderCount} Below Reorder Threshold</span>
              </span>
            )}
          </div>
          <p className="text-xs text-charcoal-400 mt-1">
            Manage catalogue, wholesale costs, selling prices, and dynamically flag/filter items requiring replenishment.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {reorderCount > 0 && (
            <button
              type="button"
              onClick={() => setIsPurchaseOrderOpen(true)}
              className="px-3 py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-600/70 active:scale-95 shadow-sm"
              title="View purchase order replenishment summary"
            >
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <span>Purchase Order ({reorderCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="px-3.5 py-2 bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer border border-charcoal-700 active:scale-95 shadow-2xs"
            title="Import products in bulk via Excel or PDF"
          >
            <Upload className="w-4 h-4 text-forest-400" />
            <span>Bulk Import Items</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-95 border border-forest-600/50"
          >
            <Plus className="w-4 h-4 text-forest-200" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Retail Stock Valuation</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}{totalRetailValue.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">{totalUnits} total units in stock</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Wholesale Cost (COGS Asset)</p>
          <p className="text-xl font-extrabold font-mono text-charcoal-300 mt-1">
            {config.currencySymbol}{totalCostValue.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">Inventory purchase investment</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Potential Retail Margin</p>
          <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
            {config.currencySymbol}{potentialProfit.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-400/80 mt-1">
            {totalRetailValue > 0 ? `${((potentialProfit / totalRetailValue) * 100).toFixed(1)}% markup margin` : '0%'}
          </p>
        </div>

        {/* Reorder Alerts KPI Card */}
        <div
          onClick={() => setFilterBelowReorderOnly(!filterBelowReorderOnly)}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs select-none ${
            reorderCount > 0
              ? 'bg-amber-950/40 border-amber-600/70 hover:bg-amber-950/60'
              : 'bg-charcoal-900 border-charcoal-800'
          }`}
          title="Click to toggle reorder filter"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal-400 font-medium">Reorder Alerts</p>
            {reorderCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <p
            className={`text-xl font-extrabold font-mono mt-1 ${
              reorderCount > 0 ? 'text-amber-400' : 'text-charcoal-400'
            }`}
          >
            {reorderCount} item{reorderCount === 1 ? '' : 's'}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1 flex items-center justify-between">
            <span>
              {reorderCount > 0 ? `${outOfStockCount} out of stock` : 'Healthy stock levels'}
            </span>
            <span className="text-amber-400 font-bold underline text-[10px]">
              {filterBelowReorderOnly ? 'View All' : 'Filter Now'}
            </span>
          </p>
        </div>
      </div>

      {/* Visual Reorder Warning Alert Banner */}
      {reorderCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-amber-950/70 to-charcoal-900 border border-amber-600 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-950/40">
          <div className="flex items-start sm:items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-900/80 border border-amber-500/80 flex items-center justify-center text-amber-300 shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  Reorder Threshold Alert Triggered
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-charcoal-950">
                  {reorderCount} {reorderCount === 1 ? 'Product Flagged' : 'Products Flagged'}
                </span>
                {outOfStockCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-700">
                    {outOfStockCount} Out of Stock
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-200/90 mt-1">
                Stock is below the active reorder threshold (
                <span className="font-semibold text-white">
                  {thresholdMode === 'global' ? `≤ ${globalThreshold} units` : 'item-specific minimums'}
                </span>
                ). Replenish inventory to prevent sales disruption.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setIsPurchaseOrderOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-charcoal-900/90 hover:bg-charcoal-800 text-amber-300 border border-amber-600/60 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Purchase Order List</span>
            </button>

            <button
              onClick={() => setFilterBelowReorderOnly(!filterBelowReorderOnly)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                filterBelowReorderOnly
                  ? 'bg-amber-500 text-charcoal-950 border-amber-400 shadow-md'
                  : 'bg-amber-900/90 text-amber-100 border-amber-500 hover:bg-amber-800'
              }`}
            >
              {filterBelowReorderOnly ? 'Show All Products' : 'Filter Flagged Items'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIGURABLE REORDER THRESHOLD & FILTER TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs space-y-3.5">
        
        {/* Top Control Bar: Search & Category */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search SKU, barcode, product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-medium text-white cursor-pointer focus:border-forest-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-charcoal-900 text-white">
                  {cat}
                </option>
              ))}
            </select>

            {/* Quick Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterBelowReorderOnly(!filterBelowReorderOnly)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border select-none ${
                filterBelowReorderOnly
                  ? 'bg-amber-500 text-charcoal-950 border-amber-400 shadow-sm'
                  : 'bg-charcoal-950 text-charcoal-300 border-charcoal-700 hover:text-white hover:border-amber-600/60'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${filterBelowReorderOnly ? 'text-charcoal-950' : 'text-amber-400'}`} />
              <span>Below Reorder Threshold</span>
              {reorderCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    filterBelowReorderOnly
                      ? 'bg-charcoal-950 text-amber-400'
                      : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                  }`}
                >
                  {reorderCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Config Panel: Reorder Threshold Settings */}
        <div className="pt-3 border-t border-charcoal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-charcoal-950/60 p-3 rounded-xl border border-charcoal-800/80">
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-charcoal-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-forest-400" />
              <span>Reorder Threshold Rule:</span>
            </span>

            {/* Threshold Mode Toggle */}
            <div className="flex p-0.5 bg-charcoal-900 rounded-lg border border-charcoal-700 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => handleSetThresholdMode('item')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  thresholdMode === 'item'
                    ? 'bg-forest-800 text-white font-bold shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
                title="Uses each product's specific lowStockThreshold / reorderThreshold"
              >
                Item-Specific Min
              </button>
              <button
                type="button"
                onClick={() => handleSetThresholdMode('global')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  thresholdMode === 'global'
                    ? 'bg-amber-600 text-charcoal-950 font-bold shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
                title="Applies a unified stock threshold across the entire catalog"
              >
                Custom Threshold (≤ N)
              </button>
            </div>
          </div>

          {/* If Global Threshold active, show numeric stepper and presets */}
          {thresholdMode === 'global' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-charcoal-400">Trigger Reorder When Stock ≤</span>
              
              <div className="flex items-center gap-1 bg-charcoal-900 border border-charcoal-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => handleSetGlobalThreshold(globalThreshold - 1)}
                  className="w-6 h-6 flex items-center justify-center text-charcoal-300 hover:text-white bg-charcoal-950 rounded cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={globalThreshold}
                  onChange={(e) => handleSetGlobalThreshold(parseInt(e.target.value, 10) || 1)}
                  className="w-12 text-center font-mono font-bold text-amber-400 bg-transparent text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleSetGlobalThreshold(globalThreshold + 1)}
                  className="w-6 h-6 flex items-center justify-center text-charcoal-300 hover:text-white bg-charcoal-950 rounded cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSetGlobalThreshold(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer border ${
                      globalThreshold === preset
                        ? 'bg-amber-500 text-charcoal-950 border-amber-400'
                        : 'bg-charcoal-900 text-charcoal-400 hover:text-white border-charcoal-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thresholdMode === 'item' && (
            <span className="text-[11px] text-charcoal-400 italic">
              Configured individually on each product card (Click Edit to adjust)
            </span>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* PRODUCTS TABLE WITH HIGH-VISIBILITY REORDER FLAGGING */}
      {/* ========================================================================= */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Stationery Product</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Level & Reorder Status</th>
                <th className="py-3 px-4 text-right">Cost (Wholesale)</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockLevel <= 0;
                const threshold = getEffectiveThreshold(product);
                const isFlagged = product.stockLevel <= threshold;
                const deficit = Math.max(0, threshold - product.stockLevel);
                const margin = product.sellingPrice > 0
                  ? (((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)
                  : '0';

                return (
                  <tr
                    key={product.id}
                    className={`transition-colors ${
                      isOutOfStock
                        ? 'bg-rose-950/20 border-l-4 border-l-rose-500 hover:bg-rose-950/30'
                        : isFlagged
                        ? 'bg-amber-950/20 border-l-4 border-l-amber-500 hover:bg-amber-950/30'
                        : 'hover:bg-charcoal-800/50'
                    }`}
                  >
                    {/* SKU / Barcode */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-forest-400 block">{product.sku}</span>
                      <span className="text-[10px] text-charcoal-400">{product.barcode}</span>
                    </td>

                    {/* Product Name & Reorder Flag Badge */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{product.name}</p>

                        {/* Visually Flagged Reorder Badges */}
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight bg-rose-950 text-rose-300 border border-rose-700 shadow-xs">
                            <AlertOctagon className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Out of Stock</span>
                          </span>
                        ) : isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight bg-amber-950/90 text-amber-300 border border-amber-600/80 shadow-xs">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Reorder Flagged (Stock {product.stockLevel} ≤ {threshold})</span>
                          </span>
                        ) : null}
                      </div>

                      {product.description && (
                        <p className="text-[10px] text-charcoal-400 line-clamp-1 mt-0.5">
                          {product.description}
                        </p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="text-charcoal-300 bg-charcoal-950 border border-charcoal-700/60 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                        {product.category}
                      </span>
                    </td>

                    {/* Stock Level & Deficit Status */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      {isOutOfStock ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950 text-rose-200 border border-rose-800 shadow-xs">
                            0 {product.unit} (Out of Stock)
                          </span>
                          <span className="text-[10px] text-rose-400 font-semibold font-mono">
                            Deficit: -{threshold} {product.unit} needed
                          </span>
                        </div>
                      ) : isFlagged ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950 text-amber-100 border border-amber-600/80 shadow-sm shadow-amber-950/60">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{product.stockLevel} {product.unit} left</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-charcoal-950 text-[10px] font-mono font-black">
                              Threshold: {threshold}
                            </span>
                          </span>
                          <span className="text-[10px] text-amber-400 font-semibold font-mono">
                            Replenish: -{deficit} {product.unit} to threshold
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-charcoal-200 font-bold text-xs">
                            {product.stockLevel} {product.unit}
                          </span>
                          <span className="text-[10px] text-charcoal-400 font-mono">
                            Reorder Threshold: {threshold}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Wholesale Cost */}
                    <td className="py-3.5 px-4 text-right font-mono text-charcoal-400">
                      {config.currencySymbol}{product.costPrice.toFixed(2)}
                    </td>

                    {/* Retail Selling Price */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {config.currencySymbol}{product.sellingPrice.toFixed(2)}
                    </td>

                    {/* Margin */}
                    <td className="py-3.5 px-4 text-right font-mono text-forest-400 font-semibold">
                      {margin}%
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenRestock(product)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer border ${
                            isFlagged
                              ? 'bg-amber-900/80 hover:bg-amber-800 text-amber-200 border-amber-600/70'
                              : 'bg-forest-900/60 hover:bg-forest-800 text-forest-300 border-forest-700/50'
                          }`}
                          title="Quick restock units"
                        >
                          + Restock
                        </button>
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-1.5 text-charcoal-400 hover:text-white hover:bg-charcoal-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteProduct(product.id)}
                          className="p-1.5 text-charcoal-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-10 text-center text-charcoal-400">
            <Package className="w-8 h-8 mx-auto text-charcoal-600 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-charcoal-200">
              {filterBelowReorderOnly
                ? 'No items currently below reorder threshold!'
                : 'No stationery products found'}
            </p>
            <p className="text-xs text-charcoal-400 mt-1">
              {filterBelowReorderOnly
                ? 'All products are sufficiently stocked above reorder minimums.'
                : 'Try clearing your search query or reset filters.'}
            </p>
            {filterBelowReorderOnly && (
              <button
                onClick={() => setFilterBelowReorderOnly(false)}
                className="mt-3 px-3.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Show All Products
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PURCHASE ORDER & REORDER DEFICIT MODAL */}
      {/* ========================================================================= */}
      {isPurchaseOrderOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-charcoal-800 overflow-hidden flex flex-col max-h-[85vh] text-charcoal-100">
            <div className="p-4 bg-charcoal-950 border-b border-charcoal-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  <span>Reorder Purchase Order Plan</span>
                </h3>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  Itemized restock plan for all {itemsNeedingReorder.length} products currently below reorder thresholds
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPurchaseOrderOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <div className="divide-y divide-charcoal-800/80">
                {itemsNeedingReorder.map((item) => {
                  const threshold = getEffectiveThreshold(item);
                  const deficit = Math.max(0, threshold - item.stockLevel);
                  const suggestedOrder = Math.max(deficit, 10);
                  const estCost = suggestedOrder * item.costPrice;

                  return (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="truncate">
                        <p className="font-bold text-white truncate">{item.name}</p>
                        <p className="text-[11px] text-charcoal-400 font-mono">
                          SKU: {item.sku} • Stock: <span className="text-rose-400 font-bold">{item.stockLevel}</span> / Threshold: {threshold} {item.unit}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-amber-400 text-xs">
                          Order +{suggestedOrder} {item.unit}
                        </p>
                        <p className="text-[11px] text-charcoal-400 font-mono">
                          Cost: {config.currencySymbol}{estCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-charcoal-400">Total Purchase Budget:</span>
                <p className="text-base font-extrabold font-mono text-white">
                  {config.currencySymbol}
                  {itemsNeedingReorder
                    .reduce((acc, item) => {
                      const threshold = getEffectiveThreshold(item);
                      const orderQty = Math.max(Math.max(0, threshold - item.stockLevel), 10);
                      return acc + orderQty * item.costPrice;
                    }, 0)
                    .toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPurchaseOrder}
                  className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-forest-400" />
                  <span>{copiedPo ? 'Copied to Clipboard!' : 'Copy Order List'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPurchaseOrderOpen(false)}
                  className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-forest-400" />
                <h3 className="text-base font-bold">
                  {editingProduct ? 'Edit Stationery Product' : 'Add New Stationery Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Spiral Ruled Notebook A4 (80 Sheets)"
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl font-mono text-white focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Barcode (EAN/UPC)
                  </label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Scan or leave auto"
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl font-mono text-white focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white focus:border-forest-500 cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Selling Unit
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="e.g. pcs, pack, ream"
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Cost Price & Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Cost Price (COGS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl font-mono text-white focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl font-mono text-white focus:border-forest-500 font-bold"
                  />
                </div>
              </div>

              {/* Stock Level & Reorder Threshold */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-charcoal-950 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Initial Stock Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStockLevel}
                    onChange={(e) => setFormStockLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-xl font-mono text-white focus:border-forest-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Reorder Threshold *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formLowThreshold}
                    onChange={(e) => setFormLowThreshold(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-900 border border-amber-600/70 rounded-xl font-mono text-amber-300 focus:border-amber-500 font-bold"
                  />
                  <p className="text-[10px] text-charcoal-400 mt-1">
                    Flag item when stock falls to or below this count
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Product Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Notes on paper gsm, ink colors, pack specifications..."
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-forest-700 hover:bg-forest-600 text-white font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 border border-forest-600/50"
              >
                {editingProduct ? 'Save Product Changes' : 'Add to Inventory'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK RESTOCK MODAL */}
      {/* ========================================================================= */}
      {isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRestock}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-sm w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Restock Stationery Item</h3>
                <p className="text-xs text-forest-400 font-mono truncate max-w-[220px]">
                  {restockProduct.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Flag if fallen below reorder threshold */}
              {isBelowReorder(restockProduct) && (
                <div className="p-3 bg-amber-950/70 rounded-xl border border-amber-600/70 flex items-center gap-2.5 text-xs text-amber-200 shadow-sm shadow-amber-950/50">
                  <span className="w-6 h-6 rounded-lg bg-amber-900 border border-amber-500 flex items-center justify-center text-amber-300 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                  <div>
                    <span className="font-bold text-white block">Reorder Deficit Flagged</span>
                    <span className="text-[11px] text-amber-300">
                      Current stock ({restockProduct.stockLevel} {restockProduct.unit}) is below active threshold ({getEffectiveThreshold(restockProduct)} {restockProduct.unit}).
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 flex justify-between">
                <div>
                  <span className="text-charcoal-400">Current Stock:</span>
                  <p className="font-mono font-bold text-white text-sm">
                    {restockProduct.stockLevel} {restockProduct.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-charcoal-400">Wholesale Unit Cost:</span>
                  <p className="font-mono font-bold text-white text-sm">
                    {config.currencySymbol}{restockProduct.costPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Quantity to Add ({restockProduct.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-4 py-2.5 text-lg font-bold font-mono text-white bg-charcoal-950 border border-charcoal-700 rounded-xl focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
                />
              </div>

              {/* Total Cost calculation */}
              <div className="flex justify-between items-center text-charcoal-300 pt-2 border-t border-charcoal-800">
                <span>Restock Invoice Cost:</span>
                <span className="font-mono font-bold text-forest-400 text-sm">
                  {config.currencySymbol}
                  {((parseInt(restockQty, 10) || 0) * restockProduct.costPrice).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-forest-700 hover:bg-forest-600 text-white font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 border border-forest-600/50"
              >
                Confirm Restock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK IMPORT MODAL */}
      {/* ========================================================================= */}
      <BulkImportModal
        config={config}
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

    </div>
  );
};

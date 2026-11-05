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
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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

  // Filter Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const isLow = p.stockLevel <= p.lowStockThreshold;
      const matchLow = !lowStockOnly || isLow;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);

      return matchCat && matchLow && matchSearch;
    });
  }, [products, selectedCategory, lowStockOnly, searchQuery]);

  // Aggregate Metrics
  const totalItems = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.stockLevel, 0);
  const totalCostValue = products.reduce((acc, p) => acc + p.stockLevel * p.costPrice, 0);
  const totalRetailValue = products.reduce((acc, p) => acc + p.stockLevel * p.sellingPrice, 0);
  const potentialProfit = totalRetailValue - totalCostValue;
  const lowStockCount = products.filter((p) => p.stockLevel <= p.lowStockThreshold).length;

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
    setFormLowThreshold(p.lowStockThreshold.toString());
    setFormUnit(p.unit);
    setFormDesc(p.description || '');
    setIsProductModalOpen(true);
  };

  // Save Product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSku) return;

    const saved: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formSku.trim(),
      barcode: formBarcode.trim() || `890${Date.now().toString().slice(-9)}`,
      name: formName.trim(),
      category: formCategory,
      costPrice: parseFloat(formCostPrice) || 0,
      sellingPrice: parseFloat(formSellingPrice) || 0,
      stockLevel: parseInt(formStockLevel, 10) || 0,
      lowStockThreshold: parseInt(formLowThreshold, 10) || 5,
      unit: formUnit.trim() || 'pcs',
      description: formDesc.trim() || undefined,
    };

    onSaveProduct(saved);
    setIsProductModalOpen(false);
  };

  // Open Restock Modal
  const handleOpenRestock = (p: Product) => {
    setRestockProduct(p);
    setRestockQty('10');
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

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Stationery Inventory & Stock Control
          </h1>
          <p className="text-xs text-charcoal-300 mt-0.5">
            Manage stationery catalogue, cost/selling prices, low-stock thresholds, and reorder levels.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
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

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal-400 font-medium">Low Stock Alerts</p>
            {lowStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
            )}
          </div>
          <p className={`text-xl font-extrabold font-mono mt-1 ${lowStockCount > 0 ? 'text-forest-400' : 'text-charcoal-400'}`}>
            {lowStockCount} item{lowStockCount === 1 ? '' : 's'}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">
            {lowStockCount > 0 ? 'Fallen below minimum stock' : 'All items sufficiently stocked'}
          </p>
        </div>
      </div>

      {/* Visual Warning Alert Banner when items fall below minimum stock */}
      {lowStockCount > 0 && (
        <div className="p-4 rounded-2xl bg-forest-950/80 border border-forest-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-forest-950/60 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-forest-900 border border-forest-500 flex items-center justify-center text-forest-400 shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-forest-500" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-white">Minimum Stock Threshold Warning</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-forest-500 text-charcoal-950">
                  {lowStockCount} {lowStockCount === 1 ? 'Item Flagged' : 'Items Flagged'}
                </span>
              </div>
              <p className="text-[11px] text-forest-200 mt-0.5">
                Stock levels for these products have fallen below their predefined minimum thresholds. Immediate restocking is advised.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 ${
              lowStockOnly
                ? 'bg-forest-500 text-charcoal-950 border-forest-400 shadow-sm'
                : 'bg-forest-900/90 text-forest-200 border-forest-500 hover:bg-forest-800'
            }`}
          >
            {lowStockOnly ? 'Show All Products' : 'Filter Low Stock Products'}
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
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

        {/* Category & Low Stock Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-medium text-white cursor-pointer focus:border-forest-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-charcoal-900 text-white">{cat}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-charcoal-300 select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-charcoal-700 bg-charcoal-950 text-forest-500 focus:ring-forest-500 w-4 h-4 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-forest-500" />
              <span>Low Stock Only</span>
              {lowStockCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-forest-500 text-charcoal-950 text-[10px] font-mono font-bold">
                  {lowStockCount}
                </span>
              )}
            </span>
          </label>
        </div>

      </div>

      {/* Products Table */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Stationery Product</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Level & Minimum Threshold</th>
                <th className="py-3 px-4 text-right">Cost (Wholesale)</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockLevel <= 0;
                const isLow = product.stockLevel <= product.lowStockThreshold;
                const margin = product.sellingPrice > 0
                  ? (((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)
                  : '0';

                return (
                  <tr
                    key={product.id}
                    className={`transition-colors ${
                      isLow
                        ? 'bg-forest-950/20 border-l-4 border-l-forest-500 hover:bg-forest-950/40'
                        : 'hover:bg-charcoal-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-forest-400 block">{product.sku}</span>
                      <span className="text-[10px] text-charcoal-400">{product.barcode}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{product.name}</p>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-tight bg-forest-950 text-forest-200 border border-forest-500 shadow-xs">
                            <AlertTriangle className="w-3 h-3 text-forest-500 shrink-0" />
                            <span>Below Min Stock ({product.lowStockThreshold})</span>
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-[10px] text-charcoal-400 line-clamp-1 mt-0.5">{product.description}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-charcoal-300 bg-charcoal-950 border border-charcoal-700/60 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {isOutOfStock ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-800 shadow-xs">
                            0 {product.unit} (Out of Stock)
                          </span>
                          <span className="text-[10px] text-charcoal-400 font-mono">
                            Min: {product.lowStockThreshold} {product.unit}
                          </span>
                        </div>
                      ) : isLow ? (
                        <div className="flex flex-col items-center gap-1">
                          {/* Visual warning badge using forest-500 color */}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-forest-950 text-forest-100 border border-forest-500 shadow-sm shadow-forest-950/60">
                            <AlertTriangle className="w-3.5 h-3.5 text-forest-500 shrink-0" />
                            <span>{product.stockLevel} {product.unit}</span>
                            <span className="px-1.5 py-0.5 rounded bg-forest-500 text-charcoal-950 text-[10px] font-mono font-black">
                              Min {product.lowStockThreshold}
                            </span>
                          </span>
                          <span className="text-[10px] text-forest-400 font-semibold">
                            Restock Required
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-charcoal-200 font-bold text-xs">
                            {product.stockLevel} {product.unit}
                          </span>
                          <span className="text-[10px] text-charcoal-500 font-mono">
                            Min: {product.lowStockThreshold}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-charcoal-400">
                      {config.currencySymbol}{product.costPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {config.currencySymbol}{product.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-forest-400 font-semibold">
                      {margin}%
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenRestock(product)}
                          className="px-2.5 py-1 bg-forest-900/60 hover:bg-forest-800 text-forest-300 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer border border-forest-700/50"
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
            <p className="text-sm font-semibold text-charcoal-200">No products found</p>
            <p className="text-xs text-charcoal-400 mt-1">Try clearing your search query or reset filters.</p>
          </div>
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">
                  {editingProduct ? 'Edit Stationery Item' : 'Add New Stationery Item'}
                </h3>
                <p className="text-xs text-charcoal-400">Configure item pricing, stock levels, and category.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spiral Notebook A4 (150 Pages)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-sm text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white focus:border-forest-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-charcoal-900 text-white">{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Sale Unit</label>
                  <input
                    type="text"
                    placeholder="pcs, pack, box, ream"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-charcoal-950 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Wholesale Cost ({config.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg font-mono font-bold text-white focus:border-forest-500"
                  />
                  <span className="text-[10px] text-charcoal-400 mt-0.5 block">Store buying price</span>
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Selling Price ({config.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg font-mono font-bold text-forest-400 focus:border-forest-500"
                  />
                  <span className="text-[10px] text-charcoal-400 mt-0.5 block">Retail price to customer</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Current Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStockLevel}
                    onChange={(e) => setFormStockLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg font-mono font-bold text-white focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Predefined Minimum Stock Threshold *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formLowThreshold}
                    onChange={(e) => setFormLowThreshold(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg font-mono text-white focus:border-forest-500"
                  />
                  <span className="text-[10px] text-forest-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-forest-500" />
                    Triggers forest-500 warning badge when stock drops to or below this level
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Details, dimensions, manufacturer brand..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
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
                {editingProduct ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK RESTOCK MODAL */}
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
              {/* Flag if fallen below minimum threshold */}
              {restockProduct.stockLevel <= restockProduct.lowStockThreshold && (
                <div className="p-3 bg-forest-950/80 rounded-xl border border-forest-500 flex items-center gap-2.5 text-xs text-forest-200 shadow-sm shadow-forest-950/50">
                  <span className="w-6 h-6 rounded-lg bg-forest-900 border border-forest-500 flex items-center justify-center text-forest-400 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-forest-500" />
                  </span>
                  <div>
                    <span className="font-bold text-white block">Stock Warning Flagged</span>
                    <span className="text-[11px] text-forest-300">
                      Current level ({restockProduct.stockLevel}) has fallen below predefined minimum threshold ({restockProduct.lowStockThreshold} {restockProduct.unit}).
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

      {/* BULK IMPORT MODAL */}
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

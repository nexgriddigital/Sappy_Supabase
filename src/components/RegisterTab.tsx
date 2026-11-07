import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Smartphone,
  BookOpen,
  Barcode,
  ShoppingBag,
  AlertTriangle,
  Receipt,
  X,
  Monitor,
  Sparkles,
} from 'lucide-react';
import {
  CartItem,
  Customer,
  PaymentMethod,
  Product,
  ProductCategory,
  Sale,
  StoreConfig,
} from '../types/pos.ts';
import { PaymentProcessingLoader } from './LoadingAnimation.tsx';
import { soundEffects } from '../utils/soundEffects.ts';

interface RegisterTabProps {
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
  onCompleteSale: (sale: Omit<Sale, 'id' | 'invoiceNumber' | 'timestamp'>) => Sale;
  onOpenInvoice: (sale: Sale) => void;
  onAddNewCustomer: (customer: Customer) => void;
  onCartChange?: (data: {
    cart: CartItem[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    taxRate: number;
    grandTotal: number;
    customer?: Customer | null;
  }) => void;
  onOpenCustomerDisplay?: () => void;
  onLoadStarterPack?: () => void;
}

const CATEGORIES: (ProductCategory | 'All')[] = [
  'All',
  'Writing & Pens',
  'Paper & Notebooks',
  'Desk & Office',
  'Filing & Folders',
  'Art & Craft',
  'School & Math',
  'Printing & Services',
];

export const RegisterTab: React.FC<RegisterTabProps> = ({
  products,
  customers,
  config,
  onCompleteSale,
  onOpenInvoice,
  onAddNewCustomer,
  onCartChange,
  onOpenCustomerDisplay,
  onLoadStarterPack,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('');
  const [applyTax, setApplyTax] = useState<boolean>(false); // All sales are Tax Exempt by default unless specially ticked

  // Checkout Tender Modal State
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 14-day default credit term
    return d.toISOString().slice(0, 10);
  });
  const [creditDeposit, setCreditDeposit] = useState<string>('0');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Quick Customer Creation modal inside tender
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('500');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Filter Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations (Discount is always a direct monetary amount)
  const rawSubtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalCost = cart.reduce((acc, item) => acc + item.lineCostTotal, 0);
  const parsedDiscount = parseFloat(discountAmountInput) || 0;
  const orderDiscountAmount = Math.min(rawSubtotal, Math.max(0, parsedDiscount));
  const subtotalAfterDiscount = Math.max(0, rawSubtotal - orderDiscountAmount);
  const taxRate = applyTax ? config.defaultTaxRate : 0;
  const taxAmount = (subtotalAfterDiscount * taxRate) / 100;
  const grandTotal = subtotalAfterDiscount + taxAmount;
  const grossProfit = subtotalAfterDiscount - totalCost;

  // Selected Customer for credit sales
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Sync cart data to parent (for Customer Display Screen)
  useEffect(() => {
    if (onCartChange) {
      onCartChange({
        cart,
        subtotal: rawSubtotal,
        discountAmount: orderDiscountAmount,
        taxAmount,
        taxRate,
        grandTotal,
        customer: selectedCustomer || null,
      });
    }
  }, [cart, rawSubtotal, orderDiscountAmount, taxAmount, taxRate, grandTotal, selectedCustomer, onCartChange]);

  // Add Item to Cart with POS Beep audio feedback
  const handleAddToCart = (product: Product) => {
    if (product.stockLevel <= 0) return;
    soundEffects.playBeep();

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockLevel) return prevCart; // Cap at stock
        const newQty = existing.quantity + 1;
        return prevCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQty,
                lineTotal: newQty * (item.customPrice ?? item.product.sellingPrice),
                lineCostTotal: newQty * item.product.costPrice,
              }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            discountPercent: 0,
            lineTotal: product.sellingPrice,
            lineCostTotal: product.costPrice,
          },
        ];
      }
    });
  };

  // Adjust Cart Item Quantity with audio feedback
  const handleUpdateQty = (productId: string, delta: number) => {
    if (delta > 0) {
      soundEffects.playBeep();
    } else {
      soundEffects.playTrash();
    }

    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stockLevel) return item; // Cannot exceed inventory
            return {
              ...item,
              quantity: newQty,
              lineTotal: newQty * (item.customPrice ?? item.product.sellingPrice),
              lineCostTotal: newQty * item.product.costPrice,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    soundEffects.playTrash();
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Open Tender Modal
  const handleOpenTender = () => {
    if (cart.length === 0) return;
    setCashTendered(grandTotal.toFixed(2));
    setIsTenderOpen(true);
  };

  // Quick Barcode Scan Simulation
  const handleScanSample = () => {
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    if (randomProduct) {
      handleAddToCart(randomProduct);
    }
  };

  // Handle Quick Customer Creation
  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: newCustName,
      phone: newCustPhone,
      creditBalance: 0,
      creditLimit: parseFloat(newCustLimit) || 500,
      totalPurchased: 0,
      createdAt: new Date().toISOString(),
    };

    onAddNewCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    setShowNewCustModal(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  // Complete Sale
  const handleFinalizeSale = () => {
    if (cart.length === 0 || isProcessingPayment) return;

    setIsProcessingPayment(true);

    setTimeout(() => {
      const numericCash = parseFloat(cashTendered) || grandTotal;
      const changeGiven = selectedMethod === 'cash' ? Math.max(0, numericCash - grandTotal) : 0;
      const depositAmount = selectedMethod === 'credit' ? parseFloat(creditDeposit) || 0 : grandTotal;

      const saleItems = cart.map((item) => ({
        productId: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category,
        quantity: item.quantity,
        unit: item.product.unit,
        unitCost: item.product.costPrice,
        unitPrice: item.product.sellingPrice,
        discountPercent: item.discountPercent,
        lineTotal: item.lineTotal,
        lineCostTotal: item.lineCostTotal,
      }));

      const newSale = onCompleteSale({
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Retail Customer',
        customerPhone: selectedCustomer?.phone,
        customerEmail: selectedCustomer?.email,
        customerAddress: selectedCustomer?.address,
        items: saleItems,
        subtotal: rawSubtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        discountAmount: orderDiscountAmount,
        totalAmount: grandTotal,
        totalCost: totalCost,
        grossProfit: grossProfit,
        paymentMethod: selectedMethod,
        amountTendered: selectedMethod === 'cash' ? numericCash : grandTotal,
        changeGiven: changeGiven,
        isCreditPaid: selectedMethod !== 'credit',
        creditDueDate: selectedMethod === 'credit' ? creditDueDate : undefined,
        paidAmount: depositAmount,
        notes: orderNotes.trim() || undefined,
      });

      // Play authentic cash drawer chime
      soundEffects.playCashRegister();

      // Reset Register (all new sales default to Tax Exempt)
      setCart([]);
      setIsProcessingPayment(false);
      setIsTenderOpen(false);
      setOrderNotes('');
      setDiscountAmountInput('');
      setApplyTax(false);

      // Immediately open A4 Invoice
      onOpenInvoice(newSale);
    }, 600);
  };

  const parsedCash = parseFloat(cashTendered) || 0;
  const cashChange = Math.max(0, parsedCash - grandTotal);
  const isCashSufficient = selectedMethod !== 'cash' || parsedCash >= grandTotal;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: Product Catalog (Touchscreen optimized) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Search & Barcode Scan Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search stationery by name, SKU, or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-hidden focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={handleScanSample}
            className="px-4 py-2.5 bg-forest-800 hover:bg-forest-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 active:scale-95 shadow-2xs border border-forest-700/50"
            title="Simulate barcode scanner scan"
          >
            <Barcode className="w-4 h-4 text-forest-300" />
            <span>Quick Scan Barcode</span>
          </button>
        </div>

        {/* Category Horizontal Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-forest-700 text-white shadow-xs ring-1 ring-forest-500'
                    : 'bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-300 border border-charcoal-800 hover:border-forest-700/50 hover:text-forest-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((product) => {
            const inCart = cart.find((i) => i.product.id === product.id);
            const isOutOfStock = product.stockLevel <= 0;
            const isLowStock = product.stockLevel > 0 && product.stockLevel <= product.lowStockThreshold;

            return (
              <button
                key={product.id}
                onClick={() => handleAddToCart(product)}
                disabled={isOutOfStock}
                className={`relative p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer min-h-[140px] select-none ${
                  isOutOfStock
                    ? 'bg-charcoal-950 border-charcoal-800/80 opacity-50 cursor-not-allowed'
                    : inCart
                    ? 'bg-forest-950/80 border-forest-600 shadow-xs ring-1 ring-forest-500'
                    : 'bg-charcoal-900 border-charcoal-800 hover:border-forest-600/70 hover:bg-charcoal-800 hover:shadow-xs active:scale-[0.98]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-mono text-charcoal-400 uppercase">
                      {product.sku}
                    </span>
                    {inCart && (
                      <span className="w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {inCart.quantity}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-semibold text-charcoal-100 leading-snug line-clamp-2">
                    {product.name}
                  </h3>
                </div>

                <div className="mt-3 pt-2 border-t border-charcoal-800 flex items-end justify-between">
                  <div>
                    <span className="text-sm font-extrabold font-mono text-forest-400">
                      {config.currencySymbol}{product.sellingPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-charcoal-400 block">per {product.unit}</span>
                  </div>

                  <div className="text-right">
                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold text-rose-400">Out of Stock</span>
                    ) : (
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          isLowStock ? 'text-amber-400' : 'text-charcoal-400'
                        }`}
                      >
                        {product.stockLevel} left
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-8 text-center text-charcoal-400 space-y-3">
            <ShoppingBag className="w-10 h-10 mx-auto text-charcoal-500 mb-1" />
            <div>
              <p className="text-sm font-bold text-charcoal-200">
                {products.length === 0 ? 'Stationery Catalog is Empty' : 'No stationery items found'}
              </p>
              <p className="text-xs text-charcoal-400 mt-1 max-w-md mx-auto">
                {products.length === 0
                  ? 'Get started instantly by loading 16 authentic stationery essentials (Parker pens, Oxford notebooks, Double A paper, Kangaro staplers, Casio calculators).'
                  : 'Try selecting another category or clear your search term.'}
              </p>
            </div>

            {products.length === 0 && onLoadStarterPack && (
              <button
                type="button"
                onClick={onLoadStarterPack}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer border border-forest-500/80"
              >
                <Sparkles className="w-4 h-4 text-forest-200" />
                <span>Load 16 Stationery Essentials Starter Pack</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Active Cart Register (Touch Numpad & Line Items) */}
      <div className="lg:col-span-4 bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-xl flex flex-col h-[calc(100vh-140px)] sticky top-20">
        
        {/* Cart Header */}
        <div className="p-4 border-b border-charcoal-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-forest-900/60 text-forest-400 border border-forest-700/50 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight">Current Sale</h2>
              <p className="text-[11px] text-charcoal-400">{cart.length} distinct item{cart.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenCustomerDisplay && (
              <button
                type="button"
                onClick={onOpenCustomerDisplay}
                className="p-1.5 px-2.5 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white border border-charcoal-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open Customer Counter Display & 80mm Thermal Receipt Slip"
              >
                <Monitor className="w-3.5 h-3.5 text-forest-400" />
                <span className="hidden sm:inline text-[11px]">Customer Screen</span>
              </button>
            )}

            {cart.length > 0 && (
              <button
                onClick={() => {
                  soundEffects.playTrash();
                  setCart([]);
                  setDiscountAmountInput('');
                  setApplyTax(false);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>

        {/* Cart Line Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-charcoal-500">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-40 text-forest-700" />
              <p className="text-sm font-medium text-charcoal-300">Register is Empty</p>
              <p className="text-xs text-charcoal-500 mt-1">Tap items on the left or scan a barcode to begin.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-xl bg-charcoal-950/80 border border-charcoal-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-charcoal-100 truncate">{item.product.name}</h4>
                  <p className="text-[10px] text-charcoal-400 font-mono">
                    {config.currencySymbol}{item.product.sellingPrice.toFixed(2)} × {item.quantity} {item.product.unit}
                  </p>
                </div>

                {/* Tactile Quantity Steppers */}
                <div className="flex items-center gap-1.5 shrink-0 bg-charcoal-900 rounded-lg border border-charcoal-700 p-0.5">
                  <button
                    onClick={() => handleUpdateQty(item.product.id, -1)}
                    className="w-7 h-7 rounded flex items-center justify-center text-charcoal-300 hover:bg-forest-900/50 hover:text-forest-300 transition-colors cursor-pointer active:scale-90"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQty(item.product.id, 1)}
                    className="w-7 h-7 rounded flex items-center justify-center text-charcoal-300 hover:bg-forest-900/50 hover:text-forest-300 transition-colors cursor-pointer active:scale-90"
                    title="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-forest-400 block">
                    {config.currencySymbol}{item.lineTotal.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(item.product.id)}
                    className="text-charcoal-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-auto" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Calculation Footer & Quick Actions */}
        <div className="p-4 border-t border-charcoal-800 bg-charcoal-950/90 rounded-b-2xl space-y-3">
          
          {/* Quick Discount & Tax Toggle */}
          <div className="flex items-center justify-between text-xs text-charcoal-400 pt-1 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[11px] text-charcoal-300 whitespace-nowrap">
                Discount ({config.currencySymbol.trim()}):
              </span>
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-charcoal-400 select-none">
                  {config.currencySymbol.trim()}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  max={rawSubtotal}
                  value={discountAmountInput}
                  onChange={(e) => setDiscountAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-24 pl-6 pr-2 py-1 bg-charcoal-900 border border-charcoal-700 rounded text-right text-xs font-mono font-bold text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium select-none shrink-0">
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => setApplyTax(e.target.checked)}
                className="rounded border-charcoal-700 bg-charcoal-900 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className={applyTax ? 'text-forest-400 font-bold' : 'text-charcoal-400'}>
                {applyTax ? `VAT Applied (${config.defaultTaxRate}%)` : `Apply VAT (${config.defaultTaxRate}%)`}
              </span>
            </label>
          </div>

          {/* Subtotal & Total Rows */}
          <div className="space-y-1.5 text-xs text-charcoal-400 font-mono">
            <div className="flex justify-between">
              <span className="font-sans text-charcoal-400">Subtotal:</span>
              <span className="text-charcoal-200">{config.currencySymbol}{rawSubtotal.toFixed(2)}</span>
            </div>
            {orderDiscountAmount > 0 && (
              <div className="flex justify-between text-forest-400">
                <span className="font-sans">Discount:</span>
                <span>-{config.currencySymbol}{orderDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-sans text-charcoal-400">Tax / VAT:</span>
              {applyTax ? (
                <span className="text-amber-400 font-semibold font-mono">
                  +{config.currencySymbol}{taxAmount.toFixed(2)} ({taxRate}%)
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-charcoal-900 text-forest-400 border border-charcoal-800">
                  Tax Exempt (0.00)
                </span>
              )}
            </div>
            <div className="flex justify-between pt-2 border-t border-charcoal-800 text-base font-extrabold text-white">
              <span className="font-sans">Total:</span>
              <span className="text-forest-400">
                {config.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleOpenTender}
            disabled={cart.length === 0}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-transform cursor-pointer shadow-lg ${
              cart.length === 0
                ? 'bg-charcoal-800 text-charcoal-500 border border-charcoal-700/60 cursor-not-allowed'
                : 'bg-forest-700 hover:bg-forest-600 text-white active:scale-[0.98] border border-forest-600/50 shadow-forest-950/60'
            }`}
          >
            <DollarSign className="w-5 h-5 text-forest-200" />
            <span>Process Payment · {config.currencySymbol}{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* TENDER CHECKOUT MODAL */}
      {isTenderOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100">
            
            {/* Header */}
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Complete Payment</h3>
                <p className="text-xs text-charcoal-400">Total Due: <span className="font-mono text-forest-400 font-bold">{config.currencySymbol}{grandTotal.toFixed(2)}</span></p>
              </div>
              {!isProcessingPayment && (
                <button
                  onClick={() => setIsTenderOpen(false)}
                  className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {isProcessingPayment ? (
              <div className="p-8">
                <PaymentProcessingLoader message="Recording sale, updating stock, and generating A4 invoice..." />
              </div>
            ) : (
              <>
                {/* Payment Method Tabs */}
                <div className="grid grid-cols-4 border-b border-charcoal-800 bg-charcoal-950 text-xs font-semibold">
              {[
                { id: 'cash' as PaymentMethod, label: 'Cash', icon: DollarSign },
                { id: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
                { id: 'digital' as PaymentMethod, label: 'Digital', icon: Smartphone },
                { id: 'credit' as PaymentMethod, label: 'Credit Sale', icon: BookOpen },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`py-3 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-charcoal-900 text-forest-400 border-b-2 border-forest-500 font-bold'
                        : 'text-charcoal-400 hover:text-charcoal-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Specific Content */}
            <div className="p-6 space-y-4">
              
              {/* CASH PAYMENT TAB */}
              {selectedMethod === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                      Cash Received ({config.currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full px-4 py-2.5 text-xl font-bold font-mono text-white bg-charcoal-950 border border-charcoal-700 rounded-xl focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
                    />
                  </div>

                  {/* Fast Cash Tender Buttons */}
                  <div>
                    <p className="text-[11px] text-charcoal-400 mb-1.5 font-medium">Quick Cash Presets:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Exact', val: grandTotal },
                        { label: `${config.currencySymbol}50`, val: 50 },
                        { label: `${config.currencySymbol}100`, val: 100 },
                        { label: `${config.currencySymbol}200`, val: 200 },
                        { label: `${config.currencySymbol}500`, val: 500 },
                        { label: `${config.currencySymbol}1,000`, val: 1000 },
                        { label: `Round ${config.currencySymbol}50`, val: Math.ceil(grandTotal / 50) * 50 || 50 },
                        { label: `Round ${config.currencySymbol}100`, val: Math.ceil(grandTotal / 100) * 100 || 100 },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            soundEffects.playClick();
                            setCashTendered(preset.val.toFixed(2));
                          }}
                          className="py-1.5 px-2 bg-charcoal-800 hover:bg-forest-900/60 text-charcoal-200 hover:text-forest-300 border border-charcoal-700 hover:border-forest-700/60 font-mono font-bold text-xs rounded-lg transition-colors cursor-pointer active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculated Change Box */}
                  <div className="p-3.5 rounded-xl bg-forest-950/80 border border-forest-700/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-forest-300">Change Due to Customer:</span>
                    <span className="text-xl font-black font-mono text-forest-400">
                      {config.currencySymbol}{cashChange.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* CARD / DIGITAL PAYMENT TAB */}
              {(selectedMethod === 'card' || selectedMethod === 'digital') && (
                <div className="p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-forest-900/60 text-forest-400 border border-forest-700/40 flex items-center justify-center mx-auto">
                    {selectedMethod === 'card' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {selectedMethod === 'card' ? 'Present Card to Terminal' : 'Scan Store QR Code'}
                  </h4>
                  <p className="text-xs text-charcoal-400 max-w-xs mx-auto">
                    Acknowledge terminal authorization for <span className="font-mono text-forest-400 font-bold">{config.currencySymbol}{grandTotal.toFixed(2)}</span>.
                  </p>
                </div>
              )}

              {/* CREDIT SALE TAB */}
              {selectedMethod === 'credit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-charcoal-300 uppercase tracking-wider">
                      Select Debtor Customer:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewCustModal(true)}
                      className="text-xs text-forest-400 hover:text-forest-300 font-bold cursor-pointer"
                    >
                      + Add Customer
                    </button>
                  </div>

                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-medium text-white focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
                  >
                    <option value="">-- Choose Account --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-charcoal-900 text-white">
                        {c.name} ({c.phone}) — Balance: {config.currencySymbol}{c.creditBalance.toFixed(2)} / Limit: {config.currencySymbol}{c.creditLimit}
                      </option>
                    ))}
                  </select>

                  {/* Customer Status Details */}
                  {selectedCustomer && (
                    <div className="p-3 bg-charcoal-950 rounded-xl border border-amber-800/40 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-charcoal-400">Current Debt:</span>
                        <span className="font-mono font-bold text-amber-400">
                          {config.currencySymbol}{selectedCustomer.creditBalance.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-charcoal-400">Approved Credit Limit:</span>
                        <span className="font-mono font-medium text-charcoal-200">
                          {config.currencySymbol}{selectedCustomer.creditLimit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-charcoal-400">New Balance after this sale:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {config.currencySymbol}
                          {(selectedCustomer.creditBalance + grandTotal - (parseFloat(creditDeposit) || 0)).toFixed(2)}
                        </span>
                      </div>

                      {selectedCustomer.creditBalance + grandTotal > selectedCustomer.creditLimit && (
                        <div className="flex items-center gap-1.5 text-rose-400 font-semibold pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Warning: Exceeds approved credit limit!</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal-400 mb-1">
                        Due Date:
                      </label>
                      <input
                        type="date"
                        value={creditDueDate}
                        onChange={(e) => setCreditDueDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-white focus:border-forest-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal-400 mb-1">
                        Initial Deposit ({config.currencySymbol}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={creditDeposit}
                        onChange={(e) => setCreditDeposit(e.target.value)}
                        className="w-full px-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-white focus:border-forest-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Status Checkbox / Indicator inside Modal */}
              <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-charcoal-200">
                    Tax Status: {applyTax ? `Standard VAT (${config.defaultTaxRate}%)` : 'Tax Exempt (0.00)'}
                  </p>
                  <p className="text-[11px] text-charcoal-400">
                    {applyTax
                      ? `+${config.currencySymbol}${taxAmount.toFixed(2)} added to total`
                      : 'All sales are tax-exempt unless checked'}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                    className="rounded border-charcoal-700 bg-charcoal-900 text-forest-500 focus:ring-forest-500 w-4 h-4 cursor-pointer"
                  />
                  <span className={applyTax ? 'text-forest-400 font-bold' : 'text-charcoal-400'}>
                    Apply Tax
                  </span>
                </label>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-medium text-charcoal-400 mb-1">
                  Sale Notes / PO Reference (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bulk school order, paid by check #410..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-1 focus:ring-forest-500 focus:border-forest-500"
                />
              </div>

            </div>

            {/* Tender Modal Footer */}
            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsTenderOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleFinalizeSale}
                disabled={!isCashSufficient || (selectedMethod === 'credit' && !selectedCustomerId)}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-transform cursor-pointer shadow-sm ${
                  !isCashSufficient || (selectedMethod === 'credit' && !selectedCustomerId)
                    ? 'bg-charcoal-800 text-charcoal-600 border border-charcoal-700 cursor-not-allowed'
                    : 'bg-forest-700 hover:bg-forest-600 text-white active:scale-95 border border-forest-600/50 shadow-forest-950/40'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Complete & Generate Invoice</span>
              </button>
            </div>
            </>
            )}

          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 z-60 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomerSubmit}
            className="bg-charcoal-900 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-charcoal-800 space-y-4 text-charcoal-100"
          >
            <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
              <h4 className="text-sm font-bold text-white">Add Credit Customer</h4>
              <button
                type="button"
                onClick={() => setShowNewCustModal(false)}
                className="text-charcoal-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-charcoal-300 mb-1">Customer / School Name</label>
              <input
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. Horizon High School"
                className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs text-white placeholder-charcoal-500 focus:ring-1 focus:ring-forest-500 focus:border-forest-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-charcoal-300 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="+251 91 123 4567"
                className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs text-white placeholder-charcoal-500 focus:ring-1 focus:ring-forest-500 focus:border-forest-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-charcoal-300 mb-1">Approved Credit Limit ({config.currencySymbol})</label>
              <input
                type="number"
                value={newCustLimit}
                onChange={(e) => setNewCustLimit(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-forest-500 focus:border-forest-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-charcoal-800">
              <button
                type="button"
                onClick={() => setShowNewCustModal(false)}
                className="px-3 py-1.5 text-xs text-charcoal-400 hover:text-charcoal-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-forest-700 hover:bg-forest-600 text-white rounded-lg text-xs font-semibold cursor-pointer border border-forest-600/50"
              >
                Save & Select
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

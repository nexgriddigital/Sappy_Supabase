import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  ShoppingBag,
  AlertTriangle,
  Receipt,
  X,
  Monitor,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Zap,
  Layers,
  Copy,
  Check,
  Landmark,
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner.ts';
import {
  CartItem,
  Customer,
  PaymentMethod,
  Product,
  ProductCategory,
  Sale,
  StoreConfig,
} from '../types/pos.ts';
import { STORE_PAYMENT_ACCOUNTS } from '../data/seedData.ts';
import { PaymentProcessingLoader } from './LoadingAnimation.tsx';
import { soundEffects } from '../utils/soundEffects.ts';
import { extractVerifyToken } from '../utils/invoiceAuth.ts';

const BarcodeScannerModal = React.lazy(() =>
  import('./BarcodeScannerModal.tsx').then((m) => ({ default: m.BarcodeScannerModal }))
);

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
  onVerifyInvoiceToken?: (token: string) => void;
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
  onVerifyInvoiceToken,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('');
  const [applyTax, setApplyTax] = useState<boolean>(false); // All sales are Tax Exempt by default unless specially ticked
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [isBulkScanMode, setIsBulkScanMode] = useState(false);
  const [lastIncrementedKey, setLastIncrementedKey] = useState<string | null>(null);
  const [scannerInput, setScannerInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Checkout Tender Modal State
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const paymentAccounts =
    config.paymentAccounts && config.paymentAccounts.length > 0
      ? config.paymentAccounts
      : STORE_PAYMENT_ACCOUNTS;
  const [selectedDigitalAccountId, setSelectedDigitalAccountId] = useState<string>(
    () => paymentAccounts[0]?.id || 'cbe-yohannes'
  );
  const [digitalTxRef, setDigitalTxRef] = useState<string>('');
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
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
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q);
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

  const isSameProductOrSku = useCallback((a: Product, b: Product): boolean => {
    if (a.id === b.id) return true;
    const skuA = a.sku?.trim().toLowerCase();
    const skuB = b.sku?.trim().toLowerCase();
    return Boolean(skuA && skuB && skuA === skuB);
  }, []);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCartLine = useCallback((lineKey: string) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setLastIncrementedKey(lineKey);
    flashTimerRef.current = setTimeout(() => {
      setLastIncrementedKey((prev) => (prev === lineKey ? null : prev));
      flashTimerRef.current = null;
    }, 900);
  }, []);

  // Toggle Bulk Scan Mode; when activating, consolidate any duplicate SKU lines already in the cart
  const handleToggleBulkScanMode = useCallback(() => {
    const next = !isBulkScanMode;
    setIsBulkScanMode(next);
    if (next) {
      setCart((prevCart) => {
        const consolidated: CartItem[] = [];
        for (const item of prevCart) {
          const matchIdx = consolidated.findIndex((c) => isSameProductOrSku(c.product, item.product));
          if (matchIdx >= 0) {
            const target = consolidated[matchIdx];
            const mergedQty = Math.min(target.product.stockLevel, target.quantity + item.quantity);
            const unitPrice = target.customPrice ?? target.product.sellingPrice;
            consolidated[matchIdx] = {
              ...target,
              quantity: mergedQty,
              lineTotal: mergedQty * unitPrice,
              lineCostTotal: mergedQty * target.product.costPrice,
            };
          } else {
            consolidated.push({ ...item });
          }
        }
        return consolidated;
      });
    }
  }, [isBulkScanMode, isSameProductOrSku]);

  // Add Item to Cart from catalog tap (always consolidates by product id)
  const handleAddToCart = (product: Product) => {
    if (product.stockLevel <= 0) return;
    soundEffects.playBeep();

    setCart((prevCart) => {
      const totalInCart = prevCart
        .filter((i) => isSameProductOrSku(i.product, product))
        .reduce((sum, i) => sum + i.quantity, 0);
      if (totalInCart >= product.stockLevel) return prevCart;

      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        const key = existing.lineId || existing.product.id;
        queueMicrotask(() => flashCartLine(key));
        return prevCart.map((item) =>
          (item.lineId || item.product.id) === key
            ? {
                ...item,
                quantity: newQty,
                lineTotal: newQty * (item.customPrice ?? item.product.sellingPrice),
                lineCostTotal: newQty * item.product.costPrice,
              }
            : item
        );
      } else {
        const newKey = `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        queueMicrotask(() => flashCartLine(newKey));
        return [
          ...prevCart,
          {
            lineId: newKey,
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

  // Add Item to Cart from barcode/camera scan respecting Bulk Scan Mode toggle
  const handleScanAddToCart = useCallback(
    (product: Product) => {
      if (product.stockLevel <= 0) return;
      soundEffects.playBeep();

      setCart((prevCart) => {
        const totalInCart = prevCart
          .filter((i) => isSameProductOrSku(i.product, product))
          .reduce((sum, i) => sum + i.quantity, 0);
        if (totalInCart >= product.stockLevel) return prevCart;

        if (isBulkScanMode) {
          const existing = prevCart.find((item) => isSameProductOrSku(item.product, product));
          if (existing) {
            const key = existing.lineId || existing.product.id;
            const newQty = existing.quantity + 1;
            queueMicrotask(() => flashCartLine(key));
            return prevCart.map((item) =>
              (item.lineId || item.product.id) === key
                ? {
                    ...item,
                    quantity: newQty,
                    lineTotal: newQty * (item.customPrice ?? item.product.sellingPrice),
                    lineCostTotal: newQty * item.product.costPrice,
                  }
                : item
            );
          }
        }

        const newKey = `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        queueMicrotask(() => flashCartLine(newKey));
        return [
          ...prevCart,
          {
            lineId: newKey,
            product,
            quantity: 1,
            discountPercent: 0,
            lineTotal: product.sellingPrice,
            lineCostTotal: product.costPrice,
          },
        ];
      });
    },
    [isBulkScanMode, isSameProductOrSku, flashCartLine]
  );

  // Adjust Cart Item Quantity with audio feedback
  const handleUpdateQty = (lineKey: string, delta: number) => {
    if (delta > 0) {
      soundEffects.playBeep();
    } else {
      soundEffects.playTrash();
    }

    setCart((prevCart) => {
      const targetItem = prevCart.find((i) => (i.lineId || i.product.id) === lineKey);
      if (!targetItem) return prevCart;

      const totalForProduct = prevCart
        .filter((i) => i.product.id === targetItem.product.id)
        .reduce((sum, i) => sum + i.quantity, 0);

      return prevCart
        .map((item) => {
          if ((item.lineId || item.product.id) === lineKey) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0 && totalForProduct + delta > item.product.stockLevel) return item; // Cannot exceed inventory
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
  const handleRemoveItem = (lineKey: string) => {
    soundEffects.playTrash();
    setCart((prev) => prev.filter((item) => (item.lineId || item.product.id) !== lineKey));
  };

  // Open Tender Modal
  const handleOpenTender = () => {
    if (cart.length === 0) return;
    setCashTendered(grandTotal.toFixed(2));
    setIsTenderOpen(true);
  };

  // Toast notification for external hardware & Scanner Mode scans
  const [scannerNotification, setScannerNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    barcode: string;
  } | null>(null);

  const isScannerModeRef = useRef(isScannerMode);
  const modalsOpenRef = useRef(false);
  useEffect(() => {
    isScannerModeRef.current = isScannerMode;
  }, [isScannerMode]);
  useEffect(() => {
    modalsOpenRef.current = isTenderOpen || showNewCustModal || isScannerOpen;
  }, [isTenderOpen, showNewCustModal, isScannerOpen]);

  const focusScannerInput = useCallback(() => {
    if (!isScannerModeRef.current || modalsOpenRef.current) return;
    requestAnimationFrame(() => {
      if (isScannerModeRef.current && !modalsOpenRef.current) {
        scannerInputRef.current?.focus();
      }
    });
  }, []);

  // Auto-focus Scanner Mode input when activated or when modals close
  useEffect(() => {
    if (isScannerMode && !isTenderOpen && !showNewCustModal && !isScannerOpen) {
      focusScannerInput();
    }
  }, [isScannerMode, isTenderOpen, showNewCustModal, isScannerOpen, focusScannerInput]);

  // Keyboard shortcut (F2) to toggle Scanner Mode quickly without a mouse click
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isTenderOpen && !showNewCustModal && !isScannerOpen) {
        e.preventDefault();
        setIsScannerMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isTenderOpen, showNewCustModal, isScannerOpen]);

  // Unified barcode/SKU scan processor used by hardware bursts, Scanner Mode input, and Search Enter
  const processScannedCode = useCallback(
    (rawCode: string) => {
      const candidate = rawCode.trim();
      if (!candidate) return;

      // Intercept SAPPY POS Invoice Verification QR codes so staff can authenticate sales via scanner
      const verifyToken = extractVerifyToken(candidate);
      if (verifyToken) {
        soundEffects.playBeep();
        setIsScannerOpen(false);
        setScannerInput('');
        if (onVerifyInvoiceToken) {
          onVerifyInvoiceToken(verifyToken);
        } else if (typeof window !== 'undefined') {
          window.location.hash = `#verify=${verifyToken}`;
        }
        return;
      }

      const lowerCandidate = candidate.toLowerCase();
      const matched = products.find(
        (p) =>
          (p.barcode && p.barcode.trim() === candidate) ||
          (p.sku && p.sku.trim() === candidate) ||
          (p.barcode && p.barcode.trim().toLowerCase() === lowerCandidate) ||
          (p.sku && p.sku.trim().toLowerCase() === lowerCandidate) ||
          p.id === candidate
      );

      if (matched) {
        const totalInCartForMatched = cart
          .filter((item) => isSameProductOrSku(item.product, matched))
          .reduce((sum, item) => sum + item.quantity, 0);
        if (matched.stockLevel <= 0) {
          soundEffects.playError();
          setScannerNotification({
            type: 'error',
            message: `"${matched.name}" is out of stock!`,
            barcode: candidate,
          });
        } else if (totalInCartForMatched >= matched.stockLevel) {
          soundEffects.playError();
          setScannerNotification({
            type: 'error',
            message: `Max stock (${matched.stockLevel} ${matched.unit}) already in cart for "${matched.name}"`,
            barcode: candidate,
          });
        } else {
          handleScanAddToCart(matched);
          const nextQty = totalInCartForMatched + 1;
          setScannerNotification({
            type: 'success',
            message: isBulkScanMode
              ? `Bulk Scan (+1): "${matched.name}" — Qty: ${nextQty} (${config.currencySymbol}${matched.sellingPrice.toFixed(2)})`
              : `Scanned: "${matched.name}" added as new line item (${config.currencySymbol}${matched.sellingPrice.toFixed(2)})`,
            barcode: candidate,
          });
        }
      } else {
        soundEffects.playError();
        setScannerNotification({
          type: 'error',
          message: `Unrecognized barcode: "${candidate}" not found in inventory`,
          barcode: candidate,
        });
      }

      setScannerInput('');
      setSearchQuery((prev) => (prev.trim().toLowerCase() === lowerCandidate ? '' : prev));
      focusScannerInput();

      setTimeout(() => {
        setScannerNotification((prev) => (prev?.barcode === candidate ? null : prev));
      }, 4000);
    },
    [products, cart, config.currencySymbol, focusScannerInput, handleScanAddToCart, isBulkScanMode, isSameProductOrSku, onVerifyInvoiceToken]
  );

  // Hook listening for external USB/Bluetooth barcode scanner input sequences
  const { isScanning } = useBarcodeScanner({
    enabled: !isTenderOpen && !showNewCustModal && !isScannerOpen,
    completeOnIdleMs: isScannerMode ? 180 : 0,
    onScan: (scannedCode) => {
      processScannedCode(scannedCode);
    },
  });

  // Handle Enter / Tab / Escape inside dedicated Scanner Mode input
  const handleScannerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (scannerInput.trim()) {
        e.preventDefault();
        processScannedCode(scannerInput);
      } else if (e.key === 'Enter') {
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (scannerInput) {
        setScannerInput('');
      } else {
        setIsScannerMode(false);
      }
    }
  };

  // Handle paste or newline-terminated mobile barcode wedge input in Scanner Mode
  const handleScannerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes('\n') || val.includes('\r')) {
      const codes = val
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      codes.forEach((code) => processScannedCode(code));
      setScannerInput('');
      return;
    }
    setScannerInput(val);
  };

  // Keep Scanner Mode input focused unless user clicked into another form control or modal
  const handleScannerInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isScannerModeRef.current || modalsOpenRef.current) return;
    const nextTarget = e.relatedTarget as HTMLElement | null;
    if (
      nextTarget &&
      (nextTarget.tagName === 'INPUT' ||
        nextTarget.tagName === 'SELECT' ||
        nextTarget.tagName === 'TEXTAREA' ||
        nextTarget.tagName === 'BUTTON')
    ) {
      return;
    }
    focusScannerInput();
  };

  // Handle Enter key in Search Box to immediately add exact barcode/SKU to cart
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const q = searchQuery.trim();
      const exact = products.find(
        (p) =>
          (p.barcode && p.barcode.trim() === q) ||
          (p.sku && p.sku.trim() === q) ||
          (p.barcode && p.barcode.trim().toLowerCase() === q.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === q.toLowerCase())
      );
      if (exact) {
        e.preventDefault();
        processScannedCode(q);
        setSearchQuery('');
      }
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

      const selectedAcct =
        selectedMethod === 'digital'
          ? paymentAccounts.find((a) => a.id === selectedDigitalAccountId) || paymentAccounts[0]
          : null;
      const digitalNote = selectedAcct
        ? `Paid via ${selectedAcct.shortLabel} (${selectedAcct.accountNumber} · ${selectedAcct.accountHolder})${
            digitalTxRef.trim() ? ` · Ref: ${digitalTxRef.trim()}` : ''
          }`
        : '';
      const combinedNotes = [digitalNote, orderNotes.trim()].filter(Boolean).join(' | ') || undefined;

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
        notes: combinedNotes,
      });

      // Play authentic cash drawer chime
      soundEffects.playCashRegister();

      // Reset Register (all new sales default to Tax Exempt)
      setCart([]);
      setIsProcessingPayment(false);
      setIsTenderOpen(false);
      setOrderNotes('');
      setDigitalTxRef('');
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
    <div className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-6 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 items-start">
      
      {/* Mobile Top Segmented Toggle: Catalog vs Cart */}
      <div className="lg:hidden flex items-center bg-charcoal-950 p-1 rounded-xl border border-charcoal-800 shadow-inner">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
            mobileTab === 'catalog'
              ? 'bg-forest-700 text-white shadow-xs border border-forest-600/60'
              : 'text-charcoal-400 hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Catalog ({filteredProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] relative ${
            mobileTab === 'cart'
              ? 'bg-forest-700 text-white shadow-xs border border-forest-600/60'
              : 'text-charcoal-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-charcoal-950 text-[10px] font-mono font-black">
              {cart.reduce((a, b) => a + b.quantity, 0)} • {config.currencySymbol}{grandTotal.toFixed(2)}
            </span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: Product Catalog (Touchscreen optimized) */}
      <div className={`lg:col-span-8 space-y-4 ${mobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
        
        {/* Search, Scanner Mode & Camera Scan Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isScannerMode ? (
            <div
              onClick={() => scannerInputRef.current?.focus()}
              className="relative flex-1 bg-emerald-950/40 border-2 border-emerald-500/80 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center transition-all cursor-text"
            >
              <div className="pl-3.5 pr-2 flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <Barcode className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                ref={scannerInputRef}
                type="text"
                autoFocus
                data-scanner-controlled="true"
                placeholder="Scanner Mode Ready — scan barcode or type SKU + Enter..."
                value={scannerInput}
                onChange={handleScannerInputChange}
                onKeyDown={handleScannerInputKeyDown}
                onBlur={handleScannerInputBlur}
                className="w-full py-2.5 pr-28 bg-transparent text-sm text-white placeholder-emerald-300/60 focus:outline-hidden font-mono"
              />
              <span className="absolute right-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 pointer-events-none">
                Auto-Add
              </span>
            </div>
          ) : (
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              <input
                type="text"
                data-scanner-controlled="true"
                placeholder="Search stationery by name, SKU, or scan barcode (Enter to add)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-10 pr-16 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-hidden focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 shadow-2xs font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white text-xs cursor-pointer px-1 py-0.5"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerMode((prev) => !prev)}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border ${
                isScannerMode
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-950/60'
                  : 'bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-200 border-charcoal-700 hover:border-emerald-600/60'
              }`}
              title="Toggle dedicated Scanner Mode (F2) — keeps input focused and auto-adds scanned items without clicking"
            >
              <Zap className={`w-4 h-4 ${isScannerMode ? 'text-amber-200' : 'text-emerald-400'}`} />
              <span>{isScannerMode ? 'Scanner Mode: ON' : 'Scanner Mode'}</span>
              <span className="hidden sm:inline-block text-[10px] font-mono opacity-75 px-1 py-0.5 rounded bg-black/25">
                F2
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95 shadow-md shadow-forest-950/60 border border-forest-500/80 group"
              title="Choose Camera Scanner (Select front, rear, or USB webcam)"
            >
              <Camera className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition-transform" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>

        {/* Scanner Control Bar: Hardware USB/Bluetooth, Bulk Scan Mode & Camera Scanner Option */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs -mt-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isScanning || isScannerMode ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isScanning || isScannerMode ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              ></span>
            </span>
            <span className="text-[11px] font-medium text-charcoal-400 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-forest-400" />
              <span>USB / Bluetooth Scanner:</span>
              <strong className="text-emerald-400 font-semibold">
                {isScanning
                  ? 'Scanning...'
                  : isScannerMode
                  ? 'Scanner Mode Focus Locked'
                  : 'Active & Listening'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Scan Mode Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isBulkScanMode}
              onClick={handleToggleBulkScanMode}
              className={`text-[11px] font-semibold flex items-center gap-2 px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                isBulkScanMode
                  ? 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/70 shadow-xs'
                  : 'bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-300 border-charcoal-800'
              }`}
              title="When ON, continuous scanning of the same SKU automatically increments quantity instead of adding multiple line items"
            >
              <Layers className={`w-3.5 h-3.5 ${isBulkScanMode ? 'text-emerald-400' : 'text-charcoal-400'}`} />
              <span>Bulk Scan Mode</span>
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  isBulkScanMode ? 'bg-emerald-500' : 'bg-charcoal-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isBulkScanMode ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span className={`font-mono text-[10px] font-bold ${isBulkScanMode ? 'text-emerald-300' : 'text-charcoal-500'}`}>
                {isBulkScanMode ? 'ON' : 'OFF'}
              </span>
            </button>

            {isScannerMode && (
              <button
                type="button"
                onClick={() => setIsScannerMode(false)}
                className="text-[11px] text-charcoal-300 hover:text-white font-semibold flex items-center gap-1 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Exit Scanner Mode (Esc)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-800 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              title="Choose Camera Scanner option (Select front, rear, or USB webcam)"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Option: Choose Camera Scanner</span>
            </button>
          </div>
        </div>

        {/* Real-time Hardware Scanner Notification Toast */}
        {scannerNotification && (
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in slide-in-from-top-1 ${
              scannerNotification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/90 border-rose-700 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {scannerNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{scannerNotification.message}</span>
            </div>
            <span className="font-mono text-[10px] bg-charcoal-900/80 px-2 py-0.5 rounded border border-charcoal-700">
              #{scannerNotification.barcode}
            </span>
          </div>
        )}

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
            const inCartQty = cart
              .filter((i) => i.product.id === product.id)
              .reduce((sum, i) => sum + i.quantity, 0);
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
                    : inCartQty > 0
                    ? 'bg-forest-950/80 border-forest-600 shadow-xs ring-1 ring-forest-500'
                    : 'bg-charcoal-900 border-charcoal-800 hover:border-forest-600/70 hover:bg-charcoal-800 hover:shadow-xs active:scale-[0.98]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-mono text-charcoal-400 uppercase">
                      {product.sku}
                    </span>
                    {inCartQty > 0 && (
                      <span className="w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {inCartQty}
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
      <div className={`lg:col-span-4 bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-xl flex flex-col ${
        mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
      } h-auto lg:h-[calc(100vh-140px)] lg:sticky lg:top-20`}>
        
        {/* Mobile "Back to Catalog" Navigation Bar */}
        <div className="lg:hidden p-3 bg-charcoal-950 border-b border-charcoal-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileTab('catalog')}
            className="text-xs font-bold text-forest-300 hover:text-white flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-xl bg-charcoal-900 border border-charcoal-700 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-forest-400" />
            <span>Add More Items</span>
          </button>
          <span className="text-[11px] font-mono text-charcoal-400">
            {cart.reduce((a, b) => a + b.quantity, 0)} item{cart.reduce((a, b) => a + b.quantity, 0) === 1 ? '' : 's'}
          </span>
        </div>

        {/* Cart Header */}
        <div className="p-4 border-b border-charcoal-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-forest-900/60 text-forest-400 border border-forest-700/50 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight">Current Sale</h2>
              <p className="text-[11px] text-charcoal-400">{cart.length} line item{cart.length === 1 ? '' : 's'}</p>
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
            cart.map((item) => {
              const lineKey = item.lineId || item.product.id;
              const isHighlighted = lastIncrementedKey === lineKey;
              return (
              <div
                key={lineKey}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all duration-300 ${
                  isHighlighted
                    ? 'bg-emerald-950/50 border-emerald-500/80 ring-1 ring-emerald-500/40'
                    : 'bg-charcoal-950/80 border-charcoal-800'
                }`}
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
                    onClick={() => handleUpdateQty(lineKey, -1)}
                    className="w-7 h-7 rounded flex items-center justify-center text-charcoal-300 hover:bg-forest-900/50 hover:text-forest-300 transition-colors cursor-pointer active:scale-90"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQty(lineKey, 1)}
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
                    onClick={() => handleRemoveItem(lineKey)}
                    className="text-charcoal-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-auto" />
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Cart Calculation Footer & Quick Actions */}
        <div className="p-4 border-t border-charcoal-800 bg-charcoal-950/90 rounded-b-2xl space-y-3">
          
          {/* Quick Discount & Tax Toggle */}
          <div className="flex items-center justify-between text-xs text-charcoal-400 pt-1 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[11px] text-charcoal-300 whitespace-nowrap">
                Discount ({(config?.currencySymbol || 'Br').trim()}):
              </span>
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-charcoal-400 select-none">
                  {(config?.currencySymbol || 'Br').trim()}
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

      {/* Mobile Floating Bottom Cart Pill (when browsing catalog on mobile) */}
      {mobileTab === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 bg-gradient-to-r from-forest-900 via-forest-800 to-forest-700 border border-forest-500/90 text-white rounded-2xl p-2.5 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 pl-1.5">
            <span className="w-8 h-8 rounded-xl bg-charcoal-950/90 border border-forest-500/60 font-mono font-black text-xs text-amber-400 flex items-center justify-center">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
            <div>
              <p className="text-[10px] uppercase font-bold text-forest-200 leading-tight">Order Total</p>
              <p className="text-sm font-mono font-black text-white">
                {config.currencySymbol}{grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className="px-3 py-2 bg-charcoal-950/80 hover:bg-charcoal-950 text-white text-xs font-bold rounded-xl border border-charcoal-700 cursor-pointer min-h-[38px]"
            >
              View Cart
            </button>
            <button
              type="button"
              onClick={() => {
                setCashTendered(grandTotal.toString());
                setIsTenderOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-charcoal-950 text-xs font-black rounded-xl shadow-md cursor-pointer active:scale-95 flex items-center gap-1 min-h-[38px]"
            >
              <span>Charge</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TENDER CHECKOUT MODAL */}
      {isTenderOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-charcoal-800 flex flex-col my-auto text-charcoal-100">
            
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

              {/* CARD PAYMENT TAB */}
              {selectedMethod === 'card' && (
                <div className="p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-forest-900/60 text-forest-400 border border-forest-700/40 flex items-center justify-center mx-auto">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Present Card to Terminal</h4>
                  <p className="text-xs text-charcoal-400 max-w-xs mx-auto">
                    Acknowledge terminal authorization for{' '}
                    <span className="font-mono text-forest-400 font-bold">
                      {config.currencySymbol}{grandTotal.toFixed(2)}
                    </span>.
                  </p>
                </div>
              )}

              {/* DIGITAL / BANK & TELEBIRR ACCOUNTS TAB */}
              {selectedMethod === 'digital' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-charcoal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-forest-400" />
                      <span>Select Bank / Telebirr Account</span>
                    </p>
                    <span className="text-[11px] font-mono text-forest-400 font-bold">
                      {config.currencySymbol}{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {paymentAccounts.map((acct) => {
                      const isSelected = selectedDigitalAccountId === acct.id;
                      const isCopied = copiedAccountId === acct.id;
                      return (
                        <div
                          key={acct.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            soundEffects.playClick();
                            setSelectedDigitalAccountId(acct.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDigitalAccountId(acct.id);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-forest-950/80 border-forest-500 shadow-xs ring-1 ring-forest-500/30'
                              : 'bg-charcoal-950 border-charcoal-800 hover:border-charcoal-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${
                                  acct.type === 'mobile'
                                    ? 'bg-sky-950/90 text-sky-300 border border-sky-800/70'
                                    : 'bg-charcoal-800 text-forest-300 border border-charcoal-700'
                                }`}
                              >
                                {acct.shortLabel}
                              </span>
                              <span className="text-[11px] text-charcoal-300 truncate font-medium">
                                {acct.accountHolder}
                              </span>
                            </div>
                            <p className="font-mono font-bold text-xs text-white mt-1 tracking-wide">
                              {acct.accountNumber}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(acct.accountNumber).catch(() => {});
                              setCopiedAccountId(acct.id);
                              setTimeout(() => {
                                setCopiedAccountId((prev) => (prev === acct.id ? null : prev));
                              }, 1500);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border shrink-0 cursor-pointer transition-colors ${
                              isCopied
                                ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                                : 'bg-charcoal-900 hover:bg-charcoal-800 border-charcoal-700 text-charcoal-300 hover:text-white'
                            }`}
                            title={`Copy ${acct.shortLabel} account number`}
                          >
                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-charcoal-400 mb-1">
                      Transfer / Telebirr Transaction Ref # (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FT26118... or Telebirr ref"
                      value={digitalTxRef}
                      onChange={(e) => setDigitalTxRef(e.target.value)}
                      className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-mono text-white placeholder-charcoal-500 focus:ring-1 focus:ring-forest-500 focus:border-forest-500"
                    />
                  </div>
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

      {/* Live Camera QR code & Barcode Scanner Modal */}
      {isScannerOpen && (
        <React.Suspense fallback={null}>
          <BarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            products={products}
            onAddToCart={handleScanAddToCart}
            config={config}
            onVerifyInvoiceToken={onVerifyInvoiceToken}
          />
        </React.Suspense>
      )}

    </div>
  );
};

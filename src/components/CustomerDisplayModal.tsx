import React, { useState } from 'react';
import {
  Monitor,
  Printer,
  X,
  Store,
  Receipt,
  QrCode,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  ShoppingBag,
} from 'lucide-react';
import { CartItem, Customer, Sale, StoreConfig, AppUser } from '../types/pos.ts';

interface CustomerDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount: number;
  taxAmount: number;
  taxRate: number;
  grandTotal: number;
  customer?: Customer | null;
  config: StoreConfig;
  cashTendered?: number;
  cashChange?: number;
  currentUser?: AppUser | null;
  completedSale?: Sale | null;
}

export const CustomerDisplayModal: React.FC<CustomerDisplayModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  discountAmount,
  taxAmount,
  taxRate,
  grandTotal,
  customer,
  config,
  cashTendered = 0,
  cashChange = 0,
  currentUser,
  completedSale,
}) => {
  const [activeView, setActiveView] = useState<'display' | 'thermal'>('display');

  if (!isOpen) return null;

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handlePrintThermal = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-charcoal-950/90 backdrop-blur-md animate-fade-in">
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="no-print bg-charcoal-950 px-6 py-4 flex items-center justify-between border-b border-charcoal-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest-950 border border-forest-600/70 flex items-center justify-center text-forest-400">
              {activeView === 'display' ? <Monitor className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{activeView === 'display' ? 'Customer Facing Counter Screen' : '80mm Thermal Receipt Slip'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-forest-950 text-forest-300 border border-forest-700">
                  Live View
                </span>
              </h2>
              <p className="text-xs text-charcoal-400">
                {activeView === 'display'
                  ? 'Real-time high-contrast screen for customers standing at the checkout terminal.'
                  : 'Standard 80mm ESC/POS roll format for instant receipt printing.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Switcher */}
            <div className="flex items-center p-1 bg-charcoal-900 rounded-xl border border-charcoal-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveView('display')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'display'
                    ? 'bg-forest-700 text-white shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                Customer Screen
              </button>
              <button
                type="button"
                onClick={() => setActiveView('thermal')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'thermal'
                    ? 'bg-forest-700 text-white shadow-xs'
                    : 'text-charcoal-400 hover:text-white'
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>

            {activeView === 'thermal' && (
              <button
                type="button"
                onClick={handlePrintThermal}
                className="px-3.5 py-1.5 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center gap-1.5 border border-forest-500 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-charcoal-400 hover:text-white rounded-lg hover:bg-charcoal-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: CUSTOMER FACING COUNTER DISPLAY */}
        {/* ======================================================== */}
        {activeView === 'display' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Store Brand Banner */}
            <div className="bg-gradient-to-r from-forest-950 via-charcoal-950 to-forest-950 border border-forest-800/80 rounded-2xl p-5 text-center relative overflow-hidden shadow-lg">
              <p className="text-[11px] font-mono tracking-widest uppercase text-forest-400 font-bold mb-1">
                Welcome to
              </p>
              <h1 className="text-3xl font-black font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 tracking-wider">
                {config.storeName}
              </h1>
              <p className="text-xs text-charcoal-300 mt-1 font-mono">
                {config.tagline || 'Quality Paper, Pens, Art & Office Essentials'} · {config.address}
              </p>
            </div>

            {/* Main Display Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Scanned Items (7 Cols) */}
              <div className="lg:col-span-7 bg-charcoal-950 rounded-2xl border border-charcoal-800 p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-charcoal-800 text-xs text-charcoal-400 font-mono">
                  <span>ITEMS SCANNED ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
                  <span>PRICE</span>
                </div>

                {cart.length === 0 ? (
                  <div className="py-12 text-center text-charcoal-500 space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto text-charcoal-600" />
                    <p className="text-sm font-semibold">Your cart is currently empty</p>
                    <p className="text-xs text-charcoal-600">Items will appear here live as they are rung up at the register.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-3 rounded-xl bg-charcoal-900 border border-charcoal-800/90 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-charcoal-400 font-mono mt-0.5">
                            {item.quantity} × {config.currencySymbol}{item.product.sellingPrice.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-mono font-black text-base text-forest-300 shrink-0">
                          {config.currencySymbol}{item.lineTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Pricing & Change Big Numbers (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Grand Total Highlight Box */}
                <div className="bg-forest-950/70 border-2 border-forest-500 rounded-2xl p-6 text-center shadow-xl space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-forest-300">
                    Grand Total Due
                  </span>
                  <div className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight drop-shadow-sm">
                    {config.currencySymbol}{grandTotal.toFixed(2)}
                  </div>
                  {discountAmount > 0 && (
                    <p className="text-xs font-mono text-forest-400 pt-1">
                      Includes Store Discount (-{config.currencySymbol}{discountAmount.toFixed(2)})
                    </p>
                  )}
                </div>

                {/* Subtotals & Taxes breakdown */}
                <div className="bg-charcoal-950 rounded-2xl border border-charcoal-800 p-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-charcoal-400">
                    <span>Subtotal:</span>
                    <span className="text-white font-bold">{config.currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  {taxAmount > 0 ? (
                    <div className="flex justify-between text-amber-400">
                      <span>VAT ({taxRate}%):</span>
                      <span className="font-bold">+{config.currencySymbol}{taxAmount.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-charcoal-500">
                      <span>VAT Tax:</span>
                      <span>Tax Exempt (0.00)</span>
                    </div>
                  )}

                  {cashTendered > 0 && (
                    <div className="pt-2 border-t border-charcoal-800 space-y-2">
                      <div className="flex justify-between text-charcoal-300 font-bold">
                        <span>Cash Tendered:</span>
                        <span className="text-white">{config.currencySymbol}{cashTendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-forest-400 font-black">
                        <span>Change Due:</span>
                        <span className="text-base text-forest-300">{config.currencySymbol}{cashChange.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Info Card if Selected */}
                {customer && (
                  <div className="bg-charcoal-950 rounded-2xl border border-charcoal-800 p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] font-mono text-charcoal-500 uppercase">Valued Customer</p>
                      <p className="font-bold text-white text-sm">{customer.name}</p>
                      {customer.phone && <p className="text-[11px] font-mono text-charcoal-400">{customer.phone}</p>}
                    </div>
                    {customer.creditBalance > 0 && (
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-amber-400 block">Credit Account</span>
                        <span className="text-amber-300 font-bold text-xs">
                          {config.currencySymbol}{customer.creditBalance.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

            {/* Footer Tag */}
            <div className="text-center text-xs text-charcoal-500 font-mono pt-2">
              <span>Stationery & Office Retail · All major payment methods accepted · {config.receiptFooter}</span>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: 80MM THERMAL RECEIPT SLIP PREVIEW */}
        {/* ======================================================== */}
        {activeView === 'thermal' && (
          <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-charcoal-950">
            
            {/* The 80mm Thermal Receipt (Standard 300px width) */}
            <div className="w-[320px] bg-white text-black p-5 shadow-2xl font-mono text-[11px] leading-relaxed rounded-sm border border-neutral-300 print:w-full print:border-none print:shadow-none">
              
              {/* Store Header */}
              <div className="text-center pb-3 border-b border-dashed border-black space-y-0.5">
                <h2 className="font-bold text-base tracking-wider uppercase font-sans">
                  {config.storeName}
                </h2>
                <p className="text-[10px]">{config.tagline || 'Quality Stationery & Office Supplies'}</p>
                <p className="text-[10px]">{config.address}</p>
                <p className="text-[10px]">Tel: {config.phone || '0911234567'}</p>
                {config.taxId && <p className="text-[10px] font-bold">TIN: {config.taxId}</p>}
              </div>

              {/* Transaction Metadata */}
              <div className="py-2.5 border-b border-dashed border-black text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>RECEIPT #:</span>
                  <span className="font-bold">{completedSale?.invoiceNumber || `REC-${Date.now().toString().slice(-6)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{dateFormatted} {timeFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span className="font-semibold">{currentUser?.fullName || 'Counter Staff'}</span>
                </div>
                {customer && (
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="font-bold truncate max-w-[170px]">{customer.name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2.5 border-b border-dashed border-black space-y-1">
                <div className="flex justify-between font-bold text-[10px] border-b border-neutral-300 pb-1">
                  <span>ITEM / QTY</span>
                  <span>AMOUNT</span>
                </div>

                {(completedSale?.items || cart).map((item: any, idx: number) => {
                  const name = item.product ? item.product.name : item.name;
                  const qty = item.quantity;
                  const unitPrice = item.product ? item.product.sellingPrice : item.unitPrice;
                  const lineTotal = item.lineTotal;

                  return (
                    <div key={idx} className="space-y-0.5">
                      <p className="font-semibold truncate text-[11px]">{name}</p>
                      <div className="flex justify-between text-[10px] text-neutral-600">
                        <span>{qty} × {config.currencySymbol}{unitPrice.toFixed(2)}</span>
                        <span className="text-black font-bold font-mono">{config.currencySymbol}{lineTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Financial Totals */}
              <div className="py-2.5 border-b border-dashed border-black space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{config.currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-{config.currencySymbol}{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>VAT ({taxRate}%):</span>
                    <span>+{config.currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-black pt-1 mt-1">
                  <span>TOTAL DUE:</span>
                  <span>{config.currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>
                {cashTendered > 0 && (
                  <>
                    <div className="flex justify-between text-[10px] pt-1">
                      <span>CASH TENDERED:</span>
                      <span>{config.currencySymbol}{cashTendered.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>CHANGE GIVEN:</span>
                      <span>{config.currencySymbol}{cashChange.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* QR Code & Barcode Mock Footer */}
              <div className="text-center pt-3 space-y-1.5">
                <div className="flex justify-center">
                  <div className="p-1.5 bg-neutral-100 border border-neutral-300 rounded">
                    <QrCode className="w-16 h-16 text-black" />
                  </div>
                </div>
                <p className="text-[9px] uppercase tracking-wider font-semibold">
                  Scan to verify electronic invoice
                </p>
                <p className="text-[9px] leading-tight text-neutral-700 pt-1">
                  {config.receiptFooter}
                </p>
                <p className="text-[8px] text-neutral-500 pt-1">
                  *** Thank You for Shopping with SAPPY ***
                </p>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

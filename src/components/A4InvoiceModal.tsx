import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle, Clock } from 'lucide-react';
import { Sale, StoreConfig } from '../types/pos.ts';

interface A4InvoiceModalProps {
  sale: Sale | null;
  config: StoreConfig;
  onClose: () => void;
}

export const A4InvoiceModal: React.FC<A4InvoiceModalProps> = ({
  sale,
  config,
  onClose,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(sale.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCredit = sale.paymentMethod === 'credit';
  const isPaid = !isCredit || sale.isCreditPaid;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col my-auto border border-charcoal-800 overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Top Action Toolbar (Hidden during print) */}
        <div className="no-print bg-charcoal-900 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-forest-700 flex items-center justify-center font-bold text-white text-sm">
              S
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Tax Invoice Preview</h2>
              <p className="text-xs text-charcoal-300 font-mono">{sale.invoiceNumber} · A4 Format</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-charcoal-300 hover:text-white rounded-lg hover:bg-charcoal-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div
          ref={invoiceRef}
          className="printable-invoice-container p-8 sm:p-12 text-charcoal-900 bg-white max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0"
          style={{ minHeight: '840px' }}
        >
          {/* Header Lockup */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b-2 border-charcoal-900 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img
                  src="/icon.jpg"
                  alt="Sappy"
                  className="w-12 h-12 rounded-xl object-cover border border-amber-600/50 shadow-sm"
                />
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-charcoal-900 uppercase">
                    {config.storeName}
                  </h1>
                  <p className="text-xs text-charcoal-500 font-medium">{config.tagline}</p>
                </div>
              </div>
              <div className="text-xs text-charcoal-600 space-y-0.5 mt-2">
                <p>{config.address}</p>
                <p>Phone: {config.phone} · Email: {config.email}</p>
                <p className="font-mono text-charcoal-700">Tax Registration / TIN: {config.taxId}</p>
              </div>
            </div>

            {/* Invoice Meta Badges */}
            <div className="text-left sm:text-right flex flex-col sm:items-end">
              <span className="text-xs uppercase tracking-widest font-bold text-forest-900 bg-forest-50 px-3 py-1 rounded-md mb-2 border border-forest-200">
                Commercial Tax Invoice
              </span>
              <p className="text-xl font-bold font-mono tracking-tight text-charcoal-900">
                {sale.invoiceNumber}
              </p>
              <div className="text-xs text-charcoal-600 mt-2 space-y-0.5">
                <p><span className="text-charcoal-400">Issue Date:</span> {formattedDate}</p>
                <p><span className="text-charcoal-400">Time:</span> {formattedTime}</p>
                {sale.creditDueDate && (
                  <p className="font-medium text-amber-700">
                    <span className="text-slate-400">Due Date:</span> {sale.creditDueDate}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bill-To & Payment Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-slate-200 text-xs">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Billed To Customer:
              </p>
              <p className="text-sm font-bold text-slate-900">{sale.customerName}</p>
              {sale.customerPhone && (
                <p className="text-slate-600 mt-0.5">Phone: {sale.customerPhone}</p>
              )}
              {sale.customerEmail && (
                <p className="text-slate-600">Email: {sale.customerEmail}</p>
              )}
              {sale.customerAddress && (
                <p className="text-slate-600 mt-0.5">{sale.customerAddress}</p>
              )}
            </div>

            <div className="sm:text-right flex flex-col sm:items-end justify-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Payment Status:
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold font-mono uppercase">
                {isPaid ? (
                  <span className="flex items-center gap-1.5 text-forest-900 bg-forest-50 px-2.5 py-1 rounded border border-forest-200">
                    <CheckCircle className="w-3.5 h-3.5" />
                    PAID IN FULL · {sale.paymentMethod.toUpperCase()}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    CREDIT ACCOUNT · PAYMENT PENDING
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] mt-1.5">
                Payment Method: <span className="font-semibold text-slate-800 capitalize">{sale.paymentMethod}</span>
              </p>
            </div>
          </div>

          {/* Itemized Line Table */}
          <div className="py-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 text-slate-900 uppercase font-bold text-[11px]">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-2">Description / SKU</th>
                  <th className="py-2.5 px-2 text-center w-16">Unit</th>
                  <th className="py-2.5 px-2 text-right w-16">Qty</th>
                  <th className="py-2.5 px-2 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-2 text-right w-28">Total ({config.currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[10px] font-mono text-slate-500">SKU: {item.sku}</p>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600 font-medium">{item.unit}</td>
                    <td className="py-3 px-2 text-right font-mono font-medium">{item.quantity}</td>
                    <td className="py-3 px-2 text-right font-mono">
                      {config.currencySymbol}{item.unitPrice.toFixed(2)}
                      {item.discountPercent > 0 && (
                        <span className="block text-[10px] text-emerald-600">-{item.discountPercent}%</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900">
                      {config.currencySymbol}{item.lineTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Financial Breakdown */}
          <div className="border-t-2 border-slate-900 pt-4 flex flex-col sm:flex-row justify-between gap-6">
            {/* Payment & Bank Terms */}
            <div className="text-xs text-slate-600 max-w-sm space-y-2">
              <div>
                <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Remittance / Bank Instructions:
                </p>
                <p className="text-slate-600 text-[11px] font-mono mt-0.5">{config.bankDetails}</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Stationery Terms & Notes:
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Goods received in good condition. Returns accepted within 7 days with original invoice.
                  {sale.notes && <span className="block italic text-slate-700 mt-1">Note: {sale.notes}</span>}
                </p>
              </div>
            </div>

            {/* Calculations Box */}
            <div className="w-full sm:w-72 space-y-1.5 text-xs text-slate-700 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Subtotal:</span>
                <span className="font-semibold">{config.currencySymbol}{sale.subtotal.toFixed(2)}</span>
              </div>

              {sale.discountAmount > 0 && (
                <div className="flex justify-between py-1 text-emerald-700 border-b border-slate-100">
                  <span className="font-sans">Order Discount:</span>
                  <span>-{config.currencySymbol}{sale.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">
                  {sale.taxAmount > 0 ? `Tax / VAT (${sale.taxRate}%):` : 'Tax / VAT Status:'}
                </span>
                <span className={sale.taxAmount === 0 ? 'text-slate-600' : ''}>
                  {sale.taxAmount > 0 ? `${config.currencySymbol}${sale.taxAmount.toFixed(2)}` : '0.00 (Exempt)'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b-2 border-charcoal-900 text-sm font-bold text-charcoal-900">
                <span className="font-sans">Invoice Total:</span>
                <span className="text-base text-forest-900 font-extrabold">
                  {config.currencySymbol}{sale.totalAmount.toFixed(2)}
                </span>
              </div>

              {sale.paymentMethod === 'cash' ? (
                <>
                  <div className="flex justify-between py-1 text-[11px] text-slate-600">
                    <span className="font-sans">Cash Tendered:</span>
                    <span>{config.currencySymbol}{sale.amountTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-[11px] text-slate-600 font-bold">
                    <span className="font-sans">Change Given:</span>
                    <span>{config.currencySymbol}{sale.changeGiven.toFixed(2)}</span>
                  </div>
                </>
              ) : isCredit ? (
                <>
                  <div className="flex justify-between py-1 text-[11px] text-slate-600">
                    <span className="font-sans">Deposit / Paid Now:</span>
                    <span>{config.currencySymbol}{sale.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-[11px] text-amber-800 font-bold">
                    <span className="font-sans">Balance Payable:</span>
                    <span>
                      {config.currencySymbol}{(sale.totalAmount - (sale.paidAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Footer Signature & Appreciation */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
            <div>
              <p className="text-[11px] text-slate-600 font-medium mb-8">Customer Acknowledgement & Signature:</p>
              <div className="w-48 border-b border-slate-400"></div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Representative</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-600 font-medium mb-8">For {config.storeName}:</p>
              <div className="w-48 border-b border-slate-400 ml-auto"></div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Store Cashier / Stamp</p>
            </div>
          </div>

          <div className="mt-8 text-center text-[11px] text-slate-400 font-medium">
            {config.receiptFooter}
          </div>
        </div>

        {/* Modal Footer (No-print) */}
        <div className="no-print bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: In your browser print dialog, choose &quot;Save as PDF&quot; or select your local printer.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

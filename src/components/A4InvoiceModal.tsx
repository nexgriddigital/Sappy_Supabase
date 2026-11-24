import React, { useMemo, useRef, useState } from 'react';
import { Printer, X, CheckCircle, Clock, RotateCcw, ShieldCheck, QrCode, Zap } from 'lucide-react';
import { Sale, StoreConfig } from '../types/pos.ts';
import { SappyLogo } from './SappyLogo.tsx';
import { generateQrSvgPath } from '../utils/barcodeGenerator.ts';
import {
  encodeInvoicePlainTextQr,
  encodeInvoiceVerificationUrl,
  getEffectivePaidAmount,
} from '../utils/invoiceAuth.ts';

interface A4InvoiceModalProps {
  sale: Sale | null;
  config: StoreConfig;
  onClose: () => void;
  onVerifyPreview?: (tokenOrUrl: string) => void;
}

type InvoiceQrMode = 'universal' | 'link';

export const A4InvoiceModal: React.FC<A4InvoiceModalProps> = ({
  sale,
  config,
  onClose,
  onVerifyPreview,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isQuickPrinting, setIsQuickPrinting] = useState(false);
  const [qrMode, setQrMode] = useState<InvoiceQrMode>(() => {
    try {
      const saved = localStorage.getItem('sappy_invoice_qr_mode');
      return saved === 'link' ? 'link' : 'universal';
    } catch {
      return 'universal';
    }
  });

  const handleChangeQrMode = (mode: InvoiceQrMode) => {
    setQrMode(mode);
    try {
      localStorage.setItem('sappy_invoice_qr_mode', mode);
    } catch {}
  };

  const verificationData = useMemo(() => {
    if (!sale) return null;
    const encoded = encodeInvoiceVerificationUrl(sale, config);
    const plainQr = encodeInvoicePlainTextQr(sale, config);
    const qrContent = qrMode === 'link' ? encoded.url : plainQr.text;
    // ISO/IEC 18004 mandates at least 4 modules of quiet zone for reliable scanning across all QR scanners
    const qrSvg = generateQrSvgPath(qrContent, 4, 'M');
    const effectivePaid = getEffectivePaidAmount(sale);
    const totalUnits = sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return {
      ...encoded,
      plainQrText: plainQr.text,
      qrContent,
      qrSvg,
      effectivePaid,
      totalUnits,
    };
  }, [sale, config, qrMode]);

  const settlementSummary = useMemo(() => {
    if (!sale) return { methodLabel: '', extraNotes: '' };

    const rawNotes = (sale.notes || '').trim();
    const noteSegments = rawNotes
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    const paidViaSegment = noteSegments.find((seg) => /^Paid via\s+/i.test(seg));
    const remainingNotes = noteSegments
      .filter((seg) => seg !== paidViaSegment)
      .join(' · ');

    if (sale.paymentMethod === 'cash') {
      return {
        methodLabel: 'Cash',
        extraNotes: remainingNotes,
      };
    }

    if (sale.paymentMethod === 'card') {
      return {
        methodLabel: 'Card / POS Terminal',
        extraNotes: remainingNotes,
      };
    }

    if (sale.paymentMethod === 'credit') {
      const creditStatus = sale.isCreditPaid
        ? 'Credit Account (Settled)'
        : verificationData && verificationData.effectivePaid > 0
          ? 'Credit Account (Partial Payment)'
          : 'Credit Account';
      return {
        methodLabel: creditStatus,
        extraNotes: remainingNotes,
      };
    }

    // Digital / Bank / Telebirr payment: extract only the method/channel name (and optional Ref)
    if (paidViaSegment) {
      const channelMatch = paidViaSegment.match(/^Paid via\s+([^(·]+)/i);
      const refMatch = paidViaSegment.match(/·\s*Ref:\s*(.+)$/i);
      const channel = channelMatch ? channelMatch[1].trim() : 'Digital / Bank Transfer';
      const refSuffix = refMatch ? ` (Ref: ${refMatch[1].trim()})` : '';
      return {
        methodLabel: `${channel}${refSuffix}`,
        extraNotes: remainingNotes,
      };
    }

    return {
      methodLabel: 'Digital / Bank Transfer',
      extraNotes: remainingNotes,
    };
  }, [sale, verificationData]);

  if (!sale || !verificationData) return null;

  const handlePrint = () => {
    window.print();
  };

  // Directly prints only the A4 invoice via an isolated hidden frame, bypassing preview chrome
  const handleQuickPrint = () => {
    const invoiceEl = invoiceRef.current;
    if (!invoiceEl || typeof document === 'undefined') {
      window.print();
      return;
    }

    setIsQuickPrinting(true);
    let fallbackTriggered = false;
    const triggerFallback = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      setIsQuickPrinting(false);
      window.print();
    };

    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      const frameWin = iframe.contentWindow;
      if (!frameDoc || !frameWin) {
        iframe.remove();
        triggerFallback();
        return;
      }

      // Clone active styles so Tailwind classes and custom fonts apply identically
      const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('\n');

      // Clone invoice HTML with resolved absolute image sources
      const clone = invoiceEl.cloneNode(true) as HTMLElement;
      clone.classList.remove('max-h-[85vh]', 'overflow-y-auto');
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.minHeight = 'auto';
      clone.querySelectorAll('img').forEach((img) => {
        if (img.src) img.setAttribute('src', img.src);
      });

      frameDoc.open();
      frameDoc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${sale.invoiceNumber} - ${config.storeName}</title>
    ${styleTags}
    <style>
      @page { size: A4 portrait; margin: 12mm 15mm; }
      html, body { background: #ffffff !important; color: #000000 !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .printable-invoice-container { max-height: none !important; overflow: visible !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
    </style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`);
      frameDoc.close();

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        setIsQuickPrinting(false);
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 300);
      };

      frameWin.onafterprint = cleanup;

      const executePrint = () => {
        try {
          frameWin.focus();
          frameWin.print();
          // Ensure cleanup even on browsers where onafterprint is delayed or suppressed
          setTimeout(cleanup, 1500);
        } catch {
          try {
            iframe.remove();
          } catch {}
          triggerFallback();
        }
      };

      const imgs = Array.from(frameDoc.querySelectorAll('img'));
      if (imgs.length === 0) {
        setTimeout(executePrint, 80);
      } else {
        let settled = false;
        const proceed = () => {
          if (settled) return;
          settled = true;
          setTimeout(executePrint, 60);
        };
        let remaining = imgs.length;
        imgs.forEach((img) => {
          if (img.complete) {
            remaining -= 1;
            if (remaining <= 0) proceed();
          } else {
            img.addEventListener('load', () => {
              remaining -= 1;
              if (remaining <= 0) proceed();
            });
            img.addEventListener('error', () => {
              remaining -= 1;
              if (remaining <= 0) proceed();
            });
          }
        });
        setTimeout(proceed, 450);
      }
    } catch {
      triggerFallback();
    }
  };

  const handleOpenVerification = () => {
    if (onVerifyPreview) {
      onVerifyPreview(verificationData.url);
    } else if (typeof window !== 'undefined') {
      window.location.hash = `#v=${verificationData.token}`;
    }
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
              type="button"
              onClick={handleOpenVerification}
              className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-emerald-300 border border-charcoal-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Open live sale QR authentication view"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Verify QR</span>
            </button>
            <button
              type="button"
              onClick={handleQuickPrint}
              disabled={isQuickPrinting}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-charcoal-950 text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95 border border-amber-400"
              title="Directly print invoice to system printer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isQuickPrinting ? 'Printing...' : 'Quick Print'}</span>
            </button>
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
                <SappyLogo variant="icon" size="lg" />
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-charcoal-900 uppercase">
                    {config.storeName}
                  </h1>
                  <p className="text-xs text-charcoal-500 font-serif">{config.tagline}</p>
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
                {sale.isReturned ? (
                  <span className="flex items-center gap-1.5 text-rose-900 bg-rose-50 px-2.5 py-1 rounded border border-rose-300">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    SALE REVERSED / RETURNED
                  </span>
                ) : isPaid ? (
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
                Payment Method: <span className="font-semibold text-slate-800">{settlementSummary.methodLabel}</span>
              </p>
              {sale.isReturned && (
                <div className="mt-2 text-right">
                  <p className="text-[10px] text-rose-700 font-semibold">
                    Reversed at: {new Date(sale.returnedAt || '').toLocaleString()}
                  </p>
                  {sale.returnReason && (
                    <p className="text-[10px] text-slate-600 italic">
                      Reason: {sale.returnReason}
                    </p>
                  )}
                </div>
              )}
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
                      {((item.quantity * item.unitPrice) - item.lineTotal) > 0.009 && (
                        <span className="block text-[10px] text-emerald-600">
                          (-{config.currencySymbol}{((item.quantity * item.unitPrice) - item.lineTotal).toFixed(2)})
                        </span>
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
            {/* Settlement Payment Method & Terms */}
            <div className="text-xs text-slate-600 max-w-sm space-y-2">
              <div>
                <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Settled Via:
                </p>
                <p className="text-slate-800 text-xs font-semibold mt-0.5">
                  {settlementSummary.methodLabel}
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Stationery Terms & Notes:
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Goods received in good condition. Returns accepted within 7 days with original invoice.
                  {settlementSummary.extraNotes && (
                    <span className="block italic text-slate-700 mt-1">Note: {settlementSummary.extraNotes}</span>
                  )}
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
                  <div className="flex justify-between py-1 text-[11px] text-emerald-800 font-bold">
                    <span className="font-sans">Amount Paid:</span>
                    <span>{config.currencySymbol}{verificationData.effectivePaid.toFixed(2)}</span>
                  </div>
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
                    <span>{config.currencySymbol}{verificationData.effectivePaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-[11px] text-amber-800 font-bold">
                    <span className="font-sans">Balance Payable:</span>
                    <span>
                      {config.currencySymbol}{(sale.totalAmount - verificationData.effectivePaid).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1 text-[11px] text-emerald-800 font-bold">
                  <span className="font-sans">Amount Paid ({sale.paymentMethod.toUpperCase()}):</span>
                  <span>{config.currencySymbol}{verificationData.effectivePaid.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code Sale Authentication & Verification Strip */}
          <div className="mt-5 p-4 rounded-xl border border-slate-300 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-5 break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <div className="bg-white p-1 rounded-lg border border-slate-300 shadow-2xs shrink-0">
                <svg
                  className="w-40 h-40 sm:w-44 sm:h-44 block"
                  viewBox={`0 0 ${verificationData.qrSvg.size} ${verificationData.qrSvg.size}`}
                  shapeRendering="crispEdges"
                  preserveAspectRatio="xMidYMid meet"
                  aria-label={`Verification QR code for invoice ${sale.invoiceNumber}`}
                >
                  <rect width="100%" height="100%" fill="#ffffff" />
                  <path d={verificationData.qrSvg.pathData} fill="#000000" />
                </svg>
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-forest-50 border border-forest-200 text-forest-900 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-700" />
                  <span>Authenticate Sale · Scan With Any QR Scanner</span>
                </div>
                <p className="text-xs font-bold text-slate-900 font-mono">
                  Auth Code: {verificationData.authCode}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug max-w-md mx-auto sm:mx-0">
                  {qrMode === 'universal'
                    ? 'Universal QR mode: works offline with any phone camera, QR reader app, or POS scanner to display verified payment amount, status, and full item list.'
                    : 'Web Link QR mode: scan with smartphone camera to open the live interactive sale verification page in your browser.'}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 pt-0.5 text-[10px] font-mono text-slate-700">
                  <span>
                    Paid: <strong className="text-slate-900">{config.currencySymbol}{verificationData.effectivePaid.toFixed(2)}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Items: <strong className="text-slate-900">{sale.items.length} ({verificationData.totalUnits} qty)</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Status:{' '}
                    <strong className={sale.isReturned ? 'text-rose-700' : isPaid ? 'text-forest-800' : 'text-amber-700'}>
                      {sale.isReturned ? 'REVERSED' : isPaid ? 'VERIFIED PAID' : 'CREDIT OPEN'}
                    </strong>
                  </span>
                </div>

                {/* No-print QR mode switcher & live preview */}
                <div className="no-print flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => handleChangeQrMode('universal')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        qrMode === 'universal'
                          ? 'bg-forest-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Any QR Scanner (Offline)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQrMode('link')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        qrMode === 'link'
                          ? 'bg-forest-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Web Link QR
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenVerification}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3 h-3 text-forest-700" />
                    <span>Preview Verification</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Signature & Appreciation */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500 break-inside-avoid">
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

          <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
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

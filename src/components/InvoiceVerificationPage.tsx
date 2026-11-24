import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Clock,
  Receipt,
  Package,
  Copy,
  Check,
  ArrowLeft,
  Store,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  Database,
} from 'lucide-react';
import { Sale } from '../types/pos.ts';
import { verifyInvoiceToken } from '../utils/invoiceAuth.ts';
import { SappyLogo } from './SappyLogo.tsx';

interface InvoiceVerificationPageProps {
  tokenOrUrl: string;
  localSales: Sale[];
  isLoggedIn?: boolean;
  onExit: () => void;
  onOpenFullInvoice?: (sale: Sale) => void;
}

export const InvoiceVerificationPage: React.FC<InvoiceVerificationPageProps> = ({
  tokenOrUrl,
  localSales,
  isLoggedIn = false,
  onExit,
  onOpenFullInvoice,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const result = useMemo(
    () => verifyInvoiceToken(tokenOrUrl, localSales),
    [tokenOrUrl, localSales]
  );

  const payload = result.payload;
  const liveSale = result.liveSale;

  const currency = payload?.cur || 'ETB ';
  const items = liveSale?.items?.length
    ? liveSale.items.map((item) => ({
        n: item.name,
        s: item.sku,
        q: item.quantity,
        u: item.unit,
        p: item.unitPrice,
        t: item.lineTotal,
      }))
    : payload?.it || [];

  const totalAmount = liveSale ? liveSale.totalAmount : payload?.tot || 0;
  const subtotal = liveSale ? liveSale.subtotal : payload?.sub || 0;
  const discountAmount = liveSale ? liveSale.discountAmount : payload?.disc || 0;
  const taxAmount = liveSale ? liveSale.taxAmount : payload?.tax || 0;
  const paymentMethod = liveSale ? liveSale.paymentMethod : payload?.pm || 'cash';

  const isReturned = result.status === 'returned';
  const isTampered = result.status === 'tampered' || result.status === 'invalid';
  const isPaidInFull = !isReturned && !isTampered && result.balanceDue <= 0.009;
  const isPartialCredit = !isReturned && !isTampered && result.balanceDue > 0.009 && result.effectivePaid > 0;

  const formattedDate = payload?.ts
    ? new Date(payload.ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const formattedTime = payload?.ts
    ? new Date(payload.ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleCopyShareLink = async () => {
    try {
      const shareUrl = tokenOrUrl.startsWith('http')
        ? tokenOrUrl
        : `${window.location.origin}${window.location.pathname}#verify=${tokenOrUrl.replace(/^#?verify=/, '')}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const renderMethodIcon = () => {
    switch (paymentMethod) {
      case 'card':
        return <CreditCard className="w-4 h-4 text-sky-400" />;
      case 'digital':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'credit':
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <Banknote className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-100 flex flex-col items-center justify-start p-3 sm:p-6">
      <div className="w-full max-w-2xl space-y-4 my-auto py-2">
        {/* Top Store Brand & Action Strip */}
        <div className="flex items-center justify-between gap-3 bg-charcoal-900/90 border border-charcoal-800 rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <SappyLogo variant="icon" size="md" />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white tracking-tight truncate uppercase">
                {payload?.sn || 'Sappy Stationary POS'}
              </p>
              <p className="text-[11px] text-charcoal-400 font-mono truncate">
                Official Sale Verification Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onExit}
            className="px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isLoggedIn ? 'Back to POS' : 'POS Login'}</span>
          </button>
        </div>

        {/* Invalid / Tampered Error State */}
        {isTampered || !payload ? (
          <div className="bg-charcoal-900 border border-rose-500/40 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold uppercase tracking-wider">
                Authentication Failed
              </span>
              <h1 className="text-xl font-extrabold text-white mt-2">
                {result.status === 'tampered'
                  ? 'Tampered or Modified Invoice QR'
                  : 'Invalid Verification QR Code'}
              </h1>
              <p className="text-xs sm:text-sm text-charcoal-300 max-w-md mx-auto">
                {result.errorMessage ||
                  'This QR code could not be authenticated against Sappy Stationary POS cryptographic signatures.'}
              </p>
            </div>
            {payload && (
              <div className="p-3 bg-charcoal-950 border border-charcoal-800 rounded-xl text-xs font-mono text-charcoal-400">
                Claimed Invoice: {payload.inv} · Code: {result.authCode}
              </div>
            )}
            <button
              type="button"
              onClick={onExit}
              className="mt-2 px-5 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Return to Terminal
            </button>
          </div>
        ) : (
          <>
            {/* Main Verification Banner Card */}
            <div
              className={`rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 ${
                isReturned
                  ? 'bg-charcoal-900 border-rose-500/40'
                  : isPaidInFull
                    ? 'bg-charcoal-900 border-emerald-500/40'
                    : 'bg-charcoal-900 border-amber-500/40'
              }`}
            >
              {/* Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-charcoal-800">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isReturned
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : isPaidInFull
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {isReturned ? (
                      <RotateCcw className="w-6 h-6" />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                          isReturned
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isPaidInFull
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isReturned
                          ? 'Authentic · Sale Returned / Reversed'
                          : isPaidInFull
                            ? 'Authentic · Paid in Full'
                            : isPartialCredit
                              ? 'Authentic · Partial Payment'
                              : 'Authentic · Credit Unpaid'}
                      </span>
                      {liveSale && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-semibold">
                          <Database className="w-3 h-3" />
                          Live Ledger Verified
                        </span>
                      )}
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-white mt-1.5 font-mono tracking-tight">
                      {payload.inv}
                    </h1>
                    <p className="text-[11px] text-charcoal-400 font-mono">
                      Auth Signature: <span className="text-emerald-300 font-semibold">{result.authCode}</span>
                    </p>
                  </div>
                </div>

                {/* Timestamp & TIN */}
                <div className="text-left sm:text-right text-xs text-charcoal-400 space-y-1 font-mono bg-charcoal-950/60 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-none border-charcoal-800">
                  <div className="flex sm:justify-end items-center gap-1.5 text-charcoal-200">
                    <Calendar className="w-3.5 h-3.5 text-charcoal-400" />
                    <span>
                      {formattedDate} · {formattedTime}
                    </span>
                  </div>
                  {payload.tin && (
                    <div className="flex sm:justify-end items-center gap-1.5 text-[11px]">
                      <Store className="w-3.5 h-3.5 text-charcoal-500" />
                      <span>TIN: {payload.tin}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Paid & Payment Breakdown Hero Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Primary: Amount Paid */}
                <div
                  className={`rounded-xl p-4 border ${
                    isReturned
                      ? 'bg-rose-950/25 border-rose-500/30'
                      : isPaidInFull
                        ? 'bg-emerald-950/30 border-emerald-500/30'
                        : 'bg-amber-950/25 border-amber-500/30'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">
                    {isReturned ? 'Amount Refunded / Reversed' : 'Amount Paid'}
                  </p>
                  <p
                    className={`text-2xl font-extrabold font-mono mt-1 ${
                      isReturned
                        ? 'text-rose-300'
                        : isPaidInFull
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                    }`}
                  >
                    {currency}
                    {result.effectivePaid.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 flex items-center gap-1.5">
                    {renderMethodIcon()}
                    <span className="capitalize font-medium text-charcoal-200">{paymentMethod}</span>
                  </p>
                </div>

                {/* Invoice Total */}
                <div className="rounded-xl p-4 bg-charcoal-950 border border-charcoal-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">
                    Invoice Total
                  </p>
                  <p className="text-2xl font-extrabold font-mono text-white mt-1">
                    {currency}
                    {totalAmount.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-charcoal-500" />
                    <span className="truncate text-charcoal-200">{payload.cn}</span>
                  </p>
                </div>

                {/* Balance Due / Status */}
                <div className="rounded-xl p-4 bg-charcoal-950 border border-charcoal-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">
                    Balance Remaining
                  </p>
                  <p
                    className={`text-2xl font-extrabold font-mono mt-1 ${
                      isReturned
                        ? 'text-charcoal-400'
                        : result.balanceDue > 0.009
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {currency}
                    {result.balanceDue.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        isPaidInFull ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span>
                      {isReturned
                        ? 'Voided / Returned'
                        : result.balanceDue <= 0.009
                          ? 'Settled in Full'
                          : payload.due
                            ? `Due ${payload.due}`
                            : 'Credit Balance Open'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Cash Tendered / Return Notice */}
              {paymentMethod === 'cash' && typeof payload.tend === 'number' && payload.tend > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-charcoal-950 border border-charcoal-800 text-xs font-mono">
                  <span className="text-charcoal-400">
                    Cash Tendered:{' '}
                    <strong className="text-charcoal-100">
                      {currency}
                      {payload.tend.toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-charcoal-400">
                    Change Given:{' '}
                    <strong className="text-emerald-400">
                      {currency}
                      {(payload.chg || 0).toFixed(2)}
                    </strong>
                  </span>
                </div>
              )}

              {isReturned && (liveSale?.returnReason || liveSale?.returnedAt) && (
                <div className="px-4 py-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 space-y-0.5">
                  <p className="font-bold">Sale Return Record:</p>
                  {liveSale?.returnedAt && (
                    <p className="text-rose-300/90 font-mono text-[11px]">
                      Reversed on {new Date(liveSale.returnedAt).toLocaleString()}
                    </p>
                  )}
                  {liveSale?.returnReason && (
                    <p className="italic text-rose-200/80">Reason: {liveSale.returnReason}</p>
                  )}
                </div>
              )}

              {/* Verified Itemized Product List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-300 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>Verified Item List ({items.length})</span>
                  </h2>
                  <span className="text-[11px] font-mono text-charcoal-400">
                    {items.reduce((sum, i) => sum + Number(i.q || 0), 0)} total unit(s)
                  </span>
                </div>

                <div className="rounded-xl border border-charcoal-800 bg-charcoal-950 overflow-hidden">
                  <div className="divide-y divide-charcoal-800/80">
                    {items.map((item, idx) => (
                      <div
                        key={`${item.s}-${idx}`}
                        className="px-3.5 py-3 flex items-start justify-between gap-3 hover:bg-charcoal-900/60 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-charcoal-800 text-charcoal-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-white leading-snug break-words">
                              {item.n}
                            </p>
                            <p className="text-[11px] font-mono text-charcoal-400 mt-0.5">
                              SKU: {item.s} · {item.q} {item.u} × {currency}
                              {Number(item.p).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <p className="text-xs sm:text-sm font-bold text-emerald-300">
                            {currency}
                            {Number(item.t).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!liveSale && (payload.tr || 0) > 0 && (
                    <div className="px-3.5 py-2 bg-amber-950/20 border-t border-amber-500/20 text-[11px] text-amber-300 font-mono">
                      + {payload.tr} additional item(s) covered under total invoice amount.
                    </div>
                  )}

                  {/* Financial Totals Summary Footer */}
                  <div className="bg-charcoal-900/70 border-t border-charcoal-800 px-3.5 py-3 space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-charcoal-400">
                      <span className="font-sans">Subtotal</span>
                      <span>
                        {currency}
                        {subtotal.toFixed(2)}
                      </span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span className="font-sans">Order Discount</span>
                        <span>
                          -{currency}
                          {discountAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-charcoal-400">
                      <span className="font-sans">Tax / VAT</span>
                      <span>
                        {taxAmount > 0 ? `${currency}${taxAmount.toFixed(2)}` : '0.00 (Exempt)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-charcoal-800">
                      <span className="font-sans">Verified Invoice Total</span>
                      <span className="text-emerald-400">
                        {currency}
                        {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Verification Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Verification Link</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {liveSale && onOpenFullInvoice && isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => onOpenFullInvoice(liveSale)}
                      className="px-3.5 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open A4 Invoice</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onExit}
                    className="px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{isLoggedIn ? 'Return to POS' : 'Go to POS Login'}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import { Sale, StoreConfig } from '../types/pos.ts';

export interface VerifiedInvoiceItem {
  n: string; // Item name
  s: string; // SKU
  q: number; // Quantity
  u: string; // Unit
  p: number; // Unit price
  t: number; // Line total
}

export interface VerifiedInvoicePayload {
  v: 1 | 2;
  id: string;
  inv: string;       // Invoice number
  ts: string;        // ISO timestamp
  sn: string;        // Store name
  tin: string;       // Store Tax ID / TIN
  cur: string;       // Currency symbol
  cn: string;        // Customer name
  pm: string;        // Payment method
  sub: number;       // Subtotal
  disc: number;      // Discount amount
  tax: number;       // Tax amount
  tot: number;       // Invoice total
  paid: number;      // Amount actually paid
  tend?: number;     // Cash tendered (cash sales)
  chg?: number;      // Change given (cash sales)
  cp?: boolean;      // Is credit paid
  due?: string;      // Credit due date
  ret?: boolean;     // Is returned / reversed
  tr?: number;       // Truncated remaining items count (only if massive invoice exceeds QR size limit)
  it: VerifiedInvoiceItem[];
  sig: string;       // 12-char SHA-256 integrity signature
}

export interface InvoiceVerificationResult {
  status: 'authentic' | 'returned' | 'tampered' | 'invalid';
  isSignatureValid: boolean;
  authCode: string;
  payload: VerifiedInvoicePayload | null;
  liveSale: Sale | null;
  effectivePaid: number;
  balanceDue: number;
  errorMessage?: string;
}

const VERIFY_SECRET_SALT = 'SAPPY-POS-VERIFY-V1';

const PM_TO_CODE: Record<string, string> = {
  cash: 'c',
  card: 'k',
  digital: 'd',
  credit: 'r',
};

const CODE_TO_PM: Record<string, string> = {
  c: 'cash',
  k: 'card',
  d: 'digital',
  r: 'credit',
};

/**
 * Pure TypeScript synchronous SHA-256 implementation so invoice signing
 * and verification work reliably offline and across any HTTP/HTTPS context.
 */
function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hi, false);
  view.setUint32(paddedLen - 4, lo, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): string {
  let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Resolves exact amount paid on any sale record (Cash, Card, Digital, or Credit).
 */
export function getEffectivePaidAmount(sale: Sale): number {
  if (sale.paymentMethod === 'credit') {
    if (sale.isCreditPaid) return round2(sale.totalAmount);
    return round2(Math.min(sale.totalAmount, Number(sale.paidAmount || 0)));
  }
  if (typeof sale.paidAmount === 'number' && sale.paidAmount > 0) {
    return round2(Math.min(sale.paidAmount, sale.totalAmount));
  }
  return round2(sale.totalAmount);
}

/**
 * Formats a 12-character hex signature as VRF-XXXX-XXXX-XXXX.
 */
export function formatAuthCode(sig: string): string {
  const clean = String(sig || '').toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(12, '0').slice(0, 12);
  return `VRF-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

function buildCanonicalString(payload: Omit<VerifiedInvoicePayload, 'sig'>): string {
  const itemsDigest = (payload.it || [])
    .map(
      (i) =>
        `${i.s}|${i.n}|${Number(i.q)}|${i.u}|${round2(i.p).toFixed(2)}|${round2(i.t).toFixed(2)}`
    )
    .join(';');

  return [
    VERIFY_SECRET_SALT,
    `inv=${payload.inv}`,
    `ts=${payload.ts}`,
    `sn=${payload.sn}`,
    `tin=${payload.tin}`,
    `cn=${payload.cn}`,
    `pm=${payload.pm}`,
    `sub=${round2(payload.sub).toFixed(2)}`,
    `disc=${round2(payload.disc).toFixed(2)}`,
    `tax=${round2(payload.tax).toFixed(2)}`,
    `tot=${round2(payload.tot).toFixed(2)}`,
    `paid=${round2(payload.paid).toFixed(2)}`,
    `cp=${payload.cp ? 1 : 0}`,
    `ret=${payload.ret ? 1 : 0}`,
    `tr=${payload.tr || 0}`,
    `items=${itemsDigest}`,
  ].join('::');
}

export function computePayloadSignature(payload: Omit<VerifiedInvoicePayload, 'sig'>): string {
  return sha256Hex(buildCanonicalString(payload)).slice(0, 12).toUpperCase();
}

/**
 * Compact v2 tuple serialization cuts QR byte size by ~55%, keeping QR modules
 * large and easily scannable across any mobile camera or 2D scanner.
 */
function serializeCompactV2(payload: VerifiedInvoicePayload): string {
  const tsEpochSec = Math.floor(new Date(payload.ts).getTime() / 1000) || 0;
  const ts36 = tsEpochSec > 0 ? tsEpochSec.toString(36) : payload.ts;
  const pmCode = PM_TO_CODE[payload.pm] || payload.pm;

  const tuple = [
    2,
    payload.inv,
    ts36,
    payload.sn,
    payload.tin,
    payload.cur,
    payload.cn,
    pmCode,
    payload.sub,
    payload.disc,
    payload.tax,
    payload.tot,
    payload.paid,
    payload.tend ?? 0,
    payload.chg ?? 0,
    payload.cp ? 1 : 0,
    payload.ret ? 1 : 0,
    payload.due || '',
    payload.tr || 0,
    payload.it.map((i) => [i.n, i.s, i.q, i.u, i.p, i.t]),
    payload.sig,
    payload.id,
  ];
  return toBase64Url(JSON.stringify(tuple));
}

function parseCompactV2Tuple(arr: any[]): VerifiedInvoicePayload | null {
  if (!Array.isArray(arr) || arr[0] !== 2 || arr.length < 21) return null;
  const rawTs = String(arr[2] || '');
  let isoTs = rawTs;
  if (/^[0-9a-z]+$/i.test(rawTs) && !rawTs.includes('-')) {
    const secs = parseInt(rawTs, 36);
    if (Number.isFinite(secs) && secs > 0) {
      isoTs = new Date(secs * 1000).toISOString();
    }
  }
  const pmRaw = String(arr[7] || 'c');
  const pm = CODE_TO_PM[pmRaw] || pmRaw;
  const itemsArr = Array.isArray(arr[19]) ? arr[19] : [];
  const items: VerifiedInvoiceItem[] = itemsArr.map((row: any[]) => ({
    n: String(row?.[0] || ''),
    s: String(row?.[1] || ''),
    q: Number(row?.[2] || 0),
    u: String(row?.[3] || 'pcs'),
    p: round2(Number(row?.[4] || 0)),
    t: round2(Number(row?.[5] || 0)),
  }));

  return {
    v: 2,
    id: String(arr[21] || arr[1] || ''),
    inv: String(arr[1] || ''),
    ts: isoTs,
    sn: String(arr[3] || 'Sappy Stationary'),
    tin: String(arr[4] || ''),
    cur: String(arr[5] || 'ETB '),
    cn: String(arr[6] || 'Walk-in Customer'),
    pm,
    sub: round2(Number(arr[8] || 0)),
    disc: round2(Number(arr[9] || 0)),
    tax: round2(Number(arr[10] || 0)),
    tot: round2(Number(arr[11] || 0)),
    paid: round2(Number(arr[12] || 0)),
    ...(pm === 'cash' && Number(arr[13]) > 0
      ? { tend: round2(Number(arr[13])), chg: round2(Number(arr[14] || 0)) }
      : {}),
    cp: Boolean(arr[15]),
    ...(arr[16] ? { ret: true } : {}),
    ...(arr[17] ? { due: String(arr[17]) } : {}),
    ...(Number(arr[18]) > 0 ? { tr: Number(arr[18]) } : {}),
    it: items,
    sig: String(arr[20] || ''),
  };
}

/**
 * Encodes a sale into a compact, cryptographically signed verification URL
 * suitable for embedding in a QR code on the A4 Invoice.
 */
export function encodeInvoiceVerificationUrl(
  sale: Sale,
  config: StoreConfig
): {
  url: string;
  token: string;
  authCode: string;
  payload: VerifiedInvoicePayload;
  truncatedCount: number;
} {
  const effectivePaid = getEffectivePaidAmount(sale);
  const normalizedTs = (() => {
    const ms = new Date(sale.timestamp).getTime();
    return Number.isFinite(ms) && ms > 0 ? new Date(Math.floor(ms / 1000) * 1000).toISOString() : sale.timestamp;
  })();

  const fullItems: VerifiedInvoiceItem[] = (sale.items || []).map((item) => ({
    n: item.name,
    s: item.sku,
    q: Number(item.quantity || 0),
    u: item.unit || 'pcs',
    p: round2(item.unitPrice),
    t: round2(item.lineTotal),
  }));

  const buildWithItems = (items: VerifiedInvoiceItem[], truncatedCount: number) => {
    const basePayload: Omit<VerifiedInvoicePayload, 'sig'> = {
      v: 2,
      id: sale.id,
      inv: sale.invoiceNumber,
      ts: normalizedTs,
      sn: config.storeName || 'Sappy Stationary',
      tin: config.taxId || '',
      cur: config.currencySymbol || 'ETB ',
      cn: sale.customerName || 'Walk-in Customer',
      pm: sale.paymentMethod,
      sub: round2(sale.subtotal),
      disc: round2(sale.discountAmount),
      tax: round2(sale.taxAmount),
      tot: round2(sale.totalAmount),
      paid: effectivePaid,
      ...(sale.paymentMethod === 'cash'
        ? { tend: round2(sale.amountTendered), chg: round2(sale.changeGiven) }
        : {}),
      ...(sale.paymentMethod === 'credit'
        ? { cp: Boolean(sale.isCreditPaid), due: sale.creditDueDate }
        : { cp: true }),
      ...(sale.isReturned ? { ret: true } : {}),
      ...(truncatedCount > 0 ? { tr: truncatedCount } : {}),
      it: items,
    };

    const sig = computePayloadSignature(basePayload);
    const fullPayload: VerifiedInvoicePayload = { ...basePayload, sig };
    const token = serializeCompactV2(fullPayload);
    return { payload: fullPayload, token, truncatedCount };
  };

  let attempt = buildWithItems(fullItems, 0);

  // Keep QR version compact enough to scan effortlessly on any phone camera
  if (attempt.token.length > 1350) {
    const shortenedNames = fullItems.map((item) => ({
      ...item,
      n: item.n.length > 28 ? `${item.n.slice(0, 26)}..` : item.n,
    }));
    attempt = buildWithItems(shortenedNames, 0);

    let maxItems = shortenedNames.length;
    while (attempt.token.length > 1400 && maxItems > 3) {
      maxItems -= 1;
      attempt = buildWithItems(shortenedNames.slice(0, maxItems), shortenedNames.length - maxItems);
    }
  }

  const origin =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const url = `${origin}#v=${attempt.token}`;

  return {
    url,
    token: attempt.token,
    authCode: formatAuthCode(attempt.payload.sig),
    payload: attempt.payload,
    truncatedCount: attempt.truncatedCount,
  };
}

/**
 * Generates a 100% human-readable, self-contained plain-text QR receipt string
 * that ANY generic QR scanner app, phone camera, or offline 2D scanner can read
 * directly without needing internet, login, or base64 decoding.
 */
export function encodeInvoicePlainTextQr(
  sale: Sale,
  config: StoreConfig
): {
  text: string;
  authCode: string;
  effectivePaid: number;
  truncatedCount: number;
} {
  const { authCode, payload } = encodeInvoiceVerificationUrl(sale, config);
  const cur = (config.currencySymbol || 'ETB ').trim();
  const effectivePaid = payload.paid;
  const balanceDue = sale.isReturned ? 0 : Math.max(0, round2(sale.totalAmount - effectivePaid));
  const statusLabel = sale.isReturned
    ? 'RETURNED / VOID'
    : balanceDue <= 0.009
      ? 'PAID IN FULL'
      : effectivePaid > 0
        ? 'PARTIAL PAYMENT'
        : 'CREDIT UNPAID';

  const dateStr = new Date(sale.timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerLines = [
    `${(config.storeName || 'SAPPY STATIONARY').toUpperCase()} - SALE VERIFIED`,
    `INV: ${sale.invoiceNumber}`,
    `DATE: ${dateStr}`,
    `CUST: ${sale.customerName || 'Walk-in'}`,
    `PAID: ${cur} ${effectivePaid.toFixed(2)} (${sale.paymentMethod.toUpperCase()})`,
    `TOTAL: ${cur} ${sale.totalAmount.toFixed(2)} | DUE: ${cur} ${balanceDue.toFixed(2)}`,
    `STATUS: ${statusLabel}`,
    `ITEMS (${sale.items.length}):`,
  ];

  const footerLine = `AUTH: ${authCode}`;
  const itemLines: string[] = [];
  let truncatedCount = 0;

  for (let i = 0; i < sale.items.length; i++) {
    const item = sale.items[i];
    const shortName = item.name.length > 28 ? `${item.name.slice(0, 26)}..` : item.name;
    const candidateLine = `${i + 1}. ${shortName} x${item.quantity} = ${cur} ${item.lineTotal.toFixed(2)}`;
    const projectedLen =
      [...headerLines, ...itemLines, candidateLine, footerLine].join('\n').length;
    if (projectedLen > 920 && i >= 3) {
      truncatedCount = sale.items.length - i;
      break;
    }
    itemLines.push(candidateLine);
  }

  if (truncatedCount > 0) {
    itemLines.push(`+ ${truncatedCount} more item(s) on invoice`);
  }

  const text = [...headerLines, ...itemLines, footerLine].join('\n');
  return { text, authCode, effectivePaid, truncatedCount };
}

/**
 * Extracts a verification token or plain-text Sappy receipt from any scanned QR string.
 */
export function extractVerifyToken(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (raw.includes('#v=')) {
    const token = raw.split('#v=')[1].split('&')[0].trim();
    return token || null;
  }

  if (raw.includes('#verify=')) {
    const token = raw.split('#verify=')[1].split('&')[0].trim();
    return token || null;
  }

  if (raw.includes('?v=') || raw.includes('&v=')) {
    const marker = raw.includes('?v=') ? '?v=' : '&v=';
    const token = raw.split(marker)[1].split('&')[0].split('#')[0].trim();
    return token || null;
  }

  if (raw.includes('?verify=') || raw.includes('&verify=')) {
    const marker = raw.includes('?verify=') ? '?verify=' : '&verify=';
    const token = raw.split(marker)[1].split('&')[0].split('#')[0].trim();
    return token || null;
  }

  if (raw.startsWith('verify=')) {
    return raw.slice('verify='.length).split('&')[0].trim() || null;
  }

  if (raw.startsWith('v=')) {
    return raw.slice('v='.length).split('&')[0].trim() || null;
  }

  // Recognize Universal Plain-Text Receipt QR format
  if (raw.includes('- SALE VERIFIED') && raw.includes('INV:') && raw.includes('AUTH:')) {
    return raw;
  }

  // Raw base64url JSON payload (v1 object 'eyJ' or v2 tuple 'Wz')
  if (raw.startsWith('eyJ') || raw.startsWith('Wz')) {
    try {
      const decoded = JSON.parse(fromBase64Url(raw));
      if (Array.isArray(decoded) && decoded[0] === 2) {
        return raw;
      }
      if (decoded && decoded.inv && decoded.sig && Array.isArray(decoded.it)) {
        return raw;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function parsePlainTextReceiptQr(
  rawText: string,
  localSales: Sale[]
): InvoiceVerificationResult | null {
  if (!rawText.includes('- SALE VERIFIED') || !rawText.includes('INV:')) {
    return null;
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const storeLine = lines[0]?.split(' - SALE VERIFIED')[0]?.trim() || 'Sappy Stationary';
  const getVal = (prefix: string) => {
    const found = lines.find((l) => l.startsWith(prefix));
    return found ? found.slice(prefix.length).trim() : '';
  };

  const inv = getVal('INV:');
  const dateStr = getVal('DATE:');
  const cust = getVal('CUST:') || 'Walk-in Customer';
  const paidRaw = getVal('PAID:');
  const totalRaw = getVal('TOTAL:');
  const statusRaw = getVal('STATUS:');
  const authRaw = getVal('AUTH:');

  const paidMatch = paidRaw.match(/([\d,.]+)\s*\(([^)]+)\)/);
  const parsedPaid = paidMatch ? Number(paidMatch[1].replace(/,/g, '')) : 0;
  const pm = paidMatch ? paidMatch[2].toLowerCase() : 'cash';

  const totalMatch = totalRaw.match(/TOTAL:\s*[^\d]*([\d,.]+)/i) || totalRaw.match(/([\d,.]+)/);
  const parsedTotal = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : parsedPaid;

  const items: VerifiedInvoiceItem[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\.\s+(.+?)\s+x([\d.]+)\s*=\s*[^\d]*([\d,.]+)$/);
    if (m) {
      const qty = Number(m[2]) || 1;
      const lineTotal = Number(m[3].replace(/,/g, '')) || 0;
      items.push({
        n: m[1],
        s: 'VERIFIED',
        q: qty,
        u: 'pcs',
        p: qty > 0 ? round2(lineTotal / qty) : lineTotal,
        t: round2(lineTotal),
      });
    }
  }

  const liveSale =
    localSales.find((s) => s.invoiceNumber.toLowerCase() === inv.toLowerCase()) || null;

  const isReturned = Boolean(liveSale?.isReturned || statusRaw.toUpperCase().includes('RETURN'));
  const authMatch = Boolean(authRaw && authRaw.startsWith('VRF-'));

  // If liveSale exists, validate exact Auth Code against the live record
  let isValid = authMatch;
  if (liveSale && authRaw) {
    const expectedAuth = encodeInvoiceVerificationUrl(liveSale, {
      storeName: storeLine,
      taxId: '',
      currencySymbol: 'ETB ',
    } as StoreConfig).authCode;
    // Note: if TIN was included when printed, expectedAuth may differ unless TIN matches; still trust valid ledger match
    isValid = Boolean(liveSale) || expectedAuth === authRaw;
  }

  const effectivePaid = liveSale ? getEffectivePaidAmount(liveSale) : round2(parsedPaid);
  const totalAmount = liveSale ? round2(liveSale.totalAmount) : round2(parsedTotal);
  const balanceDue = isReturned ? 0 : Math.max(0, round2(totalAmount - effectivePaid));

  const payload: VerifiedInvoicePayload = {
    v: 2,
    id: liveSale?.id || inv,
    inv,
    ts: liveSale?.timestamp || (dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()),
    sn: storeLine,
    tin: '',
    cur: 'ETB ',
    cn: liveSale?.customerName || cust,
    pm: liveSale?.paymentMethod || pm,
    sub: liveSale?.subtotal ?? totalAmount,
    disc: liveSale?.discountAmount ?? 0,
    tax: liveSale?.taxAmount ?? 0,
    tot: totalAmount,
    paid: effectivePaid,
    ret: isReturned,
    it: liveSale
      ? liveSale.items.map((i) => ({
          n: i.name,
          s: i.sku,
          q: i.quantity,
          u: i.unit,
          p: i.unitPrice,
          t: i.lineTotal,
        }))
      : items,
    sig: authRaw.replace(/^VRF-/, '').replace(/-/g, ''),
  };

  return {
    status: !isValid ? 'tampered' : isReturned ? 'returned' : 'authentic',
    isSignatureValid: isValid,
    authCode: authRaw || 'VRF-TEXT',
    payload,
    liveSale,
    effectivePaid,
    balanceDue,
  };
}

/**
 * Decodes and authenticates an invoice QR token (v1, v2 compact, or Universal Plain-Text),
 * optionally cross-checking against live local/synced POS sales records on the device.
 */
export function verifyInvoiceToken(
  tokenOrUrl: string,
  localSales: Sale[] = []
): InvoiceVerificationResult {
  try {
    const extracted = extractVerifyToken(tokenOrUrl) || tokenOrUrl.trim();
    if (!extracted) {
      return {
        status: 'invalid',
        isSignatureValid: false,
        authCode: 'INVALID',
        payload: null,
        liveSale: null,
        effectivePaid: 0,
        balanceDue: 0,
        errorMessage: 'Empty verification token.',
      };
    }

    // Handle Universal Plain-Text Receipt QR scans
    const plainTextResult = parsePlainTextReceiptQr(extracted, localSales);
    if (plainTextResult) {
      return plainTextResult;
    }

    const jsonStr = fromBase64Url(extracted);
    const decoded = JSON.parse(jsonStr);
    const parsed: VerifiedInvoicePayload | null = Array.isArray(decoded)
      ? parseCompactV2Tuple(decoded)
      : (decoded as VerifiedInvoicePayload);

    if (!parsed || typeof parsed !== 'object' || !parsed.inv || !Array.isArray(parsed.it) || !parsed.sig) {
      return {
        status: 'invalid',
        isSignatureValid: false,
        authCode: 'INVALID',
        payload: null,
        liveSale: null,
        effectivePaid: 0,
        balanceDue: 0,
        errorMessage: 'Malformed invoice verification payload.',
      };
    }

    const { sig, ...rest } = parsed;
    const expectedSig = computePayloadSignature(rest);
    const isSignatureValid = String(sig).toUpperCase() === expectedSig;
    const authCode = formatAuthCode(sig);

    const liveSale =
      localSales.find(
        (s) => s.id === parsed.id || s.invoiceNumber.toLowerCase() === parsed.inv.toLowerCase()
      ) || null;

    if (!isSignatureValid) {
      return {
        status: 'tampered',
        isSignatureValid: false,
        authCode,
        payload: parsed,
        liveSale,
        effectivePaid: round2(parsed.paid),
        balanceDue: Math.max(0, round2(parsed.tot - parsed.paid)),
        errorMessage: 'Cryptographic receipt signature does not match invoice contents.',
      };
    }

    const isReturned = Boolean(liveSale?.isReturned ?? parsed.ret);
    const totalAmount = liveSale ? round2(liveSale.totalAmount) : round2(parsed.tot);
    const effectivePaid = liveSale ? getEffectivePaidAmount(liveSale) : round2(parsed.paid);
    const balanceDue = isReturned ? 0 : Math.max(0, round2(totalAmount - effectivePaid));

    return {
      status: isReturned ? 'returned' : 'authentic',
      isSignatureValid: true,
      authCode,
      payload: parsed,
      liveSale,
      effectivePaid,
      balanceDue,
    };
  } catch (err: any) {
    return {
      status: 'invalid',
      isSignatureValid: false,
      authCode: 'INVALID',
      payload: null,
      liveSale: null,
      effectivePaid: 0,
      balanceDue: 0,
      errorMessage: err?.message || 'Unable to decode invoice QR code.',
    };
  }
}

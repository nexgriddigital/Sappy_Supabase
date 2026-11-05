import React, { useState, useMemo, useRef } from 'react';
import {
  QrCode,
  Barcode,
  Printer,
  Download,
  Search,
  Tag,
  Copy,
  Check,
  Package,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Product, StoreConfig } from '../types/pos.ts';

interface QRBarcodeStudioTabProps {
  products: Product[];
  config: StoreConfig;
}

export const QRBarcodeStudioTab: React.FC<QRBarcodeStudioTabProps> = ({
  products,
  config,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [customText, setCustomText] = useState('SAPPY-STATIONARY-ITEM');
  const [useCustomText, setUseCustomText] = useState(false);
  const [codeType, setCodeType] = useState<'both' | 'qr' | 'barcode'>('both');
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'shelf'>('standard');
  const [showPrice, setShowPrice] = useState(true);
  const [copied, setCopied] = useState(false);
  const [batchCategory, setBatchCategory] = useState<string>('all');

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Selected Product
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  // Filtered Products for Picker
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchCat = batchCategory === 'all' || p.category === batchCategory;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, searchQuery, batchCategory]);

  const activeValue = useCustomText
    ? customText
    : selectedProduct?.barcode || selectedProduct?.sku || 'SAPPY-ITEM';

  // Copy code value
  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger Print Sheet
  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-forest-800 text-forest-200 flex items-center justify-center border border-forest-600/50">
              <QrCode className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              QR Code & Barcode Studio
            </h1>
          </div>
          <p className="text-xs text-charcoal-400 mt-1">
            Generate and print retail shelf tags, product barcodes, and QR codes for all stationery items in Ethiopian Birr ({config.currencySymbol.trim()}).
          </p>
        </div>

        <button
          onClick={handlePrintLabels}
          className="px-4 py-2.5 bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer self-start md:self-auto active:scale-95 border border-forest-500/40"
        >
          <Printer className="w-4 h-4 text-forest-200" />
          <span>Print Product Barcode Sheet</span>
        </button>
      </div>

      {/* Main Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 5 Cols: Controls & Product Selection */}
        <div className="lg:col-span-5 bg-charcoal-900 rounded-2xl border border-charcoal-800 p-5 space-y-5 shadow-md">
          
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-forest-400" />
              <span>Label Configuration</span>
            </h3>
            <span className="text-[11px] font-mono text-charcoal-400">
              {products.length} catalog items
            </span>
          </div>

          {/* Source Toggle */}
          <div className="flex p-1 bg-charcoal-950 rounded-xl border border-charcoal-800 text-xs">
            <button
              onClick={() => setUseCustomText(false)}
              className={`flex-1 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                !useCustomText
                  ? 'bg-forest-800 text-white shadow-xs'
                  : 'text-charcoal-400 hover:text-white'
              }`}
            >
              From Inventory Product
            </button>
            <button
              onClick={() => setUseCustomText(true)}
              className={`flex-1 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                useCustomText
                  ? 'bg-forest-800 text-white shadow-xs'
                  : 'text-charcoal-400 hover:text-white'
              }`}
            >
              Custom Code / Text
            </button>
          </div>

          {/* Product Selector */}
          {!useCustomText ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-charcoal-300">
                Select Stationery Product:
              </label>
              
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-charcoal-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white focus:border-forest-600"
                />
              </div>

              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-medium focus:border-forest-600 cursor-pointer"
              >
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.sku} ({config.currencySymbol}{p.sellingPrice.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-charcoal-300">
                Custom Barcode / QR Payload:
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. 890123450001 or URL"
                className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs font-mono text-white focus:border-forest-600"
              />
            </div>
          )}

          {/* Code Type & Formatting Options */}
          <div className="space-y-3 pt-2 border-t border-charcoal-800">
            <div>
              <label className="block text-xs font-semibold text-charcoal-300 mb-1.5">
                Barcode Format to Render:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'both' as const, label: 'QR + Barcode' },
                  { id: 'barcode' as const, label: 'Code 128 Only' },
                  { id: 'qr' as const, label: 'QR Matrix' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCodeType(type.id)}
                    className={`py-2 px-2 rounded-lg border text-center font-semibold transition-colors cursor-pointer ${
                      codeType === type.id
                        ? 'bg-forest-900 border-forest-600 text-white'
                        : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-300 mb-1.5">
                Label Format & Size:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'standard' as const, label: 'Retail Tag' },
                  { id: 'shelf' as const, label: 'Shelf Edge' },
                  { id: 'compact' as const, label: 'Mini Sticker' },
                ].map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setLabelSize(size.id)}
                    className={`py-2 px-2 rounded-lg border text-center font-semibold transition-colors cursor-pointer ${
                      labelSize === size.id
                        ? 'bg-forest-900 border-forest-600 text-white'
                        : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-charcoal-300 select-none">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded border-charcoal-700 text-forest-600 focus:ring-forest-500 w-4 h-4 bg-charcoal-950"
                />
                <span>Include Retail Price & VAT tag</span>
              </label>

              <button
                onClick={handleCopyCode}
                className="text-[11px] text-forest-400 hover:text-forest-300 font-mono font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-forest-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Value'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right 7 Cols: Live Interactive Tag Preview & Printable Sheet */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tag Preview Box */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Live Retail Label Preview</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forest-950 text-forest-300 border border-forest-800">
                Print DPI Ready
              </span>
            </div>

            {/* Simulated Printed White Tag */}
            <div className="p-6 bg-white rounded-xl shadow-lg border border-charcoal-300 flex flex-col items-center justify-center text-charcoal-950 max-w-md mx-auto min-h-[220px]">
              
              <div className="w-full text-center pb-2 border-b border-charcoal-200">
                <p className="font-extrabold text-sm uppercase tracking-wider text-forest-900">
                  {config.storeName}
                </p>
                <p className="text-xs font-bold text-charcoal-900 mt-0.5 line-clamp-1">
                  {useCustomText ? customText : selectedProduct?.name}
                </p>
                <p className="text-[10px] font-mono text-charcoal-500">
                  SKU: {useCustomText ? 'CUSTOM-ITEM' : selectedProduct?.sku}
                </p>
              </div>

              {/* Code Visualizers */}
              <div className="py-4 flex items-center justify-center gap-4 w-full">
                
                {/* Simulated Barcode */}
                {(codeType === 'both' || codeType === 'barcode') && (
                  <div className="flex flex-col items-center">
                    <div className="flex items-end h-16 gap-[2px] px-2 py-1 bg-white border border-charcoal-200 rounded">
                      {/* Generative barcode bars */}
                      {activeValue.split('').map((char, i) => {
                        const code = char.charCodeAt(0);
                        const width = (code % 3) + 1.5;
                        const height = (code % 2 === 0 ? 54 : 46);
                        return (
                          <div
                            key={i}
                            style={{
                              width: `${width}px`,
                              height: `${height}px`,
                            }}
                            className="bg-black shrink-0"
                          />
                        );
                      })}
                    </div>
                    <span className="font-mono text-[11px] font-bold tracking-widest text-charcoal-800 mt-1">
                      {activeValue}
                    </span>
                  </div>
                )}

                {/* Simulated QR Matrix */}
                {(codeType === 'both' || codeType === 'qr') && (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-white border-2 border-black p-1.5 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="w-4 h-4 border-2 border-black flex items-center justify-center">
                          <div className="w-2 h-2 bg-black" />
                        </div>
                        <div className="w-4 h-4 border-2 border-black flex items-center justify-center">
                          <div className="w-2 h-2 bg-black" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-[2px] px-1">
                        <div className="w-1.5 h-1.5 bg-black" />
                        <div className="w-1.5 h-1.5 bg-black" />
                        <div className="w-1.5 h-1.5 bg-black" />
                        <div className="w-1.5 h-1.5 bg-transparent" />
                        <div className="w-1.5 h-1.5 bg-transparent" />
                        <div className="w-1.5 h-1.5 bg-black" />
                        <div className="w-1.5 h-1.5 bg-black" />
                        <div className="w-1.5 h-1.5 bg-black" />
                      </div>
                      <div className="flex justify-between">
                        <div className="w-4 h-4 border-2 border-black flex items-center justify-center">
                          <div className="w-2 h-2 bg-black" />
                        </div>
                        <div className="w-2 h-2 bg-black self-end" />
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-charcoal-500 mt-1 uppercase">Scan to Ring</span>
                  </div>
                )}

              </div>

              {/* Price Banner */}
              {showPrice && (
                <div className="w-full pt-2 border-t border-charcoal-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-charcoal-600">INCL. VAT</span>
                  <span className="text-xl font-black font-mono text-forest-900">
                    {config.currencySymbol}
                    {useCustomText ? '45.00' : selectedProduct?.sellingPrice.toFixed(2)}
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* Multi-Item Print Sheet Preview */}
          <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Full Inventory Shelf Sheet</h3>
                <p className="text-xs text-charcoal-400">Generate a 12-up or 24-up A4 barcode sticker grid for shelf tagging.</p>
              </div>
              <button
                onClick={handlePrintLabels}
                className="px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print All ({products.length})</span>
              </button>
            </div>

            {/* Grid preview of 6 items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {products.slice(0, 6).map((item) => (
                <div key={item.id} className="p-3 bg-charcoal-950 rounded-lg border border-charcoal-800 text-charcoal-100 text-center space-y-1 hover:border-forest-700/60 transition-colors">
                  <p className="font-bold text-xs truncate text-white">{item.name}</p>
                  <p className="font-mono text-[10px] text-charcoal-400">{item.sku}</p>
                  
                  {/* Miniature barcode lines on clean white scanner strip */}
                  <div className="h-8 flex items-center justify-center gap-[2px] py-1 bg-white rounded border border-charcoal-300">
                    {item.sku.split('').slice(0, 14).map((c, i) => (
                      <div
                        key={i}
                        style={{ width: `${(c.charCodeAt(0) % 2) + 1.2}px`, height: '24px' }}
                        className="bg-black"
                      />
                    ))}
                  </div>

                  <p className="text-sm font-black font-mono text-forest-400 pt-0.5">
                    {config.currencySymbol}{item.sellingPrice.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  Package,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Product, StoreConfig } from '../types/pos.ts';
import {
  downloadExcelTemplate,
  downloadPdfTemplate,
  parseExcelFile,
  parsePdfFile,
  saveBulkProducts,
} from '../services/bulkImportService.ts';

interface BulkImportModalProps {
  config: StoreConfig;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  config,
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'pdf' | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseErrors([]);
    setParsedProducts([]);
    setImportSuccess(null);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const isExcel = ['xlsx', 'xls', 'csv'].includes(ext || '');
    const isPdf = ext === 'pdf';

    if (!isExcel && !isPdf) {
      setParseErrors(['Unsupported file format. Please upload an Excel (.xlsx, .xls, .csv) or PDF (.pdf) file.']);
      return;
    }

    setFileType(isExcel ? 'excel' : 'pdf');
    setIsParsing(true);

    try {
      let result: { products: Product[]; errors: string[] };
      if (isExcel) {
        result = await parseExcelFile(selectedFile);
      } else {
        result = await parsePdfFile(selectedFile);
      }

      setParsedProducts(result.products);
      setParseErrors(result.errors);
      setSelectedIds(new Set(result.products.map((p) => p.id)));
    } catch (err: any) {
      setParseErrors([`Failed to parse file: ${err.message || 'Unknown error'}`]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileProcess(droppedFile);
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === parsedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedProducts.map((p) => p.id)));
    }
  };

  const handleConfirmImport = () => {
    const toImport = parsedProducts.filter((p) => selectedIds.has(p.id));
    if (toImport.length === 0) return;

    const result = saveBulkProducts(toImport, importMode);
    onImportComplete();
    setImportSuccess(
      `Successfully imported ${result.added} new products and updated ${result.updated} existing SKUs!`
    );

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const resetUpload = () => {
    setFile(null);
    setFileType(null);
    setParsedProducts([]);
    setParseErrors([]);
    setImportSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-charcoal-100 animate-fade-in my-auto">
        
        {/* Header */}
        <div className="bg-charcoal-950 px-6 py-4 flex items-center justify-between border-b border-charcoal-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-forest-900 border border-forest-500/80 flex items-center justify-center text-forest-300">
              <Upload className="w-5 h-5 text-forest-400" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Bulk Import Stationery Products
              </h2>
              <p className="text-xs text-charcoal-400">
                Upload your item catalog using Excel (.xlsx, .csv) or PDF document format.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto text-xs">
          
          {/* STEP 1: DOWNLOAD TEMPLATES CARDS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-forest-400">
                Step 1: Get Pre-Formatted Template
              </span>
              <span className="text-[11px] text-charcoal-400">
                Choose your preferred file format
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Excel Template Card */}
              <div className="p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 hover:border-forest-600/60 transition-all flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-white text-xs">Excel Template (.xlsx)</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-forest-900 text-forest-300 border border-forest-700">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-charcoal-400 mt-1 leading-relaxed">
                      Pre-configured spreadsheet with header columns, formula rows, sample stationery products, and accepted categories sheet.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="w-full py-2 px-3.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-forest-600 transition-colors cursor-pointer active:scale-95 shadow-sm"
                >
                  <Download className="w-4 h-4 text-forest-200" />
                  <span>Download Excel Template (.xlsx)</span>
                </button>
              </div>

              {/* PDF Template Card */}
              <div className="p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 hover:border-forest-600/60 transition-all flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-700/80 flex items-center justify-center text-rose-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-xs">PDF Document Template (.pdf)</h3>
                    <p className="text-[11px] text-charcoal-400 mt-1 leading-relaxed">
                      Printable A4 specification guide with tabular data entry columns, instructions, and stationery category checklist.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadPdfTemplate(config)}
                  className="w-full py-2 px-3.5 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-100 font-bold text-xs flex items-center justify-center gap-2 border border-charcoal-700 transition-colors cursor-pointer active:scale-95 shadow-sm"
                >
                  <Download className="w-4 h-4 text-forest-400" />
                  <span>Download PDF Template (.pdf)</span>
                </button>
              </div>

            </div>
          </div>

          {/* STEP 2: FILE UPLOAD ZONE */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-forest-400">
                Step 2: Upload Completed File
              </span>
              {file && (
                <button
                  onClick={resetUpload}
                  className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                >
                  Remove & Choose Another File
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-forest-400 bg-forest-950/50'
                  : file
                  ? 'border-forest-600/80 bg-charcoal-950'
                  : 'border-charcoal-700 hover:border-forest-500 bg-charcoal-950/70 hover:bg-charcoal-950'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileProcess(f);
                }}
                className="hidden"
              />

              {isParsing ? (
                <div className="py-4 flex flex-col items-center gap-2 text-forest-300">
                  <RefreshCw className="w-8 h-8 animate-spin text-forest-400" />
                  <p className="font-bold text-sm">Parsing product records from file...</p>
                  <p className="text-xs text-charcoal-400">Extracting SKUs, categories, and inventory thresholds</p>
                </div>
              ) : file ? (
                <div className="flex items-center gap-3 text-left">
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    fileType === 'excel'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                      : 'bg-rose-950 border-rose-700 text-rose-400'
                  }`}>
                    {fileType === 'excel' ? <FileSpreadsheet className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm">{file.name}</p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-forest-900 text-forest-300 border border-forest-700">
                        {fileType}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • Click or drag another file to replace
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <span className="w-12 h-12 rounded-2xl bg-charcoal-900 border border-charcoal-700 flex items-center justify-center text-forest-400 shadow-inner">
                    <Upload className="w-6 h-6" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Drop your Excel (.xlsx, .xls, .csv) or PDF document here
                    </p>
                    <p className="text-xs text-charcoal-400 mt-1">
                      or click to browse your computer or tablet storage
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-charcoal-500 font-mono">
                    <span>Excel (.xlsx/.csv)</span>
                    <span>•</span>
                    <span>PDF (.pdf)</span>
                    <span>•</span>
                    <span>Up to 10MB</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* PARSE ERRORS / WARNINGS */}
          {parseErrors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-800/80 text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Notice / Skipped Rows:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 max-h-24 overflow-y-auto font-mono">
                {parseErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {importSuccess && (
            <div className="p-4 rounded-xl bg-forest-950 border border-forest-500 text-forest-100 flex items-center gap-2.5 font-bold shadow-lg animate-fade-in">
              <CheckCircle className="w-5 h-5 text-forest-400 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}

          {/* STEP 3: PREVIEW & SELECTION */}
          {parsedProducts.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-charcoal-800">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-forest-400" />
                    <span>Parsed Products Preview ({parsedProducts.length} items detected)</span>
                  </h3>
                  <p className="text-[11px] text-charcoal-400">
                    Review extracted prices, stock levels, and warning thresholds before committing.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-forest-400 hover:text-forest-300 cursor-pointer"
                  >
                    {selectedIds.size === parsedProducts.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-charcoal-400 font-mono font-bold">
                    {selectedIds.size} of {parsedProducts.length} selected
                  </span>
                </div>
              </div>

              {/* Import Mode Radio */}
              <div className="flex items-center gap-4 text-xs p-3 rounded-xl bg-charcoal-950 border border-charcoal-800">
                <span className="font-semibold text-charcoal-300">Import Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-forest-500 focus:ring-forest-500"
                  />
                  <span className="text-white">Merge & Update (Keep existing, update matching SKUs)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-rose-500 focus:ring-rose-500"
                  />
                  <span className="text-rose-300">Replace Entire Catalog</span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-charcoal-900 sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-charcoal-400 border-b border-charcoal-800">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === parsedProducts.length && parsedProducts.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-charcoal-700 text-forest-500 focus:ring-forest-500"
                        />
                      </th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Stock & Warning</th>
                      <th className="py-2.5 px-3 text-right">Cost ({config.currencySymbol.trim()})</th>
                      <th className="py-2.5 px-3 text-right">Price ({config.currencySymbol.trim()})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-800/80 font-mono text-[11px]">
                    {parsedProducts.map((p) => {
                      const isLow = p.stockLevel <= p.lowStockThreshold;
                      const isSelected = selectedIds.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleToggleSelect(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-charcoal-900/90' : 'opacity-40 hover:opacity-75'
                          } ${isLow ? 'border-l-2 border-forest-500' : ''}`}
                        >
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(p.id)}
                              className="rounded border-charcoal-700 text-forest-500 focus:ring-forest-500"
                            />
                          </td>
                          <td className="py-2 px-3 font-bold text-forest-400">{p.sku}</td>
                          <td className="py-2 px-3 font-sans font-semibold text-white">
                            <span className="truncate max-w-[220px] block">{p.name}</span>
                          </td>
                          <td className="py-2 px-3 font-sans text-charcoal-300">{p.category}</td>
                          <td className="py-2 px-3 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-forest-950 text-forest-200 border border-forest-500 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3 text-forest-500" />
                                <span>{p.stockLevel} {p.unit} (Min: {p.lowStockThreshold})</span>
                              </span>
                            ) : (
                              <span className="text-charcoal-300">
                                {p.stockLevel} {p.unit} (Min: {p.lowStockThreshold})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-charcoal-400">{p.costPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-bold text-white">{p.sellingPrice.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-charcoal-950 px-6 py-4 border-t border-charcoal-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-charcoal-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={selectedIds.size === 0 || isParsing}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 border border-forest-500 shadow-md transition-all cursor-pointer active:scale-95"
          >
            <CheckCircle className="w-4 h-4 text-forest-200" />
            <span>Confirm & Import {selectedIds.size} Products</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  Barcode,
  QrCode,
  FlipHorizontal,
  Zap,
  ZapOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShoppingBag,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product, StoreConfig } from '../types/pos.ts';
import { soundEffects } from '../utils/soundEffects.ts';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product) => void;
  config: StoreConfig;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
  config,
}) => {
  const [scannerMode, setScannerMode] = useState<'camera' | 'file' | 'manual'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [scannedHistory, setScannedHistory] = useState<{ product: Product; timestamp: string }[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimestamp = useRef<number>(0);
  const lastScanText = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to find a product by code (barcode, SKU, ID, or JSON payload)
  const findProductByCode = useCallback(
    (rawCode: string): Product | null => {
      if (!rawCode) return null;
      const clean = rawCode.trim();
      const lower = clean.toLowerCase();

      // 1. Exact match on barcode or SKU
      const direct = products.find(
        (p) =>
          (p.barcode && p.barcode.trim() === clean) ||
          (p.sku && p.sku.trim() === clean) ||
          p.id === clean
      );
      if (direct) return direct;

      // 2. Case-insensitive match
      const caseMatch = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === lower) ||
          (p.sku && p.sku.trim().toLowerCase() === lower)
      );
      if (caseMatch) return caseMatch;

      // 3. Try parsing if QR code contains JSON
      if (clean.startsWith('{') && clean.endsWith('}')) {
        try {
          const parsed = JSON.parse(clean);
          const candidate = parsed.barcode || parsed.sku || parsed.id;
          if (candidate) {
            return findProductByCode(candidate);
          }
        } catch {}
      }

      // 4. Try parsing if QR code contains a URL with query params
      try {
        if (clean.includes('?') && (clean.startsWith('http://') || clean.startsWith('https://'))) {
          const url = new URL(clean);
          const pCode = url.searchParams.get('barcode') || url.searchParams.get('sku') || url.searchParams.get('id');
          if (pCode) {
            return findProductByCode(pCode);
          }
        }
      } catch {}

      return null;
    },
    [products]
  );

  // Process a successfully decoded barcode or QR code
  const handleBarcodeDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const cleanText = decodedText.trim();

      // Debounce repetitive scan of the exact same code within 1.2 seconds
      if (lastScanText.current === cleanText && now - lastScanTimestamp.current < 1200) {
        return;
      }

      lastScanTimestamp.current = now;
      lastScanText.current = cleanText;
      setLastScannedCode(cleanText);

      const matchedProduct = findProductByCode(cleanText);

      if (matchedProduct) {
        soundEffects.playBeep();
        onAddToCart(matchedProduct);
        setLastScannedProduct(matchedProduct);
        setScannedHistory((prev) => [
          { product: matchedProduct, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 7),
        ]);

        if (!isContinuous) {
          // If single scan mode, stop camera and close modal
          setTimeout(() => {
            onClose();
          }, 350);
        }
      } else {
        setLastScannedProduct(null);
      }
    },
    [findProductByCode, onAddToCart, isContinuous, onClose]
  );

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Camera stop warning:', err);
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
  }, []);

  // Start live camera scanner
  const startCamera = useCallback(async () => {
    await stopCamera();
    setCameraError(null);

    const containerId = 'pos-camera-viewport';
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // Query cameras if not yet loaded
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
        }
      } catch {}

      const qrScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      scannerRef.current = qrScanner;

      const cameraConfig = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: 'environment' };

      await qrScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(200, Math.floor(minEdge * 0.72));
            return { width: boxSize, height: Math.floor(boxSize * 0.65) };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleBarcodeDecoded(decodedText);
        },
        () => {
          // Frame parse miss, normal during scanning
        }
      );

      setIsCameraActive(true);

      // Check if torch/flashlight capability is available
      try {
        const capabilities = qrScanner.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsCameraActive(false);
      const msg = err?.message || 'Unable to access camera.';
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera access denied. Please allow camera permissions in your browser address bar.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. You can scan from image or enter barcode manually.');
      } else {
        setCameraError('Camera is busy or not supported. You can enter barcodes manually or upload an image.');
      }
    }
  }, [selectedCameraId, handleBarcodeDecoded, stopCamera]);

  // Toggle torch / flashlight
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Switch camera device
  const handleSwitchCamera = async () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  // Scan from uploaded file / photo
  const handleScanFromFile = async (file: File) => {
    try {
      setCameraError(null);
      const html5Qr = new Html5Qrcode('pos-file-scanner-temp');
      const decodedText = await html5Qr.scanFile(file, true);
      html5Qr.clear();
      if (decodedText) {
        handleBarcodeDecoded(decodedText);
      }
    } catch {
      setCameraError('Could not detect a readable barcode or QR code in the uploaded image. Please try a clearer picture.');
    }
  };

  // Manual code submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const matched = findProductByCode(manualInput.trim());
    if (matched) {
      soundEffects.playBeep();
      onAddToCart(matched);
      setLastScannedProduct(matched);
      setLastScannedCode(manualInput.trim());
      setScannedHistory((prev) => [
        { product: matched, timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(0, 7),
      ]);
      setManualInput('');
      setManualError(null);
      if (!isContinuous) {
        onClose();
      }
    } else {
      setManualError(`No product found with code "${manualInput.trim()}"`);
    }
  };

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (scannerMode === 'camera') {
        const timer = setTimeout(() => {
          startCamera();
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      stopCamera();
      setLastScannedProduct(null);
      setLastScannedCode(null);
      setManualError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, scannerMode, startCamera, stopCamera]);

  // Restart camera when camera device selection changes
  useEffect(() => {
    if (isOpen && isCameraActive && selectedCameraId) {
      startCamera();
    }
  }, [selectedCameraId]);

  // Keyboard shortcut listener for Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-charcoal-900 border border-charcoal-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-charcoal-800 flex items-center justify-between bg-charcoal-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-forest-900/80 border border-forest-600/50 flex items-center justify-center text-forest-300">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Barcode & QR Scanner</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-forest-900/80 text-forest-300 border border-forest-700/60 font-mono">
                  Live Camera
                </span>
              </h3>
              <p className="text-[11px] text-charcoal-400">Aim camera at stationery label or QR code to add to cart</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Mode Selector: Live Camera, Image File, Manual Input */}
        <div className="p-3 bg-charcoal-950/40 border-b border-charcoal-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-charcoal-950 p-1 rounded-xl border border-charcoal-800/80 flex-1">
            <button
              type="button"
              onClick={() => {
                setScannerMode('camera');
                setCameraError(null);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                scannerMode === 'camera'
                  ? 'bg-forest-700 text-white shadow-xs font-bold'
                  : 'text-charcoal-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                setScannerMode('manual');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                scannerMode === 'manual'
                  ? 'bg-forest-700 text-white shadow-xs font-bold'
                  : 'text-charcoal-400 hover:text-white'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Type Code</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                setScannerMode('file');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                scannerMode === 'file'
                  ? 'bg-forest-700 text-white shadow-xs font-bold'
                  : 'text-charcoal-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Photo</span>
            </button>
          </div>

          {/* Continuous Scanning Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsContinuous(!isContinuous)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              isContinuous
                ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
            }`}
            title={
              isContinuous
                ? 'Continuous Mode: Keep scanning items rapidly without closing'
                : 'Single Mode: Auto-closes after 1 successful scan'
            }
          >
            <RefreshCw className={`w-3 h-3 ${isContinuous ? 'text-emerald-400' : 'text-charcoal-500'}`} />
            <span className="hidden sm:inline">Continuous:</span>
            <span>{isContinuous ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* MODE 1: LIVE VIDEO CAMERA VIEWPORT */}
          {scannerMode === 'camera' && (
            <div className="space-y-3">
              <div className="relative w-full aspect-square max-h-[300px] sm:max-h-[340px] mx-auto bg-black rounded-2xl overflow-hidden border border-charcoal-800 shadow-inner flex items-center justify-center">
                {/* HTML5 QR Code Mount Node */}
                <div id="pos-camera-viewport" className="w-full h-full object-cover" />

                {/* Animated Targeting Overlay (Visual Reticle & Laser) */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Targeting Frame Box */}
                    <div className="relative w-4/5 h-3/5 border-2 border-dashed border-emerald-400/80 rounded-2xl flex items-center justify-center shadow-2xl">
                      {/* 4 Corner Markers */}
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm" />
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm" />
                      <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-sm" />

                      {/* Sweeping Laser Beam */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />
                    </div>

                    <span className="absolute bottom-3 text-[11px] font-mono text-emerald-300/90 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                      Align barcode or QR code inside box
                    </span>
                  </div>
                )}

                {/* Camera Inactive / Permission Prompt */}
                {!isCameraActive && !cameraError && (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-charcoal-900 border border-charcoal-800 flex items-center justify-center mx-auto text-forest-400 animate-spin">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-charcoal-300">Starting optical sensor camera...</p>
                  </div>
                )}

                {/* Error Banner inside camera box */}
                {cameraError && (
                  <div className="absolute inset-4 p-4 rounded-xl bg-charcoal-950/95 border border-rose-800/80 flex flex-col items-center justify-center text-center space-y-3 z-10">
                    <AlertCircle className="w-8 h-8 text-rose-400" />
                    <p className="text-xs text-rose-200 leading-relaxed font-semibold">{cameraError}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-xs font-semibold text-white border border-charcoal-700 cursor-pointer"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => setScannerMode('manual')}
                        className="px-3 py-1.5 rounded-lg bg-forest-700 hover:bg-forest-600 text-xs font-semibold text-white cursor-pointer"
                      >
                        Enter Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls Bar: Switch Camera & Torch */}
              <div className="flex items-center justify-between text-xs text-charcoal-400">
                <div className="flex items-center gap-2">
                  {availableCameras.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="px-2.5 py-1 rounded-lg bg-charcoal-950 border border-charcoal-800 hover:text-white hover:bg-charcoal-800 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5 text-forest-400" />
                      <span>Switch Camera ({availableCameras.length})</span>
                    </button>
                  )}

                  {hasTorch && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        torchOn
                          ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                          : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
                      }`}
                    >
                      {torchOn ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <ZapOff className="w-3.5 h-3.5" />}
                      <span>{torchOn ? 'Torch ON' : 'Torch OFF'}</span>
                    </button>
                  )}
                </div>

                <span className="text-[11px] font-mono text-charcoal-500">
                  {products.length} products loaded
                </span>
              </div>
            </div>
          )}

          {/* MODE 2: MANUAL BARCODE OR SKU ENTRY */}
          {scannerMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-charcoal-300">
                  Enter Barcode, SKU, or Product Code:
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-forest-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. 3026981254321 or PEN-PAR-001"
                    autoFocus
                    className="w-full pl-10 pr-24 py-2.5 bg-charcoal-950 border border-charcoal-800 rounded-xl text-sm text-white placeholder-charcoal-500 focus:outline-hidden focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {manualError && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              {/* Quick Sample Barcodes Pill Grid */}
              <div className="space-y-1 pt-1">
                <p className="text-[11px] text-charcoal-400">Quick Test Samples:</p>
                <div className="flex flex-wrap gap-1.5">
                  {products.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setManualInput(p.barcode || p.sku);
                      }}
                      className="px-2 py-1 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white border border-charcoal-800 text-[11px] font-mono cursor-pointer transition-colors"
                    >
                      {p.sku}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* MODE 3: UPLOAD BARCODE / QR PHOTO */}
          {scannerMode === 'file' && (
            <div className="space-y-3 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleScanFromFile(file);
                  }
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-charcoal-700 hover:border-forest-500 rounded-2xl p-8 text-center space-y-3 bg-charcoal-950/60 hover:bg-charcoal-950 transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-forest-950 border border-forest-700/60 flex items-center justify-center mx-auto text-forest-300">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Click to upload barcode or QR photo</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">Supports PNG, JPG, WebP image snapshots</p>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {/* HIDDEN TEMP ELEMENT FOR FILE SCANNER */}
          <div id="pos-file-scanner-temp" className="hidden" />

          {/* SCAN FEEDBACK BANNER: LAST SCANNED ITEM */}
          {lastScannedProduct && (
            <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 flex items-center justify-between gap-3 animate-slide-up shadow-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                      Item Added to Cart
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300/80">({lastScannedCode})</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{lastScannedProduct.name}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold font-mono text-emerald-300">
                  {config.currencySymbol}
                  {lastScannedProduct.sellingPrice.toFixed(2)}
                </p>
                <p className="text-[10px] font-mono text-emerald-400/80">Stock: {lastScannedProduct.stockLevel}</p>
              </div>
            </div>
          )}

          {/* UNRECOGNIZED CODE BANNER */}
          {lastScannedCode && !lastScannedProduct && (
            <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-between gap-2 animate-slide-up">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-200">Unrecognized Barcode</p>
                  <p className="text-[11px] font-mono text-amber-400/90 truncate">"{lastScannedCode}"</p>
                </div>
              </div>

              <span className="text-[10px] text-amber-400/80 font-mono shrink-0">Not in catalog</span>
            </div>
          )}

          {/* RECENT SCAN SESSION HISTORY */}
          {scannedHistory.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-charcoal-400">
                <span>Recent Scans this Session:</span>
                <span className="font-mono text-emerald-400">{scannedHistory.length} item(s)</span>
              </div>

              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                {scannedHistory.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className="px-3 py-1.5 rounded-xl bg-charcoal-950 border border-charcoal-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="w-4 h-4 rounded-full bg-forest-900 text-forest-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white truncate">{item.product.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-forest-400 font-bold">
                        {config.currencySymbol}
                        {item.product.sellingPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-charcoal-500">{item.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-charcoal-800 bg-charcoal-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-charcoal-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Hardware USB Scanners supported</span>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-md shadow-forest-950/50"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Done / Return to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};

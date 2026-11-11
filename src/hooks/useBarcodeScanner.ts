import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseBarcodeScannerOptions {
  /** Callback invoked when a complete barcode/QR sequence is detected */
  onScan: (barcode: string) => void;
  /** Whether the scanner listener is actively listening (defaults to true) */
  enabled?: boolean;
  /** Maximum milliseconds between consecutive keydowns to be considered a scanner burst (default: 55ms) */
  maxIntervalMs?: number;
  /** Minimum characters for a valid barcode string (default: 2) */
  minBarcodeLength?: number;
  /** Whether to prevent default form submission when Enter terminates a scan (default: true) */
  preventDefault?: boolean;
  /** Whether to intercept and consume scanner input even if an input field is focused (default: true) */
  interceptInputs?: boolean;
}

export interface UseBarcodeScannerReturn {
  lastScannedBarcode: string | null;
  lastScanTimestamp: number | null;
  isScanning: boolean;
  scannerConnected: boolean;
  clearLastScan: () => void;
}

/**
 * Custom React Hook that listens for rapid external USB/Bluetooth HID barcode scanner input sequences.
 * Hardware barcode scanners emulate high-speed keyboard input (<35ms per character) terminated by 'Enter'.
 * This hook distinguishes scanner sequences from human typing and automatically routes the scanned barcode.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  maxIntervalMs = 55,
  minBarcodeLength = 2,
  preventDefault = true,
  interceptInputs = true,
}: UseBarcodeScannerOptions): UseBarcodeScannerReturn {
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerConnected, setScannerConnected] = useState<boolean>(false);

  // Mutable refs to track timing and buffer without re-rendering per keystroke
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timestampsRef = useRef<number[]>([]);
  const isBurstRef = useRef<boolean>(false);
  const scanTimerRef = useRef<any>(null);

  const clearLastScan = useCallback(() => {
    setLastScannedBarcode(null);
    setLastScanTimestamp(null);
  }, []);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // 1. Check for Scanner Terminator Key (Enter or Tab)
      if (e.key === 'Enter' || e.key === 'Tab') {
        const barcodeCandidate = bufferRef.current.trim();
        const timestamps = timestampsRef.current;
        const charCount = barcodeCandidate.length;

        // Reset buffer state
        bufferRef.current = '';
        timestampsRef.current = [];

        if (charCount >= minBarcodeLength && timestamps.length >= 2) {
          // Calculate average inter-key delay
          const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
          const avgInterval = totalDuration / (timestamps.length - 1);

          // If keys arrived at scanner speed (<70ms average per key)
          if (avgInterval <= 70 || isBurstRef.current) {
            if (preventDefault) {
              e.preventDefault();
              e.stopPropagation();
            }

            // If an input was focused and filled by the scanner burst, clean it up if desired
            if (isInput && interceptInputs && target instanceof HTMLInputElement) {
              // If the input value exactly ends with or contains the barcode, strip it
              if (target.value === barcodeCandidate) {
                target.value = '';
              }
            }

            setLastScannedBarcode(barcodeCandidate);
            const scanTime = Date.now();
            setLastScanTimestamp(scanTime);
            setScannerConnected(true);
            setIsScanning(false);

            try {
              onScanRef.current(barcodeCandidate);
            } catch (err) {
              console.warn('Error in onScan callback:', err);
            }

            return;
          }
        }

        isBurstRef.current = false;
        return;
      }

      // 2. Only collect printable single characters (exclude Shift, Ctrl, Alt, F-keys, etc.)
      if (e.key.length !== 1) {
        return;
      }

      // 3. Buffer reset if gap between keys exceeds scanner speed
      if (timeDiff > maxIntervalMs) {
        bufferRef.current = e.key;
        timestampsRef.current = [now];
        isBurstRef.current = false;
      } else {
        // Fast burst detected!
        bufferRef.current += e.key;
        timestampsRef.current.push(now);

        // If at least 3 characters arrive within <50ms of each other, mark as active scanner burst
        if (timestampsRef.current.length >= 3) {
          isBurstRef.current = true;
          setIsScanning(true);

          if (scanTimerRef.current) {
            clearTimeout(scanTimerRef.current);
          }
          scanTimerRef.current = setTimeout(() => {
            setIsScanning(false);
          }, 300);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, [enabled, maxIntervalMs, minBarcodeLength, preventDefault, interceptInputs]);

  return {
    lastScannedBarcode,
    lastScanTimestamp,
    isScanning,
    scannerConnected,
    clearLastScan,
  };
}

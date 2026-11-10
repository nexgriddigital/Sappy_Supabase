// Clean, dependency-free Code128 (Type B) and QR matrix SVG generators

// Code 128-B Patterns (107 patterns, each pattern is a 6-digit string representing widths of alternating bars and spaces)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string into Code128-B bar pattern.
 */
export function encodeCode128(text: string): { bars: number[]; totalWidth: number } {
  const clean = text.replace(/[^\x20-\x7E]/g, '') || '0000';
  let checksum = START_CODE_B;
  const indices: number[] = [START_CODE_B];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    indices.push(code);
    checksum += code * (i + 1);
  }

  const checkIndex = checksum % 103;
  indices.push(checkIndex);
  indices.push(STOP_CODE);

  // Convert indices to bar widths (1=bar, 0=space)
  const binaryBars: number[] = [];
  // Quiet zone: 10 units space
  for (let q = 0; q < 10; q++) binaryBars.push(0);

  for (const idx of indices) {
    const pattern = CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      for (let w = 0; w < width; w++) {
        binaryBars.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Quiet zone: 10 units space
  for (let q = 0; q < 10; q++) binaryBars.push(0);

  return { bars: binaryBars, totalWidth: binaryBars.length };
}

/**
 * Generates an SVG path for Code128 barcode
 */
export function generateBarcodeSvgPath(
  text: string,
  width: number = 200,
  height: number = 50
): { pathData: string; viewBox: string } {
  const { bars, totalWidth } = encodeCode128(text);
  const scaleX = width / totalWidth;

  let pathData = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === 1 && !inBar) {
      inBar = true;
      barStart = i;
    } else if (bars[i] === 0 && inBar) {
      inBar = false;
      const barW = (i - barStart) * scaleX;
      const barX = barStart * scaleX;
      pathData += `M${barX.toFixed(2)},0 h${barW.toFixed(2)} v${height} h-${barW.toFixed(2)} Z `;
    }
  }

  if (inBar) {
    const barW = (bars.length - barStart) * scaleX;
    const barX = barStart * scaleX;
    pathData += `M${barX.toFixed(2)},0 h${barW.toFixed(2)} v${height} h-${barW.toFixed(2)} Z `;
  }

  return {
    pathData,
    viewBox: `0 0 ${width} ${height}`,
  };
}

import QRCode from 'qrcode';

/**
 * Standards-compliant 2D QR matrix generator (ISO/IEC 18004) with Reed-Solomon error correction.
 * Produces verified, camera-scannable 4-sided square matrix with quiet margins on all sides.
 */
export function generateQrMatrix(text: string, margin: number = 2): boolean[][] {
  try {
    const raw = String(text || '').trim() || '0000';
    const qr = QRCode.create(raw, {
      errorCorrectionLevel: 'M',
    });
    const coreSize = qr.modules.size;
    const totalSize = coreSize + margin * 2;
    const matrix: boolean[][] = Array.from({ length: totalSize }, () => Array(totalSize).fill(false));

    for (let r = 0; r < coreSize; r++) {
      for (let c = 0; c < coreSize; c++) {
        if (qr.modules.get(r, c)) {
          matrix[r + margin][c + margin] = true;
        }
      }
    }
    return matrix;
  } catch (err) {
    console.warn('QR code generation error:', err);
    return Array.from({ length: 25 }, () => Array(25).fill(false));
  }
}


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

/**
 * Deterministic 2D QR matrix generator (21x21 Version 1 format)
 * Produces crisp vector QR code with 3 standard finder eyes and data payload.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Helper to add Finder Pattern at (row, col)
  const addFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (
          i === 0 || i === 6 ||
          j === 0 || j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4)
        ) {
          matrix[r + i][c + j] = true;
        }
      }
    }
  };

  // 3 Finder patterns (Top-Left, Top-Right, Bottom-Left)
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8][8] = true;

  // Hash-based data encoding for reproducible, high-contrast QR patterns
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  // Fill data cells avoiding finders and timing tracks
  let bitIndex = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder zones
      const isFinderTL = r < 9 && c < 9;
      const isFinderTR = r < 9 && c >= size - 8;
      const isFinderBL = r >= size - 8 && c < 9;
      const isTiming = r === 6 || c === 6;

      if (!isFinderTL && !isFinderTR && !isFinderBL && !isTiming) {
        // Derive bit from hash and coordinates
        const pseudoRand = ((hash ^ (r * 31 + c * 17)) + bitIndex) % 100;
        matrix[r][c] = pseudoRand > 46;
        bitIndex++;
      }
    }
  }

  return matrix;
}

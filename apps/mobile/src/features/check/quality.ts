import type { PhotoIssue, PhotoQuality } from '@garimpo/contracts';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

/**
 * Análise básica de qualidade no dispositivo, sobre uma versão reduzida da
 * foto (320px). Heurísticas clássicas de CV — o pipeline do Sprint 3 refina,
 * mas as métricas salvas aqui já são auditáveis (check_photos.quality).
 */
const ANALYSIS_WIDTH = 320;
const GRID = 6;

const THRESHOLDS = {
  /** Variância do Laplaciano abaixo disso = tremida/desfocada. */
  sharpness: 45,
  /** Luma média (0–1) abaixo disso = escura. */
  brightness: 0.2,
  /** Fração de pixels estourados acima disso = reflexo/estouro. */
  overexposed: 0.06,
  /** Fração de células com detalhe abaixo disso = assunto pequeno (longe). */
  detailFar: 0.12,
  /** Detalhe em praticamente todas as células = assunto vazando o quadro (perto). */
  detailClose: 0.94,
} as const;

export async function analyzePhotoQuality(uri: string): Promise<PhotoQuality> {
  const context = ImageManipulator.manipulate(uri).resize({ width: ANALYSIS_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) {
    return {
      ok: true,
      issues: [],
      metrics: { sharpness: 0, brightness: 0.5, overexposed_ratio: 0, detail_coverage: 1 },
    };
  }

  const { data, width, height } = decodeJpeg(base64ToBytes(saved.base64), {
    useTArray: true,
    formatAsRGBA: true,
  });

  // Luma por pixel.
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }

  let sum = 0;
  let overexposed = 0;
  for (let p = 0; p < luma.length; p++) {
    sum += luma[p]!;
    if (luma[p]! > 250) overexposed++;
  }
  const brightness = sum / luma.length / 255;
  const overexposedRatio = overexposed / luma.length;

  // Variância do Laplaciano (4 vizinhos) — nitidez global.
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const v =
        4 * luma[p]! - luma[p - 1]! - luma[p + 1]! - luma[p - width]! - luma[p + width]!;
      lapSum += v;
      lapSumSq += v * v;
      lapCount++;
    }
  }
  const lapMean = lapSum / lapCount;
  const sharpness = lapSumSq / lapCount - lapMean * lapMean;

  // Cobertura de detalhe: desvio-padrão de luma por célula da grade.
  const cellW = Math.floor(width / GRID);
  const cellH = Math.floor(height / GRID);
  let detailedCells = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let cSum = 0;
      let cSumSq = 0;
      let cN = 0;
      for (let y = gy * cellH; y < (gy + 1) * cellH; y++) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x++) {
          const v = luma[y * width + x]!;
          cSum += v;
          cSumSq += v * v;
          cN++;
        }
      }
      const mean = cSum / cN;
      const std = Math.sqrt(Math.max(0, cSumSq / cN - mean * mean));
      if (std > 14) detailedCells++;
    }
  }
  const detailCoverage = detailedCells / (GRID * GRID);

  const issues: PhotoIssue[] = [];
  if (sharpness < THRESHOLDS.sharpness) issues.push('blurry');
  if (brightness < THRESHOLDS.brightness) issues.push('dark');
  if (overexposedRatio > THRESHOLDS.overexposed) issues.push('glare');
  if (detailCoverage < THRESHOLDS.detailFar) issues.push('too_far');
  else if (detailCoverage > THRESHOLDS.detailClose && sharpness < THRESHOLDS.sharpness * 2) {
    issues.push('too_close');
  }

  return {
    ok: issues.length === 0,
    issues,
    metrics: {
      sharpness: round(sharpness),
      brightness: round(brightness),
      overexposed_ratio: round(overexposedRatio),
      detail_coverage: round(detailCoverage),
    },
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

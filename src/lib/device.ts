export type Quality = 'low' | 'medium' | 'high';

export const QUALITY_PRESETS: Record<Quality, { dpr: [number, number]; cellsPerSeg: number; tubular: number; radial: number; motes: number; bloom: boolean; alveoli: number }> = {
  low: { dpr: [0.75, 1], cellsPerSeg: 22, tubular: 90, radial: 14, motes: 120, bloom: false, alveoli: 26 },
  medium: { dpr: [1, 1.5], cellsPerSeg: 45, tubular: 160, radial: 20, motes: 300, bloom: false, alveoli: 42 },
  high: { dpr: [1, 2], cellsPerSeg: 80, tubular: 240, radial: 28, motes: 600, bloom: true, alveoli: 60 },
};

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
}

export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return 'low';
  return isTouchDevice() ? 'medium' : 'high';
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

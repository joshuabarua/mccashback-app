export function rpmToStrobeHz(rpm: number, framesPerRev: number, harmonic: number): number {
  const rps = Math.max(0, rpm) / 60;
  const fpr = Math.max(1, framesPerRev);
  const h = Math.max(1, harmonic);
  return (rps * fpr) / h;
}

export function findNearestPreset(value: number, presets: readonly number[]): { nearest: number; delta: number } {
  if (!presets.length) return { nearest: value, delta: 0 };
  let nearest = presets[0];
  let best = Math.abs(value - nearest);
  for (const p of presets) {
    const d = Math.abs(value - p);
    if (d < best) { best = d; nearest = p; }
  }
  return { nearest, delta: best };
}

export function isWithinTolerance(value: number, preset: number, tolerance: number): boolean {
  return Math.abs(value - preset) <= tolerance;
}

export function snapToPreset(value: number, presets: readonly number[], snapWindow: number): number {
  if (!presets.length) return value;
  const { nearest, delta } = findNearestPreset(value, presets);
  return delta <= snapWindow ? nearest : value;
}

export function formatPresetTick(current: number, presets: readonly number[], snapWindow: number): string {
  if (!presets.length) return String(current);
  const { nearest, delta } = findNearestPreset(current, presets);
  return delta <= snapWindow ? `CD: ${nearest} ✓` : String(current);
}

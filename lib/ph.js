// Universal-indicator colours, pH 0 to 14.
const STOPS = [
  [0, [215, 38, 61]],
  [2, [240, 86, 46]],
  [4, [245, 155, 35]],
  [5, [242, 197, 48]],
  [6, [201, 212, 58]],
  [7, [95, 181, 72]],
  [8, [47, 158, 143]],
  [10, [43, 108, 184]],
  [12, [75, 63, 166]],
  [14, [91, 42, 134]],
];

export function phColor(ph) {
  const v = Math.min(14, Math.max(0, Number(ph) || 0));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i];
    const [p0, c0] = STOPS[i - 1];
    if (v <= p1) {
      const t = (v - p0) / (p1 - p0);
      const c = c0.map((a, k) => Math.round(a + (c1[k] - a) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return 'rgb(91, 42, 134)';
}

export const SCALE_GRADIENT =
  'linear-gradient(90deg, ' +
  STOPS.map(([p, c]) => `rgb(${c.join(',')}) ${((p / 14) * 100).toFixed(1)}%`).join(', ') +
  ')';

export function phCategory(min, max) {
  const mid = (min + max) / 2;
  if (mid < 4.6) return 'Strongly acidic';
  if (mid < 6.6) return 'Acidic';
  if (mid <= 7.4) return 'Near neutral';
  return 'Alkaline';
}

export function fmt(n) {
  const r = Math.round(Number(n) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

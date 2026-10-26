/** Color math for runtime team theming: contrast checks and readable accent selection. */

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(channel) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((c, i) => c + (cb[i]! - c) * amount) as Rgb);
}

/** Text color (near-white or near-black) that reads on a given background. */
export function readableOn(background: string): string {
  return contrast(background, "#ffffff") >= contrast(background, "#0b0f17") ? "#ffffff" : "#0b0f17";
}

/**
 * Picks the team color that reads best on the page background, then nudges it toward
 * white (dark theme) or black (light theme) until it reaches the target contrast.
 */
export function readableAccent(colors: readonly string[], background: string, target = 3.5): string {
  const best = [...colors].sort((a, b) => contrast(b, background) - contrast(a, background))[0] ?? "#888888";
  const toward = luminance(background) < 0.2 ? "#ffffff" : "#000000";
  let color = best;
  for (let step = 1; step <= 10 && contrast(color, background) < target; step++) {
    color = mix(best, toward, step * 0.08);
  }
  return color;
}

/** Ignore near-white or near-black secondaries when choosing an accent (Jets white, Raiders black). */
export function isNeutral(hex: string): boolean {
  const l = luminance(hex);
  return l > 0.85 || l < 0.005;
}

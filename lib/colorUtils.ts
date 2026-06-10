export interface ColorSet {
  50: string;
  100: string;
  200: string;
  400: string;
  500: string;
  600: string;
  700: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const value = parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 60) {
    rn = c;
    gn = x;
  } else if (h < 120) {
    rn = x;
    gn = c;
  } else if (h < 180) {
    gn = c;
    bn = x;
  } else if (h < 240) {
    gn = x;
    bn = c;
  } else if (h < 300) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }

  return {
    r: (rn + m) * 255,
    g: (gn + m) * 255,
    b: (bn + m) * 255,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function hueToHex(hue: number, saturation = 75, lightness = 50): string {
  const h = ((hue % 360) + 360) % 360;
  return hslToHex(h, saturation, lightness);
}

export function hexToHue(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 30;
  return rgbToHsl(rgb.r, rgb.g, rgb.b).h;
}

/** Build UI shades from a single brand hex color. */
export function buildColorSetFromHex(hex: string): ColorSet | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const base = normalizeHexColor(hex)!;
  const saturation = Math.max(35, Math.min(hsl.s, 90));

  return {
    50: hslToHex(hsl.h, saturation * 0.35, 97),
    100: hslToHex(hsl.h, saturation * 0.45, 92),
    200: hslToHex(hsl.h, saturation * 0.55, 84),
    400: hslToHex(hsl.h, saturation * 0.9, Math.min(hsl.l + 8, 72)),
    500: base,
    600: hslToHex(hsl.h, saturation, Math.max(hsl.l - 8, 28)),
    700: hslToHex(hsl.h, saturation, Math.max(hsl.l - 16, 22)),
  };
}

export function isCustomHexColor(color: string | null | undefined): boolean {
  return !!color && color.startsWith('#');
}

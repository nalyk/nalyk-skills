// sRGB ⇄ OKLCH, gradients blended in OKLCH (midpoints never go muddy), and
// the WCAG contrast ratio the theme tests hold every text token to.

export type Rgb = [number, number, number]
export type Oklch = [number, number, number]

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = ([r, g, b]: Rgb): string =>
  '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

const toLin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export const rgbToOklch = (rgb: Rgb): Oklch => {
  const [r, g, b] = rgb.map(toLin) as Rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360]
}

export const oklchToRgb = ([L, C, H]: Oklch): Rgb => {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** Mixes two hex colors in OKLCH at t (0..1), hue along the shorter arc. */
export const mixOklch = (from: string, to: string, t: number): string => {
  const [l1, c1, h1] = rgbToOklch(hexToRgb(from))
  const [l2, c2, h2] = rgbToOklch(hexToRgb(to))
  let dh = h2 - h1
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  // An achromatic end takes the other end's hue, so grey never drags hue.
  const h = c1 < 0.02 ? h2 : c2 < 0.02 ? h1 : h1 + dh * t
  return rgbToHex(oklchToRgb([l1 + (l2 - l1) * t, c1 + (c2 - c1) * t, (h + 360) % 360]))
}

/** n stops from `from` to `to`, inclusive. */
export const gradient = (from: string, to: string, n: number): string[] =>
  Array.from({ length: Math.max(1, n) }, (_, i) => mixOklch(from, to, n === 1 ? 0 : i / (n - 1)))

/** A hue laid at `alpha` over a background, blended in OKLCH. */
export const tint = (hue: string, bg: string, alpha: number): string => mixOklch(bg, hue, alpha)

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(toLin) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio between two colors, 1..21. */
export const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** Darkens or lightens `fg` in OKLCH lightness until it reaches `min` against `bg`. */
export const ensureContrast = (fg: string, bg: string, min = 4.5): string => {
  if (contrast(fg, bg) >= min) return fg
  const [L, C, H] = rgbToOklch(hexToRgb(fg))
  const towardDark = luminance(bg) > 0.18
  for (let i = 1; i <= 60; i += 1) {
    const l = towardDark ? L - i * 0.01 : L + i * 0.01
    const hex = rgbToHex(oklchToRgb([Math.min(1, Math.max(0, l)), C, H]))
    if (contrast(hex, bg) >= min) return hex
  }
  return towardDark ? '#000000' : '#FFFFFF'
}

// Cell-grid helpers: width checks, sub-cell bars, sparklines, padding.

import { GLYPH } from './theme'

const WIDE: readonly [number, number][] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e],
  [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff],
  [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]

/** True for a code point a terminal draws two cells wide (or an emoji selector). */
export const isWide = (cp: number): boolean => cp === 0xfe0f || WIDE.some(([a, b]) => cp >= a && cp <= b)

/** Every code point of `s` that is not single width. */
export const wideChars = (s: string): string[] => [...s].filter(ch => isWide(ch.codePointAt(0) ?? 0))

/** Terminal cells a string takes, all our glyphs being width 1. */
export const cells = (s: string): number => [...s].reduce((n, ch) => n + (isWide(ch.codePointAt(0) ?? 0) ? 2 : 1), 0)

export const padStart = (s: string, n: number): string => ' '.repeat(Math.max(0, n - cells(s))) + s
export const padEnd = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - cells(s)))

/** Cuts to n cells with an ellipsis. */
export const clip = (s: string, n: number): string => {
  if (n <= 0) return ''
  if (cells(s) <= n) return s
  return [...s].slice(0, Math.max(0, n - 1)).join('') + '…'
}

/** A bar `width` cells wide filled to `fraction` with eighth-block precision: [filled, partial, empty]. */
export const eighthBar = (fraction: number, width: number): [string, string, string] => {
  const f = Math.min(1, Math.max(0, fraction))
  const eighths = Math.round(f * width * 8)
  const full = Math.floor(eighths / 8)
  const rest = eighths % 8
  const partial = full < width && rest > 0 ? GLYPH.eighths[rest] ?? '' : ''
  const empty = Math.max(0, width - full - (partial ? 1 : 0))
  return [GLYPH.full.repeat(full), partial, ' '.repeat(empty)]
}

/** An n-wide sparkline of values in 0..100. */
export const sparkline = (values: readonly number[], n = 8): string => {
  const tail = values.slice(-n)
  return tail.map(v => GLYPH.spark[Math.min(7, Math.max(0, Math.round((v / 100) * 7)))] ?? '▁').join('').padStart(n, ' ')
}

/** Five fix-round pips: ●●○○○. */
export const pips = (round: number, of = 5): string => '●'.repeat(Math.min(of, round)) + '○'.repeat(Math.max(0, of - round))

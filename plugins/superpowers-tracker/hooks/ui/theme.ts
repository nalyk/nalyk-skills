// "Arc": every stage owns one hue, from ideas (violet) to shipped (gold).
// The one module that holds colors; nothing elsewhere is hardcoded.

import type { StageId, ThemeChoice } from '../../types'
import { gradient, tint } from './oklch'

export type ThemeName = 'dark' | 'light' | 'dark-daltonized' | 'light-daltonized' | 'ansi'

export type Tokens = {
  name: ThemeName
  stage: Record<StageId, string>
  ok: string
  warn: string
  critical: string
  muted: string
  text: string
  canvas: string
  brand: [string, string]
  /** True where colors are named ANSI colors: no truecolor tints or gradients. */
  ansi: boolean
}

const DARK: Tokens = {
  name: 'dark',
  stage: { brainstorm: '#B48CFF', spec: '#7AA2FF', plan: '#5CC8FF', execute: '#3DDBB5', review: '#A3E635', finish: '#FFC857' },
  ok: '#4ADE80',
  warn: '#FBBF24',
  critical: '#F87171',
  muted: 'inactive',
  text: 'text',
  canvas: '#0B0B10',
  brand: ['#7C5CFF', '#00D4FF'],
  ansi: false,
}

// Light: plan, execute and the brand's cyan end are darkened in OKLCH from
// the brief's #0284C7 / #0F9F7A / #0891B2 to reach 4.5:1 on white.
const LIGHT: Tokens = {
  name: 'light',
  stage: { brainstorm: '#7C3AED', spec: '#3B5BDB', plan: '#007BBD', execute: '#008663', review: '#4D7C0F', finish: '#B45309' },
  ok: '#15803D',
  warn: '#B45309',
  critical: '#DC2626',
  muted: 'inactive',
  text: 'text',
  canvas: '#FFFFFF',
  brand: ['#5B3DF5', '#007F9F'],
  ansi: false,
}

const DARK_DALT: Tokens = { ...DARK, name: 'dark-daltonized', stage: { ...DARK.stage, review: '#38BDF8' }, critical: '#FB923C' }
const LIGHT_DALT: Tokens = { ...LIGHT, name: 'light-daltonized', stage: { ...LIGHT.stage, review: '#0369A1' }, critical: '#C2410C' }

const ANSI: Tokens = {
  name: 'ansi',
  stage: { brainstorm: 'magenta', spec: 'blue', plan: 'cyan', execute: 'green', review: 'greenBright', finish: 'yellow' },
  ok: 'green',
  warn: 'yellow',
  critical: 'red',
  muted: 'gray',
  text: 'white',
  canvas: 'black',
  brand: ['magenta', 'magenta'],
  ansi: true,
}

export const THEMES: Record<ThemeName, Tokens> = {
  dark: DARK,
  light: LIGHT,
  'dark-daltonized': DARK_DALT,
  'light-daltonized': LIGHT_DALT,
  ansi: ANSI,
}

/** The tokens for the person's setting, Claude Code's own `theme` row, and NO_COLOR. */
export const pickTheme = (choice: ThemeChoice, engineTheme: string | undefined, noColor: boolean): Tokens => {
  if (noColor || choice === 'ansi') return ANSI
  const engine = (engineTheme ?? '').toLowerCase()
  const isLight = choice === 'light' || (choice !== 'dark' && engine.startsWith('light'))
  if (choice === 'daltonized' || (choice === 'auto' && engine.includes('daltonized'))) return isLight ? LIGHT_DALT : DARK_DALT
  if (choice === 'auto' && engine.includes('ansi')) return ANSI
  return isLight ? LIGHT : DARK
}

/** The pill and selection background: a stage hue at ~18% (dark) or ~12% (light) over the canvas. */
export const tintOf = (t: Tokens, hue: string): string | undefined =>
  t.ansi ? undefined : tint(hue, t.canvas, t.name.startsWith('light') ? 0.12 : 0.18)

/** n colors along the brand gradient, OKLCH-blended. */
export const brandRamp = (t: Tokens, n: number): string[] => (t.ansi ? Array(n).fill(t.brand[0]) : gradient(t.brand[0], t.brand[1], n))

/** The whole arc, violet to gold, for particles and the desktop rail. */
export const arcRamp = (t: Tokens, n: number): string[] => {
  if (t.ansi) return Array(n).fill(t.stage.finish)
  const stops = [t.stage.brainstorm, t.stage.spec, t.stage.plan, t.stage.execute, t.stage.review, t.stage.finish]
  return Array.from({ length: n }, (_, i) => {
    const x = (i / Math.max(1, n - 1)) * (stops.length - 1)
    const k = Math.min(stops.length - 2, Math.floor(x))
    return gradient(stops[k]!, stops[k + 1]!, 11)[Math.round((x - k) * 10)]!
  })
}

export const SEV_COLOR = (t: Tokens, sev: 'info' | 'warn' | 'critical'): string =>
  sev === 'critical' ? t.critical : sev === 'warn' ? t.warn : t.muted

/** Glyphs, all single width. Status is always glyph + color. */
export const GLYPH = {
  brand: 'ϟ',
  done: '●',
  running: '◐',
  pending: '○',
  failed: '✗',
  warn: '⚠',
  current: '◆',
  ruling: '⚖',
  agents: '⌁',
  check: '✓',
  loop: '↻',
  wait: '⧗',
  arrow: '▸',
  railDone: '━',
  railFuture: '╌',
  tier: { cheap: '◇', mid: '◈', top: '◆', unknown: '·' },
  eighths: ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'],
  full: '█',
  spark: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
} as const

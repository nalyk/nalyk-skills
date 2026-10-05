// Raster cells, packed as the terminal wants them: base64 of little-endian
// u32 triplets [codePoint, fg, bg]; 0x01000000 is the terminal's default color.
// Plus the two charts drawn with them: the Gantt strip and the swimlanes.

import type { Agent, Run, Role } from '../../types'
import type { Tokens } from './theme'
import { isWide } from './cells'

export const DEFAULT_COLOR = 0x01000000
export type Cell = { ch: string; fg?: string; bg?: string }

const hex = (c: string | undefined): number => {
  if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return DEFAULT_COLOR
  return parseInt(c.slice(1), 16)
}

const toBase64 = (bytes: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Packs a grid (rows of cells) for `RasterProps.cells`; a wide or non-BMP glyph becomes a space. */
export const encodeCells = (grid: readonly (readonly Cell[])[], columns: number, rows: number): string => {
  const words = new Uint32Array(columns * rows * 3)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const cell = grid[y]?.[x]
      let cp = cell?.ch.codePointAt(0) ?? 0x20
      if (cp > 0xffff || cp < 0x20 || isWide(cp)) cp = 0x20
      const i = (y * columns + x) * 3
      words[i] = cp
      words[i + 1] = hex(cell?.fg)
      words[i + 2] = hex(cell?.bg)
    }
  }
  const bytes = new Uint8Array(words.buffer)
  // Little-endian on every host this runs on; make it explicit anyway.
  const view = new DataView(words.buffer)
  for (let i = 0; i < words.length; i += 1) view.setUint32(i * 4, words[i] ?? 0, true)
  return toBase64(bytes)
}

/** Decodes a packed grid back into code points (for tests). */
export const decodeCodePoints = (cells: string): number[] => {
  const bin = atob(cells)
  const out: number[] = []
  for (let i = 0; i < bin.length; i += 12) {
    out.push(bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24))
  }
  return out
}

const blank = (columns: number): Cell[] => Array.from({ length: columns }, () => ({ ch: ' ' }))

export const ROLE_HUE = (t: Tokens, role: Role): string =>
  role === 'implementer' ? t.stage.execute : role.endsWith('reviewer') ? t.stage.review : role === 'analyst' ? t.stage.spec : role === 'investigator' ? t.stage.plan : t.stage.brainstorm

/** One row per task across session time: build, review, hatched fix rounds, a "now" cursor. */
export const ganttGrid = (run: Run, agents: readonly Agent[], t: Tokens, columns: number, now: number): Cell[][] => {
  const label = 5
  const span = Math.max(1, columns - label)
  const start = Math.min(run.startedAt || now, ...run.tasks.map(x => x.startedAt ?? now), ...agents.map(a => a.startedAt))
  const total = Math.max(60_000, now - start)
  const col = (ms: number) => label + Math.min(span - 1, Math.max(0, Math.floor(((ms - start) / total) * span)))
  return run.tasks.map(task => {
    const row = blank(columns)
    const tag = `#${task.n}`.padStart(4) + ' '
    ;[...tag].forEach((ch, i) => (row[i] = { ch, fg: t.ansi ? undefined : t.stage.execute }))
    if (task.startedAt !== undefined) {
      const end = task.doneAt ?? now
      for (let x = col(task.startedAt); x <= col(end); x += 1) row[x] = { ch: '▂', fg: t.stage.execute }
    }
    const mine = agents.filter(a => a.task === task.n)
    const firstReview = mine.find(a => a.role === 'task-reviewer')?.startedAt ?? Infinity
    for (const a of mine) {
      const end = a.endedAt ?? now
      const isFix = (a.role === 'implementer' || a.role === 're-reviewer') && a.startedAt > firstReview
      const hue = a.role === 'implementer' ? t.stage.execute : t.stage.review
      for (let x = col(a.startedAt); x <= col(end); x += 1) row[x] = { ch: isFix ? '▒' : '█', fg: hue }
    }
    const nowX = col(now)
    if (row[nowX]?.ch === ' ') row[nowX] = { ch: '│', fg: t.ansi ? undefined : '#888888' }
    return row
  })
}

/** One bar per subagent on the session's time axis, tier glyph at its left edge. */
export const swimlaneGrid = (agents: readonly Agent[], t: Tokens, columns: number, now: number, tierGlyph: Record<string, string>): Cell[][] => {
  const start = Math.min(now, ...agents.map(a => a.startedAt))
  const total = Math.max(60_000, now - start)
  const col = (ms: number) => Math.min(columns - 1, Math.max(0, Math.floor(((ms - start) / total) * columns)))
  return agents.map(a => {
    const row = blank(columns)
    const hue = ROLE_HUE(t, a.role)
    const x0 = col(a.startedAt)
    const x1 = Math.max(x0, col(a.endedAt ?? now))
    for (let x = x0; x <= x1; x += 1) row[x] = { ch: a.status === 'running' && x === x1 ? '▌' : '█', fg: a.status === 'failed' ? t.critical : hue }
    row[x0] = { ch: tierGlyph[a.tier] ?? '·', fg: '#0B0B10', bg: hue }
    return row
  })
}

/** Ship-moment particles: braille dots in the arc gradient, drifting up and fading over `frames`. */
export const sparkFrame = (columns: number, rows: number, frame: number, frames: number, ramp: readonly string[], seed = 7): Cell[][] => {
  const dots = ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈']
  const grid = Array.from({ length: rows }, () => blank(columns))
  let s = seed
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const n = Math.max(6, Math.floor(columns / 4))
  const life = 1 - frame / Math.max(1, frames)
  for (let i = 0; i < n; i += 1) {
    const x = Math.floor(rand() * columns)
    const rise = rand() * rows * 2
    const y = Math.floor(rows - 1 - ((frame / frames) * rows * 1.5 + rise) % (rows + 1))
    if (y < 0 || y >= rows || rand() > life + 0.15) continue
    const color = ramp[Math.floor((x / columns) * (ramp.length - 1))] ?? '#FFC857'
    grid[y]![x] = { ch: dots[Math.floor(rand() * dots.length)] ?? '⠂', fg: color }
  }
  return grid
}

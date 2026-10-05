// Shared pieces of the pane: its context, section headers, the three
// designed states (empty, loading, error), key/value grids.

import type { Elements, RenderElement, RenderNode, RenderSurface } from 'claude-code'
import type { World } from '../viewModel'
import type { Tokens } from '../theme'

export type Els = Elements[RenderSurface]

export type PaneActions = {
  tab: (n: number) => void
  select: (i: number) => void
  expand: (i: number) => void
  ack: (id: string) => void
  ackAll: () => void
  exportRun: () => void
  close: () => void
  resume: (n: number) => void
  dismiss: (n: number) => void
  openEvidence: (id: string) => void
}

export type PaneCtx = {
  els: Els
  t: Tokens
  w: World
  now: number
  cols: number
  surface: RenderSurface
  focused: boolean
  loading: boolean
  act: PaneActions
}

/** `T A S K S`: uppercase muted label with one space of tracking. */
export const tracked = (s: string): string => s.toUpperCase().split('').join(' ')

export const Section = (c: PaneCtx, label: string, right?: string): RenderElement => {
  const { Box, Text } = c.els
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Text color={c.t.muted}>{tracked(label)}</Text>
      {right ? <Text color={c.t.muted}>{right}</Text> : null}
    </Box>
  )
}

/** Empty state: a 3-line muted drawing, one sentence, the next useful action. */
export const Empty = (c: PaneCtx, art: [string, string, string], sentence: string): RenderElement => {
  const { Box, Text } = c.els
  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      {art.map(line => (
        <Text color={c.t.muted}>{line}</Text>
      ))}
      <Box marginTop={1}>
        <Text color={c.t.muted}>{sentence}</Text>
      </Box>
    </Box>
  )
}

/** Loading: dim ░▒░ skeleton bars. */
export const Skeleton = (c: PaneCtx, rows = 3): RenderElement => {
  const { Box, Text } = c.els
  const w = Math.max(8, Math.min(48, c.cols - 8))
  return (
    <Box flexDirection="column" paddingY={1}>
      {Array.from({ length: rows }, (_, i) => (
        <Text dimColor color={c.t.muted}>{('░▒░'.repeat(Math.ceil(w / 3))).slice(0, w - i * 4)}</Text>
      ))}
    </Box>
  )
}

/** Error: a muted card naming the file; the last good read stays on screen. */
export const ParseError = (c: PaneCtx, file: string, why: string): RenderElement => {
  const { Box, Text } = c.els
  return (
    <Box borderStyle="round" borderColor={c.t.muted} borderDimColor paddingX={1} flexDirection="column" marginBottom={1}>
      <Text color={c.t.muted}>{`couldn't parse ${file}: showing last good read`}</Text>
      <Text color={c.t.muted} dimColor wrap="truncate-end">{why}</Text>
    </Box>
  )
}

/** Muted labels right-aligned to a shared column, values in code style. */
export const KeyValues = (c: PaneCtx, rows: readonly [string, string | RenderNode][]): RenderElement => {
  const { Box, Text } = c.els
  const w = Math.max(...rows.map(([k]) => k.length))
  return (
    <Box flexDirection="column">
      {rows.map(([k, v]) => (
        <Box flexDirection="row" gap={2}>
          <Text color={c.t.muted}>{k.padStart(w)}</Text>
          {typeof v === 'string' ? <Text wrap="truncate-middle">{v}</Text> : v}
        </Box>
      ))}
    </Box>
  )
}

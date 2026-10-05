// Tab 1, Flow: a vertical subway map of the session. The main line is ┃ in
// the stage hue; subagents fork off ├━━◐ and rejoin ╰━━●; a compaction is a
// dashed break. The selected station opens inline into a card.

import type { RenderElement, RenderNode } from 'claude-code'
import type { TimelineRow } from '../../../types'
import { Empty, Section, type PaneCtx } from './kit'
import { clip, padStart } from '../cells'
import { tintOf } from '../theme'

export const clock = (at: number): string => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The line and the station: branches fork off ├━━ and rejoin ╰━━; the rest sit on ┃. */
const stationGlyph = (r: TimelineRow): string => {
  switch (r.kind) {
    case 'agent-start':
      return '├━━◐'
    case 'agent-end':
      return `╰━━${r.ok === false ? '✗' : '●'}`
    case 'compact':
      return '┊ ↻'
    case 'warning':
      return '┃ ⚠'
    case 'test':
      return `┃ ${r.ok ? '·' : '✗'}`
    case 'artifact':
      return '┃ ◆'
    case 'note':
      return '┃ ·'
    default:
      return '┃ ●'
  }
}

export const Flow = (c: PaneCtx): RenderElement => {
  const { Box, Text } = c.els
  const rows = c.w.timeline.slice(-160)
  if (rows.length === 0) {
    return Empty(c, ['   ●', '   ┃', '   ○'], 'No superpowers activity yet. The map grows as skills fire and subagents run.')
  }
  const width = Math.max(20, c.cols - 10)
  const sel = Math.min(c.w.ui.selection, rows.length - 1)
  return (
    <Box flexDirection="column">
      {Section(c, 'Flow', `${rows.length} stations`)}
      {rows.map((r, i) => {
        const hue = c.t.stage[r.stage]
        const isSel = i === sel
        const glyph = stationGlyph(r)
        const color = r.kind === 'warning' ? c.t.warn : r.ok === false && r.kind !== 'test' ? c.t.critical : r.kind === 'test' ? (r.ok ? c.t.ok : c.t.critical) : hue
        const label = r.kind === 'compact' ? `compacted · ${r.detail ?? ''}` : r.label
        const main = `${glyph} ${label}`
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" {...(isSel && tintOf(c.t, hue) ? { backgroundColor: tintOf(c.t, hue)! } : {})}>
              <Text wrap="truncate-end" inverse={isSel && c.t.ansi}>
                <Text color={color} bold={r.kind === 'skill'}>{clip(main, width)}</Text>
                {r.detail && r.kind !== 'compact' ? <Text color={c.t.muted}>{` · ${clip(r.detail, Math.max(0, width - main.length - 3))}`}</Text> : null}
              </Text>
              <Text color={c.t.muted}>{padStart(clock(r.at), 6)}</Text>
            </Box>
            {isSel && c.w.ui.expanded === i ? (
              <Box borderStyle="round" borderColor={hue} paddingX={1} marginLeft={2} flexDirection="column">
                <Text bold color={hue}>{r.label}</Text>
                <Text color={c.t.muted}>{`${r.kind} · ${r.stage} · ${new Date(r.at).toISOString()}`}</Text>
                {r.detail ? <Text wrap="wrap">{r.detail}</Text> : null}
                {r.agentId ? <Text color={c.t.muted}>{`agent ${r.agentId}`}</Text> : null}
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}


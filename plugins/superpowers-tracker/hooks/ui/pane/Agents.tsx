// Tab 3, Agents: swimlanes on the session's time axis, then a dense table,
// running rows pinned on top; hover a row to reveal its full description.

import { taskLabel } from '../../taskid'
import type { RenderElement, RenderNode } from 'claude-code'
import { Empty, Section, type PaneCtx } from './kit'
import { clip, padEnd, padStart } from '../cells'
import { GLYPH } from '../theme'
import { ROLE_HUE, encodeCells, swimlaneGrid } from '../raster'
import { roleLabel } from '../../signals/agents'
import { fmtDuration } from '../../core'

export const Agents = (c: PaneCtx): RenderElement => {
  const { Box, Text } = c.els
  const agents = [...c.w.agents].sort((a, b) => (a.status === 'running' ? 0 : 1) - (b.status === 'running' ? 0 : 1) || b.startedAt - a.startedAt)
  if (agents.length === 0) {
    return Empty(c, ['   ┃', '   ├━━○', '   ╰━━○'], 'No subagents yet. SDD dispatches an implementer, then a reviewer, per task.')
  }
  const lanes = [...c.w.agents].slice(-24)
  const columns = Math.max(20, Math.min(240, c.cols - 2))
  const Raster = 'Raster' in c.els && !c.t.ansi ? c.els.Raster : undefined
  const grid = swimlaneGrid(lanes, c.t, columns, c.now, GLYPH.tier)
  const mix = { cheap: 0, mid: 0, top: 0, unknown: 0 }
  for (const a of c.w.agents) mix[a.tier] += 1
  return (
    <Box flexDirection="column">
      {Section(c, 'Swimlanes', `◇ ${mix.cheap}  ◈ ${mix.mid}  ◆ ${mix.top}${mix.unknown ? `  · ${mix.unknown}` : ''}`)}
      {Raster ? (
        <Raster key="lanes" columns={columns} rows={Math.max(1, grid.length)} cells={encodeCells(grid, columns, Math.max(1, grid.length))} />
      ) : (
        grid.map(row => <Text>{row.map(cell => cell.ch).join('')}</Text>)
      )}
      {Section(c, 'Subagents', `${agents.filter(a => a.status === 'running').length} running`)}
      <Box flexDirection="row" gap={1}>
        <Text color={c.t.muted}>{padEnd('ROLE', 15)}</Text>
        <Text color={c.t.muted}>{padStart('TASK', 4)}</Text>
        <Text color={c.t.muted}>{padEnd('MODEL', 10)}</Text>
        <Text color={c.t.muted}>{padEnd('STATUS', 8)}</Text>
        <Text color={c.t.muted}>{padStart('TIME', 7)}</Text>
        <Text color={c.t.muted}>VERDICT</Text>
      </Box>
      {agents.slice(0, 60).map((a, i) => {
        const hue = ROLE_HUE(c.t, a.role)
        const g = a.status === 'running' ? GLYPH.running : a.status === 'failed' ? GLYPH.failed : GLYPH.done
        const model = `${GLYPH.tier[a.tier]} ${a.model ? a.model.replace(/^claude-/, '').split('-')[0] : a.modelOmitted ? 'inherits' : '?'}`
        return (
          <Box key={`agent-${i}`} flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color={hue}>{`${g} ${padEnd(clip(roleLabel(a.role), 13), 13)}`}</Text>
              <Text>{padStart(a.task !== undefined ? `#${taskLabel(a.task)}` : '', 4)}</Text>
              <Text color={a.modelOmitted ? c.t.warn : c.t.text}>{padEnd(model, 10)}</Text>
              <Text color={a.status === 'failed' ? c.t.critical : c.t.muted}>{padEnd(a.status, 8)}</Text>
              <Text>{padStart(fmtDuration((a.endedAt ?? c.now) - a.startedAt), 7)}</Text>
              <Text wrap="truncate-end" color={c.t.muted}>{a.verdict ?? ''}</Text>
            </Box>
            <Box display="none" hover={{ display: 'flex' }} paddingLeft={2}>
              <Text color={c.t.muted} italic wrap="truncate-end">{`${a.description}${a.summary ? ` · ${a.summary}` : ''}`}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

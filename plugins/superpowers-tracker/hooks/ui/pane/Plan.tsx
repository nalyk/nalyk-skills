// Tab 2, Plan: one row per task (status, steps bar, fix pips, commits,
// duration), an inline detail card, and the Gantt strip below.

import { taskLabel } from '../../taskid'
import type { RenderElement, RenderNode } from 'claude-code'
import type { TaskRow } from '../../../types'
import { Empty, ParseError, Section, type PaneCtx } from './kit'
import { clip, eighthBar, padStart, pips } from '../cells'
import { GLYPH, tintOf } from '../theme'
import { encodeCells, ganttGrid } from '../raster'
import { fmtDuration } from '../../core'

export const statusGlyph = (t: TaskRow): string =>
  t.status === 'done' ? GLYPH.done : t.status === 'parked' ? GLYPH.warn : t.status === 'blocked' ? GLYPH.failed : t.status === 'pending' ? GLYPH.pending : GLYPH.running

export const Plan = (c: PaneCtx): RenderElement => {
  const { Box, Text, Markdown } = c.els
  const { run, agents } = c.w
  if (!run.planPath && run.tasks.length === 0) {
    return Empty(c, ['  ┌─────┐', '  │ ○ ○ │', '  └─────┘'], 'No plan yet. Brainstorming writes a spec, then writing-plans turns it into tasks.')
  }
  const hue = c.t.stage.execute
  // Columns give way as the pane narrows: commits first, then duration.
  const showCommits = c.cols >= 96
  const showTime = c.cols >= 64
  const nameW = Math.max(10, Math.min(44, c.cols - 2 - 4 - 12 - 9 - (showCommits ? 18 : 0) - (showTime ? 8 : 0) - 6))
  const sel = Math.min(c.w.ui.selection, Math.max(0, run.tasks.length - 1))
  const header = run.planTitle ?? run.planPath ?? 'plan'
  return (
    <Box flexDirection="column">
      {run.planParseError ? ParseError(c, run.planPath ?? 'plan', run.planParseError) : null}
      {Section(c, 'Tasks', clip(header, Math.max(10, c.cols - 16)))}
      {run.planGoal ? <Text color={c.t.muted} italic wrap="truncate-end">{run.planGoal}</Text> : null}
      {run.tasks.map((t, i) => {
        const isSel = i === sel
        const [full, part, empty] = eighthBar(t.steps ? t.stepsDone / t.steps : t.status === 'done' ? 1 : 0, 12)
        const tint = isSel ? tintOf(c.t, hue) : undefined
        const glyphColor = t.status === 'done' ? c.t.ok : t.status === 'parked' ? c.t.warn : t.status === 'blocked' ? c.t.critical : t.status === 'pending' ? c.t.muted : hue
        const took = t.startedAt ? fmtDuration((t.doneAt ?? c.now) - t.startedAt) : ''
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1} flexWrap="nowrap" {...(tint ? { backgroundColor: tint } : {})}>
              <Text color={glyphColor} inverse={isSel && c.t.ansi}>{statusGlyph(t)}</Text>
              <Text color={c.t.muted}>{padStart(`#${taskLabel(t.n)}`, 3)}</Text>
              <Box width={nameW} flexShrink={0}><Text wrap="truncate-end" bold={t.status === 'running' || t.status === 'fixing'}>{t.name}</Text></Box>
              <Text color={hue}>{full + part}<Text color={c.t.muted}>{empty.replace(/ /g, '·')}</Text></Text>
              <Text color={t.breaker ? c.t.critical : t.fixRound >= 4 ? c.t.warn : c.t.muted}>{(t.breaker ? '✗ breaker' : t.fixRound ? pips(t.fixRound) : '').padEnd(9)}</Text>
              {showCommits ? <Text color={c.t.muted} dimColor>{(t.commits ?? '').padEnd(17)}</Text> : null}
              {showTime ? <Text>{padStart(took, 7)}</Text> : null}
            </Box>
            {isSel && c.w.ui.expanded === i ? (
              <Box borderStyle="round" borderColor={hue} paddingX={1} marginLeft={4} flexDirection="column">
                <Text bold color={hue}>{`Task ${taskLabel(t.n)}: ${t.name}`}</Text>
                <Text color={c.t.muted}>{`brief  ${t.brief ?? '—'}`}</Text>
                <Text color={c.t.muted}>{`report ${t.report ?? '—'}`}</Text>
                <Text>{`verdict ${t.verdict ?? '—'} · ${t.agents} subagent${t.agents === 1 ? '' : 's'}`}</Text>
                {t.ledger.length ? <Markdown text={t.ledger.map(l => `- ${l}`).join('\n').slice(0, 4000)} /> : <Text color={c.t.muted}>No ledger lines for this task yet.</Text>}
              </Box>
            ) : null}
          </Box>
        )
      })}
      {run.tasks.some(t => t.startedAt !== undefined) ? Gantt(c) : null}
    </Box>
  )
}

/** The Gantt strip: build in the execute hue, review in the review hue, fix rounds hatched ▒. */
export const Gantt = (c: PaneCtx): RenderElement => {
  const { Box, Text } = c.els
  const columns = Math.max(20, Math.min(240, c.cols - 2))
  const grid = ganttGrid(c.w.run, c.w.agents, c.t, columns, c.now)
  const Raster = 'Raster' in c.els && !c.t.ansi ? c.els.Raster : undefined
  return (
    <Box flexDirection="column">
      {Section(c, 'Timeline', 'build █  review █  fix ▒  now │')}
      {Raster ? (
        <Raster key="gantt" columns={columns} rows={Math.max(1, grid.length)} cells={encodeCells(grid, columns, Math.max(1, grid.length))} />
      ) : (
        grid.map(row => <Text>{row.map(cell => cell.ch).join('')}</Text>)
      )}
    </Box>
  )
}

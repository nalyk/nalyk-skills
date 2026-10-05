// Tab 5, Tests: each task's chain of result dots, RED→GREEN when the order
// was right, ⚠ impl first when it wasn't; the debugging meter.

import type { RenderElement, RenderNode } from 'claude-code'
import { Empty, Section, type PaneCtx } from './kit'
import { clip, padStart } from '../cells'
import { clock } from './Flow'

export const Tests = (c: PaneCtx): RenderElement => {
  const { Box, Text } = c.els
  const { run, tests, env } = c.w
  const withTdd = run.tasks.filter(t => t.tdd.length)
  if (tests.length === 0 && withTdd.length === 0) {
    return Empty(c, ['   ○ ○ ○', '   ╰─┴─╯', '   RED→GREEN'], 'No test runs yet. TDD shows here as a red dot, then a green one, per task.')
  }
  const fixes = env.debugFixes
  return (
    <Box flexDirection="column">
      {Section(c, 'TDD by task')}
      {withTdd.map(t => {
        const red = t.tdd.findIndex(d => !d.ok)
        const greenAfter = red >= 0 && t.tdd.slice(red).some(d => d.ok)
        return (
          <Box flexDirection="row" gap={1}>
            <Text color={c.t.muted}>{padStart(`#${t.n}`, 3)}</Text>
            <Text>{t.tdd.slice(-16).map(d => <Text color={d.ok ? c.t.ok : c.t.critical}>{d.ok ? '● ' : '✗ '}</Text>)}</Text>
            {greenAfter && !t.implFirst ? <Text color={c.t.ok} bold>RED→GREEN ✓</Text> : null}
            {t.implFirst ? <Text color={c.t.warn}>⚠ impl first</Text> : null}
          </Box>
        )
      })}
      {Section(c, 'Debugging', run.debuggingActive ? 'systematic-debugging active' : 'idle')}
      <Text>
        <Text color={c.t.muted}>{'failed fixes '}</Text>
        {[0, 1, 2].map(i => <Text color={i < fixes ? (fixes >= 3 ? c.t.warn : c.t.text) : c.t.muted}>{i < fixes ? '●' : '○'}</Text>)}
        {fixes >= 3 ? <Text color={c.t.warn}>{'  question the architecture'}</Text> : null}
      </Text>
      {Section(c, 'Runs', `${tests.length}`)}
      {tests.slice(-30).reverse().map(r => (
        <Box flexDirection="row" justifyContent="space-between">
          <Text wrap="truncate-end">
            <Text color={r.ok ? c.t.ok : c.t.critical}>{r.ok ? '● ' : '✗ '}</Text>
            <Text>{clip(r.command, Math.max(10, c.cols - 30))}</Text>
            {r.passed !== undefined || r.failed !== undefined ? <Text color={c.t.muted}>{` · ${r.passed ?? 0} passed, ${r.failed ?? 0} failed`}</Text> : null}
            {r.task !== undefined ? <Text color={c.t.muted}>{` · Task ${r.task}`}</Text> : null}
          </Text>
          <Text color={c.t.muted}>{clock(r.at)}</Text>
        </Box>
      ))}
    </Box>
  )
}

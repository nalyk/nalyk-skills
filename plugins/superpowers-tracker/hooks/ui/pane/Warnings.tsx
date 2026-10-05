// Tab 7, Warnings: cards by severity, each with a severity rail, the
// evidence, and ack / open evidence.

import type { RenderElement, RenderNode } from 'claude-code'
import { Empty, Section, type PaneCtx } from './kit'
import { SEV_COLOR } from '../theme'
import { SEV_RANK } from '../../warnings'
import { fmtAgo } from '../../core'

export const Warnings = (c: PaneCtx): RenderElement => {
  const { Box, Text, Button } = c.els
  const list = [...c.w.warnings].sort((a, b) => Number(a.acked) - Number(b.acked) || SEV_RANK[b.sev] - SEV_RANK[a.sev] || b.at - a.at)
  if (list.length === 0) {
    return Empty(c, ['    ╭─╮', '    │✓│', '    ╰─╯'], 'No process warnings. Strict mode adds guards; /sp mode strict turns them on.')
  }
  const open = list.filter(w => !w.acked).length
  return (
    <Box flexDirection="column">
      {Section(c, 'Warnings', `${open} open · ${list.length - open} acked`)}
      {open > 1 ? <Button key="ack-all" label="ack all" plain dimColor onPress={() => c.act.ackAll()} /> : null}
      {list.slice(0, 40).map((w, i) => {
        const color = SEV_COLOR(c.t, w.sev)
        const glyph = w.sev === 'critical' ? '✗' : w.sev === 'warn' ? '⚠' : '·'
        return (
          <Box flexDirection="row" marginTop={i ? 1 : 0}>
            <Text color={color} dimColor={w.acked}>{'┃'}</Text>
            <Box flexDirection="column" paddingLeft={1} flexGrow={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text bold={!w.acked} dimColor={w.acked} wrap="truncate-end">
                  <Text color={color}>{`${glyph} `}</Text>
                  {w.text}
                </Text>
                <Text color={c.t.muted}>{`${w.sev} · ${fmtAgo(c.now - w.at)}`}</Text>
              </Box>
              <Text color={c.t.muted} wrap="truncate-middle">{w.evidence}</Text>
              {w.acked ? null : (
                <Box flexDirection="row" gap={1}>
                  <Button key={`ack-${i}`} label="ack" plain onPress={() => c.act.ack(w.id)} />
                  <Button key={`ev-${i}`} label="open evidence" plain dimColor onPress={() => c.act.openEvidence(w.id)} />
                </Box>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

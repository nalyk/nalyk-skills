// Tab 4, Ledger: rulings as cards (what in bold, why, cost if wrong in muted
// italic), parked findings and deferred minors as lists, the pre-flight table.

import type { RenderElement, RenderNode } from 'claude-code'
import { Empty, ParseError, Section, type PaneCtx } from './kit'
import { splitRuling } from '../../parsers'
import { padEnd } from '../cells'

export const Ledger = (c: PaneCtx): RenderElement => {
  const { Box, Text } = c.els
  const l = c.w.ledger
  if (!l.path) {
    return Empty(c, ['  ┌──────┐', '  │ ≡≡≡≡ │', '  └──────┘'], 'No ledger yet. SDD and executing-plans write progress.md when a plan starts.')
  }
  const rulings = l.entries.filter(e => e.kind === 'ruling' || e.kind === 'task-ruling' || e.kind === 'final-ruling')
  const parked = l.entries.filter(e => e.kind === 'parked')
  const minors = l.entries.filter(e => e.kind === 'minor' || e.kind === 'final-minor')
  const fixed = l.entries.filter(e => e.kind === 'final-fixed')
  const table = l.entries.filter(e => e.kind === 'table').map(e => e.text.split('|').slice(1, -1).map(s => s.trim()))
  const widths = table.reduce<number[]>((w, row) => row.map((cell, i) => Math.max(w[i] ?? 0, Math.min(28, cell.length))), [])
  const preflight = l.entries.find(e => e.kind === 'preflight')
  return (
    <Box flexDirection="column">
      {l.parseError ? ParseError(c, l.path, l.parseError) : null}
      {Section(c, 'Rulings', `${rulings.length + parked.length}`)}
      {rulings.length === 0 ? <Text color={c.t.muted}>No rulings recorded.</Text> : null}
      {rulings.map(e => {
        const r = splitRuling(e.text)
        return (
          <Box flexDirection="row" marginBottom={1}>
            <Text color={c.t.warn}>{'▎'}</Text>
            <Box flexDirection="column" paddingLeft={1}>
              <Text bold wrap="wrap">{`${e.task !== undefined ? `Task ${e.task} · ` : e.kind === 'final-ruling' ? 'Final · ' : ''}${r.what}`}</Text>
              {r.why ? <Text wrap="wrap">{r.why}</Text> : null}
              {r.cost ? <Text color={c.t.muted} italic wrap="wrap">{`cost if wrong: ${r.cost}`}</Text> : null}
            </Box>
          </Box>
        )
      })}
      {parked.length ? Section(c, 'Parked', `${parked.length}`) : null}
      {parked.map(e => (
        <Text wrap="truncate-end"><Text color={c.t.warn}>{'⚠ '}</Text>{`Task ${e.task} · ${e.text}`}</Text>
      ))}
      {Section(c, 'Deferred minors', `${minors.length}`)}
      {minors.length === 0 ? <Text color={c.t.muted}>None deferred.</Text> : null}
      {minors.map(e => (
        <Text wrap="truncate-end" color={c.t.muted}>{`· ${e.task !== undefined ? `Task ${e.task}` : 'Final'}: ${e.text}`}</Text>
      ))}
      {fixed.length ? Section(c, 'Final fixes', `${fixed.length}`) : null}
      {fixed.map(e => (
        <Text wrap="truncate-end"><Text color={c.t.ok}>{'✓ '}</Text>{e.text}</Text>
      ))}
      {Section(c, 'Pre-flight')}
      {preflight ? <Text>{preflight.text}</Text> : null}
      {table.filter(row => !row.every(cell => /^:?-+:?$/.test(cell))).map((row, i) => (
        <Text color={i === 0 ? c.t.muted : c.t.text}>{row.map((cell, k) => padEnd(cell.slice(0, 28), widths[k] ?? 0)).join('  ')}</Text>
      ))}
      {!preflight && table.length === 0 ? <Text color={c.t.muted}>No pre-flight scan in the ledger.</Text> : null}
      {l.unknown.length ? <Text color={c.t.muted} dimColor>{`${l.unknown.length} line(s) in other formats kept as written`}</Text> : null}
    </Box>
  )
}

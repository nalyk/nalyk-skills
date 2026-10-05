// The band for surfaces without a Client (VS Code, mobile): the same view
// model drawn statically with Box and Text, Buttons for the resume actions.

import type { RenderElement, RenderNode } from 'claude-code'
import type { Els } from '../pane/kit'
import type { BandVM } from '../viewModel'
import { eighthBar } from '../cells'

export type BandActions = { resume: () => void; open: (tab?: number) => void; dismiss: () => void; ack: (id: string) => void }

export const BandText = (els: Els, vm: BandVM, act: BandActions): RenderElement => {
  const { Box, Text, Button } = els
  const c = vm.c
  const prog = vm.progress
  const bar = prog ? eighthBar(prog.fraction, 10) : undefined
  if (vm.kind === 'armed') return <Text color={c.muted}>{`ϟ superpowers ${vm.version} · ready`}</Text>
  if (vm.kind === 'shipped') return <Text color={vm.rail[5]?.hue ?? c.ok} bold>{`✓ shipped · ${vm.shipped ?? ''}`}</Text>
  if (vm.kind === 'resume' && vm.resume) {
    const r = vm.resume
    return (
      <Box flexDirection="row" justifyContent="space-between">
        <Text wrap="truncate-end">
          <Text color={r.hue} bold>{`ϟ ${r.label} · `}</Text>
          <Text bold>{r.title}</Text>
          {bar ? <Text color={c.muted}>{` ▕${bar[0]}${bar[1]}${bar[2]}▏ ${r.done}/${r.total}`}</Text> : null}
          <Text color={c.muted}>{` · ${r.ago}${r.more > 0 ? ` · +${r.more}` : ''}`}</Text>
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button key="resume" label="resume" onPress={() => act.resume()} />
          <Button key="open" label="open" onPress={() => act.open()} />
          <Button key="dismiss" label="dismiss" onPress={() => act.dismiss()} />
        </Box>
      </Box>
    )
  }
  const cur = vm.rail.find(s => s.state === 'current')
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text color={c.brand[0] ?? c.text} bold>{'ϟ superpowers  '}</Text>
        {vm.rail.map(s => (
          <Text color={s.state === 'future' ? c.muted : s.hue} bold={s.state === 'current'}>
            {`${s.state === 'done' ? '●' : s.state === 'current' ? '◆' : '○'} ${s.state === 'current' ? s.label : s.initial}  `}
          </Text>
        ))}
        {bar && prog ? <Text color={cur?.hue ?? c.text}>{`▕${bar[0]}${bar[1]}${bar[2]}▏ ${prog.done}/${prog.total}`}</Text> : null}
        {vm.pills.warnings ? <Text color={vm.pills.warnColor}>{`  ⚠ ${vm.pills.warnings}`}</Text> : null}
        {vm.mode === 'strict' ? <Text color={c.critical} inverse>{' STRICT '}</Text> : null}
      </Text>
      {vm.critical ? (
        <Box flexDirection="row" gap={1}>
          <Text color={c.critical} bold>{`✗ ${vm.critical.text}`}</Text>
          <Button key="ack" label="ack" onPress={() => act.ack(vm.critical?.id ?? '')} />
        </Box>
      ) : vm.agents[0] ? (
        <Text color={c.muted}>{`◐ ${vm.agents[0].role} ${vm.agents[0].glyph} ${vm.agents[0].model}${vm.agents[0].task !== undefined ? ` · Task ${vm.agents[0].task}` : ''}`}</Text>
      ) : (
        <Text color={c.muted}>{`ϟ ${vm.idle}`}</Text>
      )}
    </Box>
  )
}

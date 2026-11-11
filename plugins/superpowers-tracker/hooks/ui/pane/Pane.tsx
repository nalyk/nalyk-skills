// The pane's chrome: the header with its breadcrumb and mode badge, the
// segmented tab control, the footer. The engine frames the pane itself, so
// no border is drawn here. A hotkey presses its Button only while the pane
// holds the keyboard, so the keys are shown only then; without it the
// footer says how to get it.

import type { RenderElement, RenderNode } from 'claude-code'
import { Skeleton, type PaneCtx } from './kit'
import { Flow } from './Flow'
import { Plan } from './Plan'
import { Agents } from './Agents'
import { Ledger } from './Ledger'
import { Tests } from './Tests'
import { Workspace } from './Workspace'
import { Warnings } from './Warnings'
import { breadcrumb } from '../viewModel'
import { tintOf } from '../theme'
import { BUILT_AGAINST } from '../../patterns'
import { clip } from '../cells'

export const TABS = ['Flow', 'Plan', 'Agents', 'Ledger', 'Tests', 'Workspace', 'Warnings'] as const
const BODY = [Flow, Plan, Agents, Ledger, Tests, Workspace, Warnings] as const

export const PaneView = (c: PaneCtx): RenderElement => {
  const { Box, Text, Button } = c.els
  const { run, ui, settings, env } = c.w
  const hue = c.t.stage[run.stage]
  const tab = Math.min(TABS.length, Math.max(1, ui.tab))
  const crumbs = breadcrumb(run)
  const mode = settings.mode
  const badge =
    mode === 'strict' ? <Text color={c.t.critical} inverse bold>{' STRICT '}</Text> : mode === 'assist' ? <Text color={c.t.stage.plan} inverse>{' ASSIST '}</Text> : <Text color={c.t.muted}>{' OBSERVE '}</Text>
  const body = c.loading ? Skeleton(c) : BODY[tab - 1]!(c)
  const openWarnings = c.w.warnings.filter(w => !w.acked).length
  return (
    <Box flexDirection="column" paddingX={1} paddingY={0} width={c.cols + 2}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexGrow={1} flexShrink={1} overflow="hidden">
        <Text wrap="truncate-end">
          <Text color={c.t.brand[0]} bold>{'ϟ '}</Text>
          <Text bold>superpowers</Text>
          <Text color={c.t.muted}>{'  '}</Text>
          {crumbs.map((p, i) => (
            <Text color={i === crumbs.length - 1 ? hue : c.t.muted}>{`${i ? ' › ' : ''}${clip(p, 28)}`}</Text>
          ))}
        </Text>
        </Box>
        <Box flexShrink={0}>
          <Text>
            {badge}
            <Text color={c.t.muted}>{`  ${env.pluginVersion ?? BUILT_AGAINST}  `}</Text>
            {c.focused ? <Text color={hue} bold>{'● keys'}</Text> : <Text color={c.t.muted}>{'○ ctrl+x tab for keys'}</Text>}
          </Text>
        </Box>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
        {TABS.map((name, i) => {
          const active = i + 1 === tab
          const label = name === 'Warnings' && openWarnings ? `${name} ${openWarnings}` : name
          return active ? (
            <Text key={`tab-${i}`} color={hue} inverse bold>{` ${i + 1} ${label} `}</Text>
          ) : (
            <Button key={`tab${i + 1}`} label={label} {...(c.focused ? { hotkey: String(i + 1) } : {})} plain dimColor hover={{ scope: `sp-tab${i + 1}`, color: c.t.text }} onPress={() => c.act.tab(i + 1)} />
          )
        })}
      </Box>
      <Box flexDirection="column">
        {body}
      </Box>
      {c.focused ? (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
          <Button key="prev" label="up" hotkey="k" plain dimColor onPress={() => c.act.select(Math.max(0, ui.selection - 1))} />
          <Button key="next" label="down" hotkey="j" plain dimColor onPress={() => c.act.select(ui.selection + 1)} />
          <Button key="expand" label="expand" hotkey="v" plain dimColor onPress={() => c.act.expand(ui.expanded === ui.selection ? -1 : ui.selection)} />
          <Button key="tabnext" label="next tab" hotkey="n" plain dimColor onPress={() => c.act.tab((tab % TABS.length) + 1)} />
          <Button key="tabprev" label="prev tab" hotkey="p" plain dimColor onPress={() => c.act.tab(((tab + TABS.length - 2) % TABS.length) + 1)} />
          <Button key="export" label="export" hotkey="e" plain dimColor onPress={() => c.act.exportRun()} />
          <Button key="close" label="close" hotkey="q" plain dimColor role="dismiss" onPress={() => c.act.close()} />
        </Box>
      ) : (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
          <Text color={hue} bold>{'ctrl+x tab'}</Text>
          <Text color={c.t.muted}>{`gives this pane the keys: 1-7 tabs · j/k move · v expand · e export · q close${c.fullscreen ? ' · or click' : ''}`}</Text>
          <Text color={c.t.muted}>{`· /sp ${tab === TABS.length ? 1 : tab + 1} opens the next tab from the prompt`}</Text>
        </Box>
      )}
    </Box>
  )
}

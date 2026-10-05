// /sp theme: the token swatches with their contrast ratios, and buttons that
// switch the preview between dark, light, daltonized and ANSI.

import type { RenderElement, RenderNode } from 'claude-code'
import type { ThemeChoice } from '../../types'
import type { Els } from './pane/kit'
import { THEMES, type ThemeName, type Tokens, brandRamp } from './theme'
import { contrast } from './oklch'
import { padEnd } from './cells'

const TEXT_TOKENS = (t: Tokens): [string, string][] => [
  ...Object.entries(t.stage).map(([k, v]) => [`stage.${k}`, v] as [string, string]),
  ['ok', t.ok],
  ['warn', t.warn],
  ['critical', t.critical],
]

/** Every text token's contrast against its canvas, for the tests and the swatches. */
export const contrastReport = (name: ThemeName): { token: string; color: string; ratio: number }[] => {
  const t = THEMES[name]
  if (t.ansi) return []
  return TEXT_TOKENS(t).map(([token, color]) => ({ token, color, ratio: contrast(color, t.canvas) }))
}

export const ThemePreview = (els: Els, current: Tokens, onPick: (c: ThemeChoice) => void): RenderElement => {
  const { Box, Text, Button } = els
  const names: ThemeName[] = ['dark', 'light', 'dark-daltonized', 'light-daltonized', 'ansi']
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={current.stage.plan} paddingX={2}>
      <Text>
        <Text color={current.brand[0]} bold>{'ϟ '}</Text>
        <Text bold>Arc tokens</Text>
        <Text color={current.muted}>{`  showing ${current.name}`}</Text>
      </Text>
      {names.map(name => {
        const t = THEMES[name]
        const rows = contrastReport(name)
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={current.muted}>{name.toUpperCase().split('').join(' ')}</Text>
            {t.ansi ? (
              <Text>{TEXT_TOKENS(t).map(([k, v]) => <Text color={v}>{`██ ${k}  `}</Text>)}</Text>
            ) : (
              rows.map(r => (
                <Text>
                  <Text color={r.color}>{'██ '}</Text>
                  <Text>{padEnd(r.token, 18)}</Text>
                  <Text color={current.muted}>{padEnd(r.color, 9)}</Text>
                  <Text color={r.ratio >= 4.5 ? current.ok : current.critical}>{`${r.ratio.toFixed(2)}:1 ${r.ratio >= 4.5 ? '✓' : '✗'}`}</Text>
                </Text>
              ))
            )}
            {t.ansi ? null : <Text>{brandRamp(t, 24).map(c => <Text color={c}>{'█'}</Text>)}<Text color={current.muted}>{'  brand gradient (OKLCH)'}</Text></Text>}
          </Box>
        )
      })}
      <Box flexDirection="row" gap={2} marginTop={1}>
        <Button key="th-dark" label="dark" hotkey="d" plain onPress={() => onPick('dark')} />
        <Button key="th-light" label="light" hotkey="l" plain onPress={() => onPick('light')} />
        <Button key="th-dalt" label="daltonized" hotkey="z" plain onPress={() => onPick('daltonized')} />
        <Button key="th-ansi" label="ansi" hotkey="a" plain onPress={() => onPick('ansi')} />
        <Button key="th-auto" label="auto" hotkey="u" plain dimColor onPress={() => onPick('auto')} />
      </Box>
    </Box>
  )
}

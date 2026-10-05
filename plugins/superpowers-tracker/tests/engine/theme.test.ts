import { describe, test, expect } from 'claude-code/testing'
import { contrast, gradient, hexToRgb, mixOklch, oklchToRgb, rgbToHex, rgbToOklch } from '../../hooks/ui/oklch'
import { GLYPH, THEMES, pickTheme, brandRamp, arcRamp } from '../../hooks/ui/theme'
import { contrastReport } from '../../hooks/ui/themePreview'
import { wideChars, eighthBar, sparkline } from '../../hooks/ui/cells'
import { decodeCodePoints, encodeCells, sparkFrame } from '../../hooks/ui/raster'

describe('OKLCH', () => {
  test('round-trips sRGB within one step', () => {
    for (const hex of ['#B48CFF', '#3DDBB5', '#FFC857', '#0B0B10', '#FFFFFF', '#000000']) {
      const back = rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex))))
      const [a, b] = [hexToRgb(hex), hexToRgb(back)]
      for (let i = 0; i < 3; i += 1) expect(Math.abs(a[i]! - b[i]!)).toBeLessThanOrEqual(1)
    }
  })
  test('blends in OKLCH: the violet→cyan midpoint stays saturated, unlike RGB', () => {
    const mid = rgbToOklch(hexToRgb(mixOklch('#7C5CFF', '#00D4FF', 0.5)))
    const rgbMid = rgbToOklch(hexToRgb('#3E98FF'))
    expect(mid[1]).toBeGreaterThan(0.12)
    expect(mid[1]).toBeGreaterThanOrEqual(rgbMid[1] - 0.02)
    expect(gradient('#7C5CFF', '#00D4FF', 5)).toHaveLength(5)
    expect(gradient('#7C5CFF', '#00D4FF', 5)[0]).toBe('#7C5CFF')
  })
})

describe('tokens', () => {
  test('every text token reaches 4.5:1 on its canvas, in every truecolor theme', () => {
    for (const name of ['dark', 'light', 'dark-daltonized', 'light-daltonized'] as const) {
      for (const row of contrastReport(name)) expect(row.ratio, `${name} ${row.token} ${row.color}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  test('the brand gradient ends reach 4.5:1 too', () => {
    expect(contrast(THEMES.dark.brand[0], THEMES.dark.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(THEMES.light.brand[1], THEMES.light.canvas)).toBeGreaterThanOrEqual(4.5)
  })
  test('NO_COLOR and ANSI themes fall back to named colors', () => {
    expect(pickTheme('auto', 'dark', true).ansi).toBe(true)
    expect(pickTheme('auto', 'dark-ansi', false).ansi).toBe(true)
    expect(pickTheme('auto', 'light-daltonized', false).name).toBe('light-daltonized')
    expect(pickTheme('auto', 'light', false).name).toBe('light')
    expect(THEMES.ansi.stage.review).toBe('greenBright')
    expect(brandRamp(THEMES.ansi, 3)).toEqual(['magenta', 'magenta', 'magenta'])
  })
  test('daltonized themes shift review and critical', () => {
    expect(THEMES['dark-daltonized'].stage.review).toBe('#38BDF8')
    expect(THEMES['dark-daltonized'].critical).toBe('#FB923C')
  })
})

describe('glyphs and cells', () => {
  test('every glyph is single width; ⚡ and emoji are caught', () => {
    const all = JSON.stringify(GLYPH)
    expect(wideChars(all)).toEqual([])
    expect(wideChars('ϟ ok ⚡')).toEqual(['⚡'])
  })
  test('eighth-block bars have sub-cell precision', () => {
    const [full, part, empty] = eighthBar(6.25 / 10, 10)
    expect(full).toBe('██████')
    expect(part).toBe('▎')
    expect(eighthBar(5.6 / 9, 9)[1]).toBe('▋')
    expect((full + part + empty).length).toBe(10)
    expect(sparkline([0, 50, 100], 3)).toBe('▁▅█')
  })
  test('raster cells hold only width-1 BMP code points', () => {
    const grid = sparkFrame(30, 2, 3, 18, arcRamp(THEMES.dark, 12))
    const cells = encodeCells([...grid, [{ ch: '⚡' }, { ch: '😀' }]], 30, 3)
    for (const cp of decodeCodePoints(cells)) {
      expect(cp).toBeLessThanOrEqual(0xffff)
      expect(wideChars(String.fromCodePoint(cp))).toEqual([])
    }
  })
})

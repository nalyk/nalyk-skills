// The band above the prompt: a Client surface module with its own frame
// clock. It draws the BandVM it is handed (plain data); motion lives here,
// so no $.state write happens per frame. Self-contained: types only.

import type { ClientModule, ClientSurface, JsonValue, RenderChildren } from 'claude-code'

type Stop = { id: string; label: string; initial: string; hue: string; state: 'done' | 'current' | 'future'; inferred: boolean }
type Chip = { role: string; glyph: string; model: string; task?: number; title: string; startedAt: number }
type VM = {
  kind: 'armed' | 'resume' | 'live' | 'shipped'
  tier: 'xs' | 'sm' | 'md' | 'lg'
  columns: number
  motion: boolean
  working: boolean
  now: number
  pulseAt: number
  version: string
  mode: 'observe' | 'assist' | 'strict'
  c: { muted: string; text: string; ok: string; warn: string; critical: string; hue: string; tint: string | null; brand: string[]; ansi: boolean }
  rail: Stop[]
  path: string | null
  pathInferred: boolean
  progress: { done: number; total: number; fraction: number } | null
  title: string | null
  pills: { rulings: number; agents: number; warnings: number; warnColor: string }
  agents: Chip[]
  fix: { round: number; breaker: boolean; task: number } | null
  tdd: { dots: boolean[]; green: boolean } | null
  spark: string
  idle: string
  critical: { id: string; text: string; evidence: string } | null
  resume: { title: string; kind: string; label: string; done: number; total: number; current: number | null; fixRound: number | null; ago: string; rulings: number; more: number; hue: string } | null
  shipped: string | null
}
type Local = { tick: number }
type Surface = ClientSurface<Local>

const FRAME_MS = 83 // ≤ 12 fps
const SHIMMER_MS = 1600
const PULSE_MS = 2 * FRAME_MS
const EASE_MS = 400
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

// Per-instance bookkeeping that must not trigger a redraw: the running
// timer and the progress bar's ease. Keyed by the instance's surface.
const timers = new WeakMap<object, { stop: () => void; ms: number }>()
const eases = new WeakMap<object, { target: number; from: number; start: number }>()
// The band's clock: the session's time as of the last redraw, plus the real
// time since. Mixing the two directly would break under a resumed or mocked clock.
const anchors = new WeakMap<object, { vmNow: number; realAt: number }>()

const dur = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

const clip = (s: string, n: number): string => (n <= 0 ? '' : [...s].length <= n ? s : [...s].slice(0, Math.max(0, n - 1)).join('') + '…')

const bar = (fraction: number, width: number): [string, string, string] => {
  const e = Math.round(Math.min(1, Math.max(0, fraction)) * width * 8)
  const full = Math.floor(e / 8)
  const part = full < width && e % 8 ? EIGHTHS[e % 8] ?? '' : ''
  return ['█'.repeat(full), part, ' '.repeat(Math.max(0, width - full - (part ? 1 : 0)))]
}

const easeOut = (x: number): number => 1 - (1 - x) ** 3

const Band: ClientModule<JsonValue, Local> = (props, surface) => {
  const vm = props as unknown as VM
  const { Box, Text, Button } = surface.elements
  const anchor = anchors.get(surface)
  if (!anchor || anchor.vmNow !== vm.now) anchors.set(surface, { vmNow: vm.now, realAt: Date.now() })
  const a0 = anchors.get(surface)!
  const now = vm.now + Math.max(0, Date.now() - a0.realAt)
  const width = Math.max(20, surface.columns || vm.columns)
  const tick = surface.state?.tick ?? 0

  // Progress ease-out toward the new fraction.
  const target = vm.progress?.fraction ?? 0
  const ease = eases.get(surface)
  let shown = target
  if (vm.motion) {
    if (!ease) eases.set(surface, { target, from: target, start: 0 })
    else if (ease.target !== target) {
      const was = ease.from + (ease.target - ease.from) * easeOut(Math.min(1, (now - ease.start) / EASE_MS))
      eases.set(surface, { target, from: was, start: now })
    }
    const cur = eases.get(surface)!
    shown = cur.from + (cur.target - cur.from) * easeOut(Math.min(1, (now - cur.start) / EASE_MS))
  }
  const easing = vm.motion && shown !== target
  const pulsing = vm.motion && now - vm.pulseAt < PULSE_MS
  const shimmering = vm.motion && vm.working && vm.kind === 'live'
  const spinning = vm.motion && vm.agents.length > 0

  // The clock runs only while something moves; idle, it stops completely.
  const need = shimmering || spinning || pulsing || easing ? FRAME_MS : 0
  const held = timers.get(surface)
  if ((held?.ms ?? 0) !== need) {
    held?.stop()
    timers.delete(surface)
    if (need > 0) {
      const stop = surface.every(need, () => surface.setState({ tick: (surface.state?.tick ?? 0) + 1 }))
      timers.set(surface, { stop, ms: need })
    }
  }

  const span = (text: string, style: Record<string, string | boolean | null | undefined> = {}, key?: string) => {
    const p: Record<string, string | boolean> = {}
    for (const [k, v] of Object.entries(style)) if (v !== null && v !== undefined && v !== false) p[k] = v
    if (key) p.key = key
    return <Text {...p}>{text}</Text>
  }
  const c = vm.c

  // The brand capsule: ▐ϟ superpowers▌, gradient letters on a tint, half-block caps.
  const capsule = (word = ' superpowers') => {
    const letters = [...`ϟ${word}`]
    return [
      span('▐', { color: c.tint ?? c.muted }),
      ...letters.map((ch, i) => span(ch, { color: c.brand[Math.min(c.brand.length - 1, Math.round((i / Math.max(1, letters.length - 1)) * (c.brand.length - 1)))] ?? c.text, backgroundColor: c.tint, bold: true })),
      span('▌ ', { color: c.tint ?? c.muted }),
    ]
  }
  const modeBadge = () =>
    vm.mode === 'strict'
      ? span(' STRICT ', { color: c.critical, inverse: true, bold: true })
      : vm.mode === 'assist' && vm.tier !== 'xs'
        ? span(' ASSIST ', { color: vm.rail[2]?.hue ?? c.text, inverse: true })
        : null

  const pills = () => {
    const out: RenderChildren[] = []
    if (vm.pills.rulings) out.push(span(` ⚖ ${vm.pills.rulings} `, { color: c.warn, backgroundColor: c.tint }), span(' '))
    if (vm.pills.agents) out.push(span(` ⌁ ${vm.pills.agents} `, { color: c.hue, backgroundColor: c.tint }), span(' '))
    if (vm.pills.warnings) out.push(span(` ⚠ ${vm.pills.warnings} `, { color: vm.pills.warnColor, backgroundColor: c.tint, bold: true }))
    return out
  }

  const progressBar = (w: number) => {
    if (!vm.progress) return []
    const [full, part, empty] = bar(shown, w)
    return [
      span('▕', { color: c.muted }),
      span(full + part, { color: vm.rail[3]?.hue ?? c.hue }),
      span(empty, { color: c.muted }),
      span('▏ ', { color: c.muted }),
      span(`${vm.progress.done}/${vm.progress.total}`, { bold: true }),
    ]
  }

  // ── Row 1 ──────────────────────────────────────────────────────────────
  const row1 = (): RenderChildren => {
    if (vm.kind === 'armed') {
      return <Text>{capsule()}{span(`${vm.version} · ready`, { color: c.muted })}</Text>
    }
    if (vm.kind === 'shipped') {
      return <Text>{span(' ✓ shipped ', { color: vm.rail[5]?.hue ?? c.ok, inverse: true, bold: true })}{span(` · ${vm.shipped ?? ''}`, { color: vm.rail[5]?.hue ?? c.ok })}</Text>
    }
    if (vm.kind === 'resume' && vm.resume) {
      const r = vm.resume
      const pulse = pulsing
      const tail = [
        r.current !== null ? `Task ${r.current}${r.fixRound ? ` at fix ${r.fixRound}/5` : ''}` : null,
        r.ago,
      ].filter(Boolean).join(' · ')
      const room = width - 40
      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Text wrap="truncate-end">
            {span('▐', { color: c.tint ?? c.muted })}
            {span(`ϟ ${r.label}`, { color: r.hue, backgroundColor: c.tint, bold: true, inverse: pulse })}
            {span('▌ ', { color: c.tint ?? c.muted })}
            {span(clip(r.title, Math.max(8, Math.floor(room / 3))), { bold: true })}
            {r.total ? span(' · ', { color: c.muted }) : null}
            {r.total ? progressBar(vm.tier === 'xs' ? 6 : 10) : []}
            {tail ? span(` · ${tail}`, { color: c.muted }) : null}
            {r.rulings ? span(`  ⚖ ${r.rulings}`, { color: c.warn }) : null}
            {r.more > 0 ? span(` +${r.more} `, { color: c.muted, backgroundColor: c.tint }) : null}
          </Text>
          </Box>
          <Box flexDirection="row" gap={1} flexShrink={0} marginLeft={1}>
            <Button key="resume" label="resume" hotkey="r" plain onPress={() => surface.post({ action: 'resume' })} />
            <Button key="open" label="open" hotkey="o" plain dimColor onPress={() => surface.post({ action: 'open' })} />
            <Button key="dismiss" label="dismiss" hotkey="x" plain dimColor onPress={() => surface.post({ action: 'dismiss' })} />
          </Box>
        </Box>
      )
    }

    // Live: brand, path, the arc rail, pills.
    if (vm.tier === 'xs') {
      return (
        <Text wrap="truncate-end">
          {span('ϟ ', { color: c.brand[0] ?? c.text, bold: true })}
          {span(vm.progress ? vm.rail.find(s => s.state === 'current')?.initial ?? '' : vm.rail.find(s => s.state === 'current')?.label ?? '', { color: c.hue, bold: true })}
          {span(' ')}
          {progressBar(6)}
          {vm.pills.warnings ? span(` ⚠${vm.pills.warnings}`, { color: vm.pills.warnColor }) : null}
          {vm.mode === 'strict' ? span(' S', { color: c.critical, inverse: true }) : null}
        </Text>
      )
    }
    const pillCells = (vm.pills.rulings ? 6 : 0) + (vm.pills.agents ? 6 : 0) + (vm.pills.warnings ? 6 : 0) + (vm.mode !== 'observe' ? 9 : 0)
    const head = 15 + (vm.path ? vm.path.length + 3 : 0)
    const progCells = vm.progress ? 18 : 0
    const titleCells = vm.tier === 'lg' && vm.title ? Math.min(32, Math.floor(width / 6)) : 0
    const railRoom = Math.max(18, width - head - pillCells - progCells - titleCells - 4)
    const labelOf = (s: Stop) => (vm.tier === 'sm' && s.state !== 'current' ? s.initial : s.label)
    const labels = vm.rail.reduce((n, s) => n + [...labelOf(s)].length + 3, 0)
    const seg = Math.max(1, Math.floor((railRoom - labels) / vm.rail.length))
    const shimmerAt = Math.floor(((now % SHIMMER_MS) / SHIMMER_MS) * seg)
    const rail: RenderChildren[] = []
    vm.rail.forEach((s, i) => {
      const node = s.state === 'done' ? '●' : s.state === 'current' ? '◆' : '○'
      const isCurrent = s.state === 'current'
      rail.push(span(node, { color: s.state === 'future' ? c.muted : s.hue, bold: isCurrent, inverse: isCurrent && pulsing }, `n${i}`))
      rail.push(span(' '))
      rail.push(
        isCurrent
          ? span(` ${labelOf(s)}${s.inferred ? '?' : ''} `, { color: s.hue, inverse: true, bold: true })
          : span(labelOf(s), { color: s.state === 'done' ? s.hue : c.muted, dimColor: s.state === 'future' }),
      )
      rail.push(span(' '))
      if (isCurrent && s.id === 'execute' && vm.progress) {
        rail.push(...progressBar(Math.max(6, seg + 6)), span(' '))
      } else if (isCurrent && shimmering) {
        const cellsOf = [...'━'.repeat(seg)]
        rail.push(...cellsOf.map((ch, k) => span(ch, { color: k === shimmerAt || k === shimmerAt - 1 ? c.text : s.hue, bold: k === shimmerAt })))
      } else {
        rail.push(span((s.state === 'future' ? '╌' : '━').repeat(seg), { color: s.state === 'future' ? c.muted : s.hue, dimColor: s.state === 'future', bold: isCurrent }))
      }
      if (i < vm.rail.length - 1) rail.push(span(' '))
    })
    return (
      <Box flexDirection="row" justifyContent="space-between">
        <Text wrap="truncate-end">
          {capsule()}
          {vm.path ? span(` ${vm.path}${vm.pathInferred ? '?' : ''} `, { color: c.muted, backgroundColor: c.tint, dimColor: true }) : null}
          {vm.path ? span(' ') : null}
          {rail}
          {titleCells ? span(` ${clip(vm.title ?? '', titleCells)}`, { color: c.muted, italic: true }) : null}
        </Text>
        <Text>
          {pills()}
          {modeBadge() ? span(' ') : null}
          {modeBadge()}
        </Text>
      </Box>
    )
  }

  // ── Row 2 ──────────────────────────────────────────────────────────────
  const row2 = (): RenderChildren => {
    if (vm.kind !== 'live' || vm.tier === 'xs') return null
    if (vm.critical) {
      return (
        <Box borderStyle="round" borderColor={c.critical} paddingX={1} flexDirection="row" justifyContent="space-between">
          <Text wrap="truncate-end">
            {span('✗ ', { color: c.critical, bold: true })}
            {span(vm.critical.text, { bold: true })}
            {span(` · ${clip(vm.critical.evidence, Math.max(10, width - vm.critical.text.length - 30))}`, { color: c.muted })}
          </Text>
          <Box flexDirection="row" gap={1} flexShrink={0} marginLeft={1}>
            <Button key="ack" label="ack" hotkey="a" plain onPress={() => surface.post({ action: 'ack', id: vm.critical?.id ?? '' })} />
            <Button key="open-warn" label="open" hotkey="o" plain dimColor onPress={() => surface.post({ action: 'open', tab: 7 })} />
          </Box>
        </Box>
      )
    }
    const right = span(vm.spark, { color: c.muted })
    if (vm.agents.length === 0) {
      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={c.muted} wrap="truncate-end">{`ϟ ${vm.idle}`}</Text>
          <Text>{right}</Text>
        </Box>
      )
    }
    const a = vm.agents[0]!
    const spin = vm.motion ? SPINNER[Math.floor(now / 80) % SPINNER.length] ?? '◐' : '◐'
    const elapsed = dur(now - a.startedAt)
    const fix = vm.fix
    const pipsOf = (round: number) =>
      [0, 1, 2, 3, 4].map(k => span(k < round ? '●' : '○', { color: k < round ? (k >= 3 ? c.warn : c.hue) : c.muted }, `p${k}`))
    const titleRoom = Math.max(6, width - 60 - (fix ? 9 : 0) - (vm.tdd ? 16 : 0))
    return (
      <Box flexDirection="row" justifyContent="space-between">
        <Text wrap="truncate-end">
          {span(`${spin} `, { color: c.hue })}
          {span(a.role, { bold: true })}
          {span(` ${a.glyph} ${a.model}`, { color: c.muted })}
          {a.task !== undefined ? span(` · Task ${a.task}`, { color: c.hue }) : null}
          {span(` · ${clip(a.title, titleRoom)}`, { color: c.muted })}
          {vm.agents.length > 1 ? span(` +${vm.agents.length - 1}`, { color: c.muted }) : null}
          {fix ? span('  ') : null}
          {fix ? (fix.breaker ? span('✗ breaker', { color: c.critical, bold: true }) : pipsOf(fix.round)) : null}
          {span(`  ${elapsed.padStart(6)}`, { color: c.text })}
          {vm.tdd ? span('  ') : null}
          {vm.tdd ? vm.tdd.dots.map((ok, k) => span(k ? ' ●' : '●', { color: ok ? c.ok : c.critical }, `t${k}`)) : null}
          {vm.tdd?.green ? span(' RED→GREEN ✓', { color: c.ok, bold: true }) : null}
        </Text>
        <Text>{right}</Text>
      </Box>
    )
  }

  void tick
  return (
    <Box flexDirection="column">
      {row1()}
      {row2()}
    </Box>
  )
}

export default Band

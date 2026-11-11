// The band above the prompt: a Client surface module with its own frame
// clock. It draws the BandVM it is handed (plain data); motion lives here,
// so no $.state write happens per frame. Self-contained: types only.
//
// It draws and moves, and holds no control: every Button is in the hook's
// own tree beside it (ui/band/actions.ts), where a hotkey is armed and a
// press reaches the plugin. `vm.columns` is the exact width it was given.

import type { ClientModule, ClientSurface, JsonValue, RenderChildren } from 'claude-code'

type Stop = { id: string; label: string; initial: string; hue: string; state: 'done' | 'current' | 'future'; inferred: boolean }
type Chip = { role: string; glyph: string; model: string; task?: string; title: string; startedAt: number }
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
  fix: { round: number; breaker: boolean; task: string } | null
  tdd: { dots: boolean[]; green: boolean } | null
  spark: string
  idle: string
  critical: { id: string; text: string; evidence: string; at: number } | null
  shownAt: number
  resume: { title: string; kind: string; label: string; done: number; total: number; current: string | null; fixRound: number | null; ago: string; rulings: number; more: number; hue: string } | null
  shipped: string | null
}
type Local = { tick: number }
type Surface = ClientSurface<Local>

const FRAME_MS = 83 // ≤ 12 fps
const SHIMMER_MS = 1600
const PULSE_MS = 2 * FRAME_MS
const EASE_MS = 400
// Motion that says something happened, each for a moment and then still:
const COMET_MS = 720 // a stage landed: light runs down the connector into its node
const BREATH_MS = 2400 // a plan to resume appeared: the capsule breathes three times
const ALERT_MS = 1800 // a critical warning appeared: its frame flashes three times
const SWEEP_MS = 1500 // shipped: a highlight crosses the line once
const HEART_MS = 2000 // a turn is running: the brand glyph breathes

// Colour maths for truecolor themes only (`c.ansi` themes use named colours
// and get the inverse-video forms instead). sRGB lerp: the spans are a few
// cells of one hue family, where it reads the same as a perceptual blend.
const rgb = (hex: string): [number, number, number] | undefined => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : undefined
}
const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a)
  const y = rgb(b)
  if (!x || !y) return t < 0.5 ? a : b
  const k = Math.min(1, Math.max(0, t))
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * k).toString(16).padStart(2, '0')).join('')
}
/** 0→1→0 over one period. */
const wave = (ms: number, period: number): number => (1 - Math.cos((2 * Math.PI * (ms % period)) / period)) / 2
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
  const { Box, Text } = surface.elements
  const anchor = anchors.get(surface)
  if (!anchor || anchor.vmNow !== vm.now) anchors.set(surface, { vmNow: vm.now, realAt: Date.now() })
  const a0 = anchors.get(surface)!
  const now = vm.now + Math.max(0, Date.now() - a0.realAt)
  const width = Math.max(10, vm.columns)
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
  const rich = vm.motion && !vm.c.ansi
  const since = now - vm.pulseAt
  const landing = rich && vm.kind === 'live' && since >= 0 && since < COMET_MS
  const breathing = rich && vm.kind === 'resume' && now - vm.shownAt < BREATH_MS
  const alerting = vm.motion && vm.kind === 'live' && vm.critical !== null && now - vm.critical.at < ALERT_MS
  const sweeping = rich && vm.kind === 'shipped' && now - vm.shownAt < SWEEP_MS
  const heart = rich && vm.working && vm.kind === 'live'

  // The clock runs only while something moves; idle, it stops completely.
  const need = shimmering || spinning || pulsing || easing || landing || breathing || alerting || sweeping ? FRAME_MS : 0
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
    const beat = heart ? wave(now, HEART_MS) : 0
    const tone = (i: number): string => {
      const base = c.brand[Math.min(c.brand.length - 1, Math.round((i / Math.max(1, letters.length - 1)) * (c.brand.length - 1)))] ?? c.text
      return i === 0 && heart ? mix(base, c.text, beat * 0.7) : base
    }
    return [
      span('▐', { color: c.tint ?? c.muted }),
      ...letters.map((ch, i) => span(ch, { color: tone(i), backgroundColor: c.tint, bold: true })),
      span('▌ ', { color: c.tint ?? c.muted }),
    ]
  }
  const modeBadge = () =>
    vm.mode === 'strict'
      ? span(' STRICT ', { color: c.critical, inverse: true, bold: true })
      : vm.mode === 'assist' && vm.tier !== 'xs'
        ? span(' ASSIST ', { color: vm.rail[2]?.hue ?? c.text, inverse: true })
        : null

  const progressBar = (w: number) => {
    if (!vm.progress) return []
    const [full, part, empty] = bar(shown, w)
    const from = vm.rail[3]?.hue ?? c.hue
    const to = vm.rail[4]?.hue ?? from
    const cells = [...(full + part)]
    // Filled cells run from the execute hue toward the review hue as the plan
    // nears its end; while a turn works, one lit cell crosses them.
    const sheen = rich && shimmering && cells.length > 1 ? Math.floor(((now % SHIMMER_MS) / SHIMMER_MS) * (cells.length + 3)) : -1
    const fill = rich
      ? cells.map((ch, i) => span(ch, { color: i === sheen ? mix(from, c.text, 0.75) : i === sheen - 1 ? mix(from, c.text, 0.35) : mix(from, to, (i / Math.max(1, w - 1)) * 0.6) }, `f${i}`))
      : [span(full + part, { color: from })]
    return [
      span('▕', { color: c.muted }),
      ...fill,
      span(empty, { color: c.muted }),
      span('▏ ', { color: c.muted }),
      span(`${vm.progress.done}/${vm.progress.total}`, { bold: true, ...(easing ? { color: rich ? mix(from, c.text, 0.6) : from, inverse: !rich } : {}) }),
    ]
  }

  // ── Row 1 ──────────────────────────────────────────────────────────────
  const row1 = (): RenderChildren => {
    if (vm.kind === 'armed') {
      return <Text>{capsule()}{span(`${vm.version} · ready`, { color: c.muted })}</Text>
    }
    if (vm.kind === 'shipped') {
      const hueF = vm.rail[5]?.hue ?? c.ok
      const tail = [...` · ${vm.shipped ?? ''}`]
      const at = sweeping ? Math.floor(((now - vm.shownAt) / SWEEP_MS) * (tail.length + 4)) : -9
      return (
        <Text wrap="truncate-end">
          {span(' ✓ shipped ', { color: hueF, inverse: true, bold: true })}
          {sweeping ? tail.map((ch, i) => span(ch, { color: Math.abs(i - at) <= 1 ? mix(hueF, c.text, i === at ? 0.85 : 0.45) : hueF, bold: i === at }, `s${i}`)) : span(tail.join(''), { color: hueF })}
        </Text>
      )
    }
    if (vm.kind === 'resume' && vm.resume) {
      const r = vm.resume
      const pulse = pulsing
      const lit = breathing ? mix(r.hue, c.text, wave(now - vm.shownAt, BREATH_MS / 3) * 0.65) : r.hue
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
            {span(`ϟ ${r.label}`, { color: lit, backgroundColor: c.tint, bold: true, inverse: pulse })}
            {span('▌ ', { color: c.tint ?? c.muted })}
            {span(clip(r.title, Math.max(8, Math.floor(room / 3))), { bold: true })}
            {r.total ? span(' · ', { color: c.muted }) : null}
            {r.total ? progressBar(vm.tier === 'xs' ? 6 : 10) : []}
            {tail ? span(` · ${tail}`, { color: c.muted }) : null}
            {r.rulings ? span(`  ⚖ ${r.rulings}`, { color: c.warn }) : null}
            {r.more > 0 ? span(` +${r.more} `, { color: c.muted, backgroundColor: c.tint }) : null}
          </Text>
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
    const pillCells = vm.mode !== 'observe' ? 9 : 0
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
      const arrived = isCurrent && landing && since > COMET_MS * 0.6
      rail.push(span(node, { color: s.state === 'future' ? c.muted : arrived ? mix(s.hue, c.text, 0.7) : s.hue, bold: isCurrent, inverse: isCurrent && pulsing }, `n${i}`))
      rail.push(span(' '))
      rail.push(
        isCurrent
          ? span(` ${labelOf(s)}${s.inferred ? '?' : ''} `, { color: s.hue, inverse: true, bold: true })
          : span(labelOf(s), { color: s.state === 'done' ? s.hue : c.muted, dimColor: s.state === 'future' }),
      )
      rail.push(span(' '))
      if (isCurrent && s.id === 'execute' && vm.progress) {
        // The bar gives way before a stage is pushed off the row.
        const spare = railRoom - labels - seg * (vm.rail.length - 1) - 8
        rail.push(...progressBar(Math.max(4, Math.min(seg + 6, spare))), span(' '))
      } else if (isCurrent && shimmering) {
        const cellsOf = [...'━'.repeat(seg)]
        rail.push(...cellsOf.map((ch, k) => span(ch, { color: k === shimmerAt || k === shimmerAt - 1 ? c.text : s.hue, bold: k === shimmerAt })))
      } else if (rich && s.state === 'done') {
        // A finished stage's connector runs from its hue into the next one's;
        // when the next stage has just landed, a head of light runs down it.
        const next = vm.rail[i + 1]
        const into = next?.hue ?? s.hue
        const head = landing && next?.state === 'current' ? Math.floor((since / COMET_MS) * (seg + 3)) : -9
        for (let k = 0; k < seg; k += 1) {
          const base = mix(s.hue, into, seg > 1 ? k / (seg - 1) : 1)
          const d = head - k
          rail.push(span('━', { color: d === 0 ? mix(base, c.text, 0.9) : d === 1 ? mix(base, c.text, 0.55) : d === 2 ? mix(base, c.text, 0.25) : base, bold: d === 0 }, `c${i}-${k}`))
        }
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
        <Text>{modeBadge()}</Text>
      </Box>
    )
  }

  // ── Row 2 ──────────────────────────────────────────────────────────────
  const row2 = (): RenderChildren => {
    if (vm.kind !== 'live' || vm.tier === 'xs') return null
    if (vm.critical) {
      return (
        <Box borderStyle="round" borderColor={alerting && Math.floor((now - vm.critical.at) / 300) % 2 === 0 ? c.text : c.critical} paddingX={1} flexDirection="row" justifyContent="space-between">
          <Text wrap="truncate-end">
            {span('✗ ', { color: c.critical, bold: true })}
            {span(vm.critical.text, { bold: true })}
            {span(` · ${clip(vm.critical.evidence, Math.max(10, width - vm.critical.text.length - 30))}`, { color: c.muted })}
          </Text>
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
    <Box flexDirection="column" width={width} overflow="hidden">
      {row1()}
      {row2()}
    </Box>
  )
}

export default Band

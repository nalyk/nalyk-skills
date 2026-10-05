// The desktop's rail and Flow map as interactive SVG: true gradients along
// the arc, a SMIL shimmer on the active segment, <title> on every station.
// Same data as the terminal (BandVM, timeline); `alt` carries it in words.

import type { TimelineRow } from '../../../types'
import type { BandVM } from '../viewModel'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c)
const col = (c: string, fallback: string) => (isHex(c) ? c : fallback)

export const railSvg = (vm: BandVM, width = 760): { source: string; alt: string; height: number } => {
  const h = 64
  const left = 150
  const right = width - 120
  const seg = (right - left) / vm.rail.length
  const muted = '#6B7280'
  const stops = vm.rail.map((s, i) => `<stop offset="${(i / (vm.rail.length - 1)) * 100}%" stop-color="${col(s.hue, muted)}"/>`).join('')
  const nodes = vm.rail
    .map((s, i) => {
      const x = left + i * seg
      const color = s.state === 'future' ? muted : col(s.hue, muted)
      const r = s.state === 'current' ? 7 : 5
      const label = `${s.label}${s.inferred ? '?' : ''}`
      const lineEnd = x + seg - 10
      const line =
        i < vm.rail.length
          ? `<line x1="${x + 8}" y1="30" x2="${lineEnd}" y2="30" stroke="${s.state === 'future' ? muted : 'url(#arc)'}" stroke-width="${s.state === 'current' ? 4 : 3}" stroke-linecap="round" ${s.state === 'future' ? 'stroke-dasharray="4 4" opacity="0.6"' : ''}>${
              s.state === 'current' && vm.working && vm.motion
                ? `<animate attributeName="stroke-opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite"/>`
                : ''
            }</line>`
          : ''
      const prog =
        s.id === 'execute' && vm.progress && s.state !== 'future'
          ? `<rect x="${x + 8}" y="40" width="${seg - 18}" height="4" rx="2" fill="${muted}" opacity="0.3"/><rect x="${x + 8}" y="40" width="${(seg - 18) * vm.progress.fraction}" height="4" rx="2" fill="${color}"/><text x="${x + seg - 10}" y="56" text-anchor="end" font-size="11" fill="${color}">${vm.progress.done}/${vm.progress.total}</text>`
          : ''
      return `<g><title>${esc(`${label}: ${s.state}`)}</title>${line}${prog}<circle cx="${x}" cy="30" r="${r}" fill="${s.state === 'done' || s.state === 'current' ? color : 'none'}" stroke="${color}" stroke-width="2"/><text x="${x}" y="16" text-anchor="middle" font-size="11" font-weight="${s.state === 'current' ? 700 : 400}" fill="${color}">${esc(label)}</text></g>`
    })
    .join('')
  const pill = (x: number, text: string, color: string, tip: string) =>
    `<g><title>${esc(tip)}</title><rect x="${x}" y="20" width="34" height="20" rx="10" fill="${color}" fill-opacity="0.18"/><text x="${x + 17}" y="34" text-anchor="middle" font-size="11" fill="${color}">${esc(text)}</text></g>`
  let px = right + 10
  const pills: string[] = []
  if (vm.pills.rulings) (pills.push(pill(px, `⚖ ${vm.pills.rulings}`, col(vm.c.warn, '#FBBF24'), `${vm.pills.rulings} rulings`)), (px += 38))
  if (vm.pills.agents) (pills.push(pill(px, `⌁ ${vm.pills.agents}`, col(vm.c.hue, muted), `${vm.pills.agents} subagents running`)), (px += 38))
  if (vm.pills.warnings) pills.push(pill(px, `⚠ ${vm.pills.warnings}`, col(vm.pills.warnColor, '#FBBF24'), `${vm.pills.warnings} open warnings`))
  const brand = `<defs><linearGradient id="arc" x1="0" x2="1">${stops}</linearGradient><linearGradient id="brand" x1="0" x2="1"><stop offset="0" stop-color="${col(vm.c.brand[0] ?? '', '#7C5CFF')}"/><stop offset="1" stop-color="${col(vm.c.brand.at(-1) ?? '', '#00D4FF')}"/></linearGradient></defs><g><title>superpowers ${esc(vm.version)} · ${vm.mode}</title><rect x="4" y="18" width="128" height="24" rx="12" fill="url(#brand)" fill-opacity="0.16"/><text x="16" y="35" font-size="13" font-weight="700" fill="url(#brand)">ϟ superpowers</text></g>`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${brand}${nodes}${pills.join('')}</svg>`
  const current = vm.rail.find(s => s.state === 'current')
  const alt = `superpowers ${vm.kind}: stage ${current?.label ?? '?'}${vm.progress ? `, ${vm.progress.done} of ${vm.progress.total} tasks` : ''}${vm.pills.warnings ? `, ${vm.pills.warnings} warnings` : ''}${vm.pills.rulings ? `, ${vm.pills.rulings} rulings` : ''}.`
  return { source, alt, height: h }
}

export const flowSvg = (rows: readonly TimelineRow[], hues: Record<string, string>, width = 520): { source: string; alt: string } => {
  const list = rows.slice(-40)
  const step = 22
  const h = Math.max(40, list.length * step + 20)
  const x0 = 24
  const items = list
    .map((r, i) => {
      const y = 16 + i * step
      const hue = col(hues[r.stage] ?? '', '#7AA2FF')
      const branch = r.kind === 'agent-start' || r.kind === 'agent-end'
      const cx = branch ? x0 + 28 : x0
      const fill = r.kind === 'agent-start' ? 'none' : r.ok === false ? '#F87171' : hue
      const path = branch ? `<path d="M${x0} ${y - (r.kind === 'agent-end' ? 10 : 0)} Q ${x0} ${y} ${cx} ${y}" stroke="${hue}" fill="none" stroke-width="2"/>` : ''
      const t = new Date(r.at)
      const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
      return `<g><title>${esc(`${r.label}${r.detail ? ` · ${r.detail}` : ''} · ${time}`)}</title>${path}<circle cx="${cx}" cy="${y}" r="5" fill="${fill}" stroke="${hue}" stroke-width="2"/><text x="${cx + 12}" y="${y + 4}" font-size="12" fill="${hue}">${esc(r.label.slice(0, 60))}</text><text x="${width - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="#6B7280">${time}</text></g>`
    })
    .join('')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" font-family="ui-monospace, Menlo, monospace"><line x1="${x0}" y1="8" x2="${x0}" y2="${h - 8}" stroke="#7AA2FF" stroke-opacity="0.5" stroke-width="3"/>${items}</svg>`
  return { source, alt: `Flow of ${list.length} superpowers events, latest: ${list.at(-1)?.label ?? 'none'}.` }
}

// /sp and its subcommands: parsed into intents (pure), plus the texts the
// plain-text commands print. register.tsx carries the intents out.

import { taskLabel } from './taskid'
import type { AutoOpen, BandMode, Mode, Settings, ThemeChoice } from '../types'
import type { World } from './ui/viewModel'
import { statusText } from './ui/viewModel'
import { splitRuling, rulingCount } from './parsers'
import { STAGE_LABEL } from './stages'
import { fmtDuration } from './core'
import { DIAGNOSE_PHRASE } from './patterns'
import { DEFAULT_SETTINGS } from './state'

export type Intent =
  | { kind: 'open'; tab?: number }
  | { kind: 'status' }
  | { kind: 'ledger' }
  | { kind: 'export' }
  | { kind: 'ack'; target: string }
  | { kind: 'mode'; mode: Mode }
  | { kind: 'band'; band: BandMode }
  | { kind: 'config'; key?: string; value?: string }
  | { kind: 'reset' }
  | { kind: 'resume'; n: number }
  | { kind: 'dismiss'; n: number; forget: boolean }
  | { kind: 'scan' }
  | { kind: 'demo' }
  | { kind: 'theme' }
  | { kind: 'diagnose' }
  | { kind: 'error'; text: string }

export const HELP = [
  '/sp [1-7]            open the pane (on a tab)',
  '/sp status           stage, tasks, warnings, rulings, minors',
  '/sp ledger           rulings, parked findings, deferred minors',
  '/sp export           Markdown report to .superpowers/tracker/<session>.md',
  '/sp ack [id|all]     acknowledge warnings',
  '/sp mode observe|assist|strict',
  '/sp band auto|always|compact|off',
  '/sp config [key [value]]',
  '/sp reset            clear this session\'s tracker state',
  '/sp resume [n]       fill the prompt with candidate n\'s resume text',
  '/sp dismiss [n] [--forget]',
  '/sp scan · /sp demo · /sp theme · /sp diagnose',
].join('\n')

export const parseSp = (args: string): Intent => {
  const [verb = '', ...rest] = args.trim().split(/\s+/).filter(Boolean)
  const arg = rest[0]
  if (verb === '' ) return { kind: 'open' }
  if (/^[1-7]$/.test(verb)) return { kind: 'open', tab: Number(verb) }
  switch (verb) {
    case 'status':
      return { kind: 'status' }
    case 'ledger':
      return { kind: 'ledger' }
    case 'export':
      return { kind: 'export' }
    case 'ack':
      return { kind: 'ack', target: arg ?? 'all' }
    case 'mode':
      return arg === 'observe' || arg === 'assist' || arg === 'strict' ? { kind: 'mode', mode: arg } : { kind: 'error', text: 'Usage: /sp mode observe|assist|strict' }
    case 'band':
      return arg === 'auto' || arg === 'always' || arg === 'compact' || arg === 'off' ? { kind: 'band', band: arg } : { kind: 'error', text: 'Usage: /sp band auto|always|compact|off' }
    case 'config':
      return { kind: 'config', ...(arg ? { key: arg } : {}), ...(rest.length > 1 ? { value: rest.slice(1).join(' ') } : {}) }
    case 'reset':
      return { kind: 'reset' }
    case 'resume':
      return { kind: 'resume', n: arg && /^\d+$/.test(arg) ? Number(arg) : 1 }
    case 'dismiss': {
      const n = rest.find(r => /^\d+$/.test(r))
      return { kind: 'dismiss', n: n ? Number(n) : 1, forget: rest.includes('--forget') }
    }
    case 'scan':
      return { kind: 'scan' }
    case 'demo':
      return { kind: 'demo' }
    case 'theme':
      return { kind: 'theme' }
    case 'diagnose':
      return { kind: 'diagnose' }
    case 'help':
      return { kind: 'error', text: HELP }
    default:
      return { kind: 'error', text: `Unknown subcommand "${verb}".\n${HELP}` }
  }
}

const KEYS: Record<string, string> = {
  motion: 'on | off',
  theme: 'auto | dark | light | daltonized | ansi',
  toasts: 'on | off',
  testRunners: 'comma-separated regexes',
  testFiles: 'comma-separated regexes',
  specDir: 'path',
  planDir: 'path',
  pollMs: 'milliseconds (≥ 500)',
  windowDays: 'days',
  autoOpenPane: 'never | resumable | live',
  mode: 'observe | assist | strict',
  band: 'auto | always | compact | off',
}

export const configText = (s: Settings): string =>
  Object.keys(KEYS)
    .map(k => {
      const v = (s as Record<string, unknown>)[k]
      const shown = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v)
      return `${k.padEnd(13)} ${shown}${'\n'.padEnd(15)}${KEYS[k]}`
    })
    .join('\n')

/** Applies `/sp config key value`; answers the new settings or why not. */
export const applyConfig = (s: Settings, key: string, value: string): { settings?: Settings; text: string } => {
  const on = (v: string) => (/^(on|true|yes|1)$/i.test(v) ? true : /^(off|false|no|0)$/i.test(v) ? false : undefined)
  const list = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean)
  switch (key) {
    case 'motion':
    case 'toasts': {
      const b = on(value)
      return b === undefined ? { text: `${key} takes on or off` } : { settings: { ...s, [key]: b }, text: `${key} ${b ? 'on' : 'off'}` }
    }
    case 'theme':
      return ['auto', 'dark', 'light', 'daltonized', 'ansi'].includes(value) ? { settings: { ...s, theme: value as ThemeChoice }, text: `theme ${value}` } : { text: `theme takes ${KEYS.theme}` }
    case 'testRunners':
    case 'testFiles': {
      const items = list(value)
      for (const r of items) {
        try {
          new RegExp(r)
        } catch {
          return { text: `not a regex: ${r}` }
        }
      }
      return { settings: { ...s, [key]: items.length ? items : DEFAULT_SETTINGS[key] }, text: `${key}: ${items.length} pattern(s)` }
    }
    case 'specDir':
    case 'planDir':
      return value ? { settings: { ...s, [key]: value.replace(/\/+$/, '') }, text: `${key} ${value}` } : { text: `${key} takes a path` }
    case 'pollMs': {
      const n = Number(value)
      return n >= 500 ? { settings: { ...s, pollMs: Math.round(n) }, text: `pollMs ${Math.round(n)}` } : { text: 'pollMs takes a number ≥ 500' }
    }
    case 'windowDays': {
      const n = Number(value)
      return n > 0 ? { settings: { ...s, windowDays: n }, text: `windowDays ${n}` } : { text: 'windowDays takes a positive number' }
    }
    case 'autoOpenPane':
      return ['never', 'resumable', 'live'].includes(value) ? { settings: { ...s, autoOpenPane: value as AutoOpen }, text: `autoOpenPane ${value}` } : { text: `autoOpenPane takes ${KEYS.autoOpenPane}` }
    case 'mode':
      return ['observe', 'assist', 'strict'].includes(value) ? { settings: { ...s, mode: value as Mode }, text: `mode ${value}` } : { text: `mode takes ${KEYS.mode}` }
    case 'band':
      return ['auto', 'always', 'compact', 'off'].includes(value) ? { settings: { ...s, band: value as BandMode }, text: `band ${value}` } : { text: `band takes ${KEYS.band}` }
    default:
      return { text: `Unknown setting "${key}". Settings:\n${Object.keys(KEYS).join(', ')}` }
  }
}

export const ledgerText = (w: World): string => {
  const e = w.ledger.entries
  if (!w.ledger.path) return 'No ledger found for the plan this session tracks.'
  const rulings = e.filter(x => x.kind === 'ruling' || x.kind === 'task-ruling' || x.kind === 'final-ruling')
  const parked = e.filter(x => x.kind === 'parked')
  const minors = e.filter(x => x.kind === 'minor' || x.kind === 'final-minor')
  const out = [`Ledger: ${w.ledger.path}`, '', 'Rulings I made:']
  if (!rulings.length && !parked.length) out.push('- none')
  for (const r of [...rulings, ...parked]) {
    const s = splitRuling(r.text)
    out.push(`- ${r.task !== undefined ? `Task ${taskLabel(r.task)}: ` : ''}${r.kind === 'parked' ? 'parked — ' : ''}${s.what}${s.why ? ` — ${s.why}` : ''}${s.cost ? ` — cost if wrong: ${s.cost}` : ''}`)
  }
  out.push('', 'Deferred minors:')
  if (!minors.length) out.push('- none')
  for (const m of minors) out.push(`- ${m.task !== undefined ? `Task ${taskLabel(m.task)}` : 'Final'}: ${m.text}`)
  return out.join('\n')
}

/** The whole run as Markdown for /sp export. */
export const exportMarkdown = (w: World, now: number, sessionId: string): string => {
  const { run } = w
  const lines = [
    `# superpowers run: ${run.planTitle ?? 'untitled'}`,
    '',
    `- session: \`${sessionId}\``,
    `- exported: ${new Date(now).toISOString()}`,
    `- stage: ${STAGE_LABEL[run.stage]} · lifecycle ${run.lifecycle}${run.path ? ` · path ${run.path}` : ''}`,
    `- plan: ${run.planPath ?? '—'} · spec: ${run.specPath ?? '—'}`,
    `- executor: ${run.executor ?? '—'} · rulings: ${rulingCount(w.ledger.entries)}`,
    w.env.costUsd !== undefined ? `- cost so far: $${w.env.costUsd.toFixed(2)}` : '',
    '',
    '## Status',
    '',
    '```',
    statusText(w, now),
    '```',
    '',
    '## Tasks',
    '',
    '| # | Task | Status | Fix rounds | Commits | Duration | Subagents |',
    '|---|------|--------|------------|---------|----------|-----------|',
    ...run.tasks.map(t => `| ${taskLabel(t.n)} | ${t.name.replace(/\|/g, '\\|')} | ${t.status} | ${t.fixRound} | ${t.commits ?? ''} | ${t.startedAt ? fmtDuration((t.doneAt ?? now) - t.startedAt) : ''} | ${t.agents} |`),
    '',
    '## Subagents',
    '',
    '| Role | Task | Model | Status | Duration | Verdict |',
    '|------|------|-------|--------|----------|---------|',
    ...w.agents.map(a => `| ${a.role} | ${a.task ?? ''} | ${a.model ?? (a.modelOmitted ? 'inherited' : '')} | ${a.status} | ${fmtDuration((a.endedAt ?? now) - a.startedAt)} | ${(a.verdict ?? '').replace(/\|/g, '\\|')} |`),
    '',
    '## Ledger',
    '',
    ledgerText(w),
    '',
    '## Tests',
    '',
    ...w.tests.map(t => `- ${t.ok ? 'pass' : 'FAIL'} \`${t.command}\`${t.task !== undefined ? ` (Task ${taskLabel(t.task)})` : ''}${t.passed !== undefined ? ` · ${t.passed} passed` : ''}${t.failed ? ` · ${t.failed} failed` : ''}`),
    '',
    '## Warnings',
    '',
    ...(w.warnings.length ? w.warnings.map(x => `- **${x.sev}** ${x.text} — ${x.evidence}${x.acked ? ' (acked)' : ''}`) : ['- none']),
    '',
    '## Timeline',
    '',
    ...w.timeline.map(r => `- ${new Date(r.at).toISOString().slice(11, 19)} · ${r.kind} · ${r.label}${r.detail ? ` · ${r.detail}` : ''}`),
    '',
  ]
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n')
}

export const diagnoseText = (sessionId: string): string =>
  [
    'To run superpowers:diagnosing-superpowers on this session, send:',
    '',
    `  ${DIAGNOSE_PHRASE}`,
    '',
    `session id: ${sessionId}`,
    'It writes its case file under ~/.superpowers/diagnosing-superpowers/<session-id>/.',
  ].join('\n')

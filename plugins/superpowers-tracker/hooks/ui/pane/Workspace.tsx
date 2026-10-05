// Tab 6, Workspace: environment facts in an aligned grid, the context
// gauge, links, and every resume candidate with its actions.

import type { RenderElement, RenderNode } from 'claude-code'
import { KeyValues, Section, type PaneCtx } from './kit'
import { BUILT_AGAINST } from '../../patterns'
import { clip } from '../cells'
import { fmtAgo } from '../../core'
import { visibleCandidates } from '../viewModel'

/** A braille arc, filled to `pct`, the percentage in its center. */
export const gaugeArc = (pct: number): [string, string] => {
  const arc = ['⢀', '⣠', '⣴', '⣾', '⣿', '⣿', '⣿', '⣿', '⣷', '⣦', '⣄', '⡀']
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * arc.length)
  return [arc.map((ch, i) => (i < filled ? ch : '⠤')).join(''), `${Math.round(pct)}%`.padStart(7).padEnd(12)]
}

export const Workspace = (c: PaneCtx): RenderElement => {
  const { Box, Text, Link, Button } = c.els
  const { run, env, ledger, resume, settings } = c.w
  const pct = env.context.at(-1)
  const boot = env.bootstrap.at(-1)
  const rows: [string, string][] = [
    ['superpowers', `${env.pluginVersion ?? (env.installed ? 'installed' : 'not installed')} · built against ${BUILT_AGAINST}`],
    ['bootstrap', boot ? `${boot.ok ? '✓' : '✗'} ${boot.why}` : '—'],
    ['compactions', String(env.compactions.length)],
    ['branch', `${env.branch ?? '—'}${env.isLinkedWorktree ? ' · linked worktree' : ''}`],
    ['repo', env.repoRoot ?? '—'],
    ['workspace', run.workspace ?? '—'],
    ['ledger', ledger.path ? `${ledger.path} · ${ledger.entries.length} lines` : '—'],
    ['executor', run.executor === 'sdd' ? 'subagent-driven-development' : run.executor === 'inline' ? 'executing-plans' : '—'],
    ['mode', `${settings.mode} · band ${settings.band} · motion ${settings.motion ? 'on' : 'off'}`],
    ['session', env.sessionId ?? '—'],
    ['cost', env.costUsd !== undefined ? `$${env.costUsd.toFixed(2)}` : '—'],
  ]
  const [arc, label] = gaugeArc(pct ?? 0)
  const links: [string, string][] = []
  if (run.specPath) links.push(['spec', run.specPath])
  if (run.planPath) links.push(['plan', env.repoRoot && run.planPath.startsWith(env.repoRoot + '/') ? run.planPath.slice(env.repoRoot.length + 1) : run.planPath])
  if (env.companion?.url) links.push(['companion', env.companion.url])
  // The plan this session tracks is not a candidate for resuming.
  const cands = visibleCandidates(resume).filter(c => !(c.planPath && run.planPath?.endsWith(c.planPath)))
  return (
    <Box flexDirection="column">
      {Section(c, 'Environment')}
      <Box flexDirection="row" gap={3}>
        {KeyValues(c, rows)}
        <Box flexDirection="column" alignItems="center">
          <Text color={c.t.stage[run.stage]}>{arc}</Text>
          <Text bold>{pct !== undefined ? label : '   —   '}</Text>
          <Text color={c.t.muted}>context</Text>
        </Box>
      </Box>
      {links.length ? Section(c, 'Links') : null}
      {links.map(([k, href]) => (
        <Text>
          <Text color={c.t.muted}>{`${k.padStart(9)}  `}</Text>
          {/^https?:/.test(href) ? <Link href={href}>{href}</Link> : <Link href={`file://${href.startsWith('/') ? href : `${env.repoRoot ?? ''}/${href}`}`}>{href}</Link>}
        </Text>
      ))}
      {Section(c, 'Resume candidates', `${cands.length}`)}
      {cands.length === 0 ? <Text color={c.t.muted}>Nothing unfinished found in this project.</Text> : null}
      {cands.map((cand, i) => (
        <Box flexDirection="row" justifyContent="space-between">
          <Text wrap="truncate-end" dimColor={cand.dim}>
            <Text color={c.t.stage[cand.stage]}>{`${i + 1}. `}</Text>
            <Text bold>{clip(cand.title, 28)}</Text>
            <Text color={c.t.muted}>{` · ${cand.kind}${cand.total ? ` · ${cand.done}/${cand.total}` : ''}${cand.worktree ? ` · ${cand.worktree}` : ''} · ${fmtAgo(c.now - cand.mtime)}`}</Text>
          </Text>
          <Box flexDirection="row" gap={1}>
            <Button key={`resume-${i}`} label="resume" plain onPress={() => c.act.resume(i + 1)} />
            <Button key={`dismiss-${i}`} label="dismiss" plain dimColor onPress={() => c.act.dismiss(i + 1)} />
          </Box>
        </Box>
      ))}
      {resume.lastSession ? (
        <Text color={c.t.muted}>{`last superpowers session: ${resume.lastSession.id} · ${fmtAgo(resume.lastSession.ago)}${resume.lastSession.skill ? ` · ${resume.lastSession.skill}` : ''} · claude --resume ${resume.lastSession.id}`}</Text>
      ) : null}
    </Box>
  )
}

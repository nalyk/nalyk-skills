// Main-loop turns: the brainstorming path, success claims without
// verification, performative agreement, the rulings list, the ship moment.
// Subagent turns never reach here.

import type { Io, Message } from '../io'
import { BOOTSTRAP, DESIGN_SHOWN, KEEP_BRANCH, MINORS_LIST, OPT_OUT, PERFORMATIVE, RULINGS_LIST, SUCCESS_CLAIM } from '../patterns'
import { detectPath, rulingCount } from '../parsers'
import { fmtDuration, note, warn, type Toaster } from '../core'
import { ledgerFor } from './plan'

export const onPromptSubmitted = async (io: Io, fromPerson: boolean, text = ''): Promise<void> => {
  await io.state.run.set(r => {
    let next = { ...r, turn: r.turn + 1, turnHadVerification: false }
    if (!fromPerson || !r.brainstormActive || r.approvalSeen) return next
    // Opting out of the questions ends brainstorming, and its gate with it.
    if (OPT_OUT.test(text)) return { ...next, brainstormActive: false, approvalSeen: true }
    // Approval: the person replied after the design was put in front of
    // them: shown in chat (6.x bounded), or written as a design doc (7.x,
    // short for a small change, full for a project).
    if ((r.path === 'bounded' && r.boundedDesignShown) || (r.specPath !== undefined && (r.path === 'bounded' || r.path === 'architectural'))) {
      next = { ...next, approvalSeen: true }
    }
    return next
  })
}

export const onMainAnswer = async (io: Io, toast: Toaster, answer: string, turnId: string, replay = false): Promise<void> => {
  const run = await io.state.run.get()
  if (run.lifecycle === 'dormant') return
  const path = run.brainstormActive ? detectPath(answer) : undefined
  if (path && (run.path === undefined || run.pathInferred)) {
    await io.state.run.set(r => ({ ...r, path, pathInferred: true }))
    await note(io, { kind: 'note', label: `path: ${path}?`, detail: 'announced; inferred until an artifact confirms it' })
  }
  if (run.brainstormActive && (path ?? run.path) === 'bounded' && DESIGN_SHOWN.test(answer)) {
    await io.state.run.set(r => ({ ...r, boundedDesignShown: true }))
  }
  if (!replay && SUCCESS_CLAIM.test(answer) && !run.turnHadVerification) {
    const claim = SUCCESS_CLAIM.exec(answer)?.[0] ?? 'done'
    await warn(io, toast, 'unverified-claim', `"${claim}" claimed with no verification run this turn`, `turn ${turnId}`)
  }
  if (!replay && PERFORMATIVE.test(answer)) {
    await warn(io, toast, 'performative-agreement', 'Review feedback answered with performative agreement', `turn ${turnId}`)
  }
  const ledger = ledgerFor(run, await io.state.ledger.get())
  const rulings = rulingCount(ledger.entries)
  if (RULINGS_LIST.test(answer) || MINORS_LIST.test(answer)) {
    await io.state.run.set(r =>
      r.finishing || r.stage === 'review' || r.stage === 'finish'
        ? {
            ...r,
            finishing: {
              ...(r.finishing ?? { worktreeRemoved: false, branchDeleted: false, workspaceDeleted: false, rulingsListed: false, minorsListed: false }),
              rulingsListed: r.finishing?.rulingsListed || RULINGS_LIST.test(answer),
              minorsListed: r.finishing?.minorsListed || MINORS_LIST.test(answer),
            },
          }
        : r,
    )
  }
  if (KEEP_BRANCH.test(answer)) {
    await io.state.run.set(r => (r.finishing && !r.finishing.option ? { ...r, finishing: { ...r.finishing, option: 'keep' as const } } : r))
  }
  const after = await io.state.run.get()
  if (!replay && rulings > 0 && after.finishing?.workspaceDeleted && !after.finishing.rulingsListed) {
    await warn(io, toast, 'rulings-lost', `Workspace deleted; ${rulings} ledger ruling(s) never reached "Rulings I made"`, ledger.path ?? 'progress.md')
  }
  await maybeShip(io, toast, replay)
}

/** The ship moment: every task done and a clean final review, or the
 *  workspace deleted after the final review. */
export const maybeShip = async (io: Io, toast: Toaster, replay = false): Promise<void> => {
  const run = await io.state.run.get()
  if (run.lifecycle === 'shipped' || run.shippedAt !== undefined) return
  const fr = run.finalReview
  const allDone = run.tasks.length > 0 && run.tasks.every(t => t.status === 'done' || t.status === 'parked')
  // A review whose verdict was never read is no clean review.
  const clean = fr && (fr.verdict === 'Yes' || (fr.verdict !== '?' && fr.verdict !== 'No' && fr.critical + fr.important === 0))
  const deletedAfterReview = fr && run.finishing?.workspaceDeleted
  if (!((allDone && clean) || deletedAfterReview)) return
  const now = await io.now()
  const warnings = await io.state.warnings.get()
  const critical = warnings.filter(w => w.sev === 'critical').length
  const summary = `${run.tasks.length} tasks · ${fmtDuration(now - run.startedAt)} · ${critical} critical`
  await io.state.run.set(r => ({ ...r, lifecycle: 'shipped', shippedAt: now, shipSummary: summary, stage: 'finish', pulseAt: now }))
  await note(io, { kind: 'note', label: 'shipped', ok: true, detail: summary })
  if (!replay) toast('✓', 'Shipped!', summary)
}

/** Whether the session context carries the superpowers bootstrap block. */
export const hasBootstrap = (messages: readonly Message[]): boolean =>
  messages.slice(0, 40).some(m => BOOTSTRAP.test(m.text)) || messages.some(m => m.role === 'user' && BOOTSTRAP.test(m.text))

export const checkBootstrap = async (io: Io, toast: Toaster, why: string, warnIfMissing: boolean): Promise<boolean> => {
  const now = await io.now()
  const messages = await io.session.messages().catch(() => [] as Message[])
  const ok = hasBootstrap(messages)
  await io.state.env.set(env => ({ ...env, bootstrap: [...env.bootstrap, { at: now, ok, why }].slice(-12) }))
  if (!ok && warnIfMissing) {
    await warn(io, toast, 'bootstrap-missing', `Bootstrap missing after ${why}: skills may stop triggering`, `${why} at ${new Date(now).toISOString()}`)
  }
  return ok
}

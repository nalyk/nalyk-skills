// What the band lets the person do, as plain data: the hook draws each as a
// Button of its own tree (never inside the Client module, where a hotkey is
// not armed), sized here so the band beside it can be given the exact rest
// of the row and nothing is pushed off the right edge.
//
// A digit hotkey answers from an empty prompt, as a survey's does, so the
// strips that ask for a decision (a plan to resume, a critical warning) use
// digits. The live band asks nothing: its buttons carry no hotkey, and are
// pressed by a click (fullscreen) or by Tab and Enter once the band has the
// focus (ctrl+x tab).

import type { BandVM } from '../viewModel'

export type BandAction = {
  key: string
  label: string
  hotkey?: string
  do: 'resume' | 'open' | 'dismiss' | 'ack'
  tab?: number
  id?: string
  color?: string
  dim?: boolean
}

/** Cells a plain Button takes: `1: label`, or the label alone. */
export const actionCells = (a: BandAction): number => [...a.label].length + (a.hotkey ? 3 : 0)

/** The row the actions take beside the band, gaps and the leading margin included; 0 for none. */
export const actionsWidth = (list: readonly BandAction[]): number =>
  list.length ? list.reduce((n, a) => n + actionCells(a), 0) + (list.length - 1) + 1 : 0

export const bandActions = (vm: BandVM, columns: number): BandAction[] => {
  const narrow = columns < 72
  if (vm.kind === 'resume' && vm.resume) {
    const all: BandAction[] = [
      { key: 'resume', label: 'resume', hotkey: '1', do: 'resume', color: vm.resume.hue },
      { key: 'open', label: 'open', hotkey: '2', do: 'open', dim: true },
      { key: 'dismiss', label: 'dismiss', hotkey: '3', do: 'dismiss', dim: true },
    ]
    return narrow ? all.slice(0, 1) : all
  }
  if (vm.kind === 'live' && vm.critical) {
    const all: BandAction[] = [
      { key: 'ack', label: 'ack', hotkey: '1', do: 'ack', id: vm.critical.id, color: vm.c.critical },
      { key: 'details', label: 'details', hotkey: '2', do: 'open', tab: 7, dim: true },
    ]
    return narrow ? all.slice(0, 1) : all
  }
  if (vm.kind === 'live' || vm.kind === 'shipped') {
    const out: BandAction[] = []
    if (!narrow && vm.kind === 'live') {
      if (vm.pills.rulings) out.push({ key: 'rulings', label: `⚖ ${vm.pills.rulings}`, do: 'open', tab: 4, color: vm.c.warn })
      if (vm.pills.agents) out.push({ key: 'agents', label: `⌁ ${vm.pills.agents}`, do: 'open', tab: 3, color: vm.c.hue })
      if (vm.pills.warnings) out.push({ key: 'warnings', label: `⚠ ${vm.pills.warnings}`, do: 'open', tab: 7, color: vm.pills.warnColor })
    }
    // The command that opens the pane, as the label: a hint where no click reaches.
    if (columns >= 64) out.push({ key: 'pane', label: '/sp', do: 'open', dim: true })
    return out
  }
  return []
}

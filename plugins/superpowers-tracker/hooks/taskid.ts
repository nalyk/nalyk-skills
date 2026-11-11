// A task's ID as superpowers writes it: a whole number (`3`), or letters and
// digits, optionally dot-separated, with at least one digit (`6b`, `2.1`,
// `A1`), the IDs 7.0.2's task-brief takes. The tracker keys tasks by number
// everywhere, so an ID becomes one: `3` is 3, and any other ID is its
// leading number plus up to three more parts packed into the fraction, three
// decimal digits each (a letter 1–52, a number 100–999). That keeps the
// order a plan reads in (6 < 6b < 7, 2 < 2.1 < 3), is the same number
// wherever the ID is met (a heading, a ledger line, a dispatch), and turns
// back into the ID for display. No import: every module may use it.

const PARTS = /[A-Za-z]|\d+/g
const isNum = (s: string): boolean => /^\d+$/.test(s)

/** The source of a regex that matches one task ID (no capture group of its own). */
export const TASK_ID = String.raw`(?=[A-Za-z0-9.]*\d)[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*`

export const taskKey = (id: string): number => {
  if (isNum(id)) return Number(id)
  const parts = id.match(PARTS) ?? []
  const lead = parts[0] && isNum(parts[0]) ? Number(parts[0]) : 0
  const rest = lead || parts[0] === '0' ? parts.slice(1) : parts
  let packed = 0
  rest.slice(0, 3).forEach((p, i) => {
    const v = isNum(p) ? 100 + Math.min(899, Number(p)) : p >= 'a' ? p.charCodeAt(0) - 96 : 26 + p.charCodeAt(0) - 64
    packed += v * 10 ** (6 - 3 * i)
  })
  return lead + packed / 1e9
}

export const taskLabel = (n: number): string => {
  if (Number.isInteger(n)) return String(n)
  const lead = Math.floor(n)
  const packed = Math.round((n - lead) * 1e9)
  let out = lead > 0 ? String(lead) : ''
  let afterNumber = lead > 0
  for (const v of [Math.floor(packed / 1e6), Math.floor(packed / 1e3) % 1000, packed % 1000]) {
    if (v === 0) continue
    if (v >= 100) {
      out += (afterNumber ? '.' : '') + String(v - 100)
      afterNumber = true
    } else {
      out += v <= 26 ? String.fromCharCode(96 + v) : String.fromCharCode(64 + v - 26)
      afterNumber = false
    }
  }
  return out || String(n)
}

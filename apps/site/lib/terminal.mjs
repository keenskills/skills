// How the site reads page-as-data's own text output: which lines are problems,
// and when each line appears in a replay.
export function lineKind(line) {
  if (!line.trim()) return 'blank'
  if (/^\s*error {2,}/.test(line)) return 'error'
  if (/^\s*warning {2,}/.test(line)) return 'warning'
  if (/^\s+· /.test(line)) return 'detail'
  if (/^✖ /.test(line)) return 'fail'
  if (/^! /.test(line)) return 'warn-head'
  if (/^✔ /.test(line)) return 'pass'
  if (/^\d+ page checks? · /.test(line)) return 'summary'
  // In `read`, PROBLEMS mixes both; check calls these two warnings, so do we.
  if (/^\s*• /.test(line)) return /\(warning\)|^\s*• console\.error/.test(line) ? 'warning' : 'error'
  if (/^[A-Z][A-Z /]+$/.test(line.trim()) || /^TABLE \d/.test(line)) return 'section'
  if (/ @ \d+px/.test(line)) return 'title'
  return 'text'
}

/** The bullets under PROBLEMS in `read` output, without the bullet. */
export function problemLines(output) {
  const lines = output.split('\n')
  const start = lines.indexOf('PROBLEMS')
  if (start < 0) return []
  const out = []
  for (const l of lines.slice(start + 1)) {
    if (!/^\s*• /.test(l)) break
    out.push(l.replace(/^\s*• /, ''))
  }
  return out
}

/** How many characters a wrapped line hangs by: it continues under its own text, not under its bullet or label. */
export function hangIndent(line) {
  return line.match(/^\s*(?:• |· |(?:error|warning)\s+)?/)[0].length
}

/**
 * Two runs of the same page, as one list: each line says which run printed it.
 * The runs differ by a line or two, so a walk with two pointers is enough.
 */
export function mergeLines(a, b) {
  const out = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ text: a[i], a: true, b: true })
      i++
      j++
    } else if (i < a.length && !b.includes(a[i], j)) out.push({ text: a[i++], a: true, b: false })
    else out.push({ text: b[j++], a: false, b: true })
  }
  return out
}

/** When each line appears in a replay: in order, blanks for free, capped so a long run never drags. */
export function replaySchedule(lines, { reduced = false, step = 40, max = 1200 } = {}) {
  let t = 0
  return lines.map((text) => {
    const kind = lineKind(text)
    const at = reduced ? 0 : Math.min(t, max)
    if (kind !== 'blank') t += step
    return { text, kind, at }
  })
}

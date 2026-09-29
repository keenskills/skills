// The spec's motion rules, checked on every stylesheet the site ships, so a
// later edit cannot quietly add `transition: all`, a scale(0) entrance or an
// animation without a reduced-motion path.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const app = new URL('../app/', import.meta.url)
const sheets = readdirSync(app).filter((f) => f.endsWith('.css')).map((f) => [f, readFileSync(new URL(f, app), 'utf8')])
const motion = readFileSync(new URL('motion.css', app), 'utf8')

/** The text of every @media (prefers-reduced-motion: reduce) block. */
export function reducedBlocks(css) {
  const out = []
  let i = 0
  while ((i = css.indexOf('prefers-reduced-motion: reduce', i)) !== -1) {
    let depth = 0
    let j = css.indexOf('{', i)
    const start = j
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}' && --depth === 0) break
    }
    out.push(css.slice(start, j + 1))
    i = j
  }
  return out.join('\n')
}

const components = new URL('../components/', import.meta.url)
const tsx = readdirSync(components, { recursive: true }).filter((f) => f.endsWith('.tsx')).map((f) => [f, readFileSync(new URL(f, components), 'utf8')])

describe('motion rules', () => {
  // Inline transitions escape the reduced-motion guards; motion belongs in CSS.
  for (const [name, src] of tsx) {
    it(`${name}: no inline transition other than none`, () => {
      for (const m of src.matchAll(/transition\s*[:=]\s*([^,}\n]+)/g)) assert.match(m[1], /^['"`]?none['"`]?\s*$|^''$/, m[0])
    })
  }

  for (const [name, css] of sheets) {
    it(`${name}: never transitions all properties`, () => assert.doesNotMatch(css, /transition(-property)?\s*:\s*all\b/))
    it(`${name}: nothing enters from scale(0)`, () => assert.doesNotMatch(css, /scale\(0(\.0*)?\)/))
    it(`${name}: no ease-in on UI`, () => assert.doesNotMatch(css, /\bease-in\b(?!-out)/))
    it(`${name}: every animation has a reduced-motion path`, () => {
      if (/@keyframes|transition\s*:/.test(css)) assert.match(css, /prefers-reduced-motion: reduce/)
    })
  }

  it('keeps the reduced-motion guard of every pasted transitions.dev snippet', () => {
    const guards = reducedBlocks(motion)
    for (const sel of ['.t-resize', '.t-digit', '.t-text-swap', '.t-dropdown', '.t-icon-swap .t-icon', '.t-success-check', '.t-shimmer::before', '.t-tabs-pill', '.t-tt', '.t-stagger-line']) {
      assert.ok(guards.includes(sel), `no reduced-motion rule for ${sel}`)
    }
  })

  it('defines the spec easings', () => {
    assert.match(motion, /--ease-out:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/)
    assert.match(motion, /--ease-in-out:\s*cubic-bezier\(0\.77, 0, 0\.175, 1\)/)
  })
})

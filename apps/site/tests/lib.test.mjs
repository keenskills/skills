import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import vm from 'node:vm'
import { THEME_KEY, THEME_SCRIPT, nextTheme } from '../lib/theme-script.mjs'
import { copyText } from '../lib/copy.mjs'
import { PMS, commandFor } from '../lib/commands.mjs'

describe('theme head script', () => {
  const run = (getItem) => {
    const html = { dataset: {} }
    vm.runInNewContext(THEME_SCRIPT, { document: { documentElement: html }, localStorage: { getItem } })
    return html.dataset.theme
  }
  it('applies a stored choice before paint', () => {
    assert.equal(run((k) => (k === THEME_KEY ? 'dark' : null)), 'dark')
    assert.equal(run(() => 'light'), 'light')
  })
  it('leaves the system in charge when nothing is stored', () => assert.equal(run(() => null), undefined))
  it('ignores a stored value it does not know', () => assert.equal(run(() => 'sepia'), undefined))
  it('survives storage that throws (blocked cookies, private mode)', () => {
    assert.equal(run(() => { throw new Error('SecurityError') }), undefined)
  })
  it('flips between the two themes', () => {
    assert.equal(nextTheme('light'), 'dark')
    assert.equal(nextTheme('dark'), 'light')
  })
})

describe('copyText', () => {
  const doc = (ok) => {
    const made = []
    return {
      made,
      body: { appendChild: (el) => made.push(el) },
      createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() {} }),
      execCommand: () => ok,
    }
  }
  it('uses the Clipboard API when it works', async () => {
    let got
    assert.equal(await copyText('hi', { clipboard: { writeText: async (t) => { got = t } }, doc: doc(false) }), true)
    assert.equal(got, 'hi')
  })
  it('falls back to execCommand when the Clipboard API refuses', async () => {
    const d = doc(true)
    assert.equal(await copyText('hi', { clipboard: { writeText: async () => { throw new Error('NotAllowedError') } }, doc: d }), true)
    assert.equal(d.made[0].value, 'hi')
  })
  it('reports failure instead of pretending, when nothing can copy', async () => {
    assert.equal(await copyText('hi', { clipboard: undefined, doc: doc(false) }), false)
    assert.equal(await copyText('hi', { clipboard: undefined, doc: { createElement: () => { throw new Error('no DOM') } } }), false)
  })
})

describe('commandFor', () => {
  it('runs a package the way each manager does', () => {
    assert.equal(commandFor('npm', '@keenskills/page-as-data', 'init'), 'npx @keenskills/page-as-data init')
    assert.equal(commandFor('pnpm', '@keenskills/page-as-data', 'init'), 'pnpm dlx @keenskills/page-as-data init')
    assert.equal(commandFor('bun', '@keenskills/page-as-data', 'init --dry-run'), 'bunx @keenskills/page-as-data init --dry-run')
  })
  it('falls back to npm for an unknown stored choice', () => assert.equal(commandFor('yarn2', 'x'), 'npx x'))
  it('offers npm, pnpm and bun in that order', () => assert.deepEqual(PMS.map((p) => p.id), ['npm', 'pnpm', 'bun']))
})

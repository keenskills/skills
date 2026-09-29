import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import vm from 'node:vm'
import { THEME_KEY, THEME_SCRIPT, nextTheme } from '../lib/theme-script.mjs'

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

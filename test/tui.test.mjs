// The interactive prompts, driven by real key bytes through a fake terminal. No Chrome needed.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { banner, createTUI, isCancel } from '../tui.mjs'
import { KEY, fakeTerminal } from './terminal.mjs'

const setup = (color = false) => {
  const term = fakeTerminal()
  return { term, tui: createTUI({ input: term.input, output: term.output, color }) }
}

const AGENTS = [
  { value: 'claude', label: 'Claude Code', description: 'Writes .claude/skills/page-as-data/SKILL.md.' },
  { value: 'agents', label: 'AGENTS.md', description: 'Adds a block to AGENTS.md.' },
  { value: 'cursor', label: 'Cursor', description: 'Writes .cursor/rules/page-as-data.mdc.' },
]

describe('multiselect', () => {
  it('starts with the given values ticked and confirms them with enter', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS, initial: ['agents'] })
    await term.keys(KEY.enter)
    assert.deepEqual(await answer, ['agents'])
    assert.match(term.plain(), /◇ {2}Select agents › AGENTS\.md/)
  })

  it('moves with the arrows and toggles with space, starting on Select All', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.keys(KEY.down, KEY.down, KEY.down, KEY.space, KEY.up, KEY.up, KEY.space, KEY.enter)
    assert.deepEqual(await answer, ['claude', 'cursor'])
  })

  it('selects every option with Select All, and clears them all on a second press', async () => {
    const { term, tui } = setup()
    const all = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.keys(KEY.space, KEY.enter)
    assert.deepEqual(await all, ['claude', 'agents', 'cursor'])
    const none = tui.multiselect({ message: 'Again', options: AGENTS, initial: ['claude', 'agents', 'cursor'] })
    await term.until('Again')
    await term.keys(KEY.space, KEY.down, KEY.space, KEY.enter)
    assert.deepEqual(await none, ['claude'])
  })

  it('filters the list as you type, and Select All then covers only the matches', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.keys('c', 'u', 'r', 's')
    await term.until('Search: curs')
    assert.doesNotMatch(term.plain().split('Search: curs').at(-1), /Claude Code/)
    await term.keys(KEY.space, KEY.backspace, KEY.backspace, KEY.backspace, KEY.backspace, KEY.enter)
    assert.deepEqual(await answer, ['cursor'])
  })

  it('shows the description of the highlighted option', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.until('Select or clear all 3')
    await term.keys(KEY.down, KEY.down)
    await term.until('Adds a block to AGENTS.md.')
    await term.keys(KEY.enter, KEY.space, KEY.enter)
    await answer
  })

  it('asks for at least one choice instead of confirming none', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.keys(KEY.enter)
    await term.until('Select at least one')
    await term.keys(KEY.down, KEY.space, KEY.enter)
    assert.deepEqual(await answer, ['claude'])
  })

  it('cancels on Ctrl-C', async () => {
    const { term, tui } = setup()
    const answer = tui.multiselect({ message: 'Select agents', options: AGENTS })
    await term.keys(KEY.ctrlC)
    assert.ok(isCancel(await answer))
    assert.match(term.plain(), /■ {2}Select agents/)
  })
})

describe('select, text and confirm', () => {
  it('select returns the highlighted value', async () => {
    const { term, tui } = setup()
    const answer = tui.select({ message: 'Install for', options: [{ value: 'project', label: 'This project' }, { value: 'global', label: 'All my projects' }] })
    await term.keys(KEY.down, KEY.enter)
    assert.equal(await answer, 'global')
    assert.match(term.plain(), /◇ {2}Install for › All my projects/)
  })

  it('text returns what was typed, or the default on an empty enter', async () => {
    const { term, tui } = setup()
    const typed = tui.text({ message: 'URL', initial: 'http://localhost:3000' })
    await term.keys('h', 'x', KEY.backspace, 'i', KEY.enter)
    assert.equal(await typed, 'hi')
    const empty = tui.text({ message: 'URL again', initial: 'http://localhost:3000' })
    await term.until('URL again')
    await term.keys(KEY.enter)
    assert.equal(await empty, 'http://localhost:3000')
  })

  it('text refuses a value its validator rejects, and says why', async () => {
    const { term, tui } = setup()
    const answer = tui.text({ message: 'URL', initial: '', validate: (v) => (/^https?:\/\//.test(v) ? undefined : 'Start with http:// or https://') })
    await term.keys('x', KEY.enter)
    await term.until('Start with http://')
    await term.keys(KEY.backspace, ...'http://a', KEY.enter)
    assert.equal(await answer, 'http://a')
  })

  it('confirm defaults to its initial answer and flips with the arrows or y/n', async () => {
    const { term, tui } = setup()
    const yes = tui.confirm({ message: 'Write?' })
    await term.keys(KEY.enter)
    assert.equal(await yes, true)
    const no = tui.confirm({ message: 'Try it?' })
    await term.until('Try it?')
    await term.keys(KEY.right, KEY.enter)
    assert.equal(await no, false)
    const typedYes = tui.confirm({ message: 'Once more?', initial: false })
    await term.until('Once more?')
    await term.keys('y', KEY.enter)
    assert.equal(await typedYes, true)
  })
})

describe('output', () => {
  it('writes no colour codes when colour is off', async () => {
    const { term, tui } = setup(false)
    tui.intro('page-as-data 0.1.1')
    tui.step('Node 22')
    tui.warn('No Chrome found')
    tui.outro('Done')
    await term.flush()
    assert.doesNotMatch(term.text, /\x1b\[[0-9;]*m/)
    assert.match(term.plain(), /┌ {2,3}page-as-data 0\.1\.1/)
    assert.match(term.plain(), /▲ {2}No Chrome found/)
  })

  it('colours the intro pill when colour is on', async () => {
    const { term, tui } = setup(true)
    tui.intro('page-as-data')
    await term.flush()
    assert.match(term.text, /\x1b\[[0-9;]*m page-as-data /)
  })

  it('draws the banner only when the terminal is wide enough', () => {
    assert.equal(banner({ columns: 60, color: false }), null)
    const art = banner({ columns: 100, color: false })
    assert.equal(art.split('\n').length, 5)
    assert.ok(art.split('\n').every((line) => line.length <= 70))
  })
})

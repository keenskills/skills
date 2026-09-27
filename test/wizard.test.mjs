// The interactive `init` wizard, driven by real key bytes against temp folders.
// Chrome and the page read are stubbed: this checks the flow, not the reading.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { START } from '../install.mjs'
import { nextSteps, runWizard } from '../wizard.mjs'
import { KEY, fakeTerminal } from './terminal.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'page-as-data-wizard-'))
const PAGE = {
  settle: { settled: true, ms: 312 },
  page: { title: 'Orders', headings: [{ level: 1, text: 'Orders' }, { level: 2, text: 'Recent' }], controls: [{}, {}, {}] },
  problems: { exceptions: [], consoleErrors: [], failedRequests: [], brokenImages: [], invalidFields: [], layout: { errors: [], warnings: [] } },
}

function start(root, overrides = {}) {
  const term = fakeTerminal()
  const reads = []
  const done = runWizard({
    root,
    home: join(root, 'fake-home'),
    input: term.input,
    output: term.output,
    color: false,
    version: '9.9.9',
    nodeVersion: '22.12.0',
    findChrome: () => '/usr/bin/google-chrome',
    readPage: async (opts) => {
      reads.push(opts)
      return PAGE
    },
    ...overrides,
  })
  return { term, reads, done }
}

// Answers one question: waits for it to be asked, then presses the keys.
const answer = async (term, question, ...keys) => {
  await term.until(question)
  await term.keys(...keys)
}

describe('init wizard', () => {
  it('installs for the detected agent, tries the page, and ends with next steps', async () => {
    const root = tmp()
    writeFileSync(join(root, 'AGENTS.md'), '# Rules\n')
    const { term, reads, done } = start(root)
    await answer(term, 'Select agents', KEY.enter)
    await answer(term, "Your app's URL", KEY.enter)
    await answer(term, 'Pages behind a sign-in', KEY.enter)
    await answer(term, 'Write 1 file', KEY.enter)
    await answer(term, 'Try it now', KEY.enter)
    assert.equal(await done, 0)
    const screen = term.plain()
    assert.match(screen, /page-as-data 9\.9\.9/)
    assert.match(screen, /Found 1 agent in this project/)
    assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(START))
    assert.deepEqual(reads.map((r) => [r.url, r.launch]), [['http://localhost:3000', true]])
    assert.match(screen, /Read "Orders" in 312ms: 0 problems, 2 headings, 3 controls/)
    assert.match(screen, /Next steps/)
    assert.match(screen, /npx @rajaaltus\/page-as-data read http:\/\/localhost:3000 --width 390 --launch/)
    assert.doesNotMatch(screen, /Install the Claude Code skill for/)
  })

  it('asks where the Claude Code skill goes, and tailors next steps to a signed-in Chrome', async () => {
    const root = tmp()
    const { term, reads, done } = start(root)
    await answer(term, 'Select agents', KEY.enter) // no agent files: Claude Code and AGENTS.md are ticked
    await answer(term, 'Install the Claude Code skill for', KEY.down, KEY.enter)
    await answer(term, "Your app's URL", ...'http://localhost:5173/app', KEY.enter)
    await answer(term, 'Pages behind a sign-in', KEY.down, KEY.enter)
    await answer(term, 'Write 2 files', KEY.enter)
    await answer(term, 'Try it now', KEY.right, KEY.enter)
    assert.equal(await done, 0)
    assert.ok(existsSync(join(root, 'fake-home/.claude/skills/page-as-data/SKILL.md')))
    assert.ok(!existsSync(join(root, '.claude')))
    assert.ok(existsSync(join(root, 'AGENTS.md')))
    assert.deepEqual(reads, [])
    const screen = term.plain()
    assert.match(screen, /npx @rajaaltus\/page-as-data read http:\/\/localhost:5173\/app --width 390\n/)
    assert.match(screen, /--remote-debugging-port=9222/)
  })

  it('refuses a project folder that does not exist before asking anything', async () => {
    const { term, done } = start(join(tmp(), 'nope'))
    await assert.rejects(done, /No such folder/)
    assert.doesNotMatch(term.plain(), /Select agents/)
  })

  it('writes nothing when cancelled with Ctrl-C, and exits 130', async () => {
    const root = tmp()
    const { term, done } = start(root)
    await answer(term, 'Select agents', KEY.ctrlC)
    assert.equal(await done, 130)
    assert.deepEqual(readdirSync(root), [])
    assert.match(term.plain(), /Cancelled/)
  })

  it('writes nothing when the plan is declined', async () => {
    const root = tmp()
    const { term, done } = start(root)
    await answer(term, 'Select agents', KEY.enter)
    await answer(term, 'Install the Claude Code skill for', KEY.enter)
    await answer(term, "Your app's URL", KEY.enter)
    await answer(term, 'Pages behind a sign-in', KEY.enter)
    await answer(term, 'Write 2 files', KEY.right, KEY.enter)
    assert.equal(await done, 0)
    assert.deepEqual(readdirSync(root), [])
    assert.match(term.plain(), /Nothing written/)
  })

  it('warns about a missing Chrome and an old Node, still installs, and does not offer to try', async () => {
    const root = tmp()
    writeFileSync(join(root, 'AGENTS.md'), '')
    const { term, done } = start(root, { findChrome: () => null, nodeVersion: '20.11.0' })
    await answer(term, 'Select agents', KEY.enter)
    await answer(term, "Your app's URL", KEY.enter)
    await answer(term, 'Pages behind a sign-in', KEY.enter)
    await answer(term, 'Write 1 file', KEY.enter)
    assert.equal(await done, 0)
    const screen = term.plain()
    assert.match(screen, /▲ {2}Node 20\.11\.0: page-as-data needs Node 22 or newer/)
    assert.match(screen, /▲ {2}No Chrome found\. Install Chrome, Chromium or Edge, or set CHROME_PATH/)
    assert.doesNotMatch(screen, /Try it now/)
    assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(START))
  })

  it('reports a page it cannot read without failing the install', async () => {
    const root = tmp()
    writeFileSync(join(root, 'AGENTS.md'), '')
    const readPage = async () => {
      throw new Error('Could not open http://localhost:3000: net::ERR_CONNECTION_REFUSED')
    }
    const { term, done } = start(root, { readPage })
    await answer(term, 'Select agents', KEY.enter)
    await answer(term, "Your app's URL", KEY.enter)
    await answer(term, 'Pages behind a sign-in', KEY.enter)
    await answer(term, 'Write 1 file', KEY.enter)
    await answer(term, 'Try it now', KEY.enter)
    assert.equal(await done, 0)
    assert.match(term.plain(), /▲ {2}Could not read http:\/\/localhost:3000: .*ERR_CONNECTION_REFUSED/)
    assert.match(term.plain(), /Next steps/)
  })

  it('says it is up to date on a second run, without asking to write', async () => {
    const root = tmp()
    writeFileSync(join(root, 'AGENTS.md'), '')
    for (const run of [1, 2]) {
      const { term, done } = start(root)
      await answer(term, 'Select agents', KEY.enter)
      await answer(term, "Your app's URL", KEY.enter)
      await answer(term, 'Pages behind a sign-in', KEY.enter)
      if (run === 1) await answer(term, 'Write 1 file', KEY.enter)
      await answer(term, 'Try it now', KEY.right, KEY.enter)
      assert.equal(await done, 0)
      if (run === 2) assert.match(term.plain(), /Already up to date/)
    }
  })
})

describe('nextSteps', () => {
  it('adds --launch for pages anyone can open', () => {
    const text = nextSteps({ url: 'http://localhost:3000', attach: false }).join('\n')
    assert.match(text, /read http:\/\/localhost:3000 --width 390 --launch/)
    assert.match(text, /check http:\/\/localhost:3000 --launch/)
    assert.doesNotMatch(text, /remote-debugging-port/)
  })

  it('shows how to start Chrome for signed-in pages, and drops --launch', () => {
    const text = nextSteps({ url: 'http://localhost:3000', attach: true, chrome: '/usr/bin/google-chrome' }).join('\n')
    assert.doesNotMatch(text, /--launch/)
    assert.match(text, /"\/usr\/bin\/google-chrome" --remote-debugging-port=9222 --user-data-dir=/)
  })
})

// Drives the built site the way a person would — with page-as-data itself.
// Needs Chrome and `pnpm build` first; skipped (not failed) without Chrome.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'
import { findChrome, readPage } from '@keenskills/page-as-data'
import { serveExport } from '../scripts/serve-export.mjs'

const skip = findChrome() ? false : 'no Chrome'
let server
// A fresh debugging port per launch: reusing one races a Chrome still shutting down.
let port = 9400
const read = (path, opts = {}) => readPage({ url: server.base + path, width: 1440, launch: true, port: port++, ...opts })
const first = (r, i = 0) => r.inspected[i].elements[0]
const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number)
const ok = (r) => r.steps.forEach(({ step, result }) => assert.equal(result.error, undefined, JSON.stringify(step)))

before(async () => { if (!skip) server = await serveExport(fileURLToPath(new URL('../out/', import.meta.url))) })
after(() => server?.close())

describe('theme toggle', { skip }, () => {
  // Headless Chrome follows the OS theme, so start from whichever theme the page shows.
  it('flips the page to the other theme', async () => {
    const before = await read('/', { inspect: ['body', 'button[aria-label^="Switch to"]'] })
    const dark = rgb(first(before).styles.background).every((c) => c < 30)
    const label = first(before, 1).element.match(/"(.+)"/)[1]
    assert.equal(label, dark ? 'Switch to light theme' : 'Switch to dark theme')
    const r = await read('/', { steps: [{ click: label }], inspect: ['body'] })
    ok(r)
    const nowDark = rgb(first(r).styles.background).every((c) => c < 30)
    assert.equal(nowDark, !dark, first(r).styles.background)
  })
})

describe('package manager switcher', { skip }, () => {
  it('rewrites every install command for pnpm', async () => {
    const r = await read('/how-to-use', { steps: [{ click: 'pnpm' }], inspect: ['[data-command="install"]', '[data-command="uninstall"]'] })
    ok(r)
    assert.match(first(r, 0).text, /^pnpm dlx @keenskills\/page-as-data init/)
    assert.match(first(r, 1).text, /^pnpm dlx @keenskills\/page-as-data uninstall/)
  })
})

describe('skill page tabs', { skip }, () => {
  it('opens the Prompts panel of the diagram skill', async () => {
    const r = await read('/architecture-diagrams', { steps: [{ click: 'Prompts' }], inspect: ['#panel-prompts', '#panel-preview'] })
    ok(r)
    assert.equal(first(r, 0).visible, true)
    assert.equal(first(r, 1)?.visible ?? false, false)
  })
})

describe('page-as-data showcase', { skip }, () => {
  it('swaps the screenshot and the output to 1440 px', async () => {
    const r = await read('/page-as-data', { steps: [{ click: '1440 px' }], inspect: ['[data-read-output]', 'img[src$="fixture-1440.png"]'] })
    ok(r)
    assert.match(first(r, 0).text, /@ 1440px/)
    assert.equal(first(r, 1).visible, true)
  })

  it('replays the check to its real summary line', async () => {
    const r = await read('/page-as-data', { steps: [{ click: 'Replay the check' }], inspect: ['[data-check-output="check"]', '[data-check-output="check"] [data-kind="summary"]'] })
    ok(r)
    assert.match(first(r, 0).text, /npx @keenskills\/page-as-data check/)
    assert.match(first(r, 1).text, /^2 page checks · \d+ errors · \d+ warnings$/)
  })

  it('fits a phone: nothing on the page scrolls sideways at 390 px', async () => {
    const r = await read('/page-as-data', { width: 390, steps: [{ click: '1440 px' }] })
    ok(r)
    assert.deepEqual(r.problems.layout.errors, [])
  })
})

describe('diagram showcase', { skip }, () => {
  it('walks from the linted draft to the clean final', async () => {
    const r = await read('/architecture-diagrams', { steps: [{ click: 'Final' }], inspect: ['[data-lint-output]'] })
    ok(r)
    assert.match(first(r).text, /no overlaps or whitespace findings/)
  })
  it('has a labelled slider a keyboard can reach', async () => {
    const r = await read('/architecture-diagrams', { inspect: ['input[type="range"][aria-label]'] })
    assert.equal(r.inspected[0].found, 1)
  })
  it('fits a phone at 390 px', async () => {
    const r = await read('/architecture-diagrams', { width: 390, steps: [{ click: 'Fix' }] })
    ok(r)
    assert.deepEqual(r.problems.layout.errors, [])
  })
})

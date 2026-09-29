// Runs the real CLI functions against test/fixture.html in a headless Chrome.
// Each planted bug must be reported; each look-alike that is NOT a bug must not.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { checkPages, findChrome, parseArgs, readPage } from '../cli.mjs'

const chrome = findChrome()
const PORT = 9339
// Suites run concurrently, and a killed Chrome can hold its port for a moment:
// every launch after the first gets a fresh debugging port.
let nextPort = 9340
const freshPort = () => nextPort++
const fixture = readFileSync(new URL('./fixture.html', import.meta.url))
let server
let url

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(fixture)
    res.writeHead(404).end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${server.address().port}/`
})
after(() => server.close())

const kinds = (list) => list.map((x) => x.kind)
const messages = (list) => list.map((x) => x.message).join('\n')

describe('check', { skip: !chrome && 'no Chrome found (set CHROME_PATH)' }, () => {
  let phone
  let desktop
  before(async () => {
    ;[phone, desktop] = await checkPages({ urls: [url], widths: [390, 1440], launch: true, port: PORT })
  })

  it('reports the page overflow at phone width only, blaming only what widens the page', () => {
    const overflow = phone.errors.find((e) => e.kind === 'page-overflow')
    assert.ok(overflow, messages(phone.errors))
    // The buttons inside the clipping and scrolling bars stick out too, but
    // their boxes contain them: only the 600px banner widens the page.
    assert.deepEqual(overflow.detail.map((d) => d.split(' ends')[0]), ['div (div.wide-banner)'])
    assert.ok(!kinds(desktop.errors).includes('page-overflow'), messages(desktop.errors))
  })

  it('does not blame the app for the favicon the browser asks for by itself', () => {
    assert.doesNotMatch(messages(phone.errors), /favicon/)
  })

  it('reports a control cut off by a clipping container, not one inside a scroll box', () => {
    const clipped = messages(phone.errors.filter((e) => e.kind === 'clipped-control'))
    assert.match(clipped, /Hidden action/)
    assert.doesNotMatch(clipped, /Scrollable action/)
  })

  it('reports a sticky header displaced inside a box that cannot scroll vertically', () => {
    // Measured, not the declared 48px: sticky cannot travel past the end of
    // its own table, and the fixture's table is one row tall.
    const [, px] = messages(phone.errors.filter((e) => e.kind === 'sticky-displaced')).match(/pushes it (\d+)px down/) ?? []
    assert.ok(Number(px) > 0, messages(phone.errors))
  })

  it('reports crowded small targets, and not a small target with room around it', () => {
    const small = messages(phone.warnings.filter((w) => w.kind === 'small-target'))
    assert.match(small, /Crowded A/)
    assert.doesNotMatch(small, /Lonely/)
  })

  it('reports what broke behind the page', () => {
    assert.match(messages(phone.errors), /Uncaught: .*Fixture uncaught error/)
    assert.match(messages(phone.errors), /\/api\/missing → 404/)
    assert.match(messages(phone.warnings), /Fixture console error/)
  })
})

describe('read', { skip: !chrome && 'no Chrome found (set CHROME_PATH)' }, () => {
  let r
  before(async () => {
    r = await readPage({
      url,
      width: 1440,
      steps: [{ label: 'Name', value: 'Ada' }, { click: 'Add row' }],
      inspect: ['Faint note', 'Secret', 'Hidden action', 'Modern faint', 'Primary action', 'Gradient action', 'Caption on photo', 'Faded action'],
      launch: true,
      port: freshPort(),
    })
  })

  it('reproduces steps: the filled name and the added row are on screen', () => {
    assert.deepEqual(r.steps.map((s) => s.result.error), [undefined, undefined])
    assert.match(r.page.text, /Hello Ada/)
    assert.equal(r.page.tables[0].rowCount, 2)
    assert.deepEqual(r.page.tables[0].rows[1], ['Ada', 'User'])
  })

  it('reads headings, the open dialog, the alert and the invalid field with its message', () => {
    assert.deepEqual(r.page.headings[0], { level: 1, text: 'Planted bugs' })
    assert.equal(r.page.dialogs[0].title, 'Confirm delete')
    assert.match(r.page.alerts.map((a) => a.text).join(), /Saving failed/)
    assert.deepEqual(
      r.problems.invalidFields.map((f) => [f.label, f.error]),
      [['Email', 'Enter a valid email address']],
    )
  })

  it('collects exceptions, failed requests and broken images', () => {
    assert.match(r.problems.exceptions.join(), /Fixture uncaught error/)
    assert.ok(r.problems.failedRequests.some((f) => f.url.endsWith('/api/missing') && f.status === 404))
    assert.ok(r.problems.brokenImages.some((src) => src.endsWith('/missing-image.png')))
  })

  it('answers look-questions without a screenshot', () => {
    const [faint, secret, hidden] = r.inspected.map((q) => q.elements[0])
    assert.equal(faint.readable, false, `contrast ${faint.contrast}`)
    assert.equal(secret.visible, false)
    assert.match(secret.hiddenBecause, /display: none/)
    assert.equal(hidden.visible, false)
    assert.match(hidden.cutOffBy, /clipping-bar/)
  })

  it('reports an element faded out by an ancestor as not visible, naming the ancestor', () => {
    const faded = r.inspected.at(-1).elements[0]
    assert.equal(faded.visible, false)
    assert.match(faded.hiddenBecause, /opacity: 0 on div\.faded-wrapper/)
  })

  it('reads contrast in modern colour spaces (oklch), not just rgb()', () => {
    const [modernFaint, primary] = r.inspected.slice(3).map((q) => q.elements[0])
    assert.equal(modernFaint.readable, false, `contrast ${modernFaint.contrast}`)
    assert.equal(primary.readable, true, `contrast ${primary.contrast}`)
    assert.notEqual(primary.styles.background, 'rgb(255, 255, 255)')
  })

  it('reads contrast on a gradient, and admits it cannot on an image', () => {
    const [gradient, onPhoto] = r.inspected.slice(5).map((q) => q.elements[0])
    assert.match(gradient.styles.background, /^gradient /)
    assert.equal(gradient.readable, true, `contrast ${gradient.contrast}`)
    assert.equal(onPhoto.contrast, null)
    assert.match(onPhoto.needsScreenshot, /image/)
  })
})

describe('steps that wait for the app', { skip: !chrome && 'no Chrome found (set CHROME_PATH)' }, () => {
  const run = (steps) => readPage({ url, width: 1440, steps, launch: true, port: freshPort(), timeoutMs: 8000 })

  it('waits for a screen change scheduled on a short timer after the click', async () => {
    const r = await run([{ click: 'Next step' }])
    assert.equal(r.steps[0].result.error, undefined)
    assert.match(r.page.text, /Step two/)
  })

  it('presses a key as a trusted keyboard event', async () => {
    const r = await run([{ press: 'F9' }])
    assert.equal(r.steps[0].result.error, undefined)
    assert.match(r.page.text, /Shortcut pressed/)
  })

  it('waits for text that only appears when a long job finishes', async () => {
    const r = await run([{ click: 'Start job' }, { waitFor: 'Job done' }])
    assert.deepEqual(r.steps.map((s) => s.result.error), [undefined, undefined])
    assert.match(r.page.text, /Job done/)
  })

  it('matches names and text that contain a no-break space by what they print', async () => {
    // Intl.NumberFormat puts U+00A0 in "AED 20"; the report prints it as a space,
    // so that is what a person or agent types back.
    const r = await run([{ click: 'Buy print, AED 20' }, { waitFor: 'Paid AED 20' }])
    assert.deepEqual(r.steps.map((s) => s.result.error), [undefined, undefined])
  })

  it('checks hash routes as themselves, without waiting for a load event that never comes', async () => {
    const started = Date.now()
    const [first, second] = await checkPages({ urls: [`${url}#/a`, `${url}#/b`], widths: [1440], launch: true, port: freshPort(), timeoutMs: 20000 })
    assert.equal(first.finalUrl, '/#/a')
    assert.equal(second.finalUrl, '/#/b')
    // Waiting for a load event on the hash change would take the full 20s.
    assert.ok(Date.now() - started < 15000, `took ${Date.now() - started}ms`)
  })

  it('reports a wait-for that never appears, with what is on screen instead', async () => {
    const r = await readPage({ url, width: 1440, steps: [{ waitFor: 'Never shown' }], launch: true, port: freshPort(), timeoutMs: 1000 })
    assert.match(r.steps[0].result.error, /Never shown/)
  })
})

describe('parseArgs', () => {
  it('keeps steps in the order given', () => {
    const o = parseArgs(['read', 'http://x', '--click', 'New', '--fill', 'Name=A=B', '--press', 'F9', '--wait-for', 'Saved', '--click', 'Save'])
    assert.deepEqual(o.steps, [{ click: 'New' }, { label: 'Name', value: 'A=B' }, { press: 'F9' }, { waitFor: 'Saved' }, { click: 'Save' }])
  })

  it('rejects a fill without a label', () => {
    assert.throws(() => parseArgs(['read', 'http://x', '--fill', '=x']), /Label=value/)
  })
})

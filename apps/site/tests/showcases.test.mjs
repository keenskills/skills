// The showcases on the site are real tool output, committed. These tests
// regenerate what can run here (page-as-data needs Chrome, the diagram needs
// python3; draw.io renders are local only) and fail when the output drifts.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { findChrome } from '@keenskills/page-as-data'
import { SHOWN_ORIGIN, comparable, normalizeOutput, pageAsDataShowcase, pngSize } from '../scripts/build-showcases.mjs'

describe('normalizeOutput', () => {
  it('shows the fixture at localhost:3000 whatever port served it', () => {
    const raw = 'Fixture — http://127.0.0.1:53121/ @ 390px\n  • failed request: GET http://127.0.0.1:53121/hero.jpg → 404\r\n'
    assert.equal(normalizeOutput(raw, 'http://127.0.0.1:53121'), `Fixture — ${SHOWN_ORIGIN}/ @ 390px\n  • failed request: GET ${SHOWN_ORIGIN}/hero.jpg → 404`)
  })
  it('never keeps a path from the machine that generated it', () => {
    assert.doesNotMatch(normalizeOutput('at /Users/someone/x.html', 'http://127.0.0.1:1'), /\/Users\//)
  })
  it('drops the note from --screenshot, a flag the shown command does not carry', () => {
    assert.equal(normalizeOutput('TEXT ON SCREEN\n  x\nScreenshot saved to /var/folders/T/a.png.\n', 'http://127.0.0.1:1'), 'TEXT ON SCREEN\n  x')
  })
})

describe('comparable', () => {
  it('ignores timings and the order requests finished in', () => {
    assert.equal(comparable('a settled in 410ms\nGET /b\nGET /a'), comparable('a settled in 388ms\nGET /a\nGET /b'))
  })
  it('still sees a real change', () => {
    assert.notEqual(comparable('error x\nerror y'), comparable('error x'))
  })
})

describe('pngSize', () => {
  it('reads width and height from the PNG header', () => {
    const buf = Buffer.alloc(24)
    buf.write('\x89PNG\r\n\x1a\n', 0, 'latin1')
    buf.writeUInt32BE(390, 16)
    buf.writeUInt32BE(844, 20)
    assert.deepEqual(pngSize(buf), { width: 390, height: 844 })
  })
})

describe('page-as-data showcase', { skip: findChrome() ? false : 'no Chrome' }, () => {
  it('matches a fresh run of the real CLI (timings and request order aside)', async () => {
    const committed = JSON.parse(readFileSync(new URL('../content/showcase/page-as-data.json', import.meta.url), 'utf8'))
    const fresh = await pageAsDataShowcase({ publicDir: mkdtempSync(join(tmpdir(), 'pad-shots-')) })
    for (const w of committed.widths) {
      assert.equal(comparable(fresh.read[w].output), comparable(committed.read[w].output), `read @ ${w}px changed: run pnpm --filter @keenskills/site showcases`)
      assert.equal(fresh.read[w].exit, committed.read[w].exit)
    }
    assert.equal(comparable(fresh.check.output), comparable(committed.check.output), 'check output changed: run pnpm --filter @keenskills/site showcases')
  })
})

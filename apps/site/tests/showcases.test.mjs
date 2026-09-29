// The showcases on the site are real tool output, committed. These tests
// regenerate what can run here (page-as-data needs Chrome, the diagram needs
// python3; draw.io renders are local only) and fail when the output drifts.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { findChrome } from '@keenskills/page-as-data'
import { SHOWN_ORIGIN, comparable, diagramShowcase, normalizeOutput, pageAsDataShowcase, pngSize } from '../scripts/build-showcases.mjs'

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

const hasPython = spawnSync('python3', ['--version']).status === 0

describe('diagram showcase', { skip: hasPython ? false : 'no python3' }, () => {
  const committed = () => JSON.parse(readFileSync(new URL('../content/showcase/architecture-diagrams.json', import.meta.url), 'utf8'))

  it('matches a fresh run of the example, the draft script and the real linter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diagram-'))
    const fresh = await diagramShowcase({ publicDir: dir, render: false })
    const c = committed()
    assert.deepEqual(fresh.fixes, c.fixes)
    assert.equal(fresh.draft.lint.output, c.draft.lint.output)
    assert.equal(fresh.final.lint.output, c.final.lint.output)
    assert.equal(readFileSync(join(dir, 'northwind.drawio'), 'utf8'), readFileSync(new URL('../public/showcase/architecture-diagrams/northwind.drawio', import.meta.url), 'utf8'))
  })

  it('shows a draft with findings and a final with none', () => {
    const c = committed()
    assert.equal(c.draft.lint.exit, 1)
    assert.ok(c.draft.lint.output.split('\n').length >= 3)
    assert.equal(c.final.lint.exit, 0)
    assert.equal(c.fixes.length, 3)
  })

  it('draft and final images share one size, so the slider lines up', () => {
    const c = committed()
    assert.deepEqual([c.draft.image.width, c.draft.image.height], [c.final.image.width, c.final.image.height])
    for (const img of [c.draft.image, c.final.image]) {
      assert.deepEqual(pngSize(readFileSync(new URL(`../public${img.src}`, import.meta.url))), { width: img.width, height: img.height })
    }
  })
})

// Checks the built export (run after pnpm build).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import content from '../.generated/content.json' with { type: 'json' }

const out = new URL('../out/', import.meta.url)
const page = (p) => readFileSync(new URL(p, out), 'utf8')
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

describe('home', () => {
  it('shows every skill with its install command', () => {
    const html = page('index.html')
    for (const s of content.skills) {
      assert.ok(html.includes(`href="/${s.slug}"`), s.slug)
      assert.ok(html.includes(escape(s.install)), s.install)
    }
  })

  it('has one h1 and a skip link to the main content', () => {
    const html = page('index.html')
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /href="#main"/)
    assert.match(html, /<main id="main"/)
  })
})

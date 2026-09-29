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

describe('docs', () => {
  it('has a page for every skill, section, skill file and changelog', () => {
    for (const s of content.skills) {
      for (const p of [`${s.slug}.html`, `${s.slug}/skill.html`, `${s.slug}/changelog.html`, ...s.sections.map((x) => `${s.slug}/${x.slug}.html`)]) {
        assert.ok(existsSync(new URL(p, out)), p)
      }
    }
  })

  it('marks the current page in the docs sidebar', () => {
    const s = content.skills[0]
    const x = s.sections[0]
    assert.match(page(`${s.slug}/${x.slug}.html`), new RegExp(`<a[^>]*href="/${s.slug}/${x.slug}"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="/${s.slug}/${x.slug}"`))
  })

  it('shows the version and install command on each skill page', () => {
    for (const s of content.skills) {
      const html = page(`${s.slug}.html`)
      assert.ok(html.includes(`v${s.version}`), s.slug)
      assert.ok(html.includes(escape(s.install)), s.slug)
    }
  })
})

describe('how to use', () => {
  it('lists where init writes for every agent', () => {
    const html = page('how-to-use.html')
    for (const a of content.agents) assert.ok(html.includes(escape(a.path)), a.path)
  })
})

// Checks the built export (run after pnpm build).
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import content from '../.generated/content.json' with { type: 'json' }
import pad from '../content/showcase/page-as-data.json' with { type: 'json' }
import diagrams from '../content/showcase/architecture-diagrams.json' with { type: 'json' }

const out = new URL('../out/', import.meta.url)
const page = (p) => readFileSync(new URL(p, out), 'utf8')
// As React escapes text: &, <, >, " and '.
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')

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

  it('reveals the hero with a script, and shows it without one', () => {
    const html = page('index.html')
    assert.match(html, /class="t-stagger"/)
    assert.match(html, /<noscript><style>[^<]*\.t-stagger-line/)
  })

  it('links the CI run that checks this site with page-as-data', () => {
    assert.match(page('index.html'), /href="https:\/\/github\.com\/keenskills\/skills\/actions\/workflows\/test\.yml"/)
  })

  it('animates the FAQ height only through the accordion class', () => {
    assert.equal(page('index.html').match(/<details class="t-accordion/g)?.length, 5)
  })

  it('sets a stored theme in <head>, before any stylesheet paints', () => {
    const html = page('index.html')
    const script = html.indexOf("localStorage.getItem('theme')")
    assert.ok(script > 0 && script < html.indexOf('</head>'))
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

describe('skill page', () => {
  it('offers one Copy prompt button per skill page', () => {
    for (const s of content.skills) {
      const html = page(`${s.slug}.html`)
      assert.equal(html.match(/aria-label="Copy prompt"/g)?.length, 1, s.slug)
    }
  })

  it('has Preview and Install tabs, and Prompts only where the README has example prompts', () => {
    for (const s of content.skills) {
      const html = page(`${s.slug}.html`)
      assert.match(html, /role="tab"[^>]*>Preview</)
      assert.match(html, /role="tab"[^>]*>Install &amp; Usage</)
      assert.equal(/role="tab"[^>]*>Prompts</.test(html), s.gallery.length > 0, s.slug)
      for (const g of s.gallery) for (const p of g.prompts) assert.ok(html.includes(escape(p)), p)
    }
  })
})

describe('page-as-data showcase', () => {
  it('server-renders the real read output', () => {
    const html = page('page-as-data.html')
    for (const l of pad.read['390'].output.split('\n').filter((x) => x.includes('•'))) assert.ok(html.includes(escape(l.trim())), l)
  })
})

describe('diagram showcase', () => {
  it('links the real downloads, and they are in the export', () => {
    const html = page('architecture-diagrams.html')
    for (const d of diagrams.downloads) {
      assert.ok(html.includes(`href="${d.href}"`), d.href)
      assert.ok(existsSync(new URL(`.${d.href}`, out)), d.href)
    }
  })
  it('server-renders the draft\'s real lint findings', () => {
    const html = page('architecture-diagrams.html')
    for (const l of diagrams.draft.lint.output.split('\n')) assert.ok(html.includes(escape(l)), l)
  })
})

describe('illustrations', () => {
  it('home carries both scenes, each described for screen readers', () => {
    const html = page('index.html')
    assert.equal(html.match(/class="scene[ "]/g)?.length, 2)
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="scan-title"/)
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="draw-title"/)
  })
  it('renders the final frame in HTML: nothing armed before scripts run', () => {
    assert.doesNotMatch(page('index.html'), /data-armed/)
  })
  it('lists four real PROBLEMS lines from the page-as-data showcase', () => {
    const html = page('index.html')
    const shown = [...html.matchAll(/data-scan-line=""[^>]*>([^<]+)</g)].map((m) => m[1])
    assert.equal(shown.length, 4)
    for (const l of shown) assert.ok(escape(pad.read['390'].output).includes(l), l)
  })
})

describe('how to use', () => {
  it('lists where init writes for every agent', () => {
    const html = page('how-to-use.html')
    for (const a of content.agents) assert.ok(html.includes(escape(a.path)), a.path)
  })
})

describe('headings', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '_next' ? [] : walk(new URL(`${e.name}/`, dir))) : e.name.endsWith('.html') ? [new URL(e.name, dir)] : []))
  // Screen readers navigate by heading: one h1 per page, and no skipped levels below it.
  for (const file of walk(out)) {
    const name = file.pathname.slice(out.pathname.length)
    it(`${name} has one h1 and no skipped heading levels`, () => {
      const levels = [...readFileSync(file, 'utf8').matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]))
      assert.equal(levels.filter((l) => l === 1).length, 1, `h1 count in ${name}`)
      for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} → h${levels[i]} in ${name}`)
    })
  }
})

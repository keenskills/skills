// Checks the built export (run after pnpm build).
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import content from '../.generated/content.json' with { type: 'json' }
import pad from '../content/showcase/page-as-data.json' with { type: 'json' }
import diagrams from '../content/showcase/architecture-diagrams.json' with { type: 'json' }
import docs from '../content/showcase/design-documents.json' with { type: 'json' }
import { fileURLToPath } from 'node:url'
import { SITE } from '../lib/site.mjs'
import { routesFrom } from '../scripts/self-check.mjs'

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

  it('has the D2 favicon, as an icon, an .ico and an Apple touch icon', () => {
    const html = page('index.html')
    assert.match(html, /<link rel="icon"[^>]*href="\/icon\.png/)
    assert.match(html, /<link rel="icon"[^>]*href="\/favicon\.ico/)
    assert.match(html, /<link rel="apple-touch-icon"[^>]*href="\/apple-icon\.png/)
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
  it('says how the first draft was made', () => {
    assert.match(page('architecture-diagrams.html'), /made by undoing three of the example/)
  })
  it('shows keyboard focus on the slider handle', () => {
    const html = page('architecture-diagrams.html')
    assert.match(html, /has-\[input:focus-visible\]:outline-2/)
  })
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

describe('design document showcase', () => {
  it('says how the first draft was made', () => {
    assert.match(page('design-documents.html'), /made by putting back five habits of generated text/)
  })
  it('links the real downloads, and they are in the export', () => {
    const html = page('design-documents.html')
    for (const d of docs.downloads) {
      assert.ok(html.includes(`href="${d.href}"`), d.href)
      assert.ok(existsSync(new URL(`.${d.href}`, out)), d.href)
    }
  })
  it('server-renders the draft\'s real check findings, and marks each defect once in the draft', () => {
    const html = page('design-documents.html')
    for (const l of docs.draft.check.output.split('\n')) assert.ok(html.includes(escape(l)), l)
    assert.equal(html.match(/class="doc-mark"/g)?.length, docs.marks.length)
  })
})

describe('illustrations', () => {
  it('home carries all three scenes, each described for screen readers', () => {
    const html = page('index.html')
    assert.equal(html.match(/class="scene[ "]/g)?.length, 3)
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="scan-title"/)
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="draw-title"/)
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="doc-title"/)
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

describe('search and sharing', () => {
  const routes = routesFrom(fileURLToPath(out))
  const file = (r) => (r === '/' ? 'index.html' : `${r.slice(1)}.html`)
  const meta = (html, key) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1]

  for (const r of routes) {
    it(`${r} has a canonical URL, a description and a social card that exists`, () => {
      const html = page(file(r))
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.url}${r === '/' ? '/?' : r}"`))
      assert.ok(meta(html, 'description')?.length > 50, 'description')
      assert.equal(meta(html, 'og:url'), `${SITE.url}${r === '/' ? '' : r}`.replace(/^$/, SITE.url))
      assert.equal(meta(html, 'og:site_name'), SITE.name)
      assert.equal(meta(html, 'twitter:card'), 'summary_large_image')
      const image = meta(html, 'og:image')
      assert.ok(image?.startsWith(`${SITE.url}/og/`), image)
      assert.equal(meta(html, 'twitter:image'), image)
      assert.ok(existsSync(new URL(image.slice(SITE.url.length + 1), out)), image)
    })
  }

  it('gives each skill its own card and the rest the site card', () => {
    for (const s of content.skills) assert.equal(meta(page(`${s.slug}.html`), 'og:image'), `${SITE.url}/og/${s.slug}.png`)
    assert.equal(meta(page('index.html'), 'og:image'), `${SITE.url}/og/home.png`)
  })

  it('titles are unique across pages', () => {
    const titles = routes.map((r) => page(file(r)).match(/<title>([^<]*)<\/title>/)?.[1])
    assert.equal(new Set(titles).size, titles.length)
  })

  it('the sitemap lists every page and nothing else', () => {
    const urls = [...page('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort()
    assert.deepEqual(urls, routes.map((r) => `${SITE.url}${r === '/' ? '/' : r}`).sort())
  })

  it('robots.txt allows crawling and points at the sitemap', () => {
    const txt = page('robots.txt')
    assert.match(txt, /Allow: \//)
    assert.ok(txt.includes(`Sitemap: ${SITE.url}/sitemap.xml`))
  })

  it('carries structured data: the site on every page, the FAQ on home, the software on a skill page', () => {
    const types = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1])['@type'])
    assert.deepEqual(types(page('index.html')).sort(), ['FAQPage', 'WebSite'])
    assert.deepEqual(types(page('how-to-use.html')), ['WebSite'])
    for (const s of content.skills) assert.ok(types(page(`${s.slug}.html`)).includes('SoftwareApplication'), s.slug)
  })

  it('loads Google Analytics only on the live host', () => {
    const html = page('index.html')
    assert.ok(html.includes(SITE.analytics))
    assert.ok(html.includes(`if (location.hostname === '${SITE.host}')`))
    assert.doesNotMatch(html, /<script[^>]*src="https:\/\/www\.googletagmanager\.com/)
  })

  it('the 404 page is not indexed', () => assert.match(page('404.html'), /<meta name="robots" content="noindex/))
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

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SKILLS, agentTargets, buildContent, buildPrompt, firstSentence, promptGallery, renderMarkdown, rewriteHref, splitSections, weeklyDownloads } from '../scripts/build-content.mjs'

const ctx = { pkg: 'p', slug: 'p', sections: [] }

describe('splitSections', () => {
  it('takes the title, the intro, and one section per ## heading', () => {
    const r = splitSections('# Tool\n\nIntro.\n\n## Install\n\nnpm i\n\n## Use it\n\n### Deeper\n\ntext')
    assert.equal(r.title, 'Tool')
    assert.equal(r.intro, 'Intro.')
    assert.deepEqual(r.sections.map((s) => [s.heading, s.slug]), [['Install', 'install'], ['Use it', 'use-it']])
    assert.match(r.sections[1].markdown, /### Deeper/)
  })

  it('ignores headings inside code fences', () => {
    const r = splitSections('# T\n\n## A\n\n```md\n## not a section\n```\n\n## B\n')
    assert.deepEqual(r.sections.map((s) => s.heading), ['A', 'B'])
  })

  it('keeps site routes free: a section called Changelog gets another slug', () => {
    assert.equal(splitSections('# T\n\n## Changelog\n\nx').sections[0].slug, 'changelog-section')
  })

  it('strips inline markdown from headings', () => {
    assert.equal(splitSections('# T\n\n## The `check` command\n').sections[0].heading, 'The check command')
  })
})

describe('rewriteHref', () => {
  const c = { pkg: 'page-as-data', slug: 'page-as-data', known: new Set(['install']) }

  it('leaves absolute links alone', () => {
    assert.equal(rewriteHref('https://example.com/a', c), 'https://example.com/a')
  })

  it('sends a link to another section to its page', () => {
    assert.equal(rewriteHref('#install', c), '/page-as-data/install')
  })

  it('keeps a link to a heading on the same page', () => {
    assert.equal(rewriteHref('#deeper', c), '#doc-deeper')
  })

  it('sends repo paths to GitHub', () => {
    assert.equal(rewriteHref('docs/usage.md#init', c), 'https://github.com/keenskills/skills/blob/main/packages/page-as-data/docs/usage.md#init')
  })
})

describe('renderMarkdown', () => {
  it('highlights code, wraps tables so they scroll, and fixes relative images', async () => {
    const d = { ...ctx, pkg: 'drawing-architecture-diagrams' }
    const html = await renderMarkdown('```sh\nnpx x\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![alt](docs/sample-a4.png)', d)
    assert.match(html, /class="shiki/)
    assert.match(html, /<div class="table-scroll" tabindex="0"><table>/)
    assert.match(html, /src="\/docs\/drawing-architecture-diagrams\/docs\/sample-a4\.png"/)
  })

  it('serves this repo\'s own raw.githubusercontent images from the site, not from main', async () => {
    const html = await renderMarkdown('![x](https://raw.githubusercontent.com/keenskills/skills/main/packages/page-as-data/docs/diagram/how-it-helps.png)', { ...ctx, pkg: 'page-as-data' })
    assert.match(html, /src="\/docs\/page-as-data\/docs\/diagram\/how-it-helps\.png"/)
  })

  it('does not fail on a code block in an unknown language', async () => {
    assert.match(await renderMarkdown('```nosuchlang\nx\n```', ctx), /<pre/)
  })
})

describe('firstSentence', () => {
  it('cuts at the first full stop followed by a space', () => {
    assert.equal(firstSentence('One thing. Another.'), 'One thing.')
    assert.equal(firstSentence('No stop here'), 'No stop here')
  })
})

describe('buildContent', () => {
  it('builds every skill from its package', async () => {
    const c = await buildContent()
    assert.deepEqual(c.skills.map((s) => s.slug), SKILLS.map((s) => s.slug))
    for (const s of c.skills) {
      assert.match(s.install, /^npx @keenskills\/[a-z-]+ init$/)
      assert.ok(s.sections.length >= 3, s.slug)
      assert.match(s.changelog, new RegExp(`<h2[^>]*>${s.version.replaceAll('.', '\\.')}</h2>`))
      assert.ok(s.skill.length > 500, s.slug)
    }
  })

  it('lists where init writes for every agent, from the installer itself', () => {
    const agents = agentTargets()
    assert.equal(agents.length, 7)
    assert.deepEqual(agents.find((a) => a.id === 'claude'), { id: 'claude', label: 'Claude Code', path: '.claude/skills/<skill>/SKILL.md' })
  })
})

describe('buildPrompt', () => {
  const skillMd = '---\nname: x\n---\n\n# Read a web page as data\n\n`x` reads a page. Use it when you check UI.\n\nIt needs Node 22+.\n\n## Read a screen\n\n```sh\nnpx x read http://localhost:3000 --launch\n```\n\n## Check\n\n```sh\nnpx x check http://localhost:3000 --launch\n```\n\n```sh\nnot included\n```\n'
  const p = buildPrompt({ title: 'x', pkg: 'x', install: 'npx x init', skillMd })

  it('starts with the install line and the plugin alternative', () => {
    assert.match(p, /^Install the x agent skill in this project: npx x init\n/)
    assert.match(p, /\/plugin install x@keenskills/)
  })
  it('says what it is for from the skill file, as plain text', () => {
    assert.match(p, /x reads a page\. Use it when you check UI\./)
    assert.doesNotMatch(p, /`/)
  })
  it('carries the first two command blocks and no more', () => {
    assert.match(p, /npx x read http:\/\/localhost:3000 --launch/)
    assert.match(p, /npx x check http:\/\/localhost:3000 --launch/)
    assert.doesNotMatch(p, /not included/)
  })
  it('takes the purpose from text that follows a heading with no blank line between', () => {
    const q = buildPrompt({ title: 'y', pkg: 'y', install: 'npx y init', skillMd: '# Title\n\n## Overview\nGenerate the diagram from a script.\n\n**Core principle:** look.\n' })
    assert.match(q, /What it is for: Generate the diagram from a script\./)
  })
  it('leaves out the commands heading when the skill file has no command blocks', () => {
    const q = buildPrompt({ title: 'y', pkg: 'y', install: 'npx y init', skillMd: '# T\n\nDoes things.\n' })
    assert.doesNotMatch(q, /Key commands/)
  })
})

describe('promptGallery', () => {
  const use = '## Use\n\nIntro.\n\n### From a live cloud environment\nClaude inventories first.\n\n- `Diagram rg-a.`\n- `Draw the hub,\n  spokes and peering.`\n\n### Tips for good results\n- Give it facts, not just names.\n\nOr use the library directly:\n'
  it('groups the backticked prompts under their situation', () => {
    assert.deepEqual(promptGallery(use), [
      { title: 'From a live cloud environment', note: 'Claude inventories first.', prompts: ['Diagram rg-a.', 'Draw the hub, spokes and peering.'] },
    ])
  })
  it('is empty for a README without example prompts', () => assert.deepEqual(promptGallery('## Use it\n\n### 1. Pick a Chrome\n\n```sh\nx\n```\n'), []))
})

describe('weeklyDownloads', () => {
  it('reads the npm count', async () => {
    assert.equal(await weeklyDownloads('x', async () => ({ ok: true, json: async () => ({ downloads: 1234 }) })), 1234)
  })
  it('gives null rather than failing the build when npm is unreachable', async () => {
    assert.equal(await weeklyDownloads('x', async () => { throw new Error('offline') }), null)
    assert.equal(await weeklyDownloads('x', async () => ({ ok: false })), null)
  })
})

describe('phase 3 deferred fixes', () => {
  const rctx = { ...ctx, anchors: new Map(), base: '' }
  it('a ```lang line does not close a fence', () => {
    const r = splitSections('# T\n\n## A\n\n```sh\ncode\n```sh\n## not a section\n```\n\n## B\n')
    assert.deepEqual(r.sections.map((s) => s.heading), ['A', 'B'])
  })
  it('a heading with no letters still gets a route', () => {
    assert.equal(splitSections('# T\n\n## 🚀\n\nx').sections[0].slug, 'section-1')
  })
  const c = { pkg: 'page-as-data', slug: 'page-as-data', known: new Set(['install']), anchors: new Map([['pick-a-chrome', 'use-it']]), base: '' }
  it('sends an h3 anchor in another section to that section page', () => {
    assert.equal(rewriteHref('#pick-a-chrome', c), '/page-as-data/use-it#doc-pick-a-chrome')
  })
  it('keeps an unknown in-page anchor on the page, prefixed', () => assert.equal(rewriteHref('#nowhere', c), '#doc-nowhere'))
  it('resolves links from the skill file relative to its own folder', () => {
    assert.equal(rewriteHref('../README.md', { ...c, base: 'skill' }), 'https://github.com/keenskills/skills/blob/main/packages/page-as-data/README.md')
  })
  it('only lets http, https and mailto links through', () => {
    assert.equal(rewriteHref('javascript:alert(1)', c), null)
    assert.equal(rewriteHref('data:text/html,x', c), null)
    assert.equal(rewriteHref('mailto:a@b.co', c), 'mailto:a@b.co')
  })
  it('drops an unsafe link instead of rendering it', async () => {
    const html = await renderMarkdown('[x](javascript:alert(1))', rctx)
    assert.doesNotMatch(html, /javascript:/)
  })
  it('prefixes heading ids so docs cannot collide with page ids', async () => {
    assert.match(await renderMarkdown('## Main\n\ntext', rctx), /id="doc-main"/)
  })
  it('wraps tables in a focusable scroller', async () => {
    assert.match(await renderMarkdown('| a |\n| - |\n| b |', rctx), /<div class="table-scroll" tabindex="0"/)
  })
  it('gives github-light comments at least 4.5:1 on the code background', async () => {
    assert.doesNotMatch(await renderMarkdown('```js\n// note\n```', rctx), /--shiki-light:#6A737D/i)
  })
})

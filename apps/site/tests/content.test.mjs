import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SKILLS, agentTargets, buildContent, firstSentence, renderMarkdown, rewriteHref, splitSections } from '../scripts/build-content.mjs'

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
    assert.equal(rewriteHref('#deeper', c), '#deeper')
  })

  it('sends repo paths to GitHub', () => {
    assert.equal(rewriteHref('docs/usage.md#init', c), 'https://github.com/keenskills/skills/blob/main/packages/page-as-data/docs/usage.md#init')
  })
})

describe('renderMarkdown', () => {
  it('highlights code, wraps tables so they scroll, and fixes relative images', async () => {
    const html = await renderMarkdown('```sh\nnpx x\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![alt](docs/a.png)', ctx)
    assert.match(html, /class="shiki/)
    assert.match(html, /<div class="table-scroll"><table>/)
    assert.match(html, /src="https:\/\/raw\.githubusercontent\.com\/keenskills\/skills\/main\/packages\/p\/docs\/a\.png"/)
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

// Builds the site's docs from the packages themselves, so the site cannot say
// anything the READMEs, skill files and changelogs do not. Runs before
// next dev / next build and writes .generated/content.json (not committed).
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import rehypeShiki from '@shikijs/rehype'
import GithubSlugger from 'github-slugger'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { createInstaller } from '../../../shared/skill-installer.mjs'

const REPO = 'https://github.com/keenskills/skills'
const RAW = 'https://raw.githubusercontent.com/keenskills/skills/main'
const root = new URL('../../../', import.meta.url)

export const SKILLS = [
  { pkg: 'page-as-data', slug: 'page-as-data', title: 'page-as-data', skillFile: 'skill/page-as-data.md' },
  { pkg: 'drawing-architecture-diagrams', slug: 'architecture-diagrams', title: 'Architecture diagrams', skillFile: 'skills/drawing-architecture-diagrams/SKILL.md' },
]
// Pages the site owns under /<skill>/; a README section with the same slug gets another one.
const RESERVED = new Set(['skill', 'changelog'])

const plain = (heading) => heading.replace(/[`*_]/g, '')

/** Splits a README at its ## headings, ignoring any inside code fences. */
export function splitSections(md) {
  const slugger = new GithubSlugger()
  const intro = []
  const sections = []
  let title = ''
  let fence = null
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (f) {
      if (!fence) fence = f[1]
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null
    }
    const h = fence || f ? null : /^(#{1,2})\s+(.+?)\s*#*\s*$/.exec(line)
    if (h && h[1] === '#' && !title && !sections.length) {
      title = plain(h[2])
      continue
    }
    if (h && h[1] === '##') {
      const heading = plain(h[2])
      let slug = slugger.slug(heading)
      if (RESERVED.has(slug)) slug = slugger.slug(`${heading} section`)
      sections.push({ heading, slug, lines: [] })
      continue
    }
    ;(sections.length ? sections.at(-1).lines : intro).push(line)
  }
  return {
    title,
    intro: intro.join('\n').trim(),
    sections: sections.map(({ lines, ...s }) => ({ ...s, markdown: lines.join('\n').trim() })),
  }
}

const clean = (p) => p.replace(/^\.\//, '')
const isAbsolute = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href)

/** Makes a README link work on the site: sections become site pages, repo paths become GitHub URLs. */
export function rewriteHref(href, { pkg, slug, known }) {
  if (isAbsolute(href)) return href
  if (href.startsWith('#')) return known.has(href.slice(1)) ? `/${slug}/${href.slice(1)}` : href
  if (href.startsWith('/')) return `${REPO}/blob/main${href}`
  const [path, hash] = href.split('#')
  return `${REPO}/blob/main/packages/${pkg}/${clean(path)}${hash ? `#${hash}` : ''}`
}

// Rewrites links and images, and wraps tables in a scroller so a wide options
// table scrolls inside the page instead of pushing the page sideways on a phone.
function rehypeSiteLinks({ pkg, slug, sections }) {
  const known = new Set(sections)
  const visit = (node) => {
    if (!node.children) return
    node.children = node.children.map((child) => {
      if (child.type === 'element') {
        const p = child.properties
        if (child.tagName === 'a' && typeof p.href === 'string') p.href = rewriteHref(p.href, { pkg, slug, known })
        if (child.tagName === 'img' && typeof p.src === 'string' && !isAbsolute(p.src)) p.src = `${RAW}/packages/${pkg}/${clean(p.src)}`
      }
      visit(child)
      if (child.type === 'element' && child.tagName === 'table') {
        return { type: 'element', tagName: 'div', properties: { className: ['table-scroll'] }, children: [child] }
      }
      return child
    })
  }
  return () => (tree) => visit(tree)
}

export async function renderMarkdown(md, ctx) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeSiteLinks(ctx))
    .use(rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false, defaultLanguage: 'text', fallbackLanguage: 'text' })
    .use(rehypeStringify)
    .process(md)
  return String(file)
}

export const firstSentence = (text) => {
  const i = text.indexOf('. ')
  return i === -1 ? text : text.slice(0, i + 1)
}

async function buildSkill(s) {
  const dir = new URL(`packages/${s.pkg}/`, root)
  const read = (f) => readFileSync(new URL(f, dir), 'utf8')
  const pkg = JSON.parse(read('package.json'))
  const readme = splitSections(read('README.md'))
  const ctx = { pkg: s.pkg, slug: s.slug, sections: readme.sections.map((x) => x.slug) }
  return {
    pkg: s.pkg,
    slug: s.slug,
    title: s.title,
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    summary: firstSentence(pkg.description),
    install: `npx ${pkg.name} init`,
    repo: `${REPO}/tree/main/packages/${s.pkg}`,
    npm: `https://www.npmjs.com/package/${pkg.name}`,
    intro: await renderMarkdown(readme.intro, ctx),
    sections: await Promise.all(readme.sections.map(async (x) => ({ heading: x.heading, slug: x.slug, html: await renderMarkdown(x.markdown, ctx) }))),
    changelog: await renderMarkdown(read('CHANGELOG.md').replace(/^# .*\n/, ''), ctx),
    skill: await renderMarkdown(read(s.skillFile).replace(/^---\n[\s\S]*?\n---\n/, ''), ctx),
  }
}

/** Where init writes for each agent, taken from the installer itself so the table cannot drift. */
export function agentTargets() {
  const dir = mkdtempSync(join(tmpdir(), 'site-agents-'))
  try {
    const { AGENTS } = createInstaller({ name: '<skill>', pkg: '', source: '', description: '', body: '' })
    return AGENTS.map((a) => ({ id: a.id, label: a.label, path: relative(dir, a.target(dir, { global: false, home: dir }).path).split('\\').join('/') }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export async function buildContent() {
  return { skills: await Promise.all(SKILLS.map(buildSkill)), agents: agentTargets() }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const out = new URL('../.generated/', import.meta.url)
  mkdirSync(out, { recursive: true })
  writeFileSync(new URL('content.json', out), `${JSON.stringify(await buildContent(), null, 2)}\n`)
  console.log('wrote .generated/content.json')
}

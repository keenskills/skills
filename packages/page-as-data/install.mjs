/**
 * page-as-data init / uninstall — teach coding agents to read a screen with
 * page-as-data instead of a screenshot. One skill body (skill/page-as-data.md),
 * written in each agent's own format. Zero dependencies.
 *
 * Planning only reads the disk; applyPlan() is the one place that writes, so a
 * --dry-run is the very plan that would run.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const BODY = readFileSync(new URL('./skill/page-as-data.md', import.meta.url), 'utf8').trim()
export const DESCRIPTION =
  'Read a web page as data instead of a screenshot: what is on screen, what broke behind it (exceptions, failed requests), and layout defects at phone and desktop widths. Use when checking, debugging or verifying web UI work.'
export const MANAGED = 'page-as-data:managed'
export const START = '<!-- page-as-data:start -->'
export const END = '<!-- page-as-data:end -->'
const NOTE = `<!-- ${MANAGED}: generated from skill/page-as-data.md in @rajaaltus/page-as-data. Edits here are replaced on update. -->`
// JSON strings are valid YAML double-quoted scalars; the description has a colon in it.
const DESCRIPTION_YAML = JSON.stringify(DESCRIPTION)

/** A file page-as-data owns whole: frontmatter first (agents parse it only there), then the marker. */
export const owned = (frontmatter) => `${frontmatter ? `---\n${frontmatter}\n---\n` : ''}${NOTE}\n\n${BODY}\n`
/** The part page-as-data owns inside a file the user also writes in. */
export const block = () => `${START}\n${BODY}\n${END}`
export const renderSkill = () => owned(`name: page-as-data\ndescription: ${DESCRIPTION_YAML}`)
export const renderCursor = () => owned(`description: ${DESCRIPTION_YAML}\nalwaysApply: false`)
export const renderWindsurf = () => owned(`trigger: model_decision\ndescription: ${DESCRIPTION_YAML}`)
export const renderCopilot = () => owned('applyTo: "**"')
export const renderPlain = () => owned()

// Where the marked block is. A merge can leave half of it behind, or two
// copies: then say so rather than guess, because guessing either duplicates
// it, keeps a stale copy, or cuts user text.
function findBlock(text) {
  const s = text.indexOf(START)
  const e = s === -1 ? text.indexOf(END) : text.indexOf(END, s)
  if (s === -1 && e === -1) return null
  if (s === -1 || e === -1) return 'broken'
  if (text.includes(START, s + START.length) || text.includes(END, e + END.length)) return 'broken'
  return { s, e: e + END.length }
}

/** Puts `blk` in place of the old block, or after the text. Every byte outside the markers stays. */
export function upsertBlock(text, blk) {
  const at = findBlock(text)
  if (at === 'broken') return null
  if (at) return text.slice(0, at.s) + blk + text.slice(at.e)
  if (!text) return `${blk}\n`
  return `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${blk}\n`
}

/** Takes the block out again, with the blank line upsertBlock put before it. */
export function stripBlock(text) {
  const at = findBlock(text)
  if (at === 'broken') return null
  if (!at) return text
  const before = text.slice(0, at.s).replace(/(\r?\n){0,2}$/, '')
  const after = text.slice(at.e).replace(/^\r?\n/, '')
  return before && after ? `${before}\n\n${after}` : before ? `${before}\n` : after
}

// ---------------------------------------------------------------------------
// Agents: how to tell a project uses one, where its file goes, what it holds.

const has = (root, ...paths) => paths.some((p) => existsSync(join(root, p)))
const isFile = (p) => existsSync(p) && statSync(p).isFile()
const project = (...parts) => (root) => ({ path: join(root, ...parts), shared: false })
const sharedFile = (name) => (root) => ({ path: join(root, name), shared: true })

export const AGENTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    detect: (root) => has(root, '.claude', 'CLAUDE.md'),
    target: (root, { global, home }) => ({ path: join(global ? home : root, '.claude', 'skills', 'page-as-data', 'SKILL.md'), shared: false }),
    render: renderSkill,
  },
  { id: 'agents', label: 'AGENTS.md', detect: (root) => has(root, 'AGENTS.md'), target: sharedFile('AGENTS.md') },
  { id: 'gemini', label: 'Gemini CLI', detect: (root) => has(root, 'GEMINI.md'), target: sharedFile('GEMINI.md') },
  {
    id: 'cursor',
    label: 'Cursor',
    detect: (root) => has(root, '.cursor', '.cursorrules'),
    target: project('.cursor', 'rules', 'page-as-data.mdc'),
    render: renderCursor,
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    detect: (root) => has(root, '.windsurf', '.windsurfrules'),
    target: project('.windsurf', 'rules', 'page-as-data.md'),
    render: renderWindsurf,
  },
  {
    id: 'cline',
    label: 'Cline',
    detect: (root) => has(root, '.clinerules'),
    // .clinerules is either a folder of rule files or one file; a file cannot hold a folder.
    target: (root) => {
      const rules = join(root, '.clinerules')
      return isFile(rules) ? { path: rules, shared: true } : { path: join(rules, 'page-as-data.md'), shared: false }
    },
    render: renderPlain,
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    // Not .github alone: most repos have one for workflows only.
    detect: (root) => has(root, join('.github', 'copilot-instructions.md'), join('.github', 'instructions')),
    target: project('.github', 'instructions', 'page-as-data.instructions.md'),
    render: renderCopilot,
  },
]
export const AGENT_IDS = AGENTS.map((a) => a.id)

/** Which agents to write for: the ones asked for, else the ones the project uses, else a sensible pair. */
export function selectAgents({ root, agents = [], global = false }) {
  if (agents.length) {
    const asked = agents.includes('all') ? AGENT_IDS : agents
    const unknown = asked.find((id) => !AGENT_IDS.includes(id))
    if (unknown) throw new Error(`Unknown agent "${unknown}". Use one or more of: ${AGENT_IDS.join(', ')}, all`)
    return { ids: AGENT_IDS.filter((id) => asked.includes(id)), fallback: false }
  }
  if (global) return { ids: ['claude'], fallback: false }
  const found = AGENTS.filter((a) => a.detect(root)).map((a) => a.id)
  return found.length ? { ids: found, fallback: false } : { ids: ['claude', 'agents'], fallback: true }
}

function checkRoot(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No such folder: ${root}`)
}

const BROKEN = `has page-as-data markers (${START} … ${END}) that do not form one block; fix it by hand, then run again`

/** What `init` would do. Reads the disk, never writes. */
export function planInstall({ root, agents = [], global = false, force = false, home = homedir() }) {
  checkRoot(root)
  const { ids, fallback } = selectAgents({ root, agents, global })
  const actions = ids.map((id) => {
    const agent = AGENTS.find((a) => a.id === id)
    const { path, shared } = agent.target(root, { global, home })
    const base = { agent: id, label: agent.label, path }
    const existing = isFile(path) ? readFileSync(path, 'utf8') : null
    if (existing === null && existsSync(path)) return { ...base, action: 'skip', reason: 'is a folder' }
    if (shared) {
      const content = upsertBlock(existing ?? '', block())
      if (content === null) return { ...base, action: 'skip', reason: BROKEN }
      return { ...base, action: existing === null ? 'create' : content === existing ? 'unchanged' : 'update', content }
    }
    const content = agent.render()
    if (existing === null) return { ...base, action: 'create', content }
    if (existing === content) return { ...base, action: 'unchanged', content }
    if (existing.includes(MANAGED) || force) return { ...base, action: 'update', content }
    return { ...base, action: 'skip', reason: 'exists and was not written by page-as-data; pass --force to replace it' }
  })
  return { ids, fallback, actions }
}

/** What `uninstall` would do: only what init wrote, wherever any agent keeps it. */
export function planUninstall({ root, agents = [], global = false, home = homedir() }) {
  checkRoot(root)
  const ids = agents.length ? selectAgents({ root, agents }).ids : global ? ['claude'] : AGENT_IDS
  const actions = []
  for (const id of ids) {
    const agent = AGENTS.find((a) => a.id === id)
    const { path, shared } = agent.target(root, { global, home })
    if (!isFile(path)) continue
    const base = { agent: id, label: agent.label, path }
    const text = readFileSync(path, 'utf8')
    if (shared) {
      const content = stripBlock(text)
      if (content === null) actions.push({ ...base, action: 'skip', reason: BROKEN })
      else if (content !== text) actions.push(content.trim() ? { ...base, action: 'strip-block', content } : { ...base, action: 'remove' })
    } else if (text.includes(MANAGED)) actions.push({ ...base, action: 'remove' })
    else actions.push({ ...base, action: 'skip', reason: 'was not written by page-as-data' })
  }
  return { ids, actions }
}

/** Carries out a plan from planInstall or planUninstall. The only function here that writes. */
export function applyPlan(actions) {
  for (const a of actions) {
    if (a.action === 'create' || a.action === 'update' || a.action === 'strip-block') {
      mkdirSync(dirname(a.path), { recursive: true })
      writeFileSync(a.path, a.content)
    } else if (a.action === 'remove') {
      rmSync(a.path)
      // The Claude Code skill gets a folder of its own; leave no empty one behind.
      // Only that one: any other file's folder may be the project itself.
      const dir = dirname(a.path)
      if (a.agent === 'claude' && readdirSync(dir).length === 0) rmdirSync(dir)
    }
  }
}

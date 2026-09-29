// Generated from shared/skill-installer.mjs by scripts/sync-shared.mjs. Edit that file, then run pnpm sync.
/**
 * Skill installer shared by the Keen Skills packages: `init` / `uninstall`
 * write one skill into each coding agent's own format. A skill may ship
 * support files (scripts, references); they go in a folder next to its
 * SKILL.md. Zero dependencies.
 *
 * Planning only reads the disk; applyPlan() is the one place that writes, so a
 * --dry-run is the very plan that would run.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, sep } from 'node:path'

// Agents that read one file cannot hold a folder. Their skill's files go in the
// Agent Skills layout, which several agents read directly.
export const FOLDER_ROOT = join('.agents', 'skills')

const has = (root, ...paths) => paths.some((p) => existsSync(join(root, p)))
const isFile = (p) => existsSync(p) && statSync(p).isFile()
const project = (...parts) => (root) => ({ path: join(root, ...parts), shared: false })
const sharedFile = (name) => (root) => ({ path: join(root, name), shared: true })

function checkRoot(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No such folder: ${root}`)
}

// Removes the folders a removed file leaves empty, up to and including the
// skill folder, never above it: that may be the project itself.
function pruneEmpty(from, stop) {
  if (from !== stop && !from.startsWith(stop + sep)) return
  for (let dir = from; ; dir = dirname(dir)) {
    if (!existsSync(dir) || readdirSync(dir).length) return
    rmdirSync(dir)
    if (dir === stop) return
  }
}

export function createInstaller({ name, pkg, source, description, body, files = [] }) {
  const BODY = body.trim()
  const DESCRIPTION = description
  const MANAGED = `${name}:managed`
  const START = `<!-- ${name}:start -->`
  const END = `<!-- ${name}:end -->`
  const NOTE = `<!-- ${MANAGED}: generated from ${source} in ${pkg}. Edits here are replaced on update. -->`
  // JSON strings are valid YAML double-quoted scalars; descriptions often have a colon in them.
  const DESCRIPTION_YAML = JSON.stringify(DESCRIPTION)
  const folder = join(FOLDER_ROOT, name)
  // A single-file agent gets the text only, so tell it where the files the text names are.
  const TEXT = files.length
    ? `The files this skill uses (${files.map((f) => f.rel).join(', ')}) are in \`${folder.split(sep).join('/')}/\`; paths below are relative to that folder.\n\n${BODY}`
    : BODY
  const BROKEN = `has ${name} markers (${START} … ${END}) that do not form one block; fix it by hand, then run again`

  /** A file the skill owns whole: frontmatter first (agents parse it only there), then the marker. */
  const owned = (frontmatter, text = TEXT) => `${frontmatter ? `---\n${frontmatter}\n---\n` : ''}${NOTE}\n\n${text}\n`
  /** The part the skill owns inside a file the user also writes in. */
  const block = () => `${START}\n${TEXT}\n${END}`
  // SKILL.md sits in the folder with the files, so its paths need no pointer.
  const renderSkill = () => owned(`name: ${name}\ndescription: ${DESCRIPTION_YAML}`, BODY)
  const renderCursor = () => owned(`description: ${DESCRIPTION_YAML}\nalwaysApply: false`)
  const renderWindsurf = () => owned(`trigger: model_decision\ndescription: ${DESCRIPTION_YAML}`)
  const renderCopilot = () => owned('applyTo: "**"')
  const renderPlain = () => owned()

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
  function upsertBlock(text, blk) {
    const at = findBlock(text)
    if (at === 'broken') return null
    if (at) return text.slice(0, at.s) + blk + text.slice(at.e)
    if (!text) return `${blk}\n`
    return `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${blk}\n`
  }

  /** Takes the block out again, with the blank line upsertBlock put before it. */
  function stripBlock(text) {
    const at = findBlock(text)
    if (at === 'broken') return null
    if (!at) return text
    const before = text.slice(0, at.s).replace(/(\r?\n){0,2}$/, '')
    const after = text.slice(at.e).replace(/^\r?\n/, '')
    return before && after ? `${before}\n\n${after}` : before ? `${before}\n` : after
  }

  const AGENTS = [
    {
      id: 'claude',
      label: 'Claude Code',
      detect: (root) => has(root, '.claude', 'CLAUDE.md'),
      target: (root, { global, home }) => ({ path: join(global ? home : root, '.claude', 'skills', name, 'SKILL.md'), shared: false }),
      render: renderSkill,
    },
    { id: 'agents', label: 'AGENTS.md', detect: (root) => has(root, 'AGENTS.md'), target: sharedFile('AGENTS.md') },
    { id: 'gemini', label: 'Gemini CLI', detect: (root) => has(root, 'GEMINI.md'), target: sharedFile('GEMINI.md') },
    {
      id: 'cursor',
      label: 'Cursor',
      detect: (root) => has(root, '.cursor', '.cursorrules'),
      target: project('.cursor', 'rules', `${name}.mdc`),
      render: renderCursor,
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      detect: (root) => has(root, '.windsurf', '.windsurfrules'),
      target: project('.windsurf', 'rules', `${name}.md`),
      render: renderWindsurf,
    },
    {
      id: 'cline',
      label: 'Cline',
      detect: (root) => has(root, '.clinerules'),
      // .clinerules is either a folder of rule files or one file; a file cannot hold a folder.
      target: (root) => {
        const rules = join(root, '.clinerules')
        return isFile(rules) ? { path: rules, shared: true } : { path: join(rules, `${name}.md`), shared: false }
      },
      render: renderPlain,
    },
    {
      id: 'copilot',
      label: 'GitHub Copilot',
      // Not .github alone: most repos have one for workflows only.
      detect: (root) => has(root, join('.github', 'copilot-instructions.md'), join('.github', 'instructions')),
      target: project('.github', 'instructions', `${name}.instructions.md`),
      render: renderCopilot,
    },
  ]
  const AGENT_IDS = AGENTS.map((a) => a.id)

  /** Which agents to write for: the ones asked for, else the ones the project uses, else a sensible pair. */
  function selectAgents({ root, agents = [], global = false }) {
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

  function ownedFile(base, existing, content, force) {
    if (existing === null) return { ...base, action: 'create', content }
    if (existing === content) return { ...base, action: 'unchanged', content }
    if (existing.includes(MANAGED) || force) return { ...base, action: 'update', content }
    return { ...base, action: 'skip', reason: `exists and was not written by ${name}; pass --force to replace it` }
  }

  // A skill's files are its own when its SKILL.md is: a folder whose SKILL.md
  // someone else wrote is left alone, file by file.
  function supportFiles(dir, skill, base, force) {
    return files.map(({ rel, content }) => {
      const f = { ...base, path: join(dir, ...rel.split('/')), prune: dir }
      if (skill.action === 'skip') return { ...f, action: 'skip', reason: `its SKILL.md was not written by ${name}` }
      const existing = isFile(f.path) ? readFileSync(f.path, 'utf8') : null
      if (existing === null) return existsSync(f.path) ? { ...f, action: 'skip', reason: 'is a folder' } : { ...f, action: 'create', content }
      if (existing === content) return { ...f, action: 'unchanged', content }
      // A new SKILL.md next to a file already there: the folder was someone else's.
      if (skill.action === 'create' && !force) return { ...f, action: 'skip', reason: `exists and was not written by ${name}; pass --force to replace it` }
      return { ...f, action: 'update', content }
    })
  }

  function skillFolder(dir, base, force) {
    const path = join(dir, 'SKILL.md')
    const b = { ...base, path }
    if (!isFile(path) && existsSync(path)) {
      const skill = { ...b, action: 'skip', reason: 'is a folder' }
      return [skill, ...supportFiles(dir, skill, base, force)]
    }
    const skill = { ...ownedFile(b, isFile(path) ? readFileSync(path, 'utf8') : null, renderSkill(), force), prune: dir }
    const support = supportFiles(dir, skill, base, force)
    // A new SKILL.md would make the folder look like ours: the next init would then
    // overwrite the user's file and uninstall would delete it. Take nothing instead.
    if (skill.action === 'create' && support.some((f) => f.action === 'skip')) {
      const refused = { ...b, action: 'skip', reason: `the folder already has files init would write; pass --force to replace them` }
      return [refused, ...supportFiles(dir, refused, base, force)]
    }
    return [skill, ...support]
  }

  const needsFolder = (ids) => files.length > 0 && ids.some((id) => id !== 'claude')

  /** What `init` would do. Reads the disk, never writes. */
  function planInstall({ root, agents = [], global = false, force = false, home = homedir() }) {
    checkRoot(root)
    const { ids, fallback } = selectAgents({ root, agents, global })
    const actions = []
    for (const id of ids) {
      const agent = AGENTS.find((a) => a.id === id)
      const { path, shared } = agent.target(root, { global, home })
      const base = { agent: id, label: agent.label }
      if (id === 'claude') {
        actions.push(...skillFolder(dirname(path), base, force))
        continue
      }
      const existing = isFile(path) ? readFileSync(path, 'utf8') : null
      if (existing === null && existsSync(path)) {
        actions.push({ ...base, path, action: 'skip', reason: 'is a folder' })
      } else if (shared) {
        const content = upsertBlock(existing ?? '', block())
        if (content === null) actions.push({ ...base, path, action: 'skip', reason: BROKEN })
        else actions.push({ ...base, path, action: existing === null ? 'create' : content === existing ? 'unchanged' : 'update', content })
      } else {
        actions.push(ownedFile({ ...base, path }, existing, agent.render(), force))
      }
    }
    if (needsFolder(ids)) actions.push(...skillFolder(join(root, folder), { agent: 'folder', label: 'skill files' }, force))
    return { ids, fallback, actions }
  }

  // Only the files this skill ships: anything the user added to the folder stays.
  const removeSupport = (dir, base) =>
    files.map(({ rel }) => join(dir, ...rel.split('/'))).filter(isFile).map((path) => ({ ...base, path, action: 'remove', prune: dir }))

  // Single-file agents left out of this uninstall still name the skill-files folder.
  function stillPointed(root, ids) {
    return AGENTS.some((a) => {
      if (a.id === 'claude' || ids.includes(a.id)) return false
      const { path, shared } = a.target(root, { global: false, home: root })
      if (!isFile(path)) return false
      const text = readFileSync(path, 'utf8')
      return shared ? findBlock(text) !== null : text.includes(MANAGED)
    })
  }

  function removeFolder(dir, base) {
    const path = join(dir, 'SKILL.md')
    if (!isFile(path)) return []
    if (!readFileSync(path, 'utf8').includes(MANAGED)) return [{ ...base, path, action: 'skip', reason: `was not written by ${name}` }]
    return [{ ...base, path, action: 'remove', prune: dir }, ...removeSupport(dir, base)]
  }

  /** What `uninstall` would do: only what init wrote, wherever any agent keeps it. */
  function planUninstall({ root, agents = [], global = false, home = homedir() }) {
    checkRoot(root)
    const ids = agents.length ? selectAgents({ root, agents }).ids : global ? ['claude'] : AGENT_IDS
    const actions = []
    for (const id of ids) {
      const agent = AGENTS.find((a) => a.id === id)
      const { path, shared } = agent.target(root, { global, home })
      const base = { agent: id, label: agent.label }
      if (id === 'claude') {
        actions.push(...removeFolder(dirname(path), base))
        continue
      }
      if (!isFile(path)) continue
      const text = readFileSync(path, 'utf8')
      if (shared) {
        const content = stripBlock(text)
        if (content === null) actions.push({ ...base, path, action: 'skip', reason: BROKEN })
        else if (content !== text) actions.push(content.trim() ? { ...base, path, action: 'strip-block', content } : { ...base, path, action: 'remove' })
      } else if (text.includes(MANAGED)) actions.push({ ...base, path, action: 'remove' })
      else actions.push({ ...base, path, action: 'skip', reason: `was not written by ${name}` })
    }
    if (needsFolder(ids) && !stillPointed(root, ids)) actions.push(...removeFolder(join(root, folder), { agent: 'folder', label: 'skill files' }))
    return { ids, actions }
  }

  /** Carries out a plan from planInstall or planUninstall. The only function here that writes. */
  function applyPlan(actions) {
    for (const a of actions) {
      if (a.action === 'create' || a.action === 'update' || a.action === 'strip-block') {
        mkdirSync(dirname(a.path), { recursive: true })
        writeFileSync(a.path, a.content)
      } else if (a.action === 'remove') {
        rmSync(a.path)
        if (a.prune) pruneEmpty(dirname(a.path), a.prune)
      }
    }
  }

  return {
    BODY, DESCRIPTION, MANAGED, START, END,
    owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain,
    upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan,
  }
}

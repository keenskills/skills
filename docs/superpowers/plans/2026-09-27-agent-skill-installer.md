# Agent Skill Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx @rajaaltus/page-as-data init` installs the page-as-data skill into every coding agent a project uses, and the repo doubles as a Claude Code plugin marketplace.

**Architecture:** A new `install.mjs` holds one skill body (`skill/page-as-data.md`), a table of agents with their detection markers, target paths and file formats, and pure planners (`planInstall`, `planUninstall`) that only read the disk. `applyPlan` is the one function that writes. `cli.mjs` routes `init` / `uninstall` to it before any Chrome code. A build script copies the rendered skill and version into the Claude Code plugin files, and tests fail if they drift.

**Tech Stack:** Node 22+ ES modules, `node:fs` / `node:path` / `node:os` only, `node:test`, GitHub Actions, npm.

**Spec:** `docs/superpowers/specs/2026-09-27-agent-skill-installer-design.md`

## Global Constraints

- Zero runtime dependencies. Only `node:` built-ins.
- Node `>=22`.
- npm package name: `@rajaaltus/page-as-data`. Commands in skill text use `npx @rajaaltus/page-as-data`.
- Fork repo: `github.com/rajaaltus/page-as-data`. `author: rajaaltus`, `contributors: ["gjohnpaull"]`, MIT license keeps the original copyright line.
- Agent ids, in this order everywhere: `claude`, `agents`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot`; plus `all`.
- Shared-file markers: `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`. Owned-file marker text: `page-as-data:managed`.
- Exit codes: `0` done, `2` bad flag, unknown agent, missing folder or write failure.
- Code style: no semicolons, single quotes, 2-space indent, comments say *why*. LF line endings.

## Review Focus

- **Half-marked shared file** (a start marker without its end marker, after a bad merge): `init` and `uninstall` skip it with "fix it by hand", and never add a second block or cut user text. Test in Task 1 and Task 2.
- **CRLF `AGENTS.md`** (edited on Windows): the block is replaced and every byte outside the markers stays the same. Test in Task 1 and Task 2.
- **`.clinerules` is a single file**, not a folder: `init` writes a marked block into it instead of crashing on `mkdir`. Test in Task 2.
- **`--dir` names a folder that does not exist**: exit 2 with "No such folder", and no folders created. Test in Task 2 and Task 4.
- **User rewrote an owned file and dropped the marker**: `uninstall` keeps it (skip), `init` skips it unless `--force`. Test in Task 2 and Task 3.

---

### Task 1: Skill body, renderers and marked-block helpers

**Files:**
- Create: `skill/page-as-data.md`
- Create: `install.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (exports of `install.mjs`):
  - `BODY: string`: `skill/page-as-data.md`, trimmed.
  - `DESCRIPTION: string`, `MANAGED = 'page-as-data:managed'`, `START = '<!-- page-as-data:start -->'`, `END = '<!-- page-as-data:end -->'`.
  - `renderSkill(): string`: the Claude Code `SKILL.md` text.
  - `block(): string`: `` `${START}\n${BODY}\n${END}` ``.
  - `owned(frontmatter?: string): string`: frontmatter (if any), managed note, body.
  - `upsertBlock(text: string, blk: string): string | null`: `null` when the markers are broken.
  - `stripBlock(text: string): string | null`: `text` unchanged when it has no block, `null` when broken.

- [ ] **Step 1: Write the skill body**

Create `skill/page-as-data.md`:

````markdown
# Read a web page as data, not a screenshot

`page-as-data` reads a rendered page in Chrome and prints it as text: what is on screen, what broke behind it, and layout defects. Use it whenever you check, debug or verify web UI work. Take a screenshot only for what data cannot answer: images, charts and overall visual polish.

It needs Node 22+ and Chrome, Chromium or Edge.

## Pick a Chrome

- Public pages and a local dev server: add `--launch`. It starts its own headless Chrome.
- Pages behind a sign-in: ask the user to start Chrome with `--remote-debugging-port=9222` and its own `--user-data-dir`, and to sign in once. `page-as-data` attaches to port 9222 by default and opens its own tab.

## Read a screen

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch
npx @rajaaltus/page-as-data read http://localhost:3000/orders --width 390 --launch   # phone
```

The output lists PROBLEMS first (uncaught exceptions, `console.error`, failed requests, broken images, invalid fields, layout defects), then dialogs, alerts, headings, form fields, tables, buttons and the visible text. Add `--json` for the full result.

## Reproduce a bug

Steps run in the order given. The page settles after each one.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch \
  --click "New order" --fill "Email=a@b.co" --press Enter --wait-for "Saved"
```

- `--click "Name"`: click a button or link by its name.
- `--fill "Label=value"`: fill a field by its label.
- `--press Key`: a real key press: `F9`, `Enter`, `Escape`, a character.
- `--wait-for "text"`: wait until the text is on screen (up to `--timeout`, default 15000 ms).

## Is it visible? Is it readable?

`--inspect "Save"` takes visible text or a CSS selector. It gives the element's box, whether it is visible and why not, its colours and its WCAG contrast. Repeatable.

## Before calling UI work done

```sh
npx @rajaaltus/page-as-data check http://localhost:3000/ http://localhost:3000/orders --widths 390,1440 --launch
```

It must exit `0`. Exit codes: `0` nothing found, `1` problems found, `2` could not run (no Chrome, bad URL, a step could not find its control). `--strict` also fails on warnings.

## A screenshot, only when needed

`--screenshot out.png` on `read` also saves a picture. Use it for images, charts and the overall look. Everything else is already in the data.
````

- [ ] **Step 2: Write the failing tests**

Create `test/install.test.mjs`:

```js
// init / uninstall: planning and writing against temp folders. No Chrome needed.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BODY, END, MANAGED, START, renderSkill, stripBlock, upsertBlock } from '../install.mjs'

describe('rendering', () => {
  it('renders the Claude Code skill with valid frontmatter first, then the managed note and the body', () => {
    const skill = renderSkill()
    assert.match(skill, /^---\nname: page-as-data\ndescription: "[^"\n]+"\n---\n/)
    assert.ok(skill.includes(MANAGED))
    assert.ok(skill.endsWith(`${BODY}\n`))
  })

  it('uses the scoped package name in every command', () => {
    assert.match(BODY, /npx @rajaaltus\/page-as-data read/)
    assert.doesNotMatch(BODY, /npx page-as-data/)
  })
})

const blk = `${START}\nnew\n${END}`

describe('marked block', () => {
  it('appends to a file without one, leaving the text before it untouched', () => {
    const text = '# Rules\n\nBe kind.\n'
    assert.equal(upsertBlock(text, blk), `${text}\n${blk}\n`)
  })

  it('makes the block the whole file when the file is empty', () => {
    assert.equal(upsertBlock('', blk), `${blk}\n`)
  })

  it('replaces only what is between the markers, keeping CRLF text around them', () => {
    const text = `before\r\n\r\n${START}\nold\n${END}\r\nafter\r\n`
    assert.equal(upsertBlock(text, blk), `before\r\n\r\n${blk}\r\nafter\r\n`)
  })

  it('refuses a start marker without its end marker, rather than adding a second block', () => {
    assert.equal(upsertBlock(`x\n${START}\nhalf`, blk), null)
    assert.equal(stripBlock(`x\n${START}\nhalf`), null)
    assert.equal(stripBlock(`x\n${END}\n${START}\n`), null)
  })

  it('strips the block back to the exact text it was added to', () => {
    const text = '# Rules\n\nBe kind.\n'
    assert.equal(stripBlock(upsertBlock(text, blk)), text)
  })

  it('leaves text without a block as it is', () => {
    assert.equal(stripBlock('plain\n'), 'plain\n')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/install.test.mjs`
Expected: FAIL with `Cannot find module '.../install.mjs'`.

- [ ] **Step 4: Write the implementation**

Create `install.mjs`:

```js
/**
 * page-as-data init / uninstall — teach coding agents to read a screen with
 * page-as-data instead of a screenshot. One skill body (skill/page-as-data.md),
 * written in each agent's own format. Zero dependencies.
 *
 * Planning only reads the disk; applyPlan() is the one place that writes, so a
 * --dry-run is the very plan that would run.
 */
import { readFileSync } from 'node:fs'

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

// Where the marked block is. A merge can leave half of it behind: then say so
// rather than guess, because guessing either duplicates it or cuts user text.
function findBlock(text) {
  const s = text.indexOf(START)
  const e = s === -1 ? text.indexOf(END) : text.indexOf(END, s)
  if (s === -1 && e === -1) return null
  if (s === -1 || e === -1) return 'broken'
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/install.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add skill/page-as-data.md install.mjs test/install.test.mjs
git commit -m "Add the agent skill body and the marked-block helpers"
```

---

### Task 2: Agent table, `planInstall` and `applyPlan`

**Files:**
- Modify: `install.mjs` (the import line, then append after `stripBlock`)
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `block`, `renderSkill`, `renderCursor`, `renderWindsurf`, `renderCopilot`, `renderPlain`, `upsertBlock`, `MANAGED`, `START` from Task 1.
- Produces:
  - `AGENTS: Array<{ id, label, detect(root): boolean, target(root, { global, home }): { path, shared }, render?(): string }>`.
  - `AGENT_IDS: string[]`: `['claude', 'agents', 'gemini', 'cursor', 'windsurf', 'cline', 'copilot']`.
  - `selectAgents({ root, agents?: string[], global?: boolean }): { ids: string[], fallback: boolean }`: throws `Unknown agent "<id>"`.
  - `planInstall({ root, agents?, global?, force?, home? }): { ids, fallback, actions: Array<{ agent, label, path, action: 'create'|'update'|'unchanged'|'skip', reason?, content? }> }`: throws `No such folder: <root>`.
  - `applyPlan(actions): void`.

- [ ] **Step 1: Write the failing tests**

In `test/install.test.mjs`, replace the import block at the top with:

```js
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { AGENT_IDS, BODY, END, MANAGED, START, applyPlan, planInstall, renderSkill, stripBlock, upsertBlock } from '../install.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'page-as-data-install-'))
const put = (root, path, text = '') => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}
const read = (root, path) => readFileSync(join(root, path), 'utf8')
// A fake home inside the temp folder, so no test can touch the real ~/.claude.
const plan = (root, opts = {}) => planInstall({ root, home: join(root, 'fake-home'), ...opts })
const summary = (p) => p.actions.map((a) => `${a.agent}:${a.action}`)
```

Append at the end of the file:

```js
describe('planInstall', () => {
  it('installs for each agent the project already uses, and only those', () => {
    const markers = [
      ['CLAUDE.md', 'claude'],
      ['.claude/settings.json', 'claude'],
      ['AGENTS.md', 'agents'],
      ['GEMINI.md', 'gemini'],
      ['.cursor/mcp.json', 'cursor'],
      ['.cursorrules', 'cursor'],
      ['.windsurf/x.md', 'windsurf'],
      ['.windsurfrules', 'windsurf'],
      ['.clinerules/style.md', 'cline'],
      ['.github/copilot-instructions.md', 'copilot'],
      ['.github/instructions/x.instructions.md', 'copilot'],
    ]
    for (const [marker, id] of markers) {
      const root = tmp()
      put(root, marker)
      const p = plan(root)
      assert.deepEqual(p.ids, [id], marker)
      assert.equal(p.fallback, false, marker)
    }
  })

  it('does not take a .github folder with only workflows for Copilot', () => {
    const root = tmp()
    put(root, '.github/workflows/test.yml')
    assert.equal(plan(root).fallback, true)
  })

  it('falls back to Claude Code and AGENTS.md when the project has no agent files', () => {
    const p = plan(tmp())
    assert.equal(p.fallback, true)
    assert.deepEqual(summary(p), ['claude:create', 'agents:create'])
  })

  it('installs for every agent with "all", and rejects an unknown one', () => {
    assert.deepEqual(plan(tmp(), { agents: ['all'] }).ids, AGENT_IDS)
    assert.throws(() => plan(tmp(), { agents: ['claude', 'vim'] }), /Unknown agent "vim"/)
  })

  it('writes each agent file in its own format', () => {
    const root = tmp()
    applyPlan(plan(root, { agents: ['all'] }).actions)
    assert.equal(read(root, '.claude/skills/page-as-data/SKILL.md'), renderSkill())
    assert.match(read(root, '.cursor/rules/page-as-data.mdc'), /^---\ndescription: ".+"\nalwaysApply: false\n---\n/)
    assert.match(read(root, '.windsurf/rules/page-as-data.md'), /^---\ntrigger: model_decision\ndescription: ".+"\n---\n/)
    assert.match(read(root, '.github/instructions/page-as-data.instructions.md'), /^---\napplyTo: "\*\*"\n---\n/)
    assert.ok(read(root, '.clinerules/page-as-data.md').startsWith(`<!-- ${MANAGED}`))
    for (const f of ['AGENTS.md', 'GEMINI.md']) assert.equal(read(root, f), `${START}\n${BODY}\n${END}\n`)
  })

  it('changes nothing on a second run', () => {
    const root = tmp()
    applyPlan(plan(root, { agents: ['all'] }).actions)
    assert.ok(plan(root, { agents: ['all'] }).actions.every((a) => a.action === 'unchanged'))
  })

  it('updates its own old block in a CRLF AGENTS.md and keeps the user text around it byte for byte', () => {
    const root = tmp()
    put(root, 'AGENTS.md', `# Ours\r\n\r\n${START}\nold text\n${END}\r\n\r\n## Theirs\r\n`)
    const p = plan(root)
    assert.deepEqual(summary(p), ['agents:update'])
    applyPlan(p.actions)
    assert.equal(read(root, 'AGENTS.md'), `# Ours\r\n\r\n${START}\n${BODY}\n${END}\r\n\r\n## Theirs\r\n`)
  })

  it('skips a half-marked AGENTS.md instead of adding a second block', () => {
    const root = tmp()
    put(root, 'AGENTS.md', `x\n${START}\n`)
    const p = plan(root)
    assert.deepEqual(summary(p), ['agents:skip'])
    assert.match(p.actions[0].reason, /fix it by hand/)
  })

  it('skips a same-named file it did not write, and replaces it only with force', () => {
    const root = tmp()
    put(root, '.cursor/rules/page-as-data.mdc', 'my own rule\n')
    const p = plan(root)
    assert.deepEqual(summary(p), ['cursor:skip'])
    assert.match(p.actions[0].reason, /--force/)
    applyPlan(p.actions)
    assert.equal(read(root, '.cursor/rules/page-as-data.mdc'), 'my own rule\n')
    assert.deepEqual(summary(plan(root, { force: true })), ['cursor:update'])
  })

  it('updates a file it wrote earlier, even when the body has changed since', () => {
    const root = tmp()
    put(root, '.cursor/rules/page-as-data.mdc', `old body\n<!-- ${MANAGED} -->\n`)
    assert.deepEqual(summary(plan(root)), ['cursor:update'])
  })

  it('writes a marked block into .clinerules when it is a single file', () => {
    const root = tmp()
    put(root, '.clinerules', 'Use tabs.\n')
    applyPlan(plan(root).actions)
    assert.equal(read(root, '.clinerules'), `Use tabs.\n\n${START}\n${BODY}\n${END}\n`)
  })

  it('installs the Claude Code skill under home with global, not in the project', () => {
    const root = tmp()
    const home = join(root, 'fake-home')
    const p = planInstall({ root, home, global: true })
    assert.deepEqual(summary(p), ['claude:create'])
    applyPlan(p.actions)
    assert.ok(existsSync(join(home, '.claude/skills/page-as-data/SKILL.md')))
    assert.ok(!existsSync(join(root, '.claude')))
  })

  it('refuses a project folder that does not exist, and creates nothing', () => {
    const missing = join(tmp(), 'nope')
    assert.throws(() => plan(missing), /No such folder/)
    assert.ok(!existsSync(missing))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/install.test.mjs`
Expected: FAIL with `SyntaxError: The requested module '../install.mjs' does not provide an export named 'AGENT_IDS'`.

- [ ] **Step 3: Write the implementation**

In `install.mjs`, replace `import { readFileSync } from 'node:fs'` with:

```js
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
```

Append to the end of `install.mjs`:

```js
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

const BROKEN = `has a page-as-data marker without its pair (${START} … ${END}); fix it by hand, then run again`

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

/** Carries out a plan from planInstall or planUninstall. The only function here that writes. */
export function applyPlan(actions) {
  for (const a of actions) {
    if (a.action === 'create' || a.action === 'update' || a.action === 'strip-block') {
      mkdirSync(dirname(a.path), { recursive: true })
      writeFileSync(a.path, a.content)
    } else if (a.action === 'remove') {
      rmSync(a.path)
      // The Claude Code skill gets a folder of its own; leave no empty one behind.
      const dir = dirname(a.path)
      if (basename(dir) === 'page-as-data' && readdirSync(dir).length === 0) rmdirSync(dir)
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/install.test.mjs`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add install.mjs test/install.test.mjs
git commit -m "Plan and write the skill file for each agent a project uses"
```

---

### Task 3: `planUninstall`

**Files:**
- Modify: `install.mjs` (insert before `applyPlan`)
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `AGENTS`, `AGENT_IDS`, `selectAgents`, `checkRoot`, `isFile`, `stripBlock`, `BROKEN`, `MANAGED`, `applyPlan` from Tasks 1–2.
- Produces: `planUninstall({ root, agents?, global?, home? }): { ids, actions: Array<{ agent, label, path, action: 'remove'|'strip-block'|'skip', reason?, content? }> }`.

- [ ] **Step 1: Write the failing tests**

In `test/install.test.mjs`, add `planUninstall` to the `../install.mjs` import list. Append:

```js
describe('planUninstall', () => {
  const unplan = (root, opts = {}) => planUninstall({ root, home: join(root, 'fake-home'), ...opts })

  it('removes its own files and only its block, leaving user text and user files', () => {
    const root = tmp()
    put(root, 'AGENTS.md', '# Rules\n\nBe kind.\n')
    put(root, '.cursor/rules/mine.mdc', 'mine\n')
    applyPlan(plan(root).actions)
    const p = unplan(root)
    assert.deepEqual(summary(p), ['agents:strip-block', 'cursor:remove'])
    applyPlan(p.actions)
    assert.equal(read(root, 'AGENTS.md'), '# Rules\n\nBe kind.\n')
    assert.ok(!existsSync(join(root, '.cursor/rules/page-as-data.mdc')))
    assert.equal(read(root, '.cursor/rules/mine.mdc'), 'mine\n')
  })

  it('deletes a shared file that held only its block, and the skill folder it made', () => {
    const root = tmp()
    applyPlan(plan(root).actions) // fallback: Claude Code + AGENTS.md
    applyPlan(unplan(root).actions)
    assert.ok(!existsSync(join(root, 'AGENTS.md')))
    assert.ok(!existsSync(join(root, '.claude/skills/page-as-data')))
    assert.ok(existsSync(join(root, '.claude/skills')))
  })

  it('keeps a file whose page-as-data marker the user removed', () => {
    const root = tmp()
    put(root, '.cursor/rules/page-as-data.mdc', 'rewritten by hand\n')
    const p = unplan(root)
    assert.deepEqual(summary(p), ['cursor:skip'])
    assert.match(p.actions[0].reason, /not written by page-as-data/)
  })

  it('skips a half-marked shared file rather than cut text out of it', () => {
    const root = tmp()
    put(root, 'AGENTS.md', `x\n${START}\n`)
    assert.deepEqual(summary(unplan(root)), ['agents:skip'])
  })

  it('removes the global skill only with global', () => {
    const root = tmp()
    applyPlan(plan(root, { global: true }).actions)
    assert.deepEqual(summary(unplan(root)), [])
    assert.deepEqual(summary(unplan(root, { global: true })), ['claude:remove'])
  })

  it('finds nothing to remove in a project it never touched', () => {
    assert.deepEqual(unplan(tmp()).actions, [])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/install.test.mjs`
Expected: FAIL with `does not provide an export named 'planUninstall'`.

- [ ] **Step 3: Write the implementation**

In `install.mjs`, insert directly above the `/** Carries out a plan ...` comment of `applyPlan`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/install.test.mjs`
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add install.mjs test/install.test.mjs
git commit -m "Remove only what init wrote, with uninstall"
```

---

### Task 4: `init` and `uninstall` commands in the CLI

**Files:**
- Modify: `cli.mjs:1-18` (header comment and imports), `cli.mjs:354` (`HELP`), `cli.mjs:390-420` (`parseArgs`), `cli.mjs:522-535` (`main`), plus a new `installCommand` function above `main`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `planInstall`, `planUninstall`, `applyPlan` from Tasks 2–3.
- Produces: `parseArgs` result gains `agents: string[]` (default `[]`), `global`, `force`, `dryRun` (booleans, default `false`), `dir` (absolute path, default `process.cwd()`). CLI commands `init` and `uninstall`.

- [ ] **Step 1: Write the failing tests**

In `test/install.test.mjs`, add to the imports:

```js
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from '../cli.mjs'
```

(Merge `readdirSync` into the existing `node:fs` import and `resolve` into the existing `node:path` import, rather than adding duplicate lines.)

Append:

```js
const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })

describe('init and uninstall commands', () => {
  it('reads the install options', () => {
    const o = parseArgs(['init', '--agent', 'claude,cursor', '--agent', 'copilot', '--global', '--force', '--dry-run', '--dir', 'x'])
    assert.deepEqual(o.agents, ['claude', 'cursor', 'copilot'])
    assert.ok(o.global && o.force && o.dryRun)
    assert.equal(o.dir, resolve('x'))
    assert.equal(parseArgs(['init']).dir, process.cwd())
  })

  it('shows the plan and writes nothing with --dry-run', () => {
    const root = tmp()
    const r = run('init', '--dry-run', '--dir', root)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /No agent files found/)
    assert.match(r.stdout, /would create \.claude\/skills\/page-as-data\/SKILL\.md \(Claude Code\)/)
    assert.deepEqual(readdirSync(root), [])
  })

  it('installs, reruns as unchanged, then uninstalls', () => {
    const root = tmp()
    assert.match(run('init', '--agent', 'cursor', '--dir', root).stdout, /✔ created \.cursor\/rules\/page-as-data\.mdc \(Cursor\)/)
    assert.match(run('init', '--agent', 'cursor', '--dir', root).stdout, /· unchanged \.cursor\/rules\/page-as-data\.mdc/)
    assert.match(run('uninstall', '--dir', root).stdout, /✔ removed \.cursor\/rules\/page-as-data\.mdc/)
    assert.match(run('uninstall', '--dir', root).stdout, /Nothing to remove/)
  })

  it('exits 2 on an unknown agent, a missing folder or a url, naming the problem', () => {
    const bad = run('init', '--agent', 'vim', '--dir', tmp())
    assert.equal(bad.status, 2)
    assert.match(bad.stderr, /Unknown agent "vim"/)
    const missing = join(tmp(), 'nope')
    const gone = run('init', '--dir', missing)
    assert.equal(gone.status, 2)
    assert.match(gone.stderr, /No such folder/)
    assert.ok(!existsSync(missing))
    assert.equal(run('init', 'http://localhost:3000', '--dir', tmp()).status, 2)
  })

  it('prints the plan as JSON, without file contents', () => {
    const r = JSON.parse(run('init', '--json', '--dry-run', '--dir', tmp()).stdout)
    assert.equal(r.fallback, true)
    assert.deepEqual(r.actions.map((a) => a.action), ['create', 'create'])
    assert.ok(r.actions.every((a) => !('content' in a)))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/install.test.mjs`
Expected: FAIL. `reads the install options` fails with `Unknown option --agent`; the command tests fail on status (HELP printed, exit 2) or on missing output.

- [ ] **Step 3: Update the header comment and imports in `cli.mjs`**

In the top comment, after the `page-as-data check ...` line, add:

```js
 *   page-as-data init      [--agent claude,cursor,...|all] [--global] [--force] [--dry-run] [--dir <path>]
 *   page-as-data uninstall [--agent ...] [--global] [--dry-run] [--dir <path>]
```

Replace the imports:

```js
import { tmpdir } from 'node:os'
import { join } from 'node:path'
```

with:

```js
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
```

and add after the `node:url` import:

```js
import { applyPlan, planInstall, planUninstall } from './install.mjs'
```

- [ ] **Step 4: Extend `HELP`**

In `HELP`, insert before the `  Common` line:

```
  page-as-data init [options]
      Teach the coding agents in this project to use page-as-data instead of
      screenshots. Writes each agent's own skill or rule file; run it again to
      update. Without --agent, it installs for the agents the project uses.

      --agent claude,cursor     claude, agents (AGENTS.md), gemini, cursor,
                                windsurf, cline, copilot, or all
      --global                  Claude Code skill in ~/.claude, for every project
      --force                   replace a same-named file it did not write
      --dry-run                 show what would change; write nothing
      --dir path                project folder (default: the current folder)

  page-as-data uninstall [options]
      Remove what init wrote, and nothing else. Takes --agent, --global,
      --dry-run and --dir.

```

- [ ] **Step 5: Extend `parseArgs`**

In `parseArgs`, replace the `opts` line with:

```js
  const opts = {
    command, urls: [], widths: [390, 1440], width: 1440, steps: [], inspect: [], port: 9222, launch: false, json: false, strict: false, timeoutMs: 15000,
    agents: [], global: false, force: false, dryRun: false, dir: process.cwd(),
  }
```

Insert before `else if (a.startsWith('--')) throw ...`:

```js
    else if (a === '--agent') opts.agents.push(...value(++i, a).split(',').map((s) => s.trim()).filter(Boolean))
    else if (a === '--global') opts.global = true
    else if (a === '--force') opts.force = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--dir') opts.dir = resolve(value(++i, a))
```

- [ ] **Step 6: Add `installCommand` and route to it**

Insert directly above `async function main() {`:

```js
const DONE = { create: 'created', update: 'updated', unchanged: 'unchanged', skip: 'skipped', remove: 'removed', 'strip-block': 'removed its block from' }
const WOULD = { create: 'would create', update: 'would update', unchanged: 'unchanged', skip: 'would skip', remove: 'would remove', 'strip-block': 'would remove its block from' }

/** `init` / `uninstall`: write or remove the agent skill files. */
function installCommand(opts) {
  if (opts.urls.length) throw new Error(`${opts.command} takes no urls; use --dir for another project folder`)
  const home = homedir()
  const plan =
    opts.command === 'init'
      ? planInstall({ root: opts.dir, agents: opts.agents, global: opts.global, force: opts.force, home })
      : planUninstall({ root: opts.dir, agents: opts.agents, global: opts.global, home })
  if (!opts.dryRun) applyPlan(plan.actions)
  if (opts.json) {
    out(JSON.stringify({ ...plan, dryRun: opts.dryRun, actions: plan.actions.map(({ content, ...a }) => a) }, null, 2))
    return 0
  }
  if (plan.fallback) out('No agent files found here, so installing for Claude Code and AGENTS.md. Choose others with --agent.')
  const shown = (p) => {
    const inProject = relative(opts.dir, p)
    if (!inProject.startsWith('..') && !isAbsolute(inProject)) return inProject
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p
  }
  for (const a of plan.actions) {
    const mark = a.action === 'skip' ? '–' : a.action === 'unchanged' ? '·' : '✔'
    out(`${mark} ${(opts.dryRun ? WOULD : DONE)[a.action]} ${shown(a.path)} (${a.label})${a.reason ? `: ${a.reason}` : ''}`)
  }
  if (!plan.actions.length) out(opts.command === 'init' ? 'Nothing to install.' : 'Nothing to remove: no page-as-data files found.')
  return 0
}

```

In `main()`, insert directly after the `parseArgs` try/catch and before `if (!['read', 'check'].includes(opts.command) ...`:

```js
  if (['init', 'uninstall'].includes(opts.command)) {
    try {
      return installCommand(opts)
    } catch (e) {
      console.error(e.message)
      return 2
    }
  }
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS. The install suites pass. The Chrome suites pass too, or are skipped when no Chrome is found.

- [ ] **Step 8: Commit**

```bash
git add cli.mjs test/install.test.mjs
git commit -m "Add init and uninstall commands to the CLI"
```

---

### Task 5: Package rename and Claude Code plugin

**Files:**
- Modify: `package.json`
- Modify: `LICENSE:3`
- Create: `scripts/build-plugin.mjs`
- Create: `.claude-plugin/marketplace.json`
- Create: `.claude-plugin/plugin.json`
- Create (generated): `skills/page-as-data/SKILL.md`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `renderSkill()` from Task 1.
- Produces: `npm run build:skill`, and an npm `version` lifecycle script that keeps `.claude-plugin/plugin.json` and `skills/page-as-data/SKILL.md` in step with `package.json`.

- [ ] **Step 1: Write the failing tests**

Append to `test/install.test.mjs`:

```js
describe('Claude Code plugin', () => {
  const repo = new URL('../', import.meta.url)
  const json = (p) => JSON.parse(readFileSync(new URL(p, repo), 'utf8'))

  it('carries the same skill text as init (run npm run build:skill after editing skill/)', () => {
    assert.equal(readFileSync(new URL('skills/page-as-data/SKILL.md', repo), 'utf8'), renderSkill())
  })

  it('has the same version as the npm package', () => {
    assert.equal(json('.claude-plugin/plugin.json').version, json('package.json').version)
  })

  it('lists this repo as the one plugin in the marketplace', () => {
    const m = json('.claude-plugin/marketplace.json')
    assert.equal(m.name, 'page-as-data')
    assert.deepEqual(m.plugins.map((p) => [p.name, p.source]), [['page-as-data', './']])
  })

  it('publishes the skill body with the npm package', () => {
    const pkg = json('package.json')
    assert.equal(pkg.name, '@rajaaltus/page-as-data')
    for (const f of ['install.mjs', 'skill/']) assert.ok(pkg.files.includes(f), f)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/install.test.mjs`
Expected: FAIL with `ENOENT` for `skills/page-as-data/SKILL.md` and `.claude-plugin/*.json`, and a wrong package name.

- [ ] **Step 3: Write the plugin manifests**

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "page-as-data",
  "owner": { "name": "rajaaltus" },
  "plugins": [
    {
      "name": "page-as-data",
      "source": "./",
      "description": "Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths."
    }
  ]
}
```

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "page-as-data",
  "version": "0.1.0",
  "description": "Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths.",
  "author": { "name": "rajaaltus" },
  "repository": "https://github.com/rajaaltus/page-as-data",
  "license": "MIT"
}
```

- [ ] **Step 4: Write the build script**

Create `scripts/build-plugin.mjs`:

```js
// Copies the skill and the version from the npm package into the Claude Code
// plugin, so /plugin install and `npx ... init` always carry the same text.
// Run by `npm run build:skill`, and by `npm version` before it commits.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { renderSkill } from '../install.mjs'

const repo = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', repo), 'utf8'))
const pluginFile = new URL('.claude-plugin/plugin.json', repo)
const plugin = JSON.parse(readFileSync(pluginFile, 'utf8'))
writeFileSync(pluginFile, `${JSON.stringify({ ...plugin, version: pkg.version }, null, 2)}\n`)
mkdirSync(new URL('skills/page-as-data/', repo), { recursive: true })
writeFileSync(new URL('skills/page-as-data/SKILL.md', repo), renderSkill())
```

- [ ] **Step 5: Update `package.json`**

Replace the whole file with:

```json
{
  "name": "@rajaaltus/page-as-data",
  "version": "0.1.0",
  "description": "Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths. For developers and AI coding agents; installs itself as a skill for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline and Copilot.",
  "type": "module",
  "bin": {
    "page-as-data": "cli.mjs"
  },
  "exports": {
    ".": "./cli.mjs",
    "./in-page": "./page-as-data.js",
    "./install": "./install.mjs"
  },
  "files": [
    "cli.mjs",
    "page-as-data.js",
    "install.mjs",
    "skill/"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "node --test \"test/*.test.mjs\"",
    "build:skill": "node scripts/build-plugin.mjs",
    "version": "node scripts/build-plugin.mjs && git add .claude-plugin/plugin.json skills/page-as-data/SKILL.md"
  },
  "keywords": [
    "debugging",
    "screenshot",
    "chrome-devtools-protocol",
    "layout",
    "responsive",
    "accessibility",
    "wcag",
    "ai-agent",
    "llm",
    "agent-skill",
    "claude-code",
    "codex",
    "cursor",
    "copilot",
    "nextjs",
    "react"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/rajaaltus/page-as-data.git"
  },
  "bugs": {
    "url": "https://github.com/rajaaltus/page-as-data/issues"
  },
  "homepage": "https://github.com/rajaaltus/page-as-data#readme",
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "license": "MIT",
  "author": "rajaaltus",
  "contributors": [
    "gjohnpaull"
  ]
}
```

- [ ] **Step 6: Update `LICENSE`**

Replace the line `Copyright (c) 2026 gjohnpaull` with:

```
Copyright (c) 2026 gjohnpaull
Copyright (c) 2026 rajaaltus
```

- [ ] **Step 7: Generate the plugin skill and run the tests**

Run: `npm run build:skill && node --test test/install.test.mjs`
Expected: `skills/page-as-data/SKILL.md` created; all install tests PASS.

- [ ] **Step 8: Check what npm would publish**

Run: `npm pack --dry-run 2>&1 | grep -E "cli.mjs|install.mjs|page-as-data.js|skill/|LICENSE|README|package.json|total files"`
Expected: `cli.mjs`, `install.mjs`, `page-as-data.js`, `skill/page-as-data.md`, `LICENSE`, `README.md`, `package.json`; no `test/`, `scripts/`, `skills/` or `.claude-plugin/`.

- [ ] **Step 9: Commit**

```bash
git add package.json LICENSE scripts/build-plugin.mjs .claude-plugin/marketplace.json .claude-plugin/plugin.json skills/page-as-data/SKILL.md test/install.test.mjs
git commit -m "Publish as @rajaaltus/page-as-data and as a Claude Code plugin"
```

---

### Task 6: Release workflow and docs

**Files:**
- Create: `.github/workflows/publish.yml`
- Modify: `README.md`
- Modify: `CLAUDE.md` (untracked until now; this task commits it)

**Interfaces:**
- Consumes: `npm test`, the `version` script from Task 5, the `init` / `uninstall` flags from Task 4.
- Produces: tag-triggered npm publish; user docs.

- [ ] **Step 1: Write the publish workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: publish

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write # npm provenance

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      # ubuntu-latest ships Google Chrome at /usr/bin/google-chrome.
      - run: npm test
      - name: Tag matches package.json version
        run: test "v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Check the workflow parses**

Run: `node -e "const s=require('fs').readFileSync('.github/workflows/publish.yml','utf8'); if(!/id-token: write/.test(s)||!/npm publish/.test(s)) process.exit(1); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Rename the package in the README**

In `README.md`, make these exact replacements (use the Edit tool; `replace_all` where noted):

- `npx page-as-data` → `npx @rajaaltus/page-as-data` (replace_all)
- `npm install --save-dev page-as-data   # or run it once with npx` → `npm install --save-dev @rajaaltus/page-as-data   # or run it once with npx`
- `resolve('page-as-data/in-page')` → `resolve('@rajaaltus/page-as-data/in-page')`
- `import { readPage, checkPages } from 'page-as-data'` → `import { readPage, checkPages } from '@rajaaltus/page-as-data'`
- Delete this paragraph and the blank line after it:

```
Until the package is on npm, clone this repository and run `node cli.mjs` in
place of `npx page-as-data`.
```

(Delete it before the `replace_all` step, or delete its already-renamed form.)

- [ ] **Step 4: Replace the "For AI coding agents" section**

In `README.md`, replace everything from the heading `## For AI coding agents` up to (not including) `## Use it inside your own browser tooling` with:

````markdown
## Install as an agent skill

One command teaches the coding agents in a project to read screens with
`page-as-data` instead of taking screenshots:

```sh
npx @rajaaltus/page-as-data init
```

It finds the agents the project already uses and writes each one's own file:

| Agent | File |
| --- | --- |
| Claude Code | `.claude/skills/page-as-data/SKILL.md` |
| Codex, opencode, Amp and other `AGENTS.md` readers | a block in `AGENTS.md` |
| Gemini CLI | a block in `GEMINI.md` |
| Cursor | `.cursor/rules/page-as-data.mdc` |
| Windsurf | `.windsurf/rules/page-as-data.md` |
| Cline | `.clinerules/page-as-data.md` (a block, when `.clinerules` is one file) |
| GitHub Copilot | `.github/instructions/page-as-data.instructions.md` |

When it finds none, it installs for Claude Code and `AGENTS.md`. Run it again
to update. It changes only what it wrote: in `AGENTS.md` and `GEMINI.md`, only
the text between `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`.

| Option | What it does |
| --- | --- |
| `--agent claude,cursor` | Choose agents: `claude`, `agents`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot`, or `all`. |
| `--global` | Install the Claude Code skill for every project, in `~/.claude/skills`. |
| `--force` | Replace a same-named file that page-as-data did not write. |
| `--dry-run` | Show what would change, and write nothing. |
| `--dir path` | The project folder. Default: the current folder. |

`npx @rajaaltus/page-as-data uninstall` removes what `init` wrote, and nothing else.

### As a Claude Code plugin

```text
/plugin marketplace add rajaaltus/page-as-data
/plugin install page-as-data@page-as-data
```

````

- [ ] **Step 5: Extend the README "Develop" section**

In `README.md`, replace:

````markdown
```sh
npm test    # runs the CLI against test/fixture.html in a headless Chrome
```
````

with:

````markdown
```sh
npm test              # the CLI against test/fixture.html in a headless Chrome, and init/uninstall in temp folders
npm run build:skill   # after editing skill/page-as-data.md: refresh the Claude Code plugin copy
```

To release, bump the version and push the tag. The publish workflow runs the
tests, then publishes to npm with provenance. It needs an `NPM_TOKEN`
repository secret (or npm trusted publishing set up for this repository).

```sh
npm version patch        # also updates .claude-plugin/plugin.json and the plugin's SKILL.md
git push --follow-tags
```
````

- [ ] **Step 6: Update `CLAUDE.md`**

In `CLAUDE.md`:

Replace the first paragraph under `## What this is` with:

```markdown
`page-as-data` reads a rendered web page as text/JSON instead of a screenshot: what is on screen, what broke behind it (exceptions, failed requests, broken images), and layout defects at phone and desktop widths. It is a CLI plus an injectable in-page script, published as `@rajaaltus/page-as-data` (a fork of `gjohnpaull/page-as-data`). `init` installs it as a skill for coding agents, and the repo is also a Claude Code plugin marketplace. Zero runtime dependencies, Node 22+, and a Chrome-family browser (Chrome DevTools Protocol only).
```

In the `## Commands` code block, add these lines after the `check` line:

```sh
node cli.mjs init --dry-run                           # what init would write in this folder
npm run build:skill                                   # regenerate skills/page-as-data/SKILL.md after editing skill/
```

After the `### Settling` section, add:

```markdown
### Agent skill installer

`install.mjs` is separate from the Chrome code. `skill/page-as-data.md` is the only source of the skill text. `AGENTS` in `install.mjs` maps each agent id to a detection marker, a target path and a format. Owned files carry `page-as-data:managed`. Shared files (`AGENTS.md`, `GEMINI.md`, a single-file `.clinerules`) get a block between `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`. `planInstall` / `planUninstall` only read the disk; `applyPlan` is the only writer, so `--dry-run` shows the exact plan. `cli.mjs` sends `init` / `uninstall` there before any Chrome code runs.

`skills/page-as-data/SKILL.md` and `.claude-plugin/plugin.json` are generated by `scripts/build-plugin.mjs`. Tests fail when they drift from `renderSkill()` or `package.json`.

### Release

`npm version <patch|minor|major>` (its `version` script regenerates the plugin files), then `git push --follow-tags`. `.github/workflows/publish.yml` runs on `v*` tags: tests, checks that the tag matches `package.json`, then runs `npm publish` with provenance (needs the `NPM_TOKEN` secret). `provenance: true` means a local `npm publish` fails; publish from CI.
```

In `## Tests`, add at the end:

```markdown
`test/install.test.mjs` needs no Chrome. It works in temp folders and passes a fake `home`, so it never touches the real `~/.claude`.
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/publish.yml README.md CLAUDE.md
git commit -m "Publish from CI on tags; document init, the plugin and releases"
```

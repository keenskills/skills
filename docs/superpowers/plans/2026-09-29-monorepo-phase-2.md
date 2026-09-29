# Keen Skills monorepo, phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the diagram skill the same one-command install as `page-as-data`: publish `@keenskills/drawing-architecture-diagrams` 0.1.0 with `init` / `uninstall` / `doctor`, list it as its own plugin in the `keenskills` marketplace, and share one installer between both packages without cross-package imports.

**Architecture:** The diagram package moves its skill into `skills/drawing-architecture-diagrams/` (the folder Claude Code plugins, `init` and Agent Skills tools all read). The installer from `page-as-data` becomes `shared/skill-installer.mjs`, a factory parameterised by skill and able to install support files (scripts, references). `scripts/sync-shared.mjs` copies it into each package's `lib/`, and a root test fails when a copy drifts, so packages stay independent and dependency-free at runtime. The diagram CLI is small: `node:util` `parseArgs`, the shared installer, and a `doctor` that asks `archdiagram.py` itself where Python and draw.io are.

**Tech Stack:** Node 22+ (`node:test`, `node:util.parseArgs`), Python 3.9+, pnpm 11 workspaces, GitHub Actions, npm provenance.

**Spec:** `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md` (phase 2 of 5: "Diagram skill distribution"). Phase 1 plan: `docs/superpowers/plans/2026-09-29-monorepo-phase-1.md`.

## Global Constraints

- Repo `keenskills/skills`, local path `/Users/rajas/projects/next/skills`. All paths below are relative to it.
- New package `@keenskills/drawing-architecture-diagrams`, first version `0.1.0`, bin `drawing-architecture-diagrams`, plugin `drawing-architecture-diagrams@keenskills`.
- Both npm packages: Node `>=22`, zero runtime dependencies, no imports across `packages/`. Shared code lives in `shared/` and is vendored into `packages/*/lib/` by `pnpm sync`.
- The two skills stay separate products: own package, plugin, version, changelog and docs.
- Diagram scripts need Python 3.9+; draw.io desktop is needed only for PNG/PDF export.
- Diagram CLI exit codes: `0` done, `2` could not run (bad option, unknown agent, missing folder, no Python 3.9+). It never finds "problems", so it never exits `1`.
- ES modules, no semicolons, single quotes, 2-space indent. Comments explain why. User-facing messages are plain English that name the file and the cause.
- LF line endings. Fictional names only in examples (Northwind Traders, Contoso).
- Tests never touch the real `~/.claude`: pass a fake `home`, and set `HOME` to a temp folder when spawning a CLI.
- Release tags are annotated: `git tag -a <package>@v<version> -m "<package> <version>"`, then `git push --follow-tags`.
- Outward-facing steps (pushing tags, publishing) happen only after the user confirms at that step.

## Review Focus

1. `uninstall` must never delete a file the user added inside an installed skill folder, nor the folders holding it. Pinned in Task 3.
2. Re-running `init` after an upgrade must update changed support files (a new `archdiagram.py`) and leave unchanged ones. Pinned in Task 3.
3. A skill folder whose `SKILL.md` the user wrote must be left completely alone (`SKILL.md` and every support file) unless `--force`. Pinned in Task 3.
4. `npx` runs the CLI from the npm cache with the current folder somewhere else: support files must be read relative to the package, never the current folder. Pinned in Task 5.
5. The published tarball must carry every file the installer copies and no Python caches (`__pycache__`, `.pyc`) left by the selftest. Pinned in Task 5.

---

## Task 1: Skill folder layout for the diagram package

**Files:**
- Move: `packages/drawing-architecture-diagrams/{SKILL.md,scripts/,references/,examples/}` to `packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams/`
- Modify: `packages/drawing-architecture-diagrams/tests/selftest.py:9-10,22`
- Modify: `packages/page-as-data/docs/diagram/how-it-helps.py:12`

**Interfaces:**
- Produces: skill folder `packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams/` holding `SKILL.md`, `scripts/archdiagram.py`, `references/icons.md`, `examples/event_driven_platform_a4.py`. Tasks 2, 5 and 6 rely on this path.

- [ ] **Step 1: Move the skill files**

```bash
cd packages/drawing-architecture-diagrams
mkdir -p skills/drawing-architecture-diagrams
git mv SKILL.md scripts references examples skills/drawing-architecture-diagrams/
```

- [ ] **Step 2: Run the selftest to see it fail**

Run: `python3 tests/selftest.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'archdiagram'`.

- [ ] **Step 3: Point the selftest at the skill folder**

In `tests/selftest.py` replace

```python
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
```

with

```python
ROOT = Path(__file__).resolve().parent.parent / "skills" / "drawing-architecture-diagrams"
sys.path.insert(0, str(ROOT / "scripts"))
```

(Line 22 already uses `ROOT / "examples" / ...`, which now resolves inside the skill folder.)

- [ ] **Step 4: Run the selftest to see it pass**

Run: `python3 tests/selftest.py`
Expected: only `PASS` lines, exit 0.

- [ ] **Step 5: Let the page-as-data docs diagram find the moved scripts**

In `packages/page-as-data/docs/diagram/how-it-helps.py` replace the `for cand in (...)` line with:

```python
# In this monorepo the diagram skill sits next to this package; elsewhere, use the installed skill.
_SIBLING = Path(__file__).resolve().parents[3] / "drawing-architecture-diagrams" / "skills" / "drawing-architecture-diagrams" / "scripts"
for cand in (os.environ.get("ARCHDIAGRAM_DIR"), _SIBLING, Path.home() / ".claude" / "skills" / "drawing-architecture-diagrams" / "scripts"):
```

Run: `cd ../page-as-data && ARCHDIAGRAM_DIR= python3 docs/diagram/how-it-helps.py /tmp/claude-501/hih.drawio`
Expected: `saved /tmp/claude-501/hih.drawio - lint: 0 issue(s)`, exit 0.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add -A
git commit -m "Move the diagram skill into skills/drawing-architecture-diagrams"
```

---

## Task 2: The example finds archdiagram.py wherever the skill is installed

**Files:**
- Modify: `packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams/examples/event_driven_platform_a4.py:14-20`
- Modify: `packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams/SKILL.md:32-33`
- Test: `packages/drawing-architecture-diagrams/tests/selftest.py`

**Interfaces:**
- Consumes: Task 1 layout.
- Produces: env var `ARCHDIAGRAM_DIR` (same name `how-it-helps.py` already uses) and the search order: `$ARCHDIAGRAM_DIR`, `../scripts` next to the example, `.claude/skills/drawing-architecture-diagrams/scripts` and `.agents/skills/drawing-architecture-diagrams/scripts` in the current folder or any parent, `~/.claude/skills/drawing-architecture-diagrams/scripts`. Task 3's `.agents/skills/<name>/` folder and Task 5's installs rely on it.

- [ ] **Step 1: Write the failing selftest cases**

Append before the final `sys.exit(...)` in `tests/selftest.py`:

```python
# 6. a copy of the example made anywhere still finds archdiagram.py
import os  # noqa: E402
import shutil  # noqa: E402

away = Path(tempfile.mkdtemp())
shutil.copy(ROOT / "examples" / "event_driven_platform_a4.py", away / "build.py")
bare = {k: v for k, v in os.environ.items() if k != "ARCHDIAGRAM_DIR"}
bare["HOME"] = str(away)

r = subprocess.run([sys.executable, "build.py", "out.drawio"], cwd=away, env={**bare, "ARCHDIAGRAM_DIR": str(ROOT / "scripts")}, capture_output=True, text=True)
check("copied example uses ARCHDIAGRAM_DIR", r.returncode == 0 and "lint: 0 issue" in r.stdout)

proj = Path(tempfile.mkdtemp())
shutil.copytree(ROOT / "scripts", proj / ".agents" / "skills" / "drawing-architecture-diagrams" / "scripts")
(proj / "docs").mkdir()
shutil.copy(away / "build.py", proj / "docs" / "build.py")
r = subprocess.run([sys.executable, "build.py", "out.drawio"], cwd=proj / "docs", env=bare, capture_output=True, text=True)
check("copied example finds .agents/skills in a parent folder", r.returncode == 0)

r = subprocess.run([sys.executable, "build.py", "out.drawio"], cwd=away, env=bare, capture_output=True, text=True)
check("copied example says how to fix a missing archdiagram.py", r.returncode != 0 and "ARCHDIAGRAM_DIR" in r.stderr)
```

- [ ] **Step 2: Run to see the new cases fail**

Run: `python3 packages/drawing-architecture-diagrams/tests/selftest.py`
Expected: `FAIL copied example uses ARCHDIAGRAM_DIR`, `FAIL copied example finds .agents/skills in a parent folder`, `FAIL copied example says how to fix a missing archdiagram.py`; exit 1.

- [ ] **Step 3: Replace the import fallback in the example**

In `examples/event_driven_platform_a4.py` replace

```python
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if not (_SCRIPTS / "archdiagram.py").exists():          # copied elsewhere: use the installed skill
    _SCRIPTS = Path.home() / ".claude" / "skills" / "drawing-architecture-diagrams" / "scripts"
sys.path.insert(0, str(_SCRIPTS))
```

with

```python
import os
import sys
from pathlib import Path


def _find_scripts() -> Path:
    """archdiagram.py sits next to this example in the skill folder. A copy made in a project looks where
    `init` and Claude Code install the skill: .claude/skills or .agents/skills in this folder or a parent,
    then ~/.claude/skills. A plugin install lives elsewhere, so ARCHDIAGRAM_DIR wins over all of them."""
    name = "drawing-architecture-diagrams"
    found = [Path(os.environ["ARCHDIAGRAM_DIR"])] if os.environ.get("ARCHDIAGRAM_DIR") else []
    found.append(Path(__file__).resolve().parent.parent / "scripts")
    for base in (Path.cwd(), *Path.cwd().parents):
        found += [base / ".claude" / "skills" / name / "scripts", base / ".agents" / "skills" / name / "scripts"]
    found.append(Path.home() / ".claude" / "skills" / name / "scripts")
    for cand in found:
        if (cand / "archdiagram.py").exists():
            return cand
    sys.exit(f"archdiagram.py not found. Set ARCHDIAGRAM_DIR to the scripts folder of the {name} skill.")


sys.path.insert(0, str(_find_scripts()))
```

- [ ] **Step 4: Run to see everything pass**

Run: `python3 packages/drawing-architecture-diagrams/tests/selftest.py`
Expected: only `PASS` lines (13 of them), exit 0.

- [ ] **Step 5: Say so in SKILL.md**

In `skills/drawing-architecture-diagrams/SKILL.md` Workflow step 3, replace

```
copy `examples/event_driven_platform_a4.py` (its import falls back
   to `~/.claude/skills/drawing-architecture-diagrams/scripts`, so a copy runs anywhere).
```

with

```
copy `examples/event_driven_platform_a4.py` (a copy finds `scripts/`
   in `.claude/skills` or `.agents/skills` of the project or a parent folder, or in `~/.claude/skills`; otherwise set
   `ARCHDIAGRAM_DIR=<this skill's folder>/scripts`).
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Let a copied diagram example find archdiagram.py wherever the skill is installed"
```

---

## Task 3: Shared skill installer with support files

**Files:**
- Create: `shared/skill-installer.mjs`
- Create: `scripts/sync-shared.mjs`
- Create: `test/skill-installer.test.mjs`
- Create: `test/sync-shared.test.mjs`
- Modify: `package.json` (add `sync` script)

**Interfaces:**
- Produces: `createInstaller({ name, pkg, source, description, body, files = [] })` where `files` is `[{ rel: 'scripts/x.py', content: string }]`. Returns `{ BODY, DESCRIPTION, MANAGED, START, END, owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain, upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan }` with the same signatures as `packages/page-as-data/install.mjs` today. Plan actions: `{ agent, label, path, action, content?, reason?, prune? }`; `agent` is an agent id or `'folder'` for `.agents/skills/<name>/`. Constant `FOLDER_ROOT = '.agents/skills'` (joined per platform).
- Produces: `scripts/sync-shared.mjs` exporting `TARGETS` (`['packages/page-as-data', 'packages/drawing-architecture-diagrams']`) and `vendored(): string` (header + shared source); run as a script it writes `<target>/lib/skill-installer.mjs`. Root script `pnpm sync`.

- [ ] **Step 1: Write the failing installer tests** `test/skill-installer.test.mjs`

```js
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createInstaller } from '../shared/skill-installer.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'installer-'))
const tail = (p) => p.split(/[\\/]/).slice(-2).join('/')
const summary = (p) => p.actions.map((a) => `${a.agent}:${a.action}:${tail(a.path)}`)
const actions = (p) => p.actions.map((a) => a.action)
const FILES = [{ rel: 'scripts/tool.py', content: 'print(1)\n' }, { rel: 'references/notes.md', content: '# notes\n' }]
const demo = (files = FILES) =>
  createInstaller({ name: 'demo', pkg: '@keenskills/demo', source: 'SKILL.md', description: 'Demo: a skill with files.', body: '# Demo\n\nRun scripts/tool.py.', files })
const skillDir = (base) => join(base, '.claude', 'skills', 'demo')

describe('a skill without files', () => {
  const plain = demo([])

  it('keeps the body as is in shared files', () => {
    assert.equal(plain.block(), '<!-- demo:start -->\n# Demo\n\nRun scripts/tool.py.\n<!-- demo:end -->')
  })

  it('writes no skill-files folder for single-file agents', () => {
    assert.deepEqual(summary(plain.planInstall({ root: tmp(), agents: ['cursor'], home: tmp() })), ['cursor:create:rules/demo.mdc'])
  })
})

describe('a skill with files', () => {
  it('puts the files next to SKILL.md for Claude Code', () => {
    const root = tmp()
    const i = demo()
    i.applyPlan(i.planInstall({ root, agents: ['claude'], home: tmp() }).actions)
    assert.match(readFileSync(join(skillDir(root), 'SKILL.md'), 'utf8'), /^---\nname: demo\n/)
    assert.equal(readFileSync(join(skillDir(root), 'scripts', 'tool.py'), 'utf8'), 'print(1)\n')
    assert.equal(readFileSync(join(skillDir(root), 'references', 'notes.md'), 'utf8'), '# notes\n')
  })

  it('installs into the home folder with --global', () => {
    const home = tmp()
    const i = demo()
    i.applyPlan(i.planInstall({ root: tmp(), global: true, home }).actions)
    assert.ok(existsSync(join(skillDir(home), 'scripts', 'tool.py')))
  })

  it('tells single-file agents where the files are, and puts them there', () => {
    const root = tmp()
    const i = demo()
    const p = i.planInstall({ root, agents: ['cursor'], home: tmp() })
    assert.deepEqual(summary(p), ['cursor:create:rules/demo.mdc', 'folder:create:demo/SKILL.md', 'folder:create:scripts/tool.py', 'folder:create:references/notes.md'])
    i.applyPlan(p.actions)
    assert.match(readFileSync(join(root, '.cursor', 'rules', 'demo.mdc'), 'utf8'), /The files this skill uses \(scripts\/tool\.py, references\/notes\.md\) are in `\.agents\/skills\/demo\/`/)
    assert.ok(existsSync(join(root, '.agents', 'skills', 'demo', 'scripts', 'tool.py')))
  })

  it('updates a changed file on the next init and leaves the rest', () => {
    const root = tmp()
    demo().applyPlan(demo().planInstall({ root, agents: ['claude'], home: tmp() }).actions)
    const next = demo([{ rel: 'scripts/tool.py', content: 'print(2)\n' }, FILES[1]])
    assert.deepEqual(summary(next.planInstall({ root, agents: ['claude'], home: tmp() })), [
      'claude:unchanged:demo/SKILL.md',
      'claude:update:scripts/tool.py',
      'claude:unchanged:references/notes.md',
    ])
  })

  it('leaves a skill folder someone else wrote alone, file by file, unless forced', () => {
    const root = tmp()
    mkdirSync(join(skillDir(root), 'scripts'), { recursive: true })
    writeFileSync(join(skillDir(root), 'SKILL.md'), '# mine\n')
    writeFileSync(join(skillDir(root), 'scripts', 'tool.py'), 'mine\n')
    const i = demo()
    assert.deepEqual(actions(i.planInstall({ root, agents: ['claude'], home: tmp() })), ['skip', 'skip', 'skip'])
    assert.deepEqual(actions(i.planInstall({ root, agents: ['claude'], home: tmp(), force: true })), ['update', 'update', 'create'])
  })

  it('does not overwrite a file already in a folder it is creating', () => {
    const root = tmp()
    mkdirSync(join(skillDir(root), 'scripts'), { recursive: true })
    writeFileSync(join(skillDir(root), 'scripts', 'tool.py'), 'mine\n')
    assert.deepEqual(actions(demo().planInstall({ root, agents: ['claude'], home: tmp() })), ['create', 'skip', 'create'])
  })
})

describe('uninstalling a skill with files', () => {
  it('removes its files and folders, and nothing else', () => {
    const root = tmp()
    const i = demo()
    i.applyPlan(i.planInstall({ root, agents: ['claude', 'cursor'], home: tmp() }).actions)
    i.applyPlan(i.planUninstall({ root, home: tmp() }).actions)
    assert.equal(existsSync(skillDir(root)), false)
    assert.equal(existsSync(join(root, '.agents', 'skills', 'demo')), false)
    assert.equal(existsSync(join(root, '.cursor', 'rules', 'demo.mdc')), false)
    assert.ok(existsSync(root))
  })

  it('keeps a file the user added, and the folders that hold it', () => {
    const root = tmp()
    const i = demo()
    i.applyPlan(i.planInstall({ root, agents: ['claude'], home: tmp() }).actions)
    writeFileSync(join(skillDir(root), 'scripts', 'mine.py'), 'mine\n')
    i.applyPlan(i.planUninstall({ root, home: tmp() }).actions)
    assert.deepEqual(readdirSync(skillDir(root)), ['scripts'])
    assert.deepEqual(readdirSync(join(skillDir(root), 'scripts')), ['mine.py'])
  })

  it('touches nothing in a folder whose SKILL.md it did not write', () => {
    const root = tmp()
    mkdirSync(join(skillDir(root), 'scripts'), { recursive: true })
    writeFileSync(join(skillDir(root), 'SKILL.md'), '# mine\n')
    writeFileSync(join(skillDir(root), 'scripts', 'tool.py'), 'print(1)\n')
    assert.deepEqual(summary(demo().planUninstall({ root, home: tmp() })), ['claude:skip:demo/SKILL.md'])
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm test:repo`
Expected: FAIL, `Cannot find module .../shared/skill-installer.mjs`.

- [ ] **Step 3: Write `shared/skill-installer.mjs`**

```js
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
    return [skill, ...supportFiles(dir, skill, base, force)]
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
    if (needsFolder(ids)) actions.push(...removeFolder(join(root, folder), { agent: 'folder', label: 'skill files' }))
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
```

Note for the implementer: action objects no longer carry `path` in `base` before the path is known; every pushed action has `path`. Keep the property order `agent, label, path` so `--json` output reads the same as before.

- [ ] **Step 4: Run to see the installer tests pass**

Run: `pnpm test:repo`
Expected: PASS for every `skill-installer` test and the phase 1 tests.

- [ ] **Step 5: Write the failing sync test** `test/sync-shared.test.mjs`

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { TARGETS, vendored } from '../scripts/sync-shared.mjs'

const root = new URL('../', import.meta.url)

// Packages cannot import from each other or from shared/ at runtime (each is
// published alone), so each carries a copy; a stale copy would ship old code.
describe('vendored shared code', () => {
  for (const t of TARGETS) {
    it(`${t} carries the current shared installer (run pnpm sync after editing shared/)`, () => {
      assert.equal(readFileSync(new URL(`${t}/lib/skill-installer.mjs`, root), 'utf8'), vendored())
    })
  }
})
```

Run: `pnpm test:repo`
Expected: FAIL, `Cannot find module .../scripts/sync-shared.mjs`.

- [ ] **Step 6: Write `scripts/sync-shared.mjs`**

```js
// Copies shared/skill-installer.mjs into every package that installs a skill.
// Each package is published alone and stays dependency-free, so it ships its
// own copy of the one source; test/sync-shared.test.mjs catches a stale copy.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TARGETS = ['packages/page-as-data', 'packages/drawing-architecture-diagrams']
const HEADER = '// Generated from shared/skill-installer.mjs by scripts/sync-shared.mjs. Edit that file, then run pnpm sync.\n'
const root = new URL('../', import.meta.url)

export const vendored = () => HEADER + readFileSync(new URL('shared/skill-installer.mjs', root), 'utf8')

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  for (const t of TARGETS) {
    mkdirSync(new URL(`${t}/lib/`, root), { recursive: true })
    writeFileSync(new URL(`${t}/lib/skill-installer.mjs`, root), vendored())
    console.log(`wrote ${t}/lib/skill-installer.mjs`)
  }
}
```

In root `package.json` add to `scripts`: `"sync": "node scripts/sync-shared.mjs"`.

- [ ] **Step 7: Sync and see everything pass**

Run: `pnpm sync && pnpm test:repo`
Expected: `wrote packages/page-as-data/lib/skill-installer.mjs`, `wrote packages/drawing-architecture-diagrams/lib/skill-installer.mjs`; all root tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Share one skill installer between packages, with support files for folder skills"
```

---

## Task 4: page-as-data uses the shared installer

**Files:**
- Modify: `packages/page-as-data/install.mjs` (whole file)
- Modify: `packages/page-as-data/package.json` (`files` adds `lib/`)
- Modify: `packages/page-as-data/test/install.test.mjs` (the `publishes the skill body with the npm package` test)

**Interfaces:**
- Consumes: Task 3 `createInstaller` via `packages/page-as-data/lib/skill-installer.mjs`.
- Produces: `packages/page-as-data/install.mjs` with exactly the exports it has today: `BODY, DESCRIPTION, MANAGED, START, END, owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain, upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan` (imported by `cli.mjs`, `wizard.mjs`, `scripts/build-plugin.mjs` and the tests).

- [ ] **Step 1: Write the failing test** — in `packages/page-as-data/test/install.test.mjs`, change the file list in `publishes the skill body with the npm package` to:

```js
    for (const f of ['install.mjs', 'lib/', 'tui.mjs', 'wizard.mjs', 'skill/']) assert.ok(pkg.files.includes(f), f)
```

Run: `cd packages/page-as-data && node --test --test-name-pattern "publishes the skill body" test/install.test.mjs`
Expected: FAIL, `lib/`.

- [ ] **Step 2: Replace `packages/page-as-data/install.mjs`**

```js
/**
 * page-as-data init / uninstall — teach coding agents to read a screen with
 * page-as-data instead of a screenshot. One skill body (skill/page-as-data.md),
 * written in each agent's own format by the installer every Keen Skills
 * package shares (lib/skill-installer.mjs, vendored from shared/). Zero dependencies.
 */
import { readFileSync } from 'node:fs'
import { createInstaller } from './lib/skill-installer.mjs'

export const {
  BODY, DESCRIPTION, MANAGED, START, END,
  owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain,
  upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan,
} = createInstaller({
  name: 'page-as-data',
  pkg: '@keenskills/page-as-data',
  source: 'skill/page-as-data.md',
  description:
    'Read a web page as data instead of a screenshot: what is on screen, what broke behind it (exceptions, failed requests), and layout defects at phone and desktop widths. Use when checking, debugging or verifying web UI work.',
  body: readFileSync(new URL('./skill/page-as-data.md', import.meta.url), 'utf8'),
})
```

In `packages/page-as-data/package.json` set `files` to:

```json
  "files": [
    "cli.mjs",
    "page-as-data.js",
    "install.mjs",
    "lib/",
    "tui.mjs",
    "wizard.mjs",
    "skill/"
  ],
```

- [ ] **Step 3: Run the whole package suite**

Run: `npm test` (in `packages/page-as-data`)
Expected: PASS, 85 tests, 0 fail. The generated plugin skill must not change: `npm run build:skill && git diff --exit-code skills/` exits 0.

- [ ] **Step 4: Check the tarball**

Run: `npm pack --dry-run --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].files.map(f=>f.path).sort().join(" ")))'`
Expected exactly: `LICENSE README.md cli.mjs install.mjs lib/skill-installer.mjs package.json page-as-data.js skill/page-as-data.md tui.mjs wizard.mjs`

- [ ] **Step 5: Commit**

```bash
cd ../..
git add -A
git commit -m "Build page-as-data init on the shared skill installer"
```

---

## Task 5: The diagram skill's npm package and CLI

**Files:**
- Create: `packages/drawing-architecture-diagrams/package.json`
- Create: `packages/drawing-architecture-diagrams/install.mjs`
- Create: `packages/drawing-architecture-diagrams/cli.mjs`
- Create: `packages/drawing-architecture-diagrams/scripts/build-plugin.mjs`
- Create: `packages/drawing-architecture-diagrams/.claude-plugin/plugin.json`
- Create: `packages/drawing-architecture-diagrams/tests/install.test.mjs`

**Interfaces:**
- Consumes: Task 1 skill folder, Task 2 script search, Task 3 vendored `lib/skill-installer.mjs`.
- Produces: `install.mjs` exporting `FILES: string[]` (support files, `/`-separated, relative to the skill folder) plus the installer exports; `cli.mjs` exporting `parseArgs(argv) => { command, agents, global, force, dryRun, json, dir }`, `doctor({ run }?) => { python, pythonVersion, pythonOk, drawio }`, `doctorLines(d) => string[]`, and `main(argv) => exitCode`. Package `npm test` runs node tests then the Python selftest.

- [ ] **Step 1: Write `package.json`** (tests need it to import the package)

```json
{
  "name": "@keenskills/drawing-architecture-diagrams",
  "version": "0.1.0",
  "description": "Professional, print-ready architecture diagrams (Azure, AWS, GCP, network topology) as editable draw.io files plus PNG and PDF. Installs itself as a skill for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline and Copilot.",
  "type": "module",
  "bin": {
    "drawing-architecture-diagrams": "cli.mjs"
  },
  "exports": {
    ".": "./install.mjs"
  },
  "files": [
    "cli.mjs",
    "install.mjs",
    "lib/",
    "skills/"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "node --test \"tests/*.test.mjs\" && python3 tests/selftest.py",
    "build:plugin": "node scripts/build-plugin.mjs",
    "version": "node scripts/build-plugin.mjs && git add .claude-plugin/plugin.json"
  },
  "keywords": [
    "architecture-diagram",
    "drawio",
    "diagrams",
    "azure",
    "aws",
    "gcp",
    "ai-agent",
    "agent-skill",
    "claude-code",
    "codex",
    "cursor",
    "copilot"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/keenskills/skills.git",
    "directory": "packages/drawing-architecture-diagrams"
  },
  "bugs": {
    "url": "https://github.com/keenskills/skills/issues"
  },
  "homepage": "https://github.com/keenskills/skills/tree/main/packages/drawing-architecture-diagrams#readme",
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "license": "MIT",
  "author": "keenskills",
  "contributors": [
    "gjohnpaull",
    "rajaaltus"
  ]
}
```

And `.claude-plugin/plugin.json`:

```json
{
  "name": "drawing-architecture-diagrams",
  "version": "0.1.0",
  "description": "Professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF.",
  "author": {
    "name": "keenskills"
  },
  "repository": "https://github.com/keenskills/skills",
  "license": "MIT"
}
```

And `scripts/build-plugin.mjs`:

```js
// Keeps the Claude Code plugin at the npm package's version. Run by `npm version`.
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const file = new URL('../.claude-plugin/plugin.json', import.meta.url)
const plugin = JSON.parse(readFileSync(file, 'utf8'))
writeFileSync(file, `${JSON.stringify({ ...plugin, version: pkg.version }, null, 2)}\n`)
```

- [ ] **Step 2: Write the failing tests** `tests/install.test.mjs`

```js
// init / uninstall / doctor for the diagram skill. Temp folders and a fake
// home, so no test touches the real ~/.claude.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { FILES, applyPlan, planInstall, renderSkill } from '../install.mjs'
import { doctor, doctorLines } from '../cli.mjs'

const pkg = fileURLToPath(new URL('../', import.meta.url))
const skill = join(pkg, 'skills', 'drawing-architecture-diagrams')
const cli = join(pkg, 'cli.mjs')
const tmp = () => mkdtempSync(join(tmpdir(), 'dad-'))
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__pycache__' ? [] : walk(join(dir, e.name))) : e.name.endsWith('.pyc') ? [] : [join(dir, e.name)])
const run = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', env: { ...process.env, HOME: cwd } })

describe('skill files', () => {
  it('ships every file in the skill folder', () => {
    const onDisk = walk(skill).map((p) => relative(skill, p).split(sep).join('/')).filter((p) => p !== 'SKILL.md').sort()
    assert.deepEqual([...FILES].sort(), onDisk)
  })

  it('renders SKILL.md with the name, the description and the managed note', () => {
    const s = renderSkill()
    assert.match(s, /^---\nname: drawing-architecture-diagrams\ndescription: "Use when asked to create/)
    assert.match(s, /drawing-architecture-diagrams:managed/)
    assert.match(s, /# Drawing Professional Architecture Diagrams/)
  })
})

describe('init', () => {
  it('installs a working skill folder for Claude Code in every project (--global)', () => {
    const home = tmp()
    applyPlan(planInstall({ root: tmp(), global: true, home }).actions)
    const dir = join(home, '.claude', 'skills', 'drawing-architecture-diagrams')
    for (const f of ['SKILL.md', ...FILES]) assert.ok(existsSync(join(dir, f)), f)
    // The installed example must find archdiagram.py next to it and lint clean.
    const work = tmp()
    const r = spawnSync('python3', [join(dir, 'examples', 'event_driven_platform_a4.py'), join(work, 'out.drawio')], { cwd: work, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /lint: 0 issue/)
  })

  it('gives single-file agents the text, and a folder with the files it names', () => {
    const root = tmp()
    applyPlan(planInstall({ root, agents: ['cursor'], home: tmp() }).actions)
    assert.match(readFileSync(join(root, '.cursor', 'rules', 'drawing-architecture-diagrams.mdc'), 'utf8'), /are in `\.agents\/skills\/drawing-architecture-diagrams\/`/)
    assert.ok(existsSync(join(root, '.agents', 'skills', 'drawing-architecture-diagrams', 'scripts', 'archdiagram.py')))
  })

  it('works from any folder, as npx runs it', () => {
    const root = tmp()
    const r = run(['init', '--dry-run', '--agent', 'claude', '--dir', root], tmp())
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /would create \.claude\/skills\/drawing-architecture-diagrams\/SKILL\.md \(Claude Code\)/)
    assert.match(r.stdout, /would create \.claude\/skills\/drawing-architecture-diagrams\/scripts\/archdiagram\.py \(Claude Code\)/)
    assert.deepEqual(readdirSync(root), [])
  })

  it('exits 2 on an unknown agent, naming it', () => {
    const r = run(['init', '--agent', 'vim', '--dir', tmp()], tmp())
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Unknown agent "vim"/)
  })

  it('exits 2 on an unknown option, naming it', () => {
    const r = run(['init', '--nope'], tmp())
    assert.equal(r.status, 2)
    assert.match(r.stderr, /--nope/)
  })
})

describe('uninstall', () => {
  it('removes what init wrote and leaves no files behind', () => {
    const root = tmp()
    assert.equal(run(['init', '--agent', 'claude,cursor', '--dir', root], root).status, 0)
    const r = run(['uninstall', '--dir', root], root)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(walk(root), [])
  })
})

describe('doctor', () => {
  it('reports Python and draw.io as archdiagram.py finds them', () => {
    const d = doctor({ run: () => '3.12.1\n/Applications/draw.io.app/Contents/MacOS/draw.io\n' })
    assert.deepEqual(d, { python: 'python3', pythonVersion: '3.12.1', pythonOk: true, drawio: '/Applications/draw.io.app/Contents/MacOS/draw.io' })
  })

  it('rejects Python older than 3.9', () => {
    assert.equal(doctor({ run: () => '3.8.10\n\n' }).pythonOk, false)
  })

  it('tries python3, then python, then says Python is missing', () => {
    const tried = []
    const d = doctor({ run: (cmd) => { tried.push(cmd); throw new Error('ENOENT') } })
    assert.deepEqual(tried, ['python3', 'python'])
    assert.match(doctorLines(d)[0], /Python 3\.9\+ not found/)
  })

  it('says draw.io is only needed for PNG and PDF', () => {
    assert.match(doctorLines({ python: 'python3', pythonVersion: '3.13.5', pythonOk: true, drawio: null })[1], /PNG\/PDF export needs it/)
  })

  it('runs the real probe', () => {
    const r = run(['doctor', '--json'], tmp())
    assert.equal(r.status, 0, r.stderr)
    assert.equal(JSON.parse(r.stdout).pythonOk, true)
  })
})

describe('npm package', () => {
  it('publishes the CLI, the installer and the skill folder, and no Python caches', () => {
    const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: pkg, encoding: 'utf8' })
    const files = JSON.parse(r.stdout)[0].files.map((f) => f.path).sort()
    const skillFiles = ['SKILL.md', ...FILES].map((f) => `skills/drawing-architecture-diagrams/${f}`)
    assert.deepEqual(files, ['LICENSE', 'README.md', 'cli.mjs', 'install.mjs', 'lib/skill-installer.mjs', 'package.json', ...skillFiles].sort())
  })
})
```

Run: `cd packages/drawing-architecture-diagrams && node --test "tests/*.test.mjs"`
Expected: FAIL, `Cannot find module .../install.mjs`.

- [ ] **Step 3: Write `install.mjs`**

```js
/**
 * drawing-architecture-diagrams init / uninstall — the skill folder
 * (skills/drawing-architecture-diagrams: SKILL.md plus scripts, references and
 * an example) written for each coding agent by the installer every Keen Skills
 * package shares (lib/skill-installer.mjs, vendored from shared/).
 */
import { readFileSync } from 'node:fs'
import { createInstaller } from './lib/skill-installer.mjs'

// Read relative to this file, never the current folder: npx runs it from the npm cache.
const SKILL = new URL('./skills/drawing-architecture-diagrams/', import.meta.url)
export const FILES = ['scripts/archdiagram.py', 'references/icons.md', 'examples/event_driven_platform_a4.py']

const text = readFileSync(new URL('SKILL.md', SKILL), 'utf8')
const front = /^---\n([\s\S]*?)\n---\n/.exec(text)
const description = /^description:\s*(.+)$/m.exec(front[1])[1].trim()

export const {
  BODY, DESCRIPTION, MANAGED, START, END,
  owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain,
  upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan,
} = createInstaller({
  name: 'drawing-architecture-diagrams',
  pkg: '@keenskills/drawing-architecture-diagrams',
  source: 'skills/drawing-architecture-diagrams/SKILL.md',
  description,
  body: text.slice(front[0].length),
  files: FILES.map((rel) => ({ rel, content: readFileSync(new URL(rel, SKILL), 'utf8') })),
})
```

- [ ] **Step 4: Write `cli.mjs`**

```js
#!/usr/bin/env node
/**
 * drawing-architecture-diagrams — install the diagram skill for coding agents,
 * and check the tools it needs.
 *
 *   drawing-architecture-diagrams init      [--agent claude,cursor,...|all] [--global] [--force] [--dry-run] [--json] [--dir <path>]
 *   drawing-architecture-diagrams uninstall [--agent ...] [--global] [--dry-run] [--json] [--dir <path>]
 *   drawing-architecture-diagrams doctor    [--json]
 *
 * Exit codes: 0 done, 2 could not run (bad option, missing folder, no Python 3.9+).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs as parse } from 'node:util'
import { AGENT_IDS, applyPlan, planInstall, planUninstall } from './install.mjs'

const NAME = 'drawing-architecture-diagrams'
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const SCRIPTS = fileURLToPath(new URL('./skills/drawing-architecture-diagrams/scripts/', import.meta.url))

const HELP = `${NAME} ${VERSION} — professional architecture diagrams as draw.io, PNG and PDF, as a skill for coding agents

  ${NAME} init [options]
      Install the skill for the agents this project uses.
      --agent <ids>   comma-separated: ${AGENT_IDS.join(', ')}, all
      --global        Claude Code, for every project (~/.claude/skills)
      --force         replace files with the same names that init did not write
      --dry-run       show what would change; write nothing
      --json          print the plan as JSON
      --dir <path>    the project folder (default: the current folder)

  ${NAME} uninstall [options]
      Remove what init wrote, and nothing else. Takes --agent, --global,
      --dry-run, --json and --dir.

  ${NAME} doctor [--json]
      Check for Python 3.9+ (required) and draw.io desktop (PNG/PDF export).

Exit codes: 0 done, 2 could not run.
`

const out = (s = '') => process.stdout.write(`${s}\n`)

export function parseArgs(argv) {
  const { values, positionals } = parse({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      agent: { type: 'string', multiple: true },
      global: { type: 'boolean' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      json: { type: 'boolean' },
      // Accepted for parity with page-as-data; this CLI never asks questions.
      yes: { type: 'boolean', short: 'y' },
      dir: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })
  const [command = 'help', ...extra] = positionals
  if (extra.length) throw new Error(`${command} takes no arguments ("${extra[0]}"); use --dir for another project folder`)
  return {
    command: values.help ? 'help' : values.version ? 'version' : command,
    agents: (values.agent ?? []).flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean),
    global: Boolean(values.global),
    force: Boolean(values.force),
    dryRun: Boolean(values['dry-run']),
    json: Boolean(values.json),
    dir: resolve(values.dir ?? process.cwd()),
  }
}

// Asks archdiagram.py itself where draw.io is, so doctor and render never disagree.
const PROBE = 'import sys; sys.path.insert(0, sys.argv[1]); import archdiagram; print(sys.version.split()[0]); print(archdiagram.find_drawio() or "")'
const exec = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

export function doctor({ run = exec } = {}) {
  for (const python of ['python3', 'python']) {
    let text
    try {
      text = run(python, ['-c', PROBE, SCRIPTS])
    } catch {
      continue
    }
    const [version, drawio] = text.split('\n')
    const [major, minor] = version.split('.').map(Number)
    return { python, pythonVersion: version, pythonOk: major > 3 || (major === 3 && minor >= 9), drawio: drawio || null }
  }
  return { python: null, pythonVersion: null, pythonOk: false, drawio: null }
}

export function doctorLines(d) {
  return [
    d.pythonOk
      ? `✔ Python ${d.pythonVersion} (${d.python})`
      : d.python
        ? `✖ Python ${d.pythonVersion} is too old: the skill needs Python 3.9 or newer`
        : '✖ Python 3.9+ not found: install it from python.org, then run doctor again',
    d.drawio
      ? `✔ draw.io desktop at ${d.drawio}`
      : '– draw.io desktop not found: diagrams still build and lint, but PNG/PDF export needs it (github.com/jgraph/drawio-desktop/releases, or set DRAWIO=<path>)',
  ]
}

const DONE = { create: 'created', update: 'updated', unchanged: 'unchanged', skip: 'skipped', remove: 'removed', 'strip-block': 'removed its block from' }
const WOULD = { create: 'would create', update: 'would update', unchanged: 'unchanged', skip: 'would skip', remove: 'would remove', 'strip-block': 'would remove its block from' }

function installCommand(opts) {
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
    if (!inProject.startsWith('..') && !isAbsolute(inProject)) return inProject.split('\\').join('/')
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p
  }
  for (const a of plan.actions) {
    const mark = a.action === 'skip' ? '–' : a.action === 'unchanged' ? '·' : '✔'
    out(`${mark} ${(opts.dryRun ? WOULD : DONE)[a.action]} ${shown(a.path)} (${a.label})${a.reason ? `: ${a.reason}` : ''}`)
  }
  if (!plan.actions.length) out(opts.command === 'init' ? 'Nothing to install.' : `Nothing to remove: no ${NAME} files found.`)
  if (opts.command === 'init' && !opts.dryRun) {
    out('\nTools')
    for (const line of doctorLines(doctor())) out(`  ${line}`)
    out('\nNext steps')
    out('  Ask your agent: "Create an A4 architecture diagram of <your system> as draw.io, PNG and PDF."')
  }
  return 0
}

export function main(argv = process.argv.slice(2)) {
  try {
    const opts = parseArgs(argv)
    if (opts.command === 'help') return out(HELP), 0
    if (opts.command === 'version') return out(VERSION), 0
    if (opts.command === 'doctor') {
      const d = doctor()
      if (opts.json) out(JSON.stringify(d, null, 2))
      else for (const line of doctorLines(d)) out(line)
      return d.pythonOk ? 0 : 2
    }
    if (opts.command === 'init' || opts.command === 'uninstall') return installCommand(opts)
    throw new Error(`Unknown command "${opts.command}". Use init, uninstall or doctor; --help lists the options.`)
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    return 2
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main()
```

Make it executable: `chmod +x cli.mjs`.

- [ ] **Step 5: Run the package suite**

Run: `npm test` (in `packages/drawing-architecture-diagrams`)
Expected: every node test PASS, then the selftest's `PASS` lines; exit 0.

- [ ] **Step 6: Try the CLI by hand**

Run: `node cli.mjs init --dry-run --dir "$(mktemp -d)" && node cli.mjs doctor`
Expected: the fallback line, then `would create` lines for `.claude/skills/drawing-architecture-diagrams/…` (Claude Code), `AGENTS.md`, and `.agents/skills/drawing-architecture-diagrams/…` (skill files); doctor prints `✔ Python 3.x` and a draw.io line; exit 0.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add -A
git commit -m "Publish the diagram skill as @keenskills/drawing-architecture-diagrams with init, uninstall and doctor"
```

---

## Task 6: Marketplace, CI and workspace

**Files:**
- Modify: `.claude-plugin/marketplace.json` (second plugin)
- Modify: `test/repo.test.mjs` (both plugins listed; CI covers every package)
- Modify: `test/release-target.test.mjs:41` and `fakeRepo` (deferred minor from phase 1)
- Modify: `.github/workflows/test.yml` (diagram job runs `npm test` with Node and Python)
- Modify: `package.json` (root `test`, `test:diagrams`)
- Modify: `pnpm-lock.yaml` (regenerate)

**Interfaces:**
- Consumes: Task 5 package and `plugin.json`.
- Produces: marketplace `keenskills` with plugins `page-as-data` and `drawing-architecture-diagrams`, each at `./packages/<name>`.

- [ ] **Step 1: Write the failing root tests** — append to `test/repo.test.mjs`:

```js
describe('skills', () => {
  // The skills stay separate products: one plugin each, never a bundle.
  it('lists each skill as its own plugin', () => {
    const m = json('.claude-plugin/marketplace.json')
    assert.deepEqual(m.plugins.map((p) => [p.name, p.source]), [
      ['page-as-data', './packages/page-as-data'],
      ['drawing-architecture-diagrams', './packages/drawing-architecture-diagrams'],
    ])
  })

  it('tests every package in CI', () => {
    const yml = readFileSync(new URL('.github/workflows/test.yml', root), 'utf8')
    for (const name of ['page-as-data', 'drawing-architecture-diagrams']) {
      assert.match(yml, new RegExp(`working-directory: packages/${name}\\n`), name)
    }
    assert.match(yml, /drawing-architecture-diagrams:[\s\S]*setup-node[\s\S]*setup-python[\s\S]*run: npm test/)
  })
})
```

Run: `pnpm test:repo`
Expected: FAIL on `lists each skill as its own plugin` and on the `setup-node … npm test` assertion.

- [ ] **Step 2: Add the plugin to the marketplace** — in `.claude-plugin/marketplace.json` append to `plugins`:

```json
    {
      "name": "drawing-architecture-diagrams",
      "source": "./packages/drawing-architecture-diagrams",
      "description": "Professional, print-ready architecture diagrams (Azure, AWS, GCP, network topology) as editable draw.io files plus PNG and PDF."
    }
```

- [ ] **Step 3: Run the diagram package's full suite in CI** — replace the `drawing-architecture-diagrams` job in `.github/workflows/test.yml` with:

```yaml
  drawing-architecture-diagrams:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ['3.9', '3.13']
    defaults:
      run:
        working-directory: packages/drawing-architecture-diagrams
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
      # Rendering needs draw.io desktop, which CI does not have; lint and install run.
      - run: npm test
```

- [ ] **Step 4: Root scripts and lockfile** — in root `package.json` set:

```json
    "test": "pnpm test:repo && pnpm -r test",
    "test:repo": "node --test \"test/*.test.mjs\"",
    "test:diagrams": "pnpm --filter @keenskills/drawing-architecture-diagrams test",
    "sync": "node scripts/sync-shared.mjs"
```

Run: `pnpm install`
Expected: `pnpm-lock.yaml` now lists importers `.`, `packages/drawing-architecture-diagrams` and `packages/page-as-data`.

- [ ] **Step 5: Fix the release-target test's path handling** — in `test/release-target.test.mjs`:
  - change the import line to `import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'` and `import { fileURLToPath, pathToFileURL } from 'node:url'`, and add `import { after } from 'node:test'` to the existing `node:test` import (`import { after, describe, it } from 'node:test'`);
  - in `fakeRepo`, push each `dir` onto `const made = []` declared above it, and add `after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })` after `fakeRepo`;
  - replace `new URL('../scripts/release-target.mjs', import.meta.url).pathname` with `fileURLToPath(new URL('../scripts/release-target.mjs', import.meta.url))` (`.pathname` keeps `%20` for a space in the checkout path).

- [ ] **Step 6: Run everything**

Run: `pnpm test:repo && pnpm test`
Expected: all root tests PASS (marketplace checks now also cover `drawing-architecture-diagrams`: same name, version `0.1.0` in both files, `skills/drawing-architecture-diagrams/SKILL.md` present), then both package suites PASS.

- [ ] **Step 7: Check the plugin with Claude Code**

Run: `claude plugin validate .` and `claude plugin validate packages/drawing-architecture-diagrams`
Expected: both pass (a warning that a package `CLAUDE.md` is not loaded is fine).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "List the diagram skill as its own plugin and test it in CI with Node and Python"
```

---

## Task 7: Docs and changelogs

**Files:**
- Modify: `packages/drawing-architecture-diagrams/README.md` (Install, What's inside, image URL)
- Modify: `packages/page-as-data/README.md:14,16` (absolute image and guide URLs)
- Modify: `packages/page-as-data/package.json`, `packages/drawing-architecture-diagrams/package.json` (`files` adds `CHANGELOG.md`)
- Modify: `packages/drawing-architecture-diagrams/tests/install.test.mjs` (tarball list adds `CHANGELOG.md`)
- Create: `packages/drawing-architecture-diagrams/CLAUDE.md`
- Create: `packages/drawing-architecture-diagrams/CHANGELOG.md`
- Create: `packages/page-as-data/CHANGELOG.md`
- Modify: `README.md`, `CLAUDE.md` (root)
- Modify: `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md` ("Diagram skill distribution")
- Modify: `test/repo.test.mjs`

**Interfaces:**
- Consumes: Tasks 1 to 6.
- Produces: every package has `README.md`, `CLAUDE.md` and a `CHANGELOG.md` with a `## <version>` heading for its current version; Task 8 adds headings as it bumps versions.

- [ ] **Step 1: Write the failing root test** — append to `test/repo.test.mjs`:

```js
describe('package docs', () => {
  for (const name of ['page-as-data', 'drawing-architecture-diagrams']) {
    it(`${name} has a README, a CLAUDE.md, and a changelog entry for its version`, () => {
      const dir = `packages/${name}/`
      for (const f of ['README.md', 'CLAUDE.md', 'CHANGELOG.md']) assert.ok(existsSync(new URL(dir + f, root)), f)
      const version = json(`${dir}package.json`).version
      assert.match(readFileSync(new URL(`${dir}CHANGELOG.md`, root), 'utf8'), new RegExp(`^## ${version.replaceAll('.', '\\.')}$`, 'm'))
    })

    // npm renders a README without the monorepo around it, so relative images break there.
    it(`${name} README uses absolute image URLs`, () => {
      const text = readFileSync(new URL(`packages/${name}/README.md`, root), 'utf8')
      assert.doesNotMatch(text, /!\[[^\]]*\]\((?!https:\/\/)/)
    })
  }
})
```

Run: `pnpm test:repo`
Expected: FAIL on the missing `CLAUDE.md`/`CHANGELOG.md` files and on both READMEs' relative image paths.

- [ ] **Step 2: Changelogs**

`packages/page-as-data/CHANGELOG.md`:

```markdown
# Changelog

## 0.2.0

- Moved to the Keen Skills monorepo and published as `@keenskills/page-as-data` (was `@rajaaltus/page-as-data`, now deprecated).
- The Claude Code plugin is now `/plugin install page-as-data@keenskills` after `/plugin marketplace add keenskills/skills`.

## 0.1.1

- `init` runs an interactive wizard in a terminal; `--yes` and next steps.
```

`packages/drawing-architecture-diagrams/CHANGELOG.md`:

```markdown
# Changelog

## 0.1.0

- First npm release as `@keenskills/drawing-architecture-diagrams`.
- `init` installs the skill folder (SKILL.md, `archdiagram.py`, icon references, the worked example) for Claude Code, and the text plus `.agents/skills/drawing-architecture-diagrams/` for AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline and Copilot. `uninstall` removes only what `init` wrote.
- `doctor` checks for Python 3.9+ and draw.io desktop.
- A copied example finds `archdiagram.py` in `.claude/skills`, `.agents/skills`, `~/.claude/skills`, or `ARCHDIAGRAM_DIR`.
- Claude Code plugin: `/plugin install drawing-architecture-diagrams@keenskills`.
```

Ship each changelog with its package, so the npm tarball says what changed: add `"CHANGELOG.md"` as the last entry of `files` in both `packages/page-as-data/package.json` and `packages/drawing-architecture-diagrams/package.json`. In `packages/drawing-architecture-diagrams/tests/install.test.mjs` change the expected tarball list to start `['CHANGELOG.md', 'LICENSE', 'README.md', ...`.

Run: `pnpm --filter @keenskills/drawing-architecture-diagrams test` and, in `packages/page-as-data`, the Task 4 Step 4 pack command.
Expected: diagram suite PASS; the page-as-data list is Task 4's list plus `CHANGELOG.md`.

- [ ] **Step 3: Absolute URLs in the page-as-data README** — in `packages/page-as-data/README.md` replace `docs/diagram/how-it-helps.png` in the image on line 14 with `https://raw.githubusercontent.com/keenskills/skills/main/packages/page-as-data/docs/diagram/how-it-helps.png`, and the `docs/usage.md` link on line 16 with `https://github.com/keenskills/skills/blob/main/packages/page-as-data/docs/usage.md`.

- [ ] **Step 4: Rewrite the diagram README's top sections** — in `packages/drawing-architecture-diagrams/README.md`:
  - image (line 7): `![Sample: fictional event-driven order platform on A4](https://raw.githubusercontent.com/keenskills/skills/main/packages/drawing-architecture-diagrams/docs/sample-a4.png)`
  - "What's inside" table paths become `skills/drawing-architecture-diagrams/SKILL.md`, `skills/drawing-architecture-diagrams/scripts/archdiagram.py`, `skills/drawing-architecture-diagrams/examples/event_driven_platform_a4.py`, `skills/drawing-architecture-diagrams/references/icons.md`, and `tests/selftest.py` stays; add a row `| cli.mjs, install.mjs | npm package: init, uninstall and doctor |`.
  - replace the whole `## Install` section (the `git clone` block and the Requirements line) with:

````markdown
## Install

```bash
npx @keenskills/drawing-architecture-diagrams init            # this project, for the agents it uses
npx @keenskills/drawing-architecture-diagrams init --global   # Claude Code, every project
npx @keenskills/drawing-architecture-diagrams doctor          # check Python and draw.io
```

`init` finds the agents a project uses (Claude Code, AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline, GitHub
Copilot) and installs the skill in each one's format; `--agent claude,cursor` picks them, `--dry-run` shows the
plan. Claude Code gets the whole skill folder in `.claude/skills/drawing-architecture-diagrams/`; the others get
the text, and the scripts go in `.agents/skills/drawing-architecture-diagrams/`. `uninstall` removes only what
`init` wrote.

As a Claude Code plugin:

```text
/plugin marketplace add keenskills/skills
/plugin install drawing-architecture-diagrams@keenskills
```

Requirements: Python 3.9+ and [draw.io desktop](https://github.com/jgraph/drawio-desktop/releases) (only for
PNG/PDF export; set `DRAWIO=<path>` if it is not in a standard location). A copied example finds the scripts by
itself; for a plugin install set `ARCHDIAGRAM_DIR` to the skill's `scripts` folder.
````

- [ ] **Step 5: `packages/drawing-architecture-diagrams/CLAUDE.md`**

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## What this is

`@keenskills/drawing-architecture-diagrams`: a skill that draws professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF. The skill itself is `skills/drawing-architecture-diagrams/` (SKILL.md, `scripts/archdiagram.py`, `references/icons.md`, `examples/`); that folder is what the Claude Code plugin, `init` and Agent Skills tools read. The Node side (`cli.mjs`, `install.mjs`) only installs it and checks tools.

## Commands

```sh
npm test                                  # node tests (init/uninstall/doctor in temp folders) + python3 tests/selftest.py
python3 tests/selftest.py                 # lint rules and the worked example; no draw.io needed
node cli.mjs init --dry-run --dir /tmp/x  # what init would write
node cli.mjs doctor                       # Python 3.9+ and draw.io
```

## Rules

- `install.mjs` `FILES` lists every file in the skill folder except SKILL.md; a test fails when a new file is not listed.
- `lib/skill-installer.mjs` is generated from the monorepo's `shared/skill-installer.mjs`: edit that, then run `pnpm sync` at the root.
- Keep `.claude-plugin/plugin.json` at the package version (`npm version` runs `scripts/build-plugin.mjs`).
- Examples use fictional names only (Northwind Traders, Contoso).

## Release

From this folder: `npm version <patch|minor|major> --no-git-tag-version`, add a `## <version>` entry to `CHANGELOG.md`, commit, then from the repo root `git tag -a drawing-architecture-diagrams@v<version> -m "drawing-architecture-diagrams <version>"` and `git push --follow-tags`.
````

- [ ] **Step 6: Root docs**
  - `README.md` table: the diagram row's Install cell becomes `` `npx @keenskills/drawing-architecture-diagrams init` ``; under `## Claude Code` add the line `/plugin install drawing-architecture-diagrams@keenskills`.
  - `CLAUDE.md` table: add rows `| shared/skill-installer.mjs | The one installer both packages ship; vendored into packages/*/lib/ by pnpm sync |` and `| scripts/sync-shared.mjs | Writes those copies; test/sync-shared.test.mjs fails on a stale one |`; change the drawing-architecture-diagrams row to `` `@keenskills/drawing-architecture-diagrams`, Node 22+ installer around a Python 3.9+ skill; rendering needs draw.io desktop ``; add `pnpm sync   # after editing shared/` to Commands; in Conventions replace the first bullet with `- Packages stay independent: no imports across packages/ and no runtime dependencies. Code both need lives in shared/ and is copied in by pnpm sync.` In the Release section add: `Add a ## <version> entry to the package's CHANGELOG.md before tagging; test/repo.test.mjs checks it.`
  - Spec: in "Diagram skill distribution", replace the "Reuse `install.mjs` instead of copying it. Step 1 … Step 2 …" bullet with: `- One installer for both: shared/skill-installer.mjs, a factory parameterised by skill with support-file (folder skill) handling, vendored into each package's lib/ by pnpm sync and checked by a drift test. This keeps packages independent and dependency-free; a published packages/skill-installer is only worth it if a third skill appears.`

- [ ] **Step 7: Run and commit**

Run: `pnpm test:repo`
Expected: PASS.

```bash
git add -A
git commit -m "Document installing the diagram skill; add changelogs and package CLAUDE.md"
```

---

## Task 8: Push and release (outward-facing: confirm with the user first)

**Files:**
- Modify: `packages/page-as-data/package.json`, `packages/page-as-data/.claude-plugin/plugin.json`, `packages/page-as-data/CHANGELOG.md` (0.2.1)

**Interfaces:**
- Consumes: everything above; the org secret `NPM_TOKEN` (`gh secret list --org keenskills`).

- [ ] **Step 1: Push main and wait for CI** (confirm first)

```bash
git push
gh run watch --repo keenskills/skills --exit-status "$(gh run list --repo keenskills/skills --workflow test.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: `repo`, `page-as-data (22)`, `page-as-data (24)`, `drawing-architecture-diagrams (3.9)`, `drawing-architecture-diagrams (3.13)` all succeed.

- [ ] **Step 2: Release the diagram skill 0.1.0** (confirm first; version is already 0.1.0)

```bash
node scripts/release-target.mjs drawing-architecture-diagrams@v0.1.0
git tag -a drawing-architecture-diagrams@v0.1.0 -m "drawing-architecture-diagrams 0.1.0"
git push --follow-tags
gh run watch --repo keenskills/skills --exit-status "$(gh run list --repo keenskills/skills --workflow publish.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: `name=drawing-architecture-diagrams`, `dir=packages/drawing-architecture-diagrams`, `version=0.1.0`; publish run green with `+ @keenskills/drawing-architecture-diagrams@0.1.0` and a provenance line.

- [ ] **Step 3: Release page-as-data 0.2.1** (confirm first; ships the shared installer, no behaviour change)

```bash
cd packages/page-as-data
npm version patch --no-git-tag-version
```

Add to the top of `CHANGELOG.md`, under `# Changelog`:

```markdown
## 0.2.1

- `init` / `uninstall` now run on the installer shared by every Keen Skills package. No change in what they write.
```

```bash
cd ../..
pnpm test:repo
git add -A
git commit -m "Release page-as-data 0.2.1"
git tag -a page-as-data@v0.2.1 -m "page-as-data 0.2.1"
git push --follow-tags
gh run watch --repo keenskills/skills --exit-status "$(gh run list --repo keenskills/skills --workflow publish.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: tests pass; publish green with `+ @keenskills/page-as-data@0.2.1`.

- [ ] **Step 4: Verify from the registry** (the npm index can lag a few minutes after a first publish; poll, do not assume)

```bash
cd "$(mktemp -d)"
until [ "$(curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@keenskills%2fdrawing-architecture-diagrams)" = 200 ]; do sleep 5; done
npx -y @keenskills/drawing-architecture-diagrams init --dry-run --agent claude
npx -y @keenskills/drawing-architecture-diagrams doctor
npx -y @keenskills/page-as-data@0.2.1 init --dry-run --agent claude
```

Expected: `would create .claude/skills/drawing-architecture-diagrams/SKILL.md (Claude Code)` plus its three support files; doctor `✔ Python`; page-as-data `would create .claude/skills/page-as-data/SKILL.md (Claude Code)`.

- [ ] **Step 5: Tell the user how to pick up the plugin**

```text
/plugin marketplace update keenskills
/plugin install drawing-architecture-diagrams@keenskills
```

# Keen Skills monorepo, phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `keenskills/skills` monorepo holding `page-as-data` and `drawing-architecture-diagrams` with their git history, publish `page-as-data` from it as `@keenskills/page-as-data` 0.2.0, and retire the old repos and npm name with pointers.

**Architecture:** A new git repo at `/Users/rajas/projects/next/skills` with a private pnpm workspace root. Both existing repos are imported with `git subtree add` under `packages/`. The root owns the Claude Code marketplace file, CI, and a small release script that maps a tag like `page-as-data@v0.2.0` to the package folder. Each package keeps its own tests, version and docs.

**Tech Stack:** git subtree, pnpm 11 workspaces, Node 22+ (`node:test`), Python 3.9+, GitHub Actions, npm provenance.

**Spec:** `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md` (phase 1 of 5). After Task 2 it lives at the monorepo root under the same path.

## Global Constraints

- New repo: `github.com/keenskills/skills`, local path `/Users/rajas/projects/next/skills`.
- npm scope `@keenskills`; package `@keenskills/page-as-data`; marketplace name `keenskills`.
- `packages/page-as-data` stays zero-dependency, Node `>=22`; the root may not add runtime dependencies to it.
- Two separate skills: own package, plugin, version and changelog. The marketplace file is only an index.
- Keep every MIT copyright line (gjohnpaull, john, rajaaltus). Keep `contributors: ["gjohnpaull"]`.
- LF line endings everywhere (`* text=auto eol=lf`); the `cli.mjs` shebang breaks with CRLF.
- ES modules, no semicolons, single quotes, 2-space indent (repo convention).
- Never use real client names in examples.
- Outward-facing steps (creating orgs, `gh repo create`, `npm publish`, `npm deprecate`, archiving repos) are done by the user or only after the user confirms at that step.
- The diagram skill is **not** listed in the marketplace in phase 1; its plugin layout and npm package are phase 2.

## Review Focus

1. A mistyped release tag (`page-as-data@0.2.0`, `pageasdata@v0.2.0`, `v0.2.0`) must fail the publish job with a clear message, never publish some package. Pinned in Task 4.
2. A tag whose version differs from the package's `package.json` must fail before `npm publish`. Pinned in Task 4.
3. The published tarball of `@keenskills/page-as-data` must contain exactly the same files as 0.1.1 (no monorepo root files leaking in). Pinned in Task 3.
4. Every plugin the marketplace lists must be installable: its `source` folder exists, has `.claude-plugin/plugin.json` with the same name, the same version as its `package.json`, and a `skills/<name>/SKILL.md`. Pinned in Task 3.
5. `cli.mjs` must keep LF endings after the move (a CRLF shebang makes `npx` fail with `env: node\r`). Pinned in Task 3.

---

## Task 0: Prerequisites (user, outward-facing)

These need a browser session and cannot be done by an agent. Ask the user to do them and confirm before Task 5.

- [ ] **Step 1:** Create the GitHub organization `keenskills` (github.com/account/organizations/new, Free plan). Decide whether to invite `gjohnpaull`.
- [ ] **Step 2:** Create the npm organization `keenskills` (npmjs.com/org/create, free for public packages).
- [ ] **Step 3:** Create an npm granular access token with read and write on `@keenskills` packages. Keep it for Task 5.

Tasks 1 to 4 are local only and can run before Task 0 is done.

---

## Task 1: Monorepo root skeleton

**Files:**
- Create: `/Users/rajas/projects/next/skills/package.json`
- Create: `/Users/rajas/projects/next/skills/pnpm-workspace.yaml`
- Create: `/Users/rajas/projects/next/skills/.gitattributes`
- Create: `/Users/rajas/projects/next/skills/.gitignore`
- Create: `/Users/rajas/projects/next/skills/LICENSE`

**Interfaces:**
- Produces: a git repo with one commit on `main` (subtree needs a parent commit); root scripts `test`, `test:repo`, `test:diagrams` used by Tasks 3 to 5.

- [ ] **Step 1: Create the folder and repo**

```bash
mkdir /Users/rajas/projects/next/skills
cd /Users/rajas/projects/next/skills
git init -b main
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "keenskills",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.10.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "pnpm test:repo && pnpm -r test && pnpm test:diagrams",
    "test:repo": "node --test \"test/*.test.mjs\"",
    "test:diagrams": "python3 packages/drawing-architecture-diagrams/tests/selftest.py"
  },
  "license": "MIT"
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - packages/*
  - apps/*
```

- [ ] **Step 4: Write `.gitattributes`**

```
* text=auto eol=lf
*.png binary
*.pdf binary
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
.DS_Store
*.log
__pycache__/
*.pyc
.next/
.vercel/
out/
```

- [ ] **Step 6: Write `LICENSE`**

```
MIT License

Copyright (c) 2026 gjohnpaull (John Paul)
Copyright (c) 2026 rajaaltus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Verify pnpm accepts the workspace**

Run: `pnpm install`
Expected: exits 0, writes `pnpm-lock.yaml` with only the root importer.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Start the keenskills monorepo"
```

---

## Task 2: Import both repos with history

**Files:**
- Create (by import): `packages/page-as-data/**`, `packages/drawing-architecture-diagrams/**`
- Move: `packages/page-as-data/docs/superpowers/` to `docs/superpowers/`
- Delete: `packages/page-as-data/.github/` (replaced in Task 4)

**Interfaces:**
- Consumes: Task 1's `main` commit.
- Produces: `packages/page-as-data` (unchanged contents, `name` still `@rajaaltus/page-as-data` until Task 3) and `packages/drawing-architecture-diagrams` (SKILL.md, scripts/, references/, examples/, tests/, docs/).

- [ ] **Step 1: Commit the spec and this plan in the source repo** (so they travel with the history)

```bash
cd /Users/rajas/projects/next/page-as-data
git status --short   # expect only the two docs/superpowers files for 2026-09-29
git add docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md docs/superpowers/plans/2026-09-29-monorepo-phase-1.md
git commit -m "Add the monorepo and site design, and the phase 1 plan"
```

- [ ] **Step 2: Import page-as-data from the local repo** (local `main` holds the latest commits)

```bash
cd /Users/rajas/projects/next/skills
git subtree add --prefix=packages/page-as-data /Users/rajas/projects/next/page-as-data main
```

Expected: `Added dir 'packages/page-as-data'`.

- [ ] **Step 3: Import the diagram skill from GitHub**

```bash
git subtree add --prefix=packages/drawing-architecture-diagrams https://github.com/rajaaltus/drawing-architecture-diagrams.git main
```

Expected: `Added dir 'packages/drawing-architecture-diagrams'`.

- [ ] **Step 4: Check history survived**

Run: `git log --oneline -- packages/drawing-architecture-diagrams/scripts/archdiagram.py | tail -1`
Expected: `c3b9693 Add drawing-architecture-diagrams skill` (hash may differ only if subtree rewrote; the message must match).

- [ ] **Step 5: Move shared docs to the root and drop the package workflows**

```bash
mkdir -p docs
git mv packages/page-as-data/docs/superpowers docs/superpowers
git rm -r -q packages/page-as-data/.github
```

- [ ] **Step 6: Run both suites in place**

Run: `(cd packages/page-as-data && npm test) && pnpm test:diagrams`
Expected: page-as-data suites pass (Chrome suites skip only if no Chrome; locally Chrome exists, so all pass); selftest prints only `PASS` lines.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move shared design docs to the root; CI moves to the root next"
```

---

## Task 3: Rename to @keenskills and add the root marketplace

**Files:**
- Create: `test/repo.test.mjs`
- Create: `.claude-plugin/marketplace.json`
- Delete: `packages/page-as-data/.claude-plugin/marketplace.json`
- Modify: `packages/page-as-data/package.json` (name, repository, bugs, homepage)
- Modify: `packages/page-as-data/.claude-plugin/plugin.json` (repository)
- Modify: `packages/page-as-data/wizard.mjs:13-14`
- Modify: `packages/page-as-data/install.mjs:19`
- Modify: `packages/page-as-data/skill/page-as-data.md`, `README.md`, `docs/usage.md`, `CLAUDE.md` (every `@rajaaltus/page-as-data` and `rajaaltus/page-as-data` URL)
- Modify: `packages/page-as-data/test/install.test.mjs:31,312,335-344`, `packages/page-as-data/test/wizard.test.mjs:64,83`
- Regenerate: `packages/page-as-data/skills/page-as-data/SKILL.md`

**Interfaces:**
- Consumes: Task 2 layout.
- Produces: root `test/repo.test.mjs` (run by `pnpm test:repo`), marketplace `keenskills` listing `page-as-data` at `./packages/page-as-data`.

- [ ] **Step 1: Write the failing root test** `test/repo.test.mjs`

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const json = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))

describe('marketplace', () => {
  const m = json('.claude-plugin/marketplace.json')

  it('is the keenskills marketplace', () => {
    assert.equal(m.name, 'keenskills')
    assert.equal(m.owner.name, 'keenskills')
  })

  // Each listed plugin must install on its own, since the skills stay separate products.
  for (const p of m.plugins) {
    describe(p.name, () => {
      const dir = `${p.source.replace(/^\.\//, '')}/`

      it('has a plugin.json with the same name', () => {
        assert.equal(json(`${dir}.claude-plugin/plugin.json`).name, p.name)
      })

      it('has the same plugin and npm version', () => {
        assert.equal(json(`${dir}.claude-plugin/plugin.json`).version, json(`${dir}package.json`).version)
      })

      it('ships its skill where Claude Code looks for it', () => {
        assert.ok(existsSync(new URL(`${dir}skills/${p.name}/SKILL.md`, root)))
      })
    })
  }
})

describe('page-as-data package', () => {
  const pkg = json('packages/page-as-data/package.json')

  it('is published under the shared scope from this repo', () => {
    assert.equal(pkg.name, '@keenskills/page-as-data')
    assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/keenskills/skills.git', directory: 'packages/page-as-data' })
  })

  // A CRLF shebang makes npx fail with "env: node\r".
  it('keeps LF line endings in the CLI', () => {
    assert.ok(!readFileSync(new URL('packages/page-as-data/cli.mjs', root), 'utf8').includes('\r'))
  })

  it('no longer carries its own marketplace', () => {
    assert.ok(!existsSync(new URL('packages/page-as-data/.claude-plugin/marketplace.json', root)))
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test:repo`
Expected: FAIL, `ENOENT ... .claude-plugin/marketplace.json` at the root.

- [ ] **Step 3: Update the package tests first** in `packages/page-as-data/test/`

In `install.test.mjs` and `wizard.test.mjs` replace every `@rajaaltus\/page-as-data` with `@keenskills\/page-as-data` (lines 31, 312 and 64, 83):

```bash
cd packages/page-as-data
sed -i '' 's|@rajaaltus\\/page-as-data|@keenskills\\/page-as-data|g' test/install.test.mjs test/wizard.test.mjs
```

Then in `install.test.mjs` replace the marketplace test and the name assertion (lines 335-344) with:

```js
  it('publishes the skill body with the npm package', () => {
    const pkg = json('package.json')
    assert.equal(pkg.name, '@keenskills/page-as-data')
    for (const f of ['install.mjs', 'tui.mjs', 'wizard.mjs', 'skill/']) assert.ok(pkg.files.includes(f), f)
  })
})
```

(The marketplace check now lives in the root `test/repo.test.mjs`.)

Run: `npm test`
Expected: FAIL on the name and `npx @keenskills/...` assertions.

- [ ] **Step 4: Rename in the package**

```bash
cd packages/page-as-data
grep -rl 'rajaaltus/page-as-data' --exclude-dir=test --exclude-dir=node_modules . \
  | xargs sed -i '' \
    -e 's|github.com/rajaaltus/page-as-data/blob/main/docs/usage.md|github.com/keenskills/skills/blob/main/packages/page-as-data/docs/usage.md|g' \
    -e 's|/plugin marketplace add rajaaltus/page-as-data|/plugin marketplace add keenskills/skills|g' \
    -e 's|@rajaaltus/page-as-data|@keenskills/page-as-data|g' \
    -e 's|https://github.com/rajaaltus/page-as-data|https://github.com/keenskills/skills|g'
```

Then set these fields in `package.json` exactly:

```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/keenskills/skills.git",
    "directory": "packages/page-as-data"
  },
  "bugs": {
    "url": "https://github.com/keenskills/skills/issues"
  },
  "homepage": "https://github.com/keenskills/skills/tree/main/packages/page-as-data#readme",
```

In `README.md` and `docs/usage.md`, change the plugin install line after the marketplace add from `/plugin install page-as-data@page-as-data` to `/plugin install page-as-data@keenskills`. In `README.md` line 317 change the diagram link to `https://github.com/keenskills/skills/tree/main/packages/drawing-architecture-diagrams`.

- [ ] **Step 5: Verify no old name is left, then regenerate the plugin skill**

```bash
grep -rn 'rajaaltus/page-as-data\|page-as-data@page-as-data' . --exclude-dir=node_modules
npm run build:skill
```

Expected: grep prints nothing; `skills/page-as-data/SKILL.md` now says `@keenskills/page-as-data`.

- [ ] **Step 6: Move the marketplace to the root**

```bash
cd ../..
git rm -q packages/page-as-data/.claude-plugin/marketplace.json
mkdir -p .claude-plugin
```

Write `.claude-plugin/marketplace.json`:

```json
{
  "name": "keenskills",
  "description": "Keen Skills: agent skills by keenskills. Install only the ones you want.",
  "owner": {
    "name": "keenskills"
  },
  "plugins": [
    {
      "name": "page-as-data",
      "source": "./packages/page-as-data",
      "description": "Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths."
    }
  ]
}
```

- [ ] **Step 7: Run everything**

Run: `pnpm test:repo && (cd packages/page-as-data && npm test)`
Expected: PASS for both.

- [ ] **Step 8: Check the tarball did not change shape**

Run: `(cd packages/page-as-data && npm pack --dry-run --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].files.map(f=>f.path).sort().join(" ")))'`
Expected exactly: `LICENSE README.md cli.mjs install.mjs package.json page-as-data.js skill/page-as-data.md tui.mjs wizard.mjs`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Publish page-as-data as @keenskills/page-as-data and move the marketplace to the root"
```

---

## Task 4: Root CI and tag-based publishing

**Files:**
- Create: `scripts/release-target.mjs`
- Create: `test/release-target.test.mjs`
- Create: `.github/workflows/test.yml`
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Produces: `releaseTarget(tag: string, root?: URL) => { name: string, dir: string, version: string }`, throws `Error` with a plain-English message on a bad tag, missing package or version mismatch. As a script: `node scripts/release-target.mjs <tag>` prints `name=…`, `dir=…`, `version=…` lines (for `$GITHUB_OUTPUT`) or prints the error and exits 1.

- [ ] **Step 1: Write the failing test** `test/release-target.test.mjs`

```js
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { releaseTarget } from '../scripts/release-target.mjs'

function fakeRepo(version) {
  const dir = mkdtempSync(join(tmpdir(), 'release-'))
  mkdirSync(join(dir, 'packages/page-as-data'), { recursive: true })
  writeFileSync(join(dir, 'packages/page-as-data/package.json'), JSON.stringify({ name: '@keenskills/page-as-data', version }))
  return pathToFileURL(`${dir}/`)
}

describe('releaseTarget', () => {
  it('maps a package tag to its folder and version', () => {
    assert.deepEqual(releaseTarget('page-as-data@v0.2.0', fakeRepo('0.2.0')), { name: 'page-as-data', dir: 'packages/page-as-data', version: '0.2.0' })
  })

  it('accepts a prerelease', () => {
    assert.equal(releaseTarget('page-as-data@v0.3.0-beta.1', fakeRepo('0.3.0-beta.1')).version, '0.3.0-beta.1')
  })

  for (const tag of ['v0.2.0', 'page-as-data@0.2.0', 'page-as-data@v0.2', '@v0.2.0']) {
    it(`rejects the malformed tag ${tag}`, () => {
      assert.throws(() => releaseTarget(tag, fakeRepo('0.2.0')), /expected a tag like page-as-data@v1\.2\.3/)
    })
  }

  it('rejects a package that does not exist', () => {
    assert.throws(() => releaseTarget('pageasdata@v0.2.0', fakeRepo('0.2.0')), /no package at packages\/pageasdata/)
  })

  it('rejects a tag that does not match package.json', () => {
    assert.throws(() => releaseTarget('page-as-data@v0.2.0', fakeRepo('0.1.1')), /tag says 0\.2\.0 but packages\/page-as-data\/package\.json says 0\.1\.1/)
  })

  it('fails the workflow step with exit code 1', () => {
    const script = new URL('../scripts/release-target.mjs', import.meta.url).pathname
    assert.throws(() => execFileSync('node', [script, 'v0.2.0'], { stdio: 'pipe' }), (e) => e.status === 1)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test:repo`
Expected: FAIL, `Cannot find module .../scripts/release-target.mjs`.

- [ ] **Step 3: Write `scripts/release-target.mjs`**

```js
// Maps a release tag to the package it publishes, so one publish workflow
// serves every package. A wrong tag must stop the job before npm publish.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TAG = /^(?<name>[a-z0-9][a-z0-9-]*)@v(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

export function releaseTarget(tag, root = new URL('../', import.meta.url)) {
  const m = TAG.exec(tag)
  if (!m) throw new Error(`"${tag}" is not a release tag: expected a tag like page-as-data@v1.2.3`)
  const { name, version } = m.groups
  const dir = `packages/${name}`
  const file = new URL(`${dir}/package.json`, root)
  if (!existsSync(file)) throw new Error(`no package at ${dir} for tag ${tag}`)
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (pkg.version !== version) throw new Error(`tag says ${version} but ${dir}/package.json says ${pkg.version}`)
  return { name, dir, version }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const t = releaseTarget(process.argv[2] ?? '')
    console.log(`name=${t.name}\ndir=${t.dir}\nversion=${t.version}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm test:repo`
Expected: PASS, all `releaseTarget` and marketplace tests.

- [ ] **Step 5: Write `.github/workflows/test.yml`**

```yaml
name: test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  repo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --test "test/*.test.mjs"

  page-as-data:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    defaults:
      run:
        working-directory: packages/page-as-data
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      # ubuntu-latest ships Google Chrome at /usr/bin/google-chrome.
      - run: npm test

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
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
      # Lint only: rendering needs draw.io desktop, which CI does not have.
      - run: python tests/selftest.py
```

- [ ] **Step 6: Write `.github/workflows/publish.yml`**

```yaml
name: publish

on:
  push:
    tags: ['*@v*']

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
      - id: target
        run: node scripts/release-target.mjs "$GITHUB_REF_NAME" >> "$GITHUB_OUTPUT"
      # ubuntu-latest ships Google Chrome at /usr/bin/google-chrome.
      - run: npm test
        working-directory: ${{ steps.target.outputs.dir }}
      - run: npm publish
        working-directory: ${{ steps.target.outputs.dir }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add root CI for every package and tag-based publishing"
```

---

## Task 5: Root docs, push, first release, retire the old names

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`
- Modify: `packages/page-as-data/CLAUDE.md` (Release section)
- Modify: `packages/page-as-data/package.json` (`version` 0.2.0 via `npm version`)

**Interfaces:**
- Consumes: Task 0 (orgs and token), Tasks 1 to 4.

- [ ] **Step 1: Write the root `README.md`**

```markdown
# Keen Skills

Agent skills by rajaaltus and gjohnpaull. Each skill is its own package: install only the ones you want.

| Skill | What it does | Install |
| --- | --- | --- |
| [page-as-data](packages/page-as-data) | Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths. | `npx @keenskills/page-as-data init` |
| [drawing-architecture-diagrams](packages/drawing-architecture-diagrams) | Professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF. | See its README (one-command install arrives in the next release) |

## Claude Code

    /plugin marketplace add keenskills/skills
    /plugin install page-as-data@keenskills

## License

MIT. See each package for its own copyright lines.
```

- [ ] **Step 2: Write the root `CLAUDE.md`**

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`keenskills/skills` is the monorepo for the Keen Skills agent skills. Each package under `packages/` is a separate product with its own version, changelog, tests and `CLAUDE.md`; read the package's `CLAUDE.md` before changing it. The design for the repo and the upcoming site is `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md`.

| Path | What |
| --- | --- |
| `packages/page-as-data` | `@keenskills/page-as-data`, Node 22+, zero dependencies, tests need Chrome |
| `packages/drawing-architecture-diagrams` | Python 3.9+ diagram design system; lint tests run anywhere, rendering needs draw.io desktop |
| `.claude-plugin/marketplace.json` | Claude Code marketplace `keenskills`; lists each plugin separately |
| `scripts/release-target.mjs` | Maps a tag like `page-as-data@v0.2.0` to its package for `publish.yml` |

## Commands

```sh
pnpm test                 # root checks, every package's npm test, the diagram selftest
pnpm test:repo            # root checks only: marketplace, release tags
pnpm --filter @keenskills/page-as-data test
pnpm test:diagrams
```

## Release

From the package folder: `npm version <patch|minor|major> --no-git-tag-version`, commit, then tag `<package>@v<version>` at the repo root and `git push --follow-tags`. `publish.yml` tests and publishes only that package, with provenance (needs the `NPM_TOKEN` secret). A local `npm publish` fails because of provenance; publish from CI.

## Conventions

- Packages stay independent: no imports across `packages/`, no shared runtime dependencies.
- The marketplace test in `test/repo.test.mjs` checks every listed plugin; keep a plugin's `plugin.json` version equal to its `package.json`.
- LF line endings only.
- Never use real client names in examples.
````

- [ ] **Step 3: Update the Release section of `packages/page-as-data/CLAUDE.md`**

Replace the section body with:

```markdown
From this folder: `npm version <patch|minor|major> --no-git-tag-version` (its `version` script regenerates the plugin files), commit, then tag `page-as-data@v<version>` and `git push --follow-tags` from the repo root. The root `.github/workflows/publish.yml` runs this package's tests, checks the tag against `package.json`, then publishes with provenance (needs the `NPM_TOKEN` secret). `provenance: true` means a local `npm publish` fails; publish from CI.
```

Also in that file, replace `the repo is also a Claude Code plugin marketplace` with `it is listed in the monorepo's Claude Code marketplace`, and the CI line with `CI (root .github/workflows/test.yml) runs npm test here on Node 22 and 24.`

- [ ] **Step 4: Run the full suite and commit**

Run: `pnpm test`
Expected: PASS.

```bash
git add -A
git commit -m "Add the monorepo README and CLAUDE.md"
```

- [ ] **Step 5: Push the repo (outward-facing: confirm with the user first; needs Task 0 Step 1)**

```bash
gh repo create keenskills/skills --public --source . --push --description "Keen Skills: agent skills for coding agents"
gh secret set NPM_TOKEN --repo keenskills/skills   # paste the Task 0 Step 3 token
```

Then check CI: `gh run watch --repo keenskills/skills`. Expected: `test` green on all five jobs.

- [ ] **Step 6: Release 0.2.0 (outward-facing: confirm with the user first; needs Task 0 Step 2)**

```bash
cd packages/page-as-data
npm version minor --no-git-tag-version
cd ../..
pnpm test:repo
git add -A
git commit -m "Release page-as-data 0.2.0"
git tag -a page-as-data@v0.2.0 -m "page-as-data 0.2.0"
git push --follow-tags
gh run watch --repo keenskills/skills
```

Expected: `publish` green; `npm view @keenskills/page-as-data version` prints `0.2.0`; `npx @keenskills/page-as-data --help` runs.

- [ ] **Step 7: Retire the old names (outward-facing: confirm with the user first)**

```bash
npm deprecate @rajaaltus/page-as-data "Moved to @keenskills/page-as-data"
```

In each old repo (`rajaaltus/page-as-data`, `rajaaltus/drawing-architecture-diagrams`), replace the top of `README.md` with a pointer, push, then archive:

```markdown
> **Moved.** This skill now lives in [keenskills/skills](https://github.com/keenskills/skills). This repo is archived.
```

```bash
gh repo archive rajaaltus/page-as-data --yes
gh repo archive rajaaltus/drawing-architecture-diagrams --yes
```

Old `/plugin marketplace add rajaaltus/page-as-data` installs keep working, frozen at 0.1.1.

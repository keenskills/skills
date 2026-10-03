// init / uninstall / doctor for the design document skill. Temp folders and a
// fake home, so no test touches the real ~/.claude.
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
const skill = join(pkg, 'skills', 'writing-design-documents')
const cli = join(pkg, 'cli.mjs')
const tmp = () => mkdtempSync(join(tmpdir(), 'wdd-'))
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
    assert.match(s, /^---\nname: writing-design-documents\ndescription: "Use when producing a client-facing design/)
    assert.match(s, /writing-design-documents:managed/)
    assert.match(s, /# Writing Design Documents/)
  })
})

describe('init', () => {
  it('installs a working skill folder for Claude Code in every project (--global)', () => {
    const home = tmp()
    applyPlan(planInstall({ root: tmp(), global: true, home }).actions)
    const dir = join(home, '.claude', 'skills', 'writing-design-documents')
    for (const f of ['SKILL.md', ...FILES]) assert.ok(existsSync(join(dir, f)), f)
    // The installed example must find docbuilder.py next to it and build a document that passes check.
    const work = tmp()
    const r = spawnSync('python3', [join(dir, 'examples', 'example_design_doc.py')], { cwd: work, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /check: clean/)
    assert.ok(existsSync(join(work, 'example-design.docx')))
  })

  it('gives single-file agents the text, and a folder with the files it names', () => {
    const root = tmp()
    applyPlan(planInstall({ root, agents: ['cursor'], home: tmp() }).actions)
    assert.match(readFileSync(join(root, '.cursor', 'rules', 'writing-design-documents.mdc'), 'utf8'), /are in `\.agents\/skills\/writing-design-documents\/`/)
    assert.ok(existsSync(join(root, '.agents', 'skills', 'writing-design-documents', 'scripts', 'docbuilder.py')))
  })

  it('works from any folder, as npx runs it', () => {
    const root = tmp()
    const r = run(['init', '--dry-run', '--agent', 'claude', '--dir', root], tmp())
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /would create \.claude\/skills\/writing-design-documents\/SKILL\.md \(Claude Code\)/)
    assert.match(r.stdout, /would create \.claude\/skills\/writing-design-documents\/scripts\/docbuilder\.py \(Claude Code\)/)
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
  it('reports Python, python-docx and pymupdf as the probe finds them', () => {
    const d = doctor({ run: () => '3.12.1\n1.2.0\n1.28.2\n', platform: 'darwin' })
    assert.deepEqual(d, { python: 'python3', pythonVersion: '3.12.1', pythonOk: true, docx: '1.2.0', pymupdf: '1.28.2', word: false, ok: true })
  })

  // Python on Windows writes \r\n to a pipe; a bare "\r" must not read as an installed module.
  it('reads Windows line endings from the probe', () => {
    const d = doctor({ run: () => '3.12.1\r\n1.2.0\r\n\r\n', platform: 'win32' })
    assert.deepEqual(d, { python: 'python3', pythonVersion: '3.12.1', pythonOk: true, docx: '1.2.0', pymupdf: null, word: true, ok: true })
  })

  it('needs python-docx, and says how to install it', () => {
    const d = doctor({ run: () => '3.13.5\n\n\n' })
    assert.equal(d.ok, false)
    assert.match(doctorLines(d)[1], /python-docx not found: run python3 -m pip install python-docx pymupdf/)
  })

  it('rejects Python older than 3.9', () => {
    const d = doctor({ run: () => '3.8.10\n1.1.0\n\n' })
    assert.equal(d.pythonOk, false)
    assert.equal(d.ok, false)
  })

  it('tries python3, then python, then says Python is missing', () => {
    const tried = []
    const d = doctor({ run: (cmd) => { tried.push(cmd); throw new Error('ENOENT') } })
    assert.deepEqual(tried, ['python3', 'python'])
    assert.match(doctorLines(d)[0], /Python 3\.9\+ not found/)
  })

  it('says pymupdf is only needed for the PDF checks, and Word only for finalize', () => {
    const lines = doctorLines({ python: 'python3', pythonVersion: '3.13.5', pythonOk: true, docx: '1.2.0', pymupdf: null, word: false, ok: true })
    assert.match(lines[2], /PDF page checks need it/)
    assert.match(lines[3], /Microsoft Word on Windows/)
  })

  it('runs the real probe', () => {
    const r = run(['doctor', '--json'], tmp())
    assert.equal(r.status, 0, r.stdout + r.stderr)
    const d = JSON.parse(r.stdout)
    assert.equal(d.pythonOk, true)
    assert.ok(d.docx, 'python-docx is installed where the tests run')
  })
})

describe('npm package', () => {
  it('publishes the CLI, the installer and the skill folder, and no Python caches', () => {
    const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: pkg, encoding: 'utf8' })
    const files = JSON.parse(r.stdout)[0].files.map((f) => f.path).sort()
    const skillFiles = ['SKILL.md', ...FILES].map((f) => `skills/writing-design-documents/${f}`)
    assert.deepEqual(files, ['CHANGELOG.md', 'LICENSE', 'README.md', 'cli.mjs', 'install.mjs', 'lib/skill-installer.mjs', 'package.json', ...skillFiles].sort())
  })
})

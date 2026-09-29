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

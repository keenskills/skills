// init / uninstall: planning and writing against temp folders. No Chrome needed.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseArgs, wantsWizard } from '../cli.mjs'
import { AGENT_IDS, BODY, END, MANAGED, START, applyPlan, planInstall, planUninstall, renderSkill, stripBlock, upsertBlock } from '../install.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'page-as-data-install-'))
const put = (root, path, text = '') => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}
const read = (root, path) => readFileSync(join(root, path), 'utf8')
// A fake home inside the temp folder, so no test can touch the real ~/.claude.
const plan = (root, opts = {}) => planInstall({ root, home: join(root, 'fake-home'), ...opts })
const summary = (p) => p.actions.map((a) => `${a.agent}:${a.action}`)

describe('rendering', () => {
  it('renders the Claude Code skill with valid frontmatter first, then the managed note and the body', () => {
    const skill = renderSkill()
    assert.match(skill, /^---\nname: page-as-data\ndescription: "[^"\n]+"\n---\n/)
    assert.ok(skill.includes(MANAGED))
    assert.ok(skill.endsWith(`${BODY}\n`))
  })

  it('uses the scoped package name in every command', () => {
    assert.match(BODY, /npx @keenskills\/page-as-data read/)
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

  it('refuses two blocks, as a merge can leave, rather than update one and keep a stale copy', () => {
    const two = `${blk}\n\n${blk}\n`
    assert.equal(upsertBlock(two, blk), null)
    assert.equal(stripBlock(two), null)
  })

  it('strips the block back to the exact text it was added to', () => {
    const text = '# Rules\n\nBe kind.\n'
    assert.equal(stripBlock(upsertBlock(text, blk)), text)
  })

  it('leaves text without a block as it is', () => {
    assert.equal(stripBlock('plain\n'), 'plain\n')
  })
})

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

  it('never removes the project folder, even when it is named page-as-data', () => {
    const root = join(tmp(), 'page-as-data')
    mkdirSync(root)
    applyPlan(plan(root, { agents: ['agents'] }).actions)
    applyPlan(unplan(root).actions)
    assert.ok(existsSync(root))
  })

  it('finds nothing to remove in a project it never touched', () => {
    assert.deepEqual(unplan(tmp()).actions, [])
  })
})

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

  it('runs when started through a symlink, as npm installs the command', () => {
    const link = join(tmp(), 'page-as-data')
    symlinkSync(cli, link)
    const r = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' })
    assert.match(r.stdout, /read a web page as data/)
  })

  it('opens the wizard only for a person at a terminal who gave no choices', () => {
    const tty = { stdin: { isTTY: true }, stdout: { isTTY: true } }
    assert.equal(wantsWizard(parseArgs(['init']), tty), true)
    assert.equal(wantsWizard(parseArgs(['init', '--global']), tty), true)
    for (const args of [['init', '--yes'], ['init', '-y'], ['init', '--agent', 'claude'], ['init', '--json'], ['init', '--dry-run'], ['uninstall']])
      assert.equal(wantsWizard(parseArgs(args), tty), false, args.join(' '))
    assert.equal(wantsWizard(parseArgs(['init']), { stdin: { isTTY: false }, stdout: { isTTY: true } }), false)
    assert.equal(wantsWizard(parseArgs(['init']), { stdin: { isTTY: true }, stdout: { isTTY: false } }), false)
  })

  it('ends a plain init with commands to try', () => {
    const r = run('init', '--yes', '--dir', tmp())
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /Next steps/)
    assert.match(r.stdout, /npx @keenskills\/page-as-data read http:\/\/localhost:3000 --width 390 --launch/)
  })

  it('prints the plan as JSON, without file contents', () => {
    const r = JSON.parse(run('init', '--json', '--dry-run', '--dir', tmp()).stdout)
    assert.equal(r.fallback, true)
    assert.deepEqual(r.actions.map((a) => a.action), ['create', 'create'])
    assert.ok(r.actions.every((a) => !('content' in a)))
  })
})

describe('Claude Code plugin', () => {
  const repo = new URL('../', import.meta.url)
  const json = (p) => JSON.parse(readFileSync(new URL(p, repo), 'utf8'))

  it('carries the same skill text as init (run npm run build:skill after editing skill/)', () => {
    assert.equal(readFileSync(new URL('skills/page-as-data/SKILL.md', repo), 'utf8'), renderSkill())
  })

  it('has the same version as the npm package', () => {
    assert.equal(json('.claude-plugin/plugin.json').version, json('package.json').version)
  })

  it('publishes the skill body with the npm package', () => {
    const pkg = json('package.json')
    assert.equal(pkg.name, '@keenskills/page-as-data')
    for (const f of ['install.mjs', 'tui.mjs', 'wizard.mjs', 'skill/']) assert.ok(pkg.files.includes(f), f)
  })
})

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

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

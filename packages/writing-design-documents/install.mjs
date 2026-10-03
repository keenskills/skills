/**
 * writing-design-documents init / uninstall — the skill folder
 * (skills/writing-design-documents: SKILL.md plus docbuilder.py and a worked
 * example) written for each coding agent by the installer every Keen Skills
 * package shares (lib/skill-installer.mjs, vendored from shared/).
 */
import { readFileSync } from 'node:fs'
import { createInstaller } from './lib/skill-installer.mjs'

// Read relative to this file, never the current folder: npx runs it from the npm cache.
const SKILL = new URL('./skills/writing-design-documents/', import.meta.url)
export const FILES = ['scripts/docbuilder.py', 'examples/example_design_doc.py']

const text = readFileSync(new URL('SKILL.md', SKILL), 'utf8')
const front = /^---\n([\s\S]*?)\n---\n/.exec(text)
const description = /^description:\s*(.+)$/m.exec(front[1])[1].trim()

export const {
  BODY, DESCRIPTION, MANAGED, START, END,
  owned, block, renderSkill, renderCursor, renderWindsurf, renderCopilot, renderPlain,
  upsertBlock, stripBlock, AGENTS, AGENT_IDS, selectAgents, planInstall, planUninstall, applyPlan,
} = createInstaller({
  name: 'writing-design-documents',
  pkg: '@keenskills/writing-design-documents',
  source: 'skills/writing-design-documents/SKILL.md',
  description,
  body: text.slice(front[0].length),
  files: FILES.map((rel) => ({ rel, content: readFileSync(new URL(rel, SKILL), 'utf8') })),
})

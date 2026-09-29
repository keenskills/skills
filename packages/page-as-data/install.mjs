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

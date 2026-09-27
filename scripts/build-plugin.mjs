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

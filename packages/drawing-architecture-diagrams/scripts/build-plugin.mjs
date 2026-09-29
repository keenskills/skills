// Keeps the Claude Code plugin at the npm package's version. Run by `npm version`.
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const file = new URL('../.claude-plugin/plugin.json', import.meta.url)
const plugin = JSON.parse(readFileSync(file, 'utf8'))
writeFileSync(file, `${JSON.stringify({ ...plugin, version: pkg.version }, null, 2)}\n`)

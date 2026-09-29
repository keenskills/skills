// Copies shared/skill-installer.mjs into every package that installs a skill.
// Each package is published alone and stays dependency-free, so it ships its
// own copy of the one source; test/sync-shared.test.mjs catches a stale copy.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TARGETS = ['packages/page-as-data', 'packages/drawing-architecture-diagrams']
const HEADER = '// Generated from shared/skill-installer.mjs by scripts/sync-shared.mjs. Edit that file, then run pnpm sync.\n'
const root = new URL('../', import.meta.url)

export const vendored = () => HEADER + readFileSync(new URL('shared/skill-installer.mjs', root), 'utf8')

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  for (const t of TARGETS) {
    mkdirSync(new URL(`${t}/lib/`, root), { recursive: true })
    writeFileSync(new URL(`${t}/lib/skill-installer.mjs`, root), vendored())
    console.log(`wrote ${t}/lib/skill-installer.mjs`)
  }
}

// Serves the static export and runs page-as-data over every page at phone and
// desktop widths: the site has to pass the tool it advertises. Exits with
// page-as-data's code (0 clean, 1 problems found, 2 could not run).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveFile, serveExport } from './serve-export.mjs'

export { resolveFile }

/** Every page in the export, as URL paths. */
export function routesFrom(outDir) {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '_next' ? [] : walk(join(d, e.name))) : [join(d, e.name)]))
  return walk(outDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => relative(outDir, f).split(sep).join('/'))
    .filter((f) => !/(^|\/)(404|_[^/]*)\.html$/.test(f))
    .map((f) => `/${f.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '')}`)
    .sort()
}

async function main() {
  const outDir = fileURLToPath(new URL('../out', import.meta.url))
  if (!existsSync(outDir)) {
    console.error('No out/ folder: run pnpm build first.')
    return 2
  }
  const routes = routesFrom(outDir)
  const server = await serveExport(outDir)
  const base = server.base
  console.log(`page-as-data check: ${routes.length} pages at 390 and 1440 px`)
  const code = await new Promise((done) => {
    const child = spawn('pnpm', ['exec', 'page-as-data', 'check', ...routes.map((r) => base + r), '--widths', '390,1440', '--launch'], { stdio: 'inherit' })
    child.on('exit', (c) => done(c ?? 2))
    child.on('error', () => done(2))
  })
  server.close()
  return code
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = await main()

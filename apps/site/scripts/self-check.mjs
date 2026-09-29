// Serves the static export and runs page-as-data over every page at phone and
// desktop widths: the site has to pass the tool it advertises. Exits with
// page-as-data's code (0 clean, 1 problems found, 2 could not run).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
}

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

/** The file a static host would serve for a URL path, or null. Never outside outDir. */
export function resolveFile(outDir, urlPath) {
  let p
  try {
    p = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return null
  }
  p = p.replace(/\/+$/, '') || '/index'
  const base = resolve(outDir)
  for (const cand of [p, `${p}.html`, `${p}/index.html`]) {
    const file = resolve(base, `.${cand}`)
    if (!file.startsWith(base + sep)) return null
    if (existsSync(file) && statSync(file).isFile()) return file
  }
  return null
}

async function main() {
  const outDir = fileURLToPath(new URL('../out', import.meta.url))
  if (!existsSync(outDir)) {
    console.error('No out/ folder: run pnpm build first.')
    return 2
  }
  const routes = routesFrom(outDir)
  const notFound = join(outDir, '404.html')
  const server = createServer((req, res) => {
    const file = resolveFile(outDir, req.url ?? '/')
    if (file) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      return res.end(readFileSync(file))
    }
    res.writeHead(404, { 'content-type': TYPES['.html'] })
    res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found')
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${server.address().port}`
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

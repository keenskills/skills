// Serves the static export the way Vercel does (clean URLs, 404.html), for the
// self-check and the interaction tests. Never serves a file outside outDir.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.pdf': 'application/pdf', '.drawio': 'application/xml',
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

export async function serveExport(outDir) {
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
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

// Runs the real tools on the showcase inputs and commits what they print, so the
// site never shows output nobody could reproduce. Needs Chrome for page-as-data,
// python3 for the diagram lint and draw.io desktop for the diagram renders.
// Run locally: pnpm --filter @keenskills/site showcases [--only page-as-data|architecture-diagrams]
// CI cannot render with draw.io, so tests/showcases.test.mjs regenerates only
// what it can and compares.
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = fileURLToPath(new URL('../', import.meta.url))
const repo = fileURLToPath(new URL('../../../', import.meta.url))
const PAD = join(repo, 'packages/page-as-data')
export const SHOWN_ORIGIN = 'http://localhost:3000'
const NPX = 'npx @keenskills/page-as-data'

/** Output as a reader should see it: a fixed origin, LF, no local paths, no trailing blank lines. Timings stay real. */
export function normalizeOutput(text, origin) {
  return text
    .replaceAll(origin, SHOWN_ORIGIN)
    .replace(/\r\n/g, '\n')
    // The shown command has no --screenshot (the picture is on the page), so neither does its output.
    .replace(/^Screenshot saved to .*$\n?/m, '')
    .replace(/(file:\/\/)?\/(Users|home)\/[^\s:]+/g, '<local path>')
    .trimEnd()
}

/** What the drift check compares: timings masked, lines sorted (requests finish in any order). */
export const comparable = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/\b\d+ms\b/g, '<ms>').trimEnd())
    .sort()
    .join('\n')

/** Width and height from a PNG's IHDR chunk, so <img> reserves its box and nothing shifts. */
export const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) })

/** Runs a command without blocking the event loop (the fixture server lives in this process). */
export function run(cmd, args, opts = {}) {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', fail)
    child.on('exit', (code) => done({ code, out, err }))
  })
}

/** Serves the fixture at / and 404s everything else, like a dev server with missing assets. */
async function serveFixture() {
  const html = readFileSync(join(PAD, 'test/fixture.html'))
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(html)
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found')
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

// A fresh debugging port per Chrome launch: reusing one races a Chrome still shutting down.
let port = 9500
const cli = (args) => run(process.execPath, [join(PAD, 'cli.mjs'), ...args, '--port', String(port++)])

export async function pageAsDataShowcase({ publicDir = join(site, 'public/showcase/page-as-data') } = {}) {
  mkdirSync(publicDir, { recursive: true })
  const { origin, close } = await serveFixture()
  try {
    const read = {}
    for (const width of [390, 1440]) {
      const file = join(publicDir, `fixture-${width}.png`)
      const r = await cli(['read', `${origin}/`, '--width', String(width), '--launch', '--screenshot', file])
      if (r.code === 2) throw new Error(`page-as-data read could not run: ${r.err || r.out}`)
      read[width] = {
        command: `${NPX} read ${SHOWN_ORIGIN}/ --width ${width} --launch`,
        output: normalizeOutput(r.out, origin),
        exit: r.code,
        screenshot: { src: `/showcase/page-as-data/fixture-${width}.png`, ...pngSize(readFileSync(file)) },
      }
    }
    const c = await cli(['check', `${origin}/`, '--widths', '390,1440', '--launch'])
    if (c.code === 2) throw new Error(`page-as-data check could not run: ${c.err || c.out}`)
    return {
      fixture: 'https://github.com/keenskills/skills/blob/main/packages/page-as-data/test/fixture.html',
      widths: [390, 1440],
      read,
      check: { command: `${NPX} check ${SHOWN_ORIGIN}/ --widths 390,1440 --launch`, output: normalizeOutput(c.out, origin), exit: c.code },
    }
  } finally {
    close()
  }
}

export const SKILL_DIR = join(repo, 'packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams')
const ARCH = join(SKILL_DIR, 'scripts/archdiagram.py')
const EXAMPLE = join(SKILL_DIR, 'examples/event_driven_platform_a4.py')
const DRAFT = join(site, 'showcase/northwind_draft.py')
export const python = (args, opts = {}) => run('python3', args, { env: { ...process.env, ARCHDIAGRAM_DIR: join(SKILL_DIR, 'scripts') }, ...opts })

async function lint(file, shown) {
  const r = await python([ARCH, 'lint', file])
  return { command: `python scripts/archdiagram.py lint ${shown}`, output: r.out.trimEnd(), exit: r.code }
}

async function renderPng(file, scale) {
  const r = await python([ARCH, 'render', file, '--formats', 'png', '--scale', String(scale)])
  if (r.code !== 0) throw new Error(`render failed: ${r.err || r.out}`)
}

/** The diagram loop: the worked example as the final, a linted first draft of it, the fixes between. */
export async function diagramShowcase({ publicDir = join(site, 'public/showcase/architecture-diagrams'), render = true } = {}) {
  mkdirSync(publicDir, { recursive: true })
  const tmp = mkdtempSync(join(tmpdir(), 'northwind-'))
  const final = join(tmp, 'northwind.drawio')
  const draft = join(tmp, 'northwind-draft.drawio')
  const made = await python([EXAMPLE, final])
  if (made.code !== 0) throw new Error(`example failed: ${made.err}`)
  const d = await python([DRAFT, final, draft])
  if (d.code !== 0) throw new Error(`draft failed: ${d.err || d.out}`)
  const fixes = JSON.parse(d.out)
  copyFileSync(final, join(publicDir, 'northwind.drawio'))

  const pub = (name) => `/showcase/architecture-diagrams/${name}`
  if (render) {
    // Downloads: the default export (3x PNG cropped to the frame, PDF at page size).
    const r = await python([ARCH, 'render', final])
    if (r.code !== 0) throw new Error(`render failed: ${r.err || r.out}`)
    copyFileSync(join(tmp, 'northwind.png'), join(publicDir, 'northwind.png'))
    copyFileSync(join(tmp, 'northwind.pdf'), join(publicDir, 'northwind.pdf'))
    // On-page images: 2x is sharp on retina and a fraction of the download's weight.
    for (const [src, name] of [[final, 'northwind-view'], [draft, 'northwind-draft-view']]) {
      const copy = join(tmp, `${name}.drawio`)
      copyFileSync(src, copy)
      await renderPng(copy, 2)
      copyFileSync(join(tmp, `${name}.png`), join(publicDir, `${name}.png`))
    }
  }
  // Without draw.io (CI) the committed renders stand; their sizes still come from the files.
  const imageDir = render ? publicDir : join(site, 'public/showcase/architecture-diagrams')
  const image = (name) => ({ src: pub(name), ...pngSize(readFileSync(join(imageDir, name))) })
  return {
    example: 'https://github.com/keenskills/skills/blob/main/packages/drawing-architecture-diagrams/skills/drawing-architecture-diagrams/examples/event_driven_platform_a4.py',
    draft: { lint: await lint(draft, 'northwind-draft.drawio'), image: image('northwind-draft-view.png') },
    fixes,
    final: { lint: await lint(final, 'northwind.drawio'), image: image('northwind-view.png') },
    downloads: [
      { label: 'draw.io file', href: pub('northwind.drawio'), ext: '.drawio' },
      { label: 'PNG, 3×', href: pub('northwind.png'), ext: '.png' },
      { label: 'PDF, A4 landscape', href: pub('northwind.pdf'), ext: '.pdf' },
    ],
  }
}

const write = (name, data) => {
  const dir = join(site, 'content/showcase')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), `${JSON.stringify(data, null, 2)}\n`)
  console.log(`wrote content/showcase/${name}`)
}

async function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
  if (!only || only === 'page-as-data') write('page-as-data.json', await pageAsDataShowcase())
  if (!only || only === 'architecture-diagrams') write('architecture-diagrams.json', await diagramShowcase())
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) await main()

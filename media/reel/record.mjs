// Renders reel.html frame by frame in headless Chrome and pipes the frames to
// ffmpeg. Usage: node record.mjs [out.mp4] [--from 0 --to 15 --fps 60]
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d }
const out = resolve(args.find((a) => a.endsWith('.mp4')) ?? join(here, 'keen-skills-reel.mp4'))
const FPS = opt('fps', 60), FROM = opt('from', 0), TO = opt('to', 15)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const profile = mkdtempSync(join(tmpdir(), 'reel-chrome-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', '--disable-gpu-vsync', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((ok, fail) => {
  let buf = ''
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]) })
  chrome.on('exit', () => fail(new Error('Chrome exited: ' + buf)))
})

const port = new URL(wsUrl).port
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((ok, fail) => { const i = ++id; pending.set(i, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result))); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value }

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await send('Page.enable')
const loaded = new Promise((r) => ws.addEventListener('message', (e) => JSON.parse(e.data).method === 'Page.loadEventFired' && r()))
await send('Page.navigate', { url: pathToFileURL(join(here, 'reel.html')).href + '?render' })
await loaded
await evaluate('window.ready')

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })
const total = Math.round((TO - FROM) * FPS)
for (let f = 0; f < total; f++) {
  const t = FROM + f / FPS
  await evaluate(`render(${t})`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, captureBeyondViewport: false })
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))
  if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total}`)
}
ff.stdin.end()
await new Promise((r) => ff.on('close', r))
ws.close(); chrome.kill()
await new Promise((r) => chrome.once('exit', r))
rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
console.log(`\nwrote ${out}`)

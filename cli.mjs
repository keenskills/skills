#!/usr/bin/env node
/**
 * page-as-data — read a web page as data instead of a screenshot.
 * Zero dependencies (Node 22+ and a Chrome/Chromium/Edge).
 *
 *   page-as-data read  <url> [--width 390] [--click <name>]... [--fill <label=value>]...
 *                            [--press <key>]... [--wait-for <text>]...
 *                            [--inspect <text|selector>]... [--screenshot <file.png>]
 *   page-as-data check <url...> [--widths 390,1440] [--strict]
 *   page-as-data init      [--agent claude,cursor,...|all] [--global] [--force] [--dry-run] [--dir <path>]
 *   page-as-data uninstall [--agent ...] [--global] [--dry-run] [--dir <path>]
 *
 *   common: [--port 9222 | --launch] [--json] [--timeout 15000]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyPlan, planInstall, planUninstall } from './install.mjs'

const IN_PAGE = readFileSync(new URL('./page-as-data.js', import.meta.url), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Chrome: attach to a running one, or launch a headless one.

const CHROME_PATHS = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
}

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return (CHROME_PATHS[process.platform] ?? []).find((p) => existsSync(p)) ?? null
}

async function devtoolsVersion(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function launchChrome(port) {
  const chrome = findChrome()
  if (!chrome) throw new Error('No Chrome found. Set CHROME_PATH, or start Chrome yourself with --remote-debugging-port.')
  const profile = mkdtempSync(join(tmpdir(), 'page-as-data-'))
  const child = spawn(
    chrome,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  let stderr = ''
  child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)))
  let exited = null
  child.on('exit', (code) => (exited = code))
  // A first start on a cold machine (a fresh CI runner) can take well over 10s.
  const deadline = Date.now() + 30000
  while (!(await devtoolsVersion(port))) {
    if (exited !== null) throw new Error(`Chrome exited (code ${exited}) before it opened port ${port}:\n${stderr.trim()}`)
    if (Date.now() > deadline) {
      child.kill()
      throw new Error(`Chrome did not open port ${port} within 30s:\n${stderr.trim()}`)
    }
    await sleep(100)
  }
  child.stderr.destroy()
  return {
    close: () => {
      child.kill()
      try {
        rmSync(profile, { recursive: true, force: true })
      } catch {
        // Chrome can hold the profile a moment longer on Windows; it is in tmp.
      }
    },
  }
}

const NAMED_KEYS = {
  Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, Space: 32,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34,
}

/** CDP key event fields for "F9", "Enter", "a", "7"... */
export function keyEvent(key) {
  const fn = /^F([1-9]|1[0-2])$/.exec(key)
  if (fn) return { key, code: key, windowsVirtualKeyCode: 111 + Number(fn[1]) }
  if (key in NAMED_KEYS) {
    const k = key === 'Space' ? ' ' : key
    return { key: k, code: key, windowsVirtualKeyCode: NAMED_KEYS[key], ...(key === 'Space' ? { text: ' ' } : key === 'Enter' ? { text: '\r' } : {}) }
  }
  if (key.length === 1) {
    const code = /[0-9]/.test(key) ? `Digit${key}` : /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : ''
    return { key, code, text: key, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) }
  }
  throw new Error(`Unknown key "${key}". Use a character, F1-F12, or one of: ${Object.keys(NAMED_KEYS).join(', ')}`)
}

/** A minimal Chrome DevTools Protocol client over Node's built-in WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', () => reject(new Error(`Could not connect to ${wsUrl}`)))
  })
  let id = 0
  const pending = new Map()
  const listeners = new Set()
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result)
    } else if (msg.method) for (const l of listeners) l(msg)
  })
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const i = ++id
        pending.set(i, { resolve, reject })
        ws.send(JSON.stringify({ id: i, method, params, sessionId }))
      }),
    on: (listener) => listeners.add(listener),
    waitFor: (predicate, timeoutMs) =>
      new Promise((resolve) => {
        const listener = (msg) => predicate(msg) && done(true)
        const timer = setTimeout(() => done(false), timeoutMs)
        function done(value) {
          listeners.delete(listener)
          clearTimeout(timer)
          resolve(value)
        }
        listeners.add(listener)
      }),
    close: () => ws.close(),
  }
}

/**
 * Opens a fresh tab with page-as-data.js injected before every document, and
 * records console errors, uncaught exceptions and failed requests as they
 * happen. The tab is closed again by `close()` — your own tabs are untouched.
 */
async function openTab({ port = 9222, launch = false } = {}) {
  const launched = launch ? await launchChrome(port) : null
  const version = await devtoolsVersion(port)
  if (!version) {
    launched?.close()
    throw new Error(`No Chrome is listening on port ${port}. Start one with --remote-debugging-port=${port}, or pass --launch.`)
  }
  const cdp = await connect(version.webSocketDebuggerUrl)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const send = (method, params) => cdp.send(method, params, sessionId)

  const events = { console: [], exceptions: [], failedRequests: [], log: [] }
  const requests = new Map()
  // The browser asks for /favicon.ico on its own; a missing one is not the app's bug.
  const ignored = (url) => /\/favicon\.ico(\?|$)/.test(url ?? '')
  cdp.on((m) => {
    if (m.sessionId !== sessionId) return
    const p = m.params
    if ((m.method === 'Network.responseReceived' && ignored(p.response.url)) || (m.method === 'Network.loadingFailed' && ignored(requests.get(p.requestId)?.url)))
      return
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(p.type))
      events.console.push({ level: p.type, text: p.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500) })
    else if (m.method === 'Runtime.exceptionThrown')
      events.exceptions.push((p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split('\n').slice(0, 3).join(' | '))
    else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level) && p.entry.source !== 'network')
      events.log.push({ level: p.entry.level, source: p.entry.source, text: p.entry.text.slice(0, 300) })
    else if (m.method === 'Network.requestWillBeSent') requests.set(p.requestId, { url: p.request.url, method: p.request.method })
    else if (m.method === 'Network.responseReceived' && p.response.status >= 400)
      events.failedRequests.push({ status: p.response.status, method: requests.get(p.requestId)?.method, url: p.response.url })
    else if (m.method === 'Network.loadingFailed' && !p.canceled)
      events.failedRequests.push({ status: p.errorText, method: requests.get(p.requestId)?.method, url: requests.get(p.requestId)?.url })
  })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Page.bringToFront') // a background tab never finishes React 19 streaming
  await send('Page.addScriptToEvaluateOnNewDocument', { source: IN_PAGE })

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: `(async () => { if (!window.__pageAsData) throw new Error('page-as-data.js did not load in this page'); return (${expression}) })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description?.split('\n')[0] ?? exceptionDetails.text)
    return result.value
  }

  return {
    events,
    evaluate,
    async setWidth(width) {
      const phone = width < 768
      await send('Emulation.setDeviceMetricsOverride', { width, height: phone ? 844 : 900, deviceScaleFactor: phone ? 3 : 1, mobile: phone })
      await send('Emulation.setTouchEmulationEnabled', { enabled: phone })
    },
    async goto(url, timeoutMs) {
      for (const list of Object.values(events)) list.length = 0
      const loaded = cdp.waitFor((m) => m.method === 'Page.loadEventFired' && m.sessionId === sessionId, timeoutMs)
      const nav = await send('Page.navigate', { url })
      if (nav.errorText) throw new Error(`Could not open ${url}: ${nav.errorText}`)
      // A same-document navigation (only the #hash changed) has no loaderId and
      // fires no load event: waiting for one would burn the whole timeout.
      if (nav.loaderId) await loaded
      return evaluate(`window.__pageAsData.settle({ timeoutMs: ${Number(timeoutMs)} })`)
    },
    /** A real (trusted) key press, as a keyboard shortcut handler sees it. */
    async press(key, timeoutMs) {
      const k = keyEvent(key)
      await send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', ...k })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k, text: undefined })
      return { pressed: key, ...(await evaluate(`window.__pageAsData.settle({ timeoutMs: ${Number(timeoutMs)} })`)) }
    },
    async screenshot(file) {
      // Finish what is still animating, then let two frames paint, so the
      // picture shows the settled state rather than the last composited frame.
      await evaluate('window.__pageAsData.settle({ timeoutMs: 3000 }).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))')
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(file, Buffer.from(data, 'base64'))
    },
    async close() {
      await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
      cdp.close()
      launched?.close()
    },
  }
}

// ---------------------------------------------------------------------------
// Commands

/** Sorts one page's layout findings into errors (defects) and warnings. */
export function classifyLayout(issues, settle) {
  const errors = []
  const warnings = []
  if (issues.pageOverflow)
    errors.push({
      kind: 'page-overflow',
      message: `Page is ${issues.pageOverflow.scrollWidth}px wide in a ${issues.pageOverflow.viewport}px viewport, so it scrolls sideways`,
      detail: issues.pageOverflow.culprits.map((c) => `${c.element} ends at ${c.right}px`),
    })
  for (const c of issues.clippedControls)
    errors.push({ kind: 'clipped-control', message: `${c.control} is cut off (${c.visiblePct}% visible) by ${c.clippedBy}, and nothing scrolls to it` })
  for (const s of issues.stickyThatCannotStick) {
    const message = `${s.element} is sticky (top: ${s.top}) inside ${s.scrollBox} (overflow ${s.boxOverflow}), which never scrolls vertically, so it never sticks`
    if (s.displacedPx > 0)
      errors.push({ kind: 'sticky-displaced', message: `${message}, and its offset pushes it ${s.displacedPx}px down over the content below` })
    else warnings.push({ kind: 'sticky-cannot-stick', message })
  }
  for (const t of issues.smallTargets)
    warnings.push({ kind: 'small-target', message: `${t.control} is ${t.size}px, under WCAG 2.2's 24×24px, and too close to ${t.crowdedBy}` })
  if (settle && !settle.settled) warnings.push({ kind: 'not-settled', message: `Page never settled: ${JSON.stringify(settle.why)}` })
  return { errors, warnings }
}

/** `read`: one page, optionally after some steps, as data. */
export async function readPage({ url, width = 1440, steps = [], inspect = [], screenshot, timeoutMs = 15000, ...chrome }) {
  const tab = await openTab(chrome)
  try {
    await tab.setWidth(width)
    const settle = await tab.goto(url, timeoutMs)
    const stepLog = []
    const limit = JSON.stringify({ timeoutMs })
    for (const step of steps) {
      const result =
        step.click !== undefined
          ? await tab.evaluate(`window.__pageAsData.click(${JSON.stringify(step.click)}, ${limit})`)
          : step.press !== undefined
            ? await tab.press(step.press, timeoutMs)
            : step.waitFor !== undefined
              ? await tab.evaluate(`window.__pageAsData.waitFor(${JSON.stringify(step.waitFor)}, ${limit})`)
              : await tab.evaluate(`window.__pageAsData.fill(${JSON.stringify(step.label)}, ${JSON.stringify(step.value)}, ${limit})`)
      stepLog.push({ step, result })
      if (result.error) break
    }
    const page = await tab.evaluate('window.__pageAsData.read()')
    const layout = await tab.evaluate('window.__pageAsData.layoutIssues()')
    const inspected = []
    for (const q of inspect) inspected.push(await tab.evaluate(`window.__pageAsData.inspect(${JSON.stringify(q)})`))
    if (screenshot) await tab.screenshot(screenshot)
    return {
      url,
      width,
      settle,
      steps: stepLog,
      page,
      problems: {
        exceptions: tab.events.exceptions,
        consoleErrors: tab.events.console,
        browserLog: tab.events.log,
        failedRequests: tab.events.failedRequests,
        brokenImages: page.images.broken,
        invalidFields: page.form.filter((f) => f.invalid),
        layout: classifyLayout(layout, settle),
      },
      inspected,
      ...(screenshot ? { screenshot } : {}),
    }
  } finally {
    await tab.close()
  }
}

/** `check`: every url at every width; layout defects plus what broke behind the page. */
export async function checkPages({ urls, widths = [390, 1440], timeoutMs = 15000, ...chrome }) {
  const tab = await openTab(chrome)
  const results = []
  try {
    for (const width of widths) {
      await tab.setWidth(width)
      for (const url of urls) {
        try {
          const settle = await tab.goto(url, timeoutMs)
          const layout = classifyLayout(await tab.evaluate('window.__pageAsData.layoutIssues()'), settle)
          const finalUrl = await tab.evaluate('location.pathname + location.search + location.hash')
          for (const e of tab.events.exceptions) layout.errors.push({ kind: 'exception', message: `Uncaught: ${e}` })
          for (const r of tab.events.failedRequests)
            layout.errors.push({ kind: 'failed-request', message: `${r.method ?? ''} ${r.url} → ${r.status}`.trim() })
          for (const c of tab.events.console.filter((c) => c.level === 'error'))
            layout.warnings.push({ kind: 'console-error', message: `console.error: ${c.text}` })
          results.push({ url, width, finalUrl, settle, ...layout })
        } catch (e) {
          results.push({ url, width, error: e.message })
        }
      }
    }
  } finally {
    await tab.close()
  }
  return results
}

// ---------------------------------------------------------------------------
// Command line

const HELP = `page-as-data — read a web page as data instead of a screenshot

  page-as-data read <url> [options]
      What is on the screen (headings, text, dialogs, alerts, tables, form
      fields and their errors, buttons and their state) and what went wrong
      behind it (uncaught exceptions, console errors, failed requests, broken
      images, layout defects).

      --width 390               viewport width (default 1440)
      --click "New product"     click a control by its name; repeatable, in order
      --fill "Email=a@b.co"     fill a field by its label; repeatable, in order
      --press F9                press a key (real keyboard event): a character,
                                F1-F12, Enter, Escape, Tab, arrows...; repeatable
      --wait-for "Saved"        wait until this text is on screen (for long work
                                whose progress never goes quiet); uses --timeout
      --inspect "Save"          box, visibility, colours and contrast of an element
                                (text or CSS selector); repeatable
      --screenshot out.png      ALSO save a screenshot — only for what data
                                cannot answer (images, charts, visual polish)

  page-as-data check <url...> [options]
      Layout defects and runtime errors for every url at every width.
      Exit code 1 when an error is found, so it can gate CI.

      --widths 390,1440         widths to check (default 390,1440)
      --strict                  exit 1 on warnings too

  page-as-data init [options]
      Teach the coding agents in this project to use page-as-data instead of
      screenshots. Writes each agent's own skill or rule file; run it again to
      update. Without --agent, it installs for the agents the project uses.

      --agent claude,cursor     claude, agents (AGENTS.md), gemini, cursor,
                                windsurf, cline, copilot, or all
      --global                  Claude Code skill in ~/.claude, for every project
      --force                   replace a same-named file it did not write
      --dry-run                 show what would change; write nothing
      --dir path                project folder (default: the current folder)

  page-as-data uninstall [options]
      Remove what init wrote, and nothing else. Takes --agent, --global,
      --dry-run and --dir.

  Common
      --port 9222               attach to a Chrome started with --remote-debugging-port
                                (use this for pages behind a sign-in)
      --launch                  start a headless Chrome instead
      --json                    machine-readable output
      --timeout 15000           ms to wait for a page to settle

Exit code: 0 clean, 1 problems found, 2 could not run.`

export function parseArgs(argv) {
  const [command, ...rest] = argv
  const opts = {
    command, urls: [], widths: [390, 1440], width: 1440, steps: [], inspect: [], port: 9222, launch: false, json: false, strict: false, timeoutMs: 15000,
    agents: [], global: false, force: false, dryRun: false, dir: process.cwd(),
  }
  const value = (i, flag) => {
    if (rest[i] === undefined) throw new Error(`${flag} needs a value`)
    return rest[i]
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--widths') opts.widths = value(++i, a).split(',').map(Number)
    else if (a === '--width') opts.width = Number(value(++i, a))
    else if (a === '--click') opts.steps.push({ click: value(++i, a) })
    else if (a === '--press') opts.steps.push({ press: value(++i, a) })
    else if (a === '--wait-for') opts.steps.push({ waitFor: value(++i, a) })
    else if (a === '--fill') {
      const v = value(++i, a)
      const eq = v.indexOf('=')
      if (eq < 1) throw new Error('--fill takes "Label=value"')
      opts.steps.push({ label: v.slice(0, eq), value: v.slice(eq + 1) })
    } else if (a === '--inspect') opts.inspect.push(value(++i, a))
    else if (a === '--screenshot') opts.screenshot = value(++i, a)
    else if (a === '--port') opts.port = Number(value(++i, a))
    else if (a === '--timeout') opts.timeoutMs = Number(value(++i, a))
    else if (a === '--launch') opts.launch = true
    else if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--agent') opts.agents.push(...value(++i, a).split(',').map((s) => s.trim()).filter(Boolean))
    else if (a === '--global') opts.global = true
    else if (a === '--force') opts.force = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--dir') opts.dir = resolve(value(++i, a))
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`)
    else opts.urls.push(a)
  }
  if ([...opts.widths, opts.width].some((w) => !Number.isInteger(w) || w < 200)) throw new Error('Widths are pixel widths, e.g. 390 or 1440')
  return opts
}

const out = (line = '') => console.log(line)

function printRead(r) {
  const { page, problems } = r
  out(`${page.title || '(no title)'} — ${page.url} @ ${r.width}px${r.settle.settled ? `, settled in ${r.settle.ms}ms` : `, NOT settled: ${JSON.stringify(r.settle.why)}`}`)

  for (const { step, result } of r.steps) {
    const what =
      step.click !== undefined ? `click "${step.click}"`
      : step.press !== undefined ? `press ${step.press}`
      : step.waitFor !== undefined ? `wait for "${step.waitFor}"`
      : `fill "${step.label}" = "${step.value}"`
    const done = result.clicked ?? result.filled ?? (result.found !== undefined ? `on screen after ${result.ms}ms` : 'sent')
    const hint = result.controls ?? result.fields
    if (result.error) out(`  ✖ ${what}: ${result.error}
    ${hint ? `available: ${hint.join(' · ')}` : `on screen: ${result.onScreen ?? ''}`}`)
    else out(`  ✔ ${what} → ${done}${result.settled === false ? ' (did not settle)' : ''}`)
  }

  const list = []
  for (const e of problems.exceptions) list.push(`uncaught exception: ${e}`)
  for (const r2 of problems.failedRequests) list.push(`failed request: ${r2.method ?? ''} ${r2.url} → ${r2.status}`)
  for (const c of problems.consoleErrors) list.push(`console.${c.level}: ${c.text}`)
  for (const l of problems.browserLog) list.push(`browser ${l.level} (${l.source}): ${l.text}`)
  for (const i of problems.brokenImages) list.push(`broken image: ${i}`)
  for (const f of problems.invalidFields) list.push(`invalid field "${f.label}"${f.error ? `: ${f.error}` : ''}`)
  for (const e of problems.layout.errors) list.push(`layout: ${e.message}`)
  for (const w of problems.layout.warnings) list.push(`layout (warning): ${w.message}`)
  out(`\nPROBLEMS${list.length ? '' : ': none found'}`)
  for (const l of list) out(`  • ${l}`)

  if (page.dialogs.length) {
    out('\nOPEN DIALOGS')
    for (const d of page.dialogs) out(`  [${d.title}] ${d.text.replace(/\n/g, ' ').slice(0, 300)}`)
  }
  if (page.alerts.length) {
    out('\nALERTS / STATUS MESSAGES')
    for (const a of page.alerts) out(`  (${a.role}) ${a.text}`)
  }
  if (page.headings.length) {
    out('\nHEADINGS')
    for (const h of page.headings) out(`  ${'  '.repeat(h.level - 1)}h${h.level} ${h.text}`)
  }
  if (page.form.length) {
    out('\nFORM FIELDS')
    for (const f of page.form)
      out(`  ${f.label || f.name || '(unlabelled)'} [${f.type}] = ${JSON.stringify(f.value)}${f.required ? ' required' : ''}${f.disabled ? ' disabled' : ''}${f.invalid ? ` INVALID${f.error ? `: ${f.error}` : ''}` : ''}`)
  }
  for (const t of page.tables) {
    out(`\nTABLE ${t.index}${t.caption ? ` "${t.caption}"` : ''} — ${t.rowCount} rows`)
    if (t.headers.length) out(`  ${t.headers.join(' | ')}`)
    // ↗ marks a link; its href is in --json (text output would drown in URLs).
    for (const row of t.rows.slice(0, 10)) out(`  ${row.map((c) => (typeof c === 'string' ? c : `${c.text} ↗`)).join(' | ')}`)
    if (t.rowCount > 10) out(`  … ${t.rowCount - 10} more (use --json for all)`)
  }
  if (page.controls.length) {
    out('\nBUTTONS AND LINKS')
    out(`  ${page.controls.map((c) => `${c.name || '(unnamed)'}${c.disabled ? ' (disabled)' : ''}${c.expanded ? ` (expanded=${c.expanded})` : ''}`).join(' · ')}`)
  }
  for (const q of r.inspected) {
    out(`\nINSPECT "${q.query}" — ${q.found} found`)
    for (const e of q.elements) {
      out(`  ${e.element} at x${e.box.x} y${e.box.y} ${e.box.w}×${e.box.h}: ${e.visible ? 'visible' : `NOT visible (${e.hiddenBecause ?? `cut off by ${e.cutOffBy}, ${e.visiblePct}% shown`})`}${e.inViewport ? '' : ', outside the viewport'}${e.disabled ? ', disabled' : ''}`)
      out(`    colour ${e.styles.color} on ${e.styles.background}${e.contrast ? `, contrast ${e.contrast}:1 ${e.readable ? '(readable)' : '(TOO LOW)'}` : e.needsScreenshot ? `, contrast unknown: ${e.needsScreenshot}` : ''}; font ${e.styles.fontSize} ${e.styles.fontWeight}; ${e.styles.display}, ${e.styles.position}`)
    }
  }
  out('\nTEXT ON SCREEN')
  out(page.text.split('\n').map((l) => `  ${l}`).join('\n'))
  out(
    r.screenshot
      ? `\nScreenshot saved to ${r.screenshot}.`
      : '\nNeed to see images, a chart, or overall visual polish? Only that needs a picture: rerun with --screenshot out.png.',
  )
}

function printCheck(results) {
  for (const r of results) {
    const where = `${r.url} @ ${r.width}px`
    if (r.error) {
      out(`\n✖ ${where}\n  could not check: ${r.error}`)
      continue
    }
    const moved = r.finalUrl && !r.url.endsWith(r.finalUrl) ? `  (landed on ${r.finalUrl})` : ''
    if (!r.errors.length && !r.warnings.length) {
      out(`\n✔ ${where}${moved}  settled in ${r.settle.ms}ms`)
      continue
    }
    out(`\n${r.errors.length ? '✖' : '!'} ${where}${moved}`)
    for (const e of r.errors) {
      out(`  error    ${e.message}`)
      for (const d of e.detail ?? []) out(`           · ${d}`)
    }
    for (const w of r.warnings) out(`  warning  ${w.message}`)
  }
  const count = (k) => results.reduce((n, r) => n + (r[k]?.length ?? 0), 0)
  const failed = results.filter((r) => r.error).length
  out(`\n${results.length} page checks · ${count('errors')} errors · ${count('warnings')} warnings${failed ? ` · ${failed} could not run` : ''}`)
}

const DONE = { create: 'created', update: 'updated', unchanged: 'unchanged', skip: 'skipped', remove: 'removed', 'strip-block': 'removed its block from' }
const WOULD = { create: 'would create', update: 'would update', unchanged: 'unchanged', skip: 'would skip', remove: 'would remove', 'strip-block': 'would remove its block from' }

/** `init` / `uninstall`: write or remove the agent skill files. */
function installCommand(opts) {
  if (opts.urls.length) throw new Error(`${opts.command} takes no urls; use --dir for another project folder`)
  const home = homedir()
  const plan =
    opts.command === 'init'
      ? planInstall({ root: opts.dir, agents: opts.agents, global: opts.global, force: opts.force, home })
      : planUninstall({ root: opts.dir, agents: opts.agents, global: opts.global, home })
  if (!opts.dryRun) applyPlan(plan.actions)
  if (opts.json) {
    out(JSON.stringify({ ...plan, dryRun: opts.dryRun, actions: plan.actions.map(({ content, ...a }) => a) }, null, 2))
    return 0
  }
  if (plan.fallback) out('No agent files found here, so installing for Claude Code and AGENTS.md. Choose others with --agent.')
  const shown = (p) => {
    const inProject = relative(opts.dir, p)
    if (!inProject.startsWith('..') && !isAbsolute(inProject)) return inProject
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p
  }
  for (const a of plan.actions) {
    const mark = a.action === 'skip' ? '–' : a.action === 'unchanged' ? '·' : '✔'
    out(`${mark} ${(opts.dryRun ? WOULD : DONE)[a.action]} ${shown(a.path)} (${a.label})${a.reason ? `: ${a.reason}` : ''}`)
  }
  if (!plan.actions.length) out(opts.command === 'init' ? 'Nothing to install.' : 'Nothing to remove: no page-as-data files found.')
  return 0
}

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    return 2
  }
  if (['init', 'uninstall'].includes(opts.command)) {
    try {
      return installCommand(opts)
    } catch (e) {
      console.error(e.message)
      return 2
    }
  }
  if (!['read', 'check'].includes(opts.command) || !opts.urls.length) {
    out(HELP)
    return ['--help', '-h', 'help'].includes(opts.command) ? 0 : 2
  }
  try {
    if (opts.command === 'read') {
      if (opts.urls.length > 1) throw new Error('read takes one url; use check for several')
      const r = await readPage({ ...opts, url: opts.urls[0] })
      opts.json ? out(JSON.stringify(r, null, 2)) : printRead(r)
      const p = r.problems
      const found = p.exceptions.length + p.failedRequests.length + p.brokenImages.length + p.layout.errors.length
      return r.steps.some((s) => s.result.error) ? 2 : found ? 1 : 0
    }
    const results = await checkPages(opts)
    if (opts.json) for (const r of results) out(JSON.stringify(r))
    else printCheck(results)
    if (results.some((r) => r.error)) return 2
    return results.some((r) => r.errors.length || (opts.strict && r.warnings.length)) ? 1 : 0
  } catch (e) {
    console.error(e.message)
    return 2
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await main()

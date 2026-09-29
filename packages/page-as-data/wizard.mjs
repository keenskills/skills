/**
 * `page-as-data init` in a terminal: check the machine, ask which agents to
 * teach, write their files, try a real read, and end with commands to copy.
 * Only runs when a person is at the keyboard; scripts, CI and agents get the
 * plain `init` in cli.mjs.
 */
import { existsSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { AGENTS, applyPlan, planInstall, selectAgents } from './install.mjs'
import { banner, createTUI, isCancel } from './tui.mjs'

const PKG = '@rajaaltus/page-as-data'
const GUIDE = 'https://github.com/rajaaltus/page-as-data/blob/main/docs/usage.md'
const ATTACH_PORT = 9222
// Not 9222: a Chrome the user started for debugging may already hold it.
const LAUNCH_PORT = 9333
const ALSO = { agents: 'Codex, opencode, Amp', gemini: 'GEMINI.md', cline: '.clinerules', copilot: '.github/instructions' }

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** How to start a Chrome that page-as-data can attach to, for pages behind a sign-in. */
function chromeCommand(chrome) {
  const exe =
    chrome ??
    { darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }[process.platform] ??
    'google-chrome'
  return `"${exe}" --remote-debugging-port=${ATTACH_PORT} --user-data-dir=${join(tmpdir(), 'chrome-debug')}`
}

/** The commands to copy at the end, for this app's URL and way of reaching Chrome. */
export function nextSteps({ url, attach, chrome = null, written = false }) {
  const launch = attach ? '' : ' --launch'
  return [
    ...(written ? ['Commit the files above, so everyone on the team gets the skill.', ''] : []),
    'Ask your agent:',
    `  "Check ${url} on a phone and fix what breaks"`,
    '',
    'Or run it yourself:',
    '  Read a screen on a phone',
    `    npx ${PKG} read ${url} --width 390${launch}`,
    '  Reproduce a bug, then check the button',
    `    npx ${PKG} read ${url} --click "Save" --inspect "Save"${launch}`,
    '  Before calling UI work done (exit code 0 means clean)',
    `    npx ${PKG} check ${url}${launch}`,
    ...(attach ? ['', 'Start Chrome once, sign in, and keep it open:', `    ${chromeCommand(chrome)}`] : []),
    '',
    `Guide: ${GUIDE}`,
  ]
}

function summarize(r) {
  const p = r.problems
  const found = [
    ...p.exceptions.map((e) => `uncaught exception: ${e}`),
    ...p.failedRequests.map((f) => `failed request: ${[f.method, f.url].filter(Boolean).join(' ')} → ${f.status}`),
    ...p.brokenImages.map((src) => `broken image: ${src}`),
    ...p.layout.errors.map((e) => `layout: ${e.message}`),
  ]
  const timing = r.settle.settled ? ` in ${r.settle.ms}ms` : ' (never settled)'
  const head = `Read "${r.page.title || '(no title)'}"${timing}: ${plural(found.length, 'problem')}, ${plural(r.page.headings.length, 'heading')}, ${plural(r.page.controls.length, 'control')}`
  return { head, found }
}

/**
 * Runs the wizard. Chrome discovery and the page read are passed in, so the
 * flow can be tested without a browser. Returns the exit code.
 */
export async function runWizard({
  root,
  home = homedir(),
  input = process.stdin,
  output = process.stdout,
  color,
  columns = output.columns,
  version,
  nodeVersion = process.versions.node,
  findChrome,
  readPage,
}) {
  // Before any question: finding out after five answers is worse.
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No such folder: ${root}`)
  const tui = createTUI({ input, output, ...(color === undefined ? {} : { color }) })
  const cancelled = () => {
    tui.outro('Cancelled. Nothing was written.')
    return 130
  }
  const shown = (p) => {
    const inProject = relative(root, p)
    if (!inProject.startsWith('..') && !isAbsolute(inProject)) return inProject
    return p.startsWith(`${home}/`) || p.startsWith(`${home}\\`) ? `~${p.slice(home.length)}` : p
  }

  const art = banner({ columns, color: tui.color })
  if (art) tui.write(`\n${art}\n\n`)
  tui.intro(`page-as-data ${version}`)

  // --- the machine -----------------------------------------------------------
  const major = Number(nodeVersion.split('.')[0])
  if (major < 22) tui.warn(`Node ${nodeVersion}: page-as-data needs Node 22 or newer`)
  else tui.step(`Node ${nodeVersion}`)
  const chrome = findChrome()
  if (chrome) tui.step(`Chrome: ${chrome}`)
  else tui.warn('No Chrome found. Install Chrome, Chromium or Edge, or set CHROME_PATH. The skill still installs.')

  // --- which agents ----------------------------------------------------------
  const detected = selectAgents({ root })
  const found = detected.fallback ? [] : detected.ids
  if (found.length) tui.step(`Found ${plural(found.length, 'agent')} in this project: ${found.map((id) => AGENTS.find((a) => a.id === id).label).join(', ')}`)
  else tui.step('No agent files in this project yet, so Claude Code and AGENTS.md are suggested')
  const agents = await tui.multiselect({
    message: 'Select agents to install',
    noun: 'agents',
    initial: detected.ids,
    options: AGENTS.map((a) => {
      const { path, shared } = a.target(root, { global: false, home })
      const where = shared ? `Adds a marked block to ${shown(path)}; your own text stays as it is.` : `Writes ${shown(path)}.`
      const seen = found.includes(a.id)
      return {
        value: a.id,
        label: a.label,
        hint: [ALSO[a.id], seen && 'detected'].filter(Boolean).join(' · '),
        description: `${where} ${seen ? 'Found in this project.' : 'Not found in this project.'}`,
      }
    }),
  })
  if (isCancel(agents)) return cancelled()

  let global = false
  if (agents.includes('claude')) {
    const scope = await tui.select({
      message: 'Install the Claude Code skill for',
      options: [
        { value: 'project', label: 'This project', hint: '.claude/skills/, commit it for your team' },
        { value: 'global', label: 'All my projects', hint: '~/.claude/skills/' },
      ],
    })
    if (isCancel(scope)) return cancelled()
    global = scope === 'global'
  }

  // --- the app, to tailor the examples -----------------------------------------
  const url = await tui.text({
    message: "Your app's URL",
    initial: 'http://localhost:3000',
    validate: (v) => (/^https?:\/\/\S+$/.test(v) ? undefined : 'Start with http:// or https://'),
  })
  if (isCancel(url)) return cancelled()
  const mode = await tui.select({
    message: 'Pages behind a sign-in?',
    options: [
      { value: 'launch', label: 'No, start a headless Chrome', hint: '--launch' },
      { value: 'attach', label: 'Yes, use my own signed-in Chrome', hint: `--port ${ATTACH_PORT}` },
    ],
  })
  if (isCancel(mode)) return cancelled()
  const attach = mode === 'attach'

  // --- write -------------------------------------------------------------------
  const plan = planInstall({ root, agents, global, home })
  const changes = plan.actions.filter((a) => a.action === 'create' || a.action === 'update')
  const MARK = { create: '+', update: '~', unchanged: '·', skip: '–' }
  if (!changes.length) {
    tui.step('Already up to date')
    tui.note(plan.actions.map((a) => `${MARK[a.action]} ${shown(a.path)} (${a.label})${a.reason ? `: ${a.reason}` : ''}`))
  } else {
    tui.note(['', ...plan.actions.map((a) => `${MARK[a.action]} ${shown(a.path)} (${a.label})${a.reason ? `: ${a.reason}` : ''}`)])
    const ok = await tui.confirm({ message: `Write ${plural(changes.length, 'file')}?` })
    if (isCancel(ok)) return cancelled()
    if (!ok) {
      tui.outro('Nothing written.')
      return 0
    }
    applyPlan(plan.actions)
    tui.step(`Wrote ${plural(changes.length, 'file')}`)
  }

  // --- try it --------------------------------------------------------------------
  if (attach || chrome) {
    const tryIt = await tui.confirm({ message: `Try it now on ${url}?` })
    if (isCancel(tryIt)) return cancelled()
    if (tryIt) {
      const spin = tui.spinner()
      spin.start(`Reading ${url}…`)
      try {
        const r = await readPage({ url, width: 1440, launch: !attach, port: attach ? ATTACH_PORT : LAUNCH_PORT, timeoutMs: 15000 })
        const { head, found: problems } = summarize(r)
        spin.stop(head)
        tui.note([...problems.slice(0, 3).map((p) => `• ${p}`), ...(problems.length > 3 ? [`• …and ${problems.length - 3} more`] : []), `Full output: npx ${PKG} read ${url}${attach ? '' : ' --launch'}`])
      } catch (e) {
        spin.stop(`Could not read ${url}: ${e.message.split('\n')[0]}`, false)
        tui.note([attach ? 'Start Chrome as shown below and sign in, then try again.' : 'Start your app, then run the commands below.'])
      }
    }
  }

  tui.step('Next steps')
  tui.note(nextSteps({ url, attach, chrome, written: changes.length > 0 }))
  tui.outro('Your agents now read pages as data.')
  return 0
}

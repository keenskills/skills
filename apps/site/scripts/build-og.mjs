// Renders the social cards (1200 x 630 PNG) into public/og: one for the site
// and one per skill, with the copy the pages themselves use. Needs Chrome
// (CHROME_PATH, or the usual install paths) and network for the two fonts.
// Run after changing the copy, a skill's summary or install command, then commit.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SITE, ogImage } from '../lib/site.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const { skills } = JSON.parse(readFileSync(join(root, '.generated/content.json'), 'utf8'))
const icon = `data:image/png;base64,${readFileSync(join(root, 'app/icon.png')).toString('base64')}`
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('build-og: Chrome not found; set CHROME_PATH')

/** One card. `lead` is drawn in the D2 gradient, `rest` in white after it. */
// With more than two commands the card tightens its spacing so the last one still fits.
const card = ({ eyebrow, lead, rest, body, commands }) => {
  const tight = commands.length > 2
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600&family=Geist+Mono:wght@400;500&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${SITE.og.width}px; height: ${SITE.og.height}px; overflow: hidden; }
  body { background: #0d0d0d; color: #f4f4f5; font-family: 'Fira Sans', sans-serif; position: relative; }
  .glow { position: absolute; inset: 0; background: radial-gradient(620px 420px at 86% 108%, rgba(168, 120, 255, 0.22), transparent 70%), radial-gradient(520px 360px at 104% 70%, rgba(86, 170, 255, 0.16), transparent 70%), radial-gradient(900px 500px at 20% -10%, rgba(255, 255, 255, 0.05), transparent 70%); }
  .rail { position: absolute; top: 0; bottom: 0; width: 44px; border: solid rgba(255, 255, 255, 0.08); background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 7px); }
  .rail.l { left: 0; border-width: 0 1px 0 0; } .rail.r { right: 0; border-width: 0 0 0 1px; }
  main { position: absolute; inset: 0 44px; padding: 52px 60px 54px; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 27px; font-weight: 600; letter-spacing: -0.01em; }
  .brand img { width: 44px; height: 44px; border-radius: 10px; }
  .mono { font-family: 'Geist Mono', monospace; }
  .host { font-size: 19px; color: #8b8b93; }
  .eyebrow { margin-top: ${tight ? 34 : 62}px; font-size: 18px; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a1aa; }
  h1 { margin-top: ${tight ? 12 : 18}px; font-size: ${rest ? (tight ? 62 : 70) : 84}px; line-height: 1.04; font-weight: 600; letter-spacing: -0.025em; max-width: 940px; text-wrap: balance; }
  h1 em { font-style: normal; background: linear-gradient(100deg, #ff9ad5 0%, #b48cff 45%, #6cb6ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .body { margin-top: ${tight ? 16 : 22}px; font-size: ${tight ? 24 : 27}px; line-height: 1.36; color: #b4b4bd; max-width: 900px; text-wrap: pretty; }
  footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .cmds { display: grid; gap: ${tight ? 8 : 10}px; justify-items: start; }
  .cmd { font-size: ${tight ? 18 : 20}px; padding: ${tight ? '8px 16px' : '10px 18px'}; border-radius: 12px; background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); white-space: nowrap; }
  .cmd b { font-weight: 400; color: #71717a; }
  .note { font-size: 19px; color: #8b8b93; white-space: nowrap; padding-bottom: 10px; }
</style></head>
<body>
  <div class="glow"></div><div class="rail l"></div><div class="rail r"></div>
  <main>
    <header>
      <div class="brand"><img src="${icon}" alt=""><span>${esc(SITE.name)}</span></div>
      <div class="host mono">${esc(SITE.host)}</div>
    </header>
    <p class="eyebrow mono">${esc(eyebrow)}</p>
    <h1><em>${esc(lead)}</em>${rest ? ` ${esc(rest)}` : ''}</h1>
    <p class="body">${esc(body)}</p>
    <footer>
      <div class="cmds">${commands.map((c) => `<div class="cmd mono"><b>$ </b>${esc(c)}</div>`).join('')}</div>
      <div class="note mono">MIT · open source</div>
    </footer>
  </main>
</body></html>`
}

// The home card splits the tagline after its first two words: "Sharper senses" | "for your coding agent".
const [a, b, ...tail] = SITE.tagline.split(' ')
const cards = [
  { slug: undefined, eyebrow: 'Open-source agent skills', lead: `${a} ${b}`, rest: tail.join(' '), body: SITE.description.replace(/ One command to install\.$/, ''), commands: skills.map((s) => s.install) },
  ...skills.map((s) => ({ slug: s.slug, eyebrow: 'Open-source agent skill', lead: s.title, rest: '', body: s.summary, commands: [s.install] })),
]

const tmp = mkdtempSync(join(tmpdir(), 'og-'))
mkdirSync(join(root, 'public/og'), { recursive: true })
for (const c of cards) {
  const html = join(tmp, `${c.slug ?? 'home'}.html`)
  const png = join(root, 'public', ogImage(c.slug))
  writeFileSync(html, card(c))
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${SITE.og.width},${SITE.og.height}`, '--virtual-time-budget=8000', `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore' })
  console.log(`wrote ${ogImage(c.slug)}`)
}

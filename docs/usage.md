# Using @rajaaltus/page-as-data

`page-as-data` reads a web page as data instead of a screenshot. In one command it tells you:

- what is on the screen,
- what broke behind it (uncaught exceptions, failed requests, broken images),
- and what is wrong with the layout, at phone and desktop widths.

It is made for developers and for AI coding agents, which otherwise spend a large image on every look at a page and still guess.

This guide covers:

1. [Requirements and install](#1-requirements-and-install)
2. [Choosing a Chrome](#2-choosing-a-chrome)
3. [Reading a screen](#3-reading-a-screen)
4. [Reproducing a bug with steps](#4-reproducing-a-bug-with-steps)
5. [Inspecting one element](#5-inspecting-one-element)
6. [Checking many pages, and CI](#6-checking-many-pages-and-ci)
7. [Screenshots](#7-screenshots)
8. [Installing it as an agent skill](#8-installing-it-as-an-agent-skill)
9. [Using it from code](#9-using-it-from-code)
10. [Reference](#10-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Requirements and install

- Node.js 22 or newer.
- Google Chrome, Chromium or Microsoft Edge.

The package has no dependencies.

Run it once without installing:

```sh
npx @rajaaltus/page-as-data --help
```

Or add it to a project:

```sh
npm install --save-dev @rajaaltus/page-as-data
# pnpm add -D @rajaaltus/page-as-data
# yarn add -D @rajaaltus/page-as-data
# bun add -d @rajaaltus/page-as-data
```

After a project install, the command is `page-as-data` inside npm scripts, and `npx page-as-data` in a terminal. This guide writes `npx @rajaaltus/page-as-data` everywhere, which works in both cases.

> **Version note:** use 0.1.1 or later. In 0.1.0, the installed command printed nothing and exited 0, because npm starts it through a symlink.

---

## 2. Choosing a Chrome

`page-as-data` drives Chrome through the Chrome DevTools Protocol. There are two ways to give it one.

### Pages anyone can open: `--launch`

Use this for a local dev server, a public site, or a CI job. `page-as-data` starts its own headless Chrome and closes it at the end.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/ --launch
```

It looks for Chrome at the standard install paths. If yours is elsewhere, set `CHROME_PATH`:

```sh
CHROME_PATH=/opt/google/chrome/chrome npx @rajaaltus/page-as-data read http://localhost:3000/ --launch
```

### Pages behind a sign-in: attach to your own Chrome

1. Start Chrome with a debugging port and a profile of its own:

   ```sh
   # macOS
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   # Linux
   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   # Windows
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome-debug
   ```

2. Sign in to your app in that window, once. Leave the window open.
3. Run `page-as-data` without `--launch`. It connects to port 9222 by default (change it with `--port`).

It opens a new tab for its own work and closes that tab at the end. Your other tabs are not touched.

---

## 3. Reading a screen

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch
```

The default width is 1440px. For a phone, add `--width 390`. Below 768px it also emulates a touch screen.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --width 390 --launch
```

`page-as-data` waits for the page to settle before it reads. "Settled" means:

- no framework router requests are still in flight,
- React has finished streaming,
- skeletons and `aria-busy` are gone,
- animations have finished,
- short timers have fired.

The first line of the output says how long this took, or why the page never settled.

The output comes in this order:

| Section | What is in it |
| --- | --- |
| First line | Page title, URL, width, time to settle |
| `PROBLEMS` | Uncaught exceptions, `console.error`, failed requests (4xx, 5xx, network errors), broken images, invalid form fields, layout defects |
| `OPEN DIALOGS` | Each open dialog: its title and text |
| `ALERTS / STATUS MESSAGES` | `role="alert"` and `role="status"` content |
| `HEADINGS` | The heading outline |
| `FORM FIELDS` | Label, type, value, and the error message when a field is invalid. Password values are shown as `••••`. |
| `TABLE n` | Each table as rows, up to 20 rows each |
| Buttons and links | Each control's name, and whether it is disabled |
| `TEXT ON SCREEN` | The visible text, up to 4000 characters |

Add `--json` for the complete result, including every table row and link.

---

## 4. Reproducing a bug with steps

Steps run in the order you give them. The page settles after each step.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch \
  --click "New order" \
  --fill "Email=a@b.co" \
  --press Enter \
  --wait-for "Order saved"
```

| Step | What it does |
| --- | --- |
| `--click "Name"` | Clicks a button or link by its visible name or accessible name. |
| `--fill "Label=value"` | Types into a field found by its label. Works with React-controlled inputs. The value may contain `=`. |
| `--press Key` | Sends a real key press, which handlers that check `event.isTrusted` accept. Keys: a single character, `F1`–`F12`, `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`, `Space`, arrow keys, `Home`, `End`, `PageUp`, `PageDown`. |
| `--wait-for "text"` | Waits until the text is on screen, up to `--timeout` (default 15000 ms). Use it for long work whose progress never goes quiet, such as an upload or a render. |

If a step cannot find its control, the run stops there and reports what is on screen instead. The exit code is then `2`.

---

## 5. Inspecting one element

`--inspect` answers the questions you would take a screenshot for. It takes visible text or a CSS selector, and you can repeat it.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch \
  --inspect "Save" --inspect ".price-total"
```

For each match (up to 5), it reports:

- **Position and size:** `at x297 y125 140×32`.
- **Whether it is visible, and if not, why:**
  - `display: none on div.panel`
  - cut off by a container, with the percentage still shown
  - faded out by an ancestor's opacity
  - zero size
- **Colours and contrast:** its colour, the background behind it, and the WCAG contrast ratio, marked `readable` or `TOO LOW`.
  - Works for `oklch()` and other modern colour spaces.
  - For a gradient background, it measures the worst stop.
  - On a background image it gives no number and says a screenshot is needed.
- **Font size and weight, display and position.**

---

## 6. Checking many pages, and CI

`check` loads every URL at every width and reports only defects.

```sh
npx @rajaaltus/page-as-data check http://localhost:3000/ http://localhost:3000/orders --widths 390,1440 --launch
```

Example output:

```text
✔ http://localhost:3000/ @ 390px  settled in 412ms

✖ http://localhost:3000/orders @ 390px
  error    Page is 616px wide in a 390px viewport, so it scrolls sideways
           · div (div.wide-banner) ends at 616px
  warning  button "Close" is 16×16px, under WCAG 2.2's 24×24px, and too close to button "Menu"

4 page checks · 1 errors · 1 warnings
```

When a page redirects, the line shows `(landed on /login)`.

### What counts as an error

| Kind | Error or warning | When |
| --- | --- | --- |
| Page overflow | error | The page is wider than the viewport. It names the elements that make it wide. |
| Cut-off control | error | A button, link or field is cut off by a container that clips and does not scroll. |
| Sticky displaced | error | `position: sticky` inside a box that never scrolls, and its offset pushes it over content. |
| Sticky cannot stick | warning | The same, without the displacement. |
| Uncaught exception | error | |
| Failed request | error | 4xx, 5xx or a network failure. The browser's own `/favicon.ico` request is ignored. |
| `console.error` | warning | |
| Small touch target | warning | Smaller than 24×24px **and** too close to another target (WCAG 2.2 SC 2.5.8). |
| Not settled | warning | The page never settled within `--timeout`. |

The exit code is `1` when any error is found. Add `--strict` to fail on warnings too.

### GitHub Actions

Start your app, then check it. Hosted `ubuntu-latest` runners already have Google Chrome.

```yaml
- run: npm ci
- run: npm run build
- run: npm start &
- run: npx wait-on http://localhost:3000
- run: npx @rajaaltus/page-as-data check http://localhost:3000/ http://localhost:3000/orders --launch
```

With `--json`, `check` prints one JSON object per page and width, one per line:

```json
{"url":"http://localhost:3000/","width":390,"finalUrl":"/","settle":{"settled":true,"ms":412},"errors":[],"warnings":[]}
```

A page that could not load gives `{"url": ..., "width": ..., "error": "..."}` instead.

---

## 7. Screenshots

Take one only for what data cannot answer: images, charts and overall visual polish.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/dashboard --launch --screenshot dashboard.png
```

It first lets animations finish, so the picture shows the settled screen.

---

## 8. Installing it as an agent skill

This teaches the coding agents in a project to use `page-as-data` instead of screenshots. Run it at the project root:

```sh
npx @rajaaltus/page-as-data init
```

It looks for the agents the project already uses, and writes each one's own file:

| Agent | Found by | File written |
| --- | --- | --- |
| Claude Code | `.claude/` or `CLAUDE.md` | `.claude/skills/page-as-data/SKILL.md` |
| Codex, opencode, Amp and other `AGENTS.md` readers | `AGENTS.md` | a block inside `AGENTS.md` |
| Gemini CLI | `GEMINI.md` | a block inside `GEMINI.md` |
| Cursor | `.cursor/` or `.cursorrules` | `.cursor/rules/page-as-data.mdc` |
| Windsurf | `.windsurf/` or `.windsurfrules` | `.windsurf/rules/page-as-data.md` |
| Cline | `.clinerules` | `.clinerules/page-as-data.md`, or a block when `.clinerules` is a single file |
| GitHub Copilot | `.github/copilot-instructions.md` or `.github/instructions/` | `.github/instructions/page-as-data.instructions.md` |

When it finds none of these, it installs for Claude Code and `AGENTS.md`, and says so.

Example:

```text
$ npx @rajaaltus/page-as-data init
✔ created .claude/skills/page-as-data/SKILL.md (Claude Code)
✔ created .cursor/rules/page-as-data.mdc (Cursor)
✔ updated AGENTS.md (AGENTS.md)
```

Commit the files it writes, so everyone on the team gets the skill.

### Options

| Option | What it does |
| --- | --- |
| `--agent claude,cursor` | Choose the agents yourself: `claude`, `agents`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot`, or `all`. Repeatable. |
| `--global` | Install the Claude Code skill once for all your projects, in `~/.claude/skills/page-as-data/`. |
| `--dry-run` | Show what would change, and write nothing. |
| `--force` | Replace a same-named file that `page-as-data` did not write. |
| `--dir path` | Install into another project folder. Default: the current folder. |
| `--json` | Print the plan as JSON. |

### What it will and will not touch

- **Files it owns** (`SKILL.md`, the `.mdc` rule, and so on) carry a `page-as-data:managed` comment.
  - Run `init` again after upgrading the package, and it updates them.
  - A file you wrote yourself at the same path is skipped, unless you pass `--force`.
- **Shared files** (`AGENTS.md`, `GEMINI.md`): it edits only the text between `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`. Your own text above and below is kept byte for byte.
- **Broken markers:** if a merge left a shared file with half a block, or two blocks, it skips that file and tells you to fix it by hand.
- **Reruns:** running `init` twice changes nothing the second time. The output says `unchanged`.

### Removing it

```sh
npx @rajaaltus/page-as-data uninstall            # this project
npx @rajaaltus/page-as-data uninstall --global   # the global Claude Code skill
```

It removes only the files that carry its marker, and only its block from shared files. A shared file left empty is deleted. It takes `--agent`, `--dry-run` and `--dir` too.

### As a Claude Code plugin

Instead of `init`, Claude Code users can install the skill as a plugin:

```text
/plugin marketplace add rajaaltus/page-as-data
/plugin install page-as-data@page-as-data
```

The plugin and `init` carry the same skill text.

---

## 9. Using it from code

### From Node

`readPage` and `checkPages` return the same results as the CLI's `--json`.

```js
import { checkPages, readPage } from '@rajaaltus/page-as-data'

const r = await readPage({
  url: 'http://localhost:3000/orders',
  width: 390,
  steps: [{ click: 'New order' }, { label: 'Email', value: 'a@b.co' }, { press: 'Enter' }, { waitFor: 'Order saved' }],
  inspect: ['Save'],
  launch: true, // or port: 9222 to attach
  timeoutMs: 15000,
})
console.log(r.problems.layout.errors, r.page.headings)

const results = await checkPages({ urls: ['http://localhost:3000/'], widths: [390, 1440], launch: true })
const failed = results.filter((x) => x.error || x.errors.length)
```

`readPage` returns `{ url, width, settle, steps, page, problems, inspected }`. `problems` holds:

- `exceptions`
- `consoleErrors`
- `browserLog`
- `failedRequests`
- `brokenImages`
- `invalidFields`
- `layout: { errors, warnings }`

### Inside your own browser tooling

The part that runs in the page is one file, exported as `@rajaaltus/page-as-data/in-page`. Inject it **before** the page's own scripts, so it can see router requests from the start. Then call `window.__pageAsData`.

```js
// Playwright
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const inPage = readFileSync(createRequire(import.meta.url).resolve('@rajaaltus/page-as-data/in-page'), 'utf8')
await page.addInitScript(inPage)
await page.goto('http://localhost:3000/orders')
await page.evaluate(() => window.__pageAsData.settle())
const screen = await page.evaluate(() => window.__pageAsData.read())
const issues = await page.evaluate(() => window.__pageAsData.layoutIssues())
```

| Function | Returns |
| --- | --- |
| `await settle({ timeoutMs })` | `{ settled, ms }`, or `why` it did not settle |
| `read({ maxText, maxRows })` | url, title, headings, dialogs, alerts, text, tables, form, controls, images |
| `inspect(query)` | For each match: box, visible, why hidden or cut off, colours, contrast, readable |
| `layoutIssues()` | Page overflow, clipped controls, sticky that cannot stick, small targets |
| `await click(name)` / `await fill(label, value)` / `await waitFor(text)` | What it acted on, after settling |

With Chrome DevTools MCP, pass the file's contents as `initScript` to `navigate_page`. Then call the same functions with `evaluate_script`.

The script only reads. It makes no network calls of its own. It wraps `window.fetch` and `setTimeout` only to count pending work, and never changes a request.

### The installer, from code

```js
import { applyPlan, planInstall } from '@rajaaltus/page-as-data/install'

const plan = planInstall({ root: process.cwd(), agents: ['claude', 'cursor'] })
for (const a of plan.actions) console.log(a.action, a.path)
applyPlan(plan.actions)
```

---

## 10. Reference

### Commands

```text
page-as-data read <url>        one page as data, after optional steps
page-as-data check <url...>    defects for every url at every width
page-as-data init              install the agent skill
page-as-data uninstall         remove it
page-as-data --help
```

### Options for `read` and `check`

| Option | Command | Default | What it does |
| --- | --- | --- | --- |
| `--width 390` | read | 1440 | Viewport width. Below 768 it emulates a phone with touch. |
| `--widths 390,1440` | check | `390,1440` | Widths to check. |
| `--click "Name"` | read | | Click a control. Repeatable, in order. |
| `--fill "Label=value"` | read | | Fill a field. Repeatable, in order. |
| `--press Key` | read | | Real key press. Repeatable, in order. |
| `--wait-for "text"` | read | | Wait for text on screen. Repeatable, in order. |
| `--inspect "text or selector"` | read | | Box, visibility, colours, contrast. Repeatable. |
| `--screenshot file.png` | read | | Also save a screenshot. |
| `--strict` | check | off | Exit 1 on warnings too. |
| `--launch` | both | off | Start a headless Chrome. |
| `--port 9222` | both | 9222 | Attach to a Chrome with that debugging port. |
| `--json` | both | off | Machine-readable output. |
| `--timeout 15000` | both | 15000 | Milliseconds to wait for a page to settle, and for `--wait-for`. |

### Exit codes

| Code | `read` | `check` | `init` / `uninstall` |
| --- | --- | --- | --- |
| `0` | Nothing found | No errors (and no warnings with `--strict`) | Done. Skipped files are listed, but do not change the code. |
| `1` | An exception, failed request, broken image or layout error | An error (or a warning with `--strict`) | — |
| `2` | Could not run: no Chrome, bad URL, bad option, or a step could not find its control | Could not run, or a page could not load | Unknown agent, missing folder, a URL given, or a write failure |

For `read`, `console.error` and invalid form fields are listed under `PROBLEMS`, but do not by themselves make the exit code `1`.

---

## 11. Troubleshooting

**`No Chrome found. Set CHROME_PATH, …`**
Install Chrome, Chromium or Edge, or point `CHROME_PATH` at the executable.

**`No Chrome is listening on port 9222`**
You did not pass `--launch`, and no Chrome is running with `--remote-debugging-port=9222`. Start one (see [section 2](#2-choosing-a-chrome)), or add `--launch`.

**`Chrome exited (code …) before it opened port …` in CI or Docker**
The headless Chrome could not start. The message includes Chrome's own error text. In a container, the usual causes are a missing sandbox or missing shared libraries.

**`NOT settled: …` on the first line**
The page kept doing work until `--timeout` ran out. The `why` part names what it was waiting for: requests, a stream, a busy element, an animation, or a timer. Common causes are a page that polls forever, and a loading indicator that pulses forever. Raise `--timeout`, or fix the endless indicator.

**A step fails with "not found"**
The output lists what is on screen instead. Match the control's visible text or accessible name, and the field's label text.

**Blank or half-rendered results with your own injected script**
Chrome does not run animation frames in a background tab, so React 19 never finishes streaming there. Keep the tab in front. The CLI does this for you.

**`init` skipped a file**
- **"exists and was not written by page-as-data":** a file of yours is at that path. Rename it, or pass `--force`.
- **"markers that do not form one block":** fix the `<!-- page-as-data:start -->` / `<!-- page-as-data:end -->` lines by hand, then run `init` again.

### Limits

- Chrome-family browsers only.
- "Settled" is a good guess, not a promise.
- Text on a background image gets no contrast number.
- Shadow DOM and cross-origin iframes are not read yet.

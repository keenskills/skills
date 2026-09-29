# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`page-as-data` reads a rendered web page as text/JSON instead of a screenshot: what is on screen, what broke behind it (exceptions, failed requests, broken images), and layout defects at phone and desktop widths. It is a CLI plus an injectable in-page script, published as `@keenskills/page-as-data` (a fork of `gjohnpaull/page-as-data`). `init` installs it as a skill for coding agents, and the repo is also a Claude Code plugin marketplace. Zero runtime dependencies, Node 22+, and a Chrome-family browser (Chrome DevTools Protocol only).

## Commands

```sh
npm test                                              # all tests; launches headless Chrome
node --test --test-name-pattern "sticky" test/*.test.mjs   # one test by name
node cli.mjs read http://localhost:3000/ --width 390 --launch   # run the CLI from source
node cli.mjs check <url...> --widths 390,1440 --launch
node cli.mjs init --dry-run                           # what init would write in this folder
npm run build:skill                                   # regenerate skills/page-as-data/SKILL.md after editing skill/
```

- Tests need a Chrome. Set `CHROME_PATH` if it is not at a standard path; without one, the Chrome suites are skipped (not failed).
- There is no build step, linter or formatter config. CI (`.github/workflows/test.yml`) runs `npm test` on Node 22 and 24.
- Exit codes: `0` nothing found, `1` problems found, `2` could not run (no Chrome, bad URL, a step could not find its control).

## Architecture

Two files ship (see `files` in `package.json`), and they run in different worlds:

- **`page-as-data.js`** runs *inside the page*. It is an IIFE that defines `window.__pageAsData` (`settle`, `read`, `inspect`, `layoutIssues`, `click`, `fill`, `waitFor`, ...). It must be injected before the page's own scripts, because it wraps `window.fetch` (to count Next.js RSC requests) and `window.setTimeout` (to count short pending timers) from the start. All reading, layout detection, contrast maths and "is the page finished" logic lives here. It is also exported as `page-as-data/in-page` for Playwright / DevTools MCP users, so it must stay self-contained plain browser JS.
- **`cli.mjs`** runs in Node. It finds or launches Chrome, speaks raw CDP over the built-in `WebSocket` (no puppeteer), opens its own tab via `Target.createTarget`, injects `page-as-data.js` with `Page.addScriptToEvaluateOnNewDocument`, and records problems from CDP events (console, exceptions, `Log`, network). It then calls in-page functions through `Runtime.evaluate` with expression strings like `` `window.__pageAsData.click(${JSON.stringify(name)}, ...)` ``. Values cross the boundary only as JSON.

Flow for `read`: `openTab` → `setWidth` (below 768px emulates a phone with touch) → `goto` (waits for load, then in-page `settle`) → steps in order (`--click`/`--fill`/`--wait-for` run in-page; `--press` is a trusted CDP `Input.dispatchKeyEvent` because shortcut handlers check `isTrusted`) → `read()` + `layoutIssues()` + `inspect()` → `classifyLayout` sorts raw findings into `errors` vs `warnings` → print or `--json`. `check` does the same for every url at every width, without steps.

`cli.mjs` exports `readPage`, `checkPages`, `parseArgs`, `findChrome`, `classifyLayout`, `keyEvent`; the tests import these directly rather than spawning the CLI. `main()` only runs when the file is the process entry point.

### Settling

"Settled" is the core heuristic and the most fragile area. `settle()` waits for: DOM quiet, in-flight RSC fetches, pending React streaming chunks (`div[hidden][id^="S:"]`), busy markers (`aria-busy`, `[data-skeleton]`, `.animate-pulse`, `.skeleton`), running animations, and short timers (≤2s) that have not fired. Self-rescheduling timers (pollers) are deliberately excluded so pages never wait forever. When it times out it returns `why`. The CLI brings its tab to front because a background tab never finishes React 19 streaming.

### Agent skill installer

`install.mjs` is separate from the Chrome code. `skill/page-as-data.md` is the only source of the skill text. `AGENTS` in `install.mjs` maps each agent id to a detection marker, a target path and a format. Owned files carry `page-as-data:managed`. Shared files (`AGENTS.md`, `GEMINI.md`, a single-file `.clinerules`) get a block between `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`. `planInstall` / `planUninstall` only read the disk; `applyPlan` is the only writer, so `--dry-run` shows the exact plan. `cli.mjs` sends `init` / `uninstall` there before any Chrome code runs.

In a terminal, `init` runs `wizard.mjs` instead (`wantsWizard()` in `cli.mjs` decides: TTY, and no `--agent`/`--yes`/`--json`/`--dry-run`). The wizard uses `tui.mjs`, zero-dependency clack-style prompts on `node:readline`. Both take their streams as arguments, and `test/terminal.mjs` drives them with real key bytes; Chrome discovery and `readPage` are passed into `runWizard`, so wizard tests need no browser.

`skills/page-as-data/SKILL.md` and `.claude-plugin/plugin.json` are generated by `scripts/build-plugin.mjs`. Tests fail when they drift from `renderSkill()` or `package.json`.

### Release

`npm version <patch|minor|major>` (its `version` script regenerates the plugin files), then `git push --follow-tags`. `.github/workflows/publish.yml` runs on `v*` tags: tests, checks that the tag matches `package.json`, then runs `npm publish` with provenance (needs the `NPM_TOKEN` secret). `provenance: true` means a local `npm publish` fails; publish from CI.

## Tests

`test/fixture.html` plants one of each bug next to a look-alike that is **not** a bug (for example a clipping bar vs a scrolling bar). Tests assert both: every bug is reported, and no look-alike is. When adding a detection, add both the bug and its look-alike to the fixture. Suites run concurrently, so every Chrome launch after the `check` suite takes a fresh debugging port (`freshPort()`); reusing a port races a Chrome that is still shutting down.

`test/install.test.mjs` needs no Chrome. It works in temp folders and passes a fake `home`, so it never touches the real `~/.claude`.

## Conventions

- ES modules, no semicolons, single quotes, 2-space indent, long lines are fine.
- Comments explain *why* a heuristic exists (the real page behaviour it handles), not what the code does. Keep that style.
- User-facing messages are plain English that name the element and the cause, e.g. `button "New product" is cut off (0% visible) by div.app-plate, and nothing scrolls to it`.
- The in-page script reads the page and must not change it: no network calls of its own, never alter wrapped requests, report password values as `••••`.
- Files use LF line endings (`.gitattributes`); the CLI shebang breaks with CRLF.
- Keep `README.md` (options table, in-page function table, checks table) in sync when adding a flag, function or check.

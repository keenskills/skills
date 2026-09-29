# Skills monorepo and showcase site — design

Date: 2026-09-29
Status: draft; repo strategy, diagram npm package and skill separation decided 2026-09-29, remaining open decisions at the end

## Goal

Bring the two agent skills into one repository and give them one site that shows them off:

- `page-as-data` (this repo): read a web page as data. Node 22+, zero dependencies, published to npm as `@rajaaltus/page-as-data`, installable by `npx ... init` and as a Claude Code plugin.
- `drawing-architecture-diagrams` (`github.com/rajaaltus/drawing-architecture-diagrams`): professional architecture diagrams as editable draw.io plus PNG/PDF. Python 3.9+ design system (`scripts/archdiagram.py`, 661 lines), lint + render loop, needs draw.io desktop only for export. Today installed by `git clone` into `~/.claude/skills`.
- A Next.js landing and docs site, in the spirit of libraries.dev: one page per skill, a copy-the-prompt flow, real output instead of marketing mock-ups.

Success means:

- One repo, one Claude Code marketplace listing both plugins, one CI.
- `page-as-data` keeps publishing to npm with provenance, now as `@keenskills/page-as-data`; `@rajaaltus/page-as-data` is deprecated with a pointer.
- The diagram skill installs with one command, the same way as `page-as-data`.
- The site is fast, static, works at 390 px and 1440 px, and every demo on it is generated from the real tools.
- The site's docs cannot drift from the skills: they are read from each package at build time.

## What we learned from the two repos

| | page-as-data | drawing-architecture-diagrams |
| --- | --- | --- |
| Language | Node ESM, no deps | Python stdlib, no deps |
| External tool | Chrome (CDP) | draw.io desktop (export only) |
| Tests | `node --test`, needs Chrome, skips without | `tests/selftest.py`, lint only, runs anywhere (verified: passes without draw.io) |
| Distribution | npm, `init` wizard for 7 agents, plugin marketplace at repo root | `git clone` |
| Skill source | `skill/page-as-data.md`, generated `skills/page-as-data/SKILL.md` | `SKILL.md` at root, `references/icons.md` |
| Showcase assets | `test/fixture.html` (one of every bug + look-alike) | `docs/sample-a4.{drawio,png,pdf}`, example build script |
| Credit | MIT, © gjohnpaull | MIT, © john (gjohnpaull commits) |
| Drift risk | README still fine | README install line points at `gjohnpaull/...` |

They already meet: `docs/diagram/how-it-helps.py` in this repo is drawn with `archdiagram.py`.

## Repository layout

Create a new repository for the monorepo. Import both existing repos into it with `git subtree add --prefix packages/<name>` so their history survives. The two skills stay separate products: separate npm packages, separate plugins, separate versions and changelogs, separate docs sections. The monorepo and the site only make them easier to manage and to discover together.

After the first release from the new repo, each old repo gets a README pointing to the new one and is archived. Archived repos stay clonable, so existing `/plugin marketplace add rajaaltus/page-as-data` installs keep working (frozen at 0.1.1) until users move.

```
skills/
  .claude-plugin/marketplace.json      # lists both plugins
  packages/
    page-as-data/                      # moved as-is: cli.mjs, page-as-data.js, install.mjs, tui.mjs,
                                       # wizard.mjs, skill/, skills/, .claude-plugin/plugin.json, test/
    drawing-architecture-diagrams/     # subtree import: SKILL.md, scripts/, references/, examples/, tests/, docs/
      .claude-plugin/plugin.json       # new
      package.json                     # new, see "Diagram skill distribution"
  apps/
    site/                              # Next.js 16, App Router, static export
  pnpm-workspace.yaml                  # packages/*, apps/*
  package.json                         # private root: scripts only
  .github/workflows/
    test.yml                           # matrix: page-as-data (Node 22/24), diagrams (Python 3.9/3.13), site build + self-check
    publish.yml                        # per-package tags
  CLAUDE.md                            # root: map of the repo; each package keeps its own CLAUDE.md
```

Tooling: pnpm workspaces, no Turborepo. Three packages do not need a task graph; `pnpm -r --filter` is enough. Add Turbo later only if build times hurt.

Rules carried over:

- `packages/page-as-data` stays zero-dependency. The workspace root may have dev dependencies; the published package may not.
- `.gitattributes` LF rule moves to the root.
- The `build-plugin.mjs` drift tests keep working with paths relative to the package.

## Plugin marketplace

Root `.claude-plugin/marketplace.json`:

```json
{
  "name": "keenskills",
  "owner": { "name": "keenskills" },
  "plugins": [
    { "name": "page-as-data", "source": "./packages/page-as-data", "description": "..." },
    { "name": "drawing-architecture-diagrams", "source": "./packages/drawing-architecture-diagrams", "description": "..." }
  ]
}
```

Each skill stays its own plugin with its own `plugin.json` and version; the marketplace file is only the index that lets one repo serve both. Users install only the skill they want: `/plugin marketplace add keenskills/skills` once, then `/plugin install page-as-data@keenskills` or `/plugin install drawing-architecture-diagrams@keenskills`. The site shows each skill's install line on its own page, never a combined bundle.

## Diagram skill distribution

Give the diagram skill the same one-command install as `page-as-data`:

- Publish `@keenskills/drawing-architecture-diagrams` to npm. The npm package carries the skill files only (SKILL.md, scripts, references, examples) plus a tiny `cli.mjs` with `init` / `uninstall`.
- Reuse `install.mjs` instead of copying it. Step 1: parameterise it by skill (name, source files, whether it is a folder skill with scripts). Step 2, only if a third skill appears: extract it into `packages/skill-installer`. Folder skills (scripts + references) matter here: Claude Code and Codex can take a folder; single-file targets (`AGENTS.md`, `.cursor/rules`) get the SKILL.md text plus the absolute path of the installed scripts.
- Python stays the runtime. `init` checks for `python3` and draw.io and prints what is missing, the way `page-as-data` reports a missing Chrome.
- Also works with the generic `npx skills add keenskills/skills` flow because each package has a `SKILL.md` (verify the `skills` CLI discovers skills inside `packages/*` before we advertise it).
- Old repo `rajaaltus/drawing-architecture-diagrams`: README replaced by a pointer, then archived.

## Release

- Tags per package: `page-as-data@v0.2.0`, `drawing-architecture-diagrams@v0.1.0`.
- `publish.yml` reads the package from the tag prefix, runs that package's tests, checks the tag version against its `package.json`, publishes with provenance from that folder.
- Each `package.json` gets `"repository": { "type": "git", "url": "git+https://github.com/keenskills/skills.git", "directory": "packages/<name>" }`; provenance fails if this does not match the publishing repo.
- The site deploys on every push to `main` (Vercel), not on tags.
- Versioning by hand with `npm version` inside the package folder, as today. Changesets only if release volume grows.

## The site

### Stack

Next.js 16 App Router, `output: 'export'` (pure static, no server), TypeScript, Tailwind v4, MDX for docs, Shiki for code at build time, Geist Sans and Geist Mono. No motion library: every transition is CSS from transitions.dev (see Motion). No client-side data fetching except the npm download counter, which is fetched at build time and revalidated on each deploy.

### Information architecture

Modelled on libraries.dev (home, one page per library with Preview / Install & Usage tabs, How to use, Skill page, FAQs), cut to what two skills need:

| Route | Content |
| --- | --- |
| `/` | Hero, two skill cards with live previews, "Copy the prompt, paste it in your agent, make it yours" three-step, agents strip, FAQs |
| `/page-as-data` | Docs shell: left sidebar, tabs Preview / Install & Usage / Prompts, Copy prompt button |
| `/page-as-data/cli`, `/in-page`, `/checks` | Generated from the package README tables |
| `/architecture-diagrams` | Same shell as above |
| `/architecture-diagrams/design-system`, `/lint`, `/icons` | From SKILL.md and `references/icons.md` |
| `/how-to-use` | Install per agent (Claude Code plugin, npx init, skills CLI), in a package-manager switcher |
| `/changelog` | From git tags and release notes |

### Showcases (real output only)

page-as-data, "a screenshot vs the data":

- Split panel. Left: `test/fixture.html` rendered in an iframe. Right: the actual `page-as-data read` text for that page.
- Width switcher 390 / 1440. The iframe resizes and the right side swaps to the output for that width.
- Output is produced at build time by a script that runs the real CLI against the fixture and writes JSON into `apps/site/content/generated/`. Committed, and CI fails if regenerating changes it (same drift idea as `build-plugin.mjs`).
- A terminal replay of `check <url> --widths 390,1440`: the settle line shimmers while "running", then the problems list reveals line by line.

drawing-architecture-diagrams, "lint, render, look, fix":

- Step-through of the real loop on the Northwind example: pass 1 lint findings, pass 2 fixes, final PNG. Each pass is a real committed artifact, generated locally with draw.io (CI cannot render; it runs only lint and `selftest.py`).
- Comparison slider between the first and final render (`clip-path: inset()`), no extra DOM.
- Download buttons for `.drawio`, `.png` (300 dpi), `.pdf`.
- Prompt gallery from the README's example prompts, grouped by situation, each with a copy button.

Example content uses only fictional names (Northwind Traders, Contoso-style names), never a real client.

### Copy prompt

Each skill page has one "Copy prompt" button, as on libraries.dev. The prompt is assembled at build time from the skill's SKILL.md: install line, what it is for, the key commands. One paste into Claude Code, Cursor or Codex installs and uses the skill.

### Visual direction

Quiet, product-first, like libraries.dev: near-white `#fdfdfd` / near-black `#121212`, white cards with a 6% border and a 1 px shadow, one accent (blue in light, cyan in dark), 12 / 24 px gutters. Tokens on `:root` in OKLCH, dark mode by `prefers-color-scheme` plus a `data-theme` override. We take the restraint, not the assets: our own name, type, colours and copy. The showcases carry the colour; chrome stays grey.

## Motion

Decided with the Emil Kowalski framework (frequency first, then purpose, easing, duration) and implemented with transitions.dev snippets. Install transitions.dev `_root.css` once into `globals.css`; paste each snippet verbatim with its `prefers-reduced-motion` block.

Global tokens:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

| UI | How often seen | Decision | transitions.dev | Timing |
| --- | --- | --- | --- | --- |
| Hero headline + subline | Once per visit | Animate, first load only | Texts reveal (`18`) | 40–60 ms stagger, done under 600 ms |
| npm installs counter | Once per visit | Animate on load | Number pop-in (`02`) | ~250 ms |
| Copy prompt / copy command | Often | Label + icon swap, press scale | Text states swap (`04`) + Icon swap (`09`), `:active scale(0.97)` | 160–200 ms, revert after 1.5 s |
| Preview / Install / Prompts tabs | Often | Sliding pill | Tabs sliding (`16`) | ~200 ms `--ease-out`; first paint without transition |
| npm / pnpm / bun switcher | Often | Sliding pill + command text swap | Tabs sliding (`16`) + Text swap (`04`) | ~200 ms |
| 390 / 1440 width switcher | Occasional | Frame tweens width | Tabs sliding (`16`) + Card resize (`01`) | 250 ms `--ease-in-out` (on-screen movement) |
| Terminal replay "settling…" | Occasional | Alive while waiting | Shimmer text (`15`) then Skeleton reveal (`14`) | Loop until the step ends |
| Problems list after a run | Occasional | Lines enter in order | Texts reveal (`18`) | 30–50 ms stagger, never blocks scroll |
| Lint clean in the diagram loop | Rare | Celebrate | Success check (`10`) | Stroke length from `getTotalLength()` |
| FAQ accordion | Occasional | Height tween | Card resize (`01`) | 200–250 ms |
| Nav "More" menu | Occasional | Origin-aware open, faster close | Menu dropdown (`05`) | 150–200 ms open, 150 ms close |
| Icon-button hints | Tens per visit | Delay first, instant after | Tooltip (`17`) | 125 ms in, 0 ms out |
| Mobile docs sidebar | Occasional | Slides in from the left | Panel reveal (`07`) | 250–300 ms `--ease-drawer` |
| ⌘K docs search | Many times | No animation | none | Instant, keyboard-triggered |
| Theme toggle | Rare | Colour crossfade only | none (plain `transition: background-color, color`) | 150 ms |

Rules applied everywhere:

- Only `transform`, `opacity`, `filter` and `clip-path` animate; never `transition: all`.
- Hover effects sit behind `@media (hover: hover) and (pointer: fine)`.
- Nothing enters from `scale(0)`; the lowest start is `scale(0.95)` with opacity 0.
- Exit is faster than enter.
- Reduced motion keeps opacity and colour, drops movement.
- Scroll-driven reveals run once (`IntersectionObserver`, `once`).
- Check each animation at 0.25× in the DevTools Animations panel before merging.

## Quality gates

- The site checks itself with `page-as-data`: CI builds the static site, serves it, and runs `page-as-data check` on every route at 390 and 1440. Exit code 1 fails the build. This is also the best demo we have, so the home page links to the CI run.
- `pnpm --filter page-as-data test`, `python3 packages/drawing-architecture-diagrams/tests/selftest.py`.
- Generated site content (CLI output JSON, docs pulled from READMEs, copy-prompt text) must match a fresh regeneration.
- Lighthouse budget on `/`: LCP under 1.5 s on a mid-tier phone profile, zero CLS from the counter and fonts.

## Phases

1. **Monorepo move.** New repo, pnpm workspace, subtree-import both repos into `packages/`, update `repository` URLs, root marketplace, CI matrix. Exit: both test suites green in CI, `npm pack` of `page-as-data` byte-identical in file list to 0.1.1.
2. **Diagram skill install.** Parameterise `install.mjs`, add `cli.mjs init` and `plugin.json` for the diagram skill, per-package publish workflow. Exit: `npx @keenskills/drawing-architecture-diagrams init --dry-run` shows the right plan; first publish from CI.
3. **Site skeleton.** Next.js app, tokens, layout, docs shell, content pipeline from package READMEs and SKILL.md, the page-as-data self-check in CI. Exit: all routes pass `page-as-data check` at 390 and 1440.
4. **Showcases and motion.** Fixture split view, terminal replay, diagram loop and slider, copy prompt, the motion table above. Exit: reduced-motion pass, 0.25× review, Lighthouse budget met.
5. **Launch.** Domain, OG images (generated from real output), README badges, archive the old diagram repo.

## Decided

| Topic | Decision |
| --- | --- |
| Repo strategy | New repo; both old repos imported with `git subtree`, then archived with a pointer |
| Skill separation | Two separate skills: own npm package, plugin, version, changelog and docs section. Monorepo and site are for management and discovery only |
| Diagram skill on npm | Yes: `@keenskills/drawing-architecture-diagrams` with `init` / `uninstall`, reusing `install.mjs` |
| Shared name | `keenskills`: a shared name, not a personal one, because the skills are joint work of rajaaltus and gjohnpaull (John Paul). GitHub org `keenskills`, repo `keenskills/skills`, npm scope `@keenskills`, marketplace name `keenskills`, site name Keen Skills |
| npm move | Publish `@keenskills/page-as-data` 0.2.0, then `npm deprecate @rajaaltus/page-as-data` with a pointer |
| Hosting | Vercel, static export; `keenskills.vercel.app` until a domain is bought (`keenskills.com` is taken) |

## Open decisions

1. **Domain.** `keenskills.com` is registered by someone else. Candidates: `keenskills.dev`, `keenskills.sh`. Not needed before phase 5.
2. **Upstream.** Decide whether to invite gjohnpaull to the `keenskills` GitHub and npm orgs. Keep both MIT copyright lines either way.

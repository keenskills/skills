# Keen Skills — progress and handoff

Last updated: 2026-09-29. Read this first when resuming. Spec: `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md` (5 phases). Plans live in `docs/superpowers/plans/`.

## Where things are

| Thing | State |
| --- | --- |
| Repo | `github.com/keenskills/skills` (org `keenskills`, public), local `/Users/rajas/projects/next/skills`, branch `main` |
| `@keenskills/page-as-data` | 0.2.1 on npm (provenance). Old `@rajaaltus/page-as-data` deprecated with a pointer |
| `@keenskills/drawing-architecture-diagrams` | 0.1.0 on npm (provenance): `init`, `uninstall`, `doctor` |
| Claude Code marketplace | `keenskills`: `/plugin marketplace add keenskills/skills`, then `/plugin install page-as-data@keenskills` or `drawing-architecture-diagrams@keenskills` |
| Site | Live at https://keenskills.d2studio.dev (Vercel project `skills`, team `raja-altus-projects`, Root Directory `apps/site`, custom domain). Redeploys on every push to `main` |
| CI | `.github/workflows/test.yml`: repo, page-as-data (Node 22/24), diagrams (Python 3.9/3.13), site (build + page tests + page-as-data self-check). `publish.yml` publishes on annotated tags `<package>@v<version>` using the org secret `NPM_TOKEN` |
| Old repos | `keenskills/page-as-data` and `keenskills/drawing-architecture-diagrams` (forks of gjohnpaull's), archived with a "Moved" note |

## Phases

1. Monorepo move — done (plan `2026-09-29-monorepo-phase-1.md`).
2. Diagram skill install + shared installer (`shared/skill-installer.mjs`, vendored by `pnpm sync`) — done (plan `2026-09-29-monorepo-phase-2.md`).
3. Site skeleton — done (plan `2026-09-29-site-phase-3.md`). Docs are built from the packages at build time (`apps/site/scripts/build-content.mjs`); `pnpm site:check` runs page-as-data on every page at 390 and 1440 px (46 checks, 0 errors, 0 warnings, locally and live).
4. **Showcases and motion — next. Plan not written yet.**
5. Launch — domain is done (keenskills.d2studio.dev); still to do: OG images from real output, README badges.

## Phase 4 scope (from the spec, for the next plan)

- page-as-data "a screenshot vs the data": `test/fixture.html` in an iframe next to the real `page-as-data read` output, generated at build time; 390 / 1440 width switcher; terminal replay of `check` (shimmer while running, problems reveal).
- Diagram "lint, render, look, fix": the real passes on the Northwind example, before/after slider with `clip-path: inset()`, downloads (.drawio, .png, .pdf), prompt gallery from the README's example prompts.
- Copy prompt per skill (assembled from SKILL.md at build time), copy buttons on commands, npm/pnpm/bun switcher, theme toggle (tokens already support `data-theme`).
- Motion table in the spec (transitions.dev snippets + Emil Kowalski rules: frequency first, ease-out, under 300 ms, no animation on keyboard actions, reduced-motion guard). Use the `emil-design-eng` and `transitions-dev` skills.
- Fold in phase 3 deferred minors: favicon; self-check also checks `/404`; `lib/content.ts` typed assignment instead of `as`; link rewriting (cross-section h3 anchors, `/img` paths, skill/changelog links relative to their own folder, allowlist http/https/mailto); fence closed by a "```lang" line; empty-slug headings; copy README images into `public/` instead of raw.githubusercontent main; `tabindex="0"` on scrollers; self-check `cwd`; prefix rehype-slug ids; github-light comment contrast 4.49.

## Deferred minors from earlier phases (not yet fixed)

- Installer `--json` output carries an internal `prune` field (absolute path) in both CLIs.
- A symlinked `.claude/skills/<name>` makes `uninstall` fail with ENOTDIR part-way.
- The diagram example checks `<project>/scripts/archdiagram.py` before installed skills and walks up from cwd, not from the script's folder.
- Diagram `install.mjs` frontmatter parse breaks on a quoted or folded description or CRLF.
- Stale docs: `packages/page-as-data/CLAUDE.md` says the agent list lives in `install.mjs` (it is `lib/skill-installer.mjs`, generated from `shared/`).

## How work has been run

Each phase: spec → plan with `superpowers:writing-plans` → user picks **native** execution (`superpowers:executing-plans`) → work on a branch, ledger in the git-ignored `.superpowers/sdd/<plan>/progress.md` → fresh Opus reviewer on the whole branch → fix Critical/Important with a failing test first → user confirms outward steps (push, tag, publish, Vercel) → fast-forward `main`.

Release: from the package folder `npm version <patch|minor|major> --no-git-tag-version`, add a `## <version>` entry to its `CHANGELOG.md`, commit, then `git tag -a <package>@v<version> -m "<package> <version>"` and `git push --follow-tags`.

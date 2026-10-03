# Keen Skills — progress and handoff

Last updated: 2026-10-03 (third skill: writing-design-documents). Read this first when resuming. Spec: `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md` (5 phases). Plans live in `docs/superpowers/plans/`.

## Where things are

| Thing | State |
| --- | --- |
| Repo | `github.com/keenskills/skills` (org `keenskills`, public), local `/Users/rajas/projects/next/skills`, branch `main` |
| `@keenskills/page-as-data` | 0.2.1 on npm (provenance). Old `@rajaaltus/page-as-data` deprecated with a pointer |
| `@keenskills/drawing-architecture-diagrams` | 0.1.0 on npm (provenance): `init`, `uninstall`, `doctor` |
| `@keenskills/writing-design-documents` | 0.1.0 (provenance): `init`, `uninstall`, `doctor`. Imported from `keenskills/writing-design-documents` (gjohnpaull) by `git subtree add`; tests need `pip install -r requirements.txt` |
| Claude Code marketplace | `keenskills`: `/plugin marketplace add keenskills/skills`, then `/plugin install page-as-data@keenskills`, `drawing-architecture-diagrams@keenskills` or `writing-design-documents@keenskills` |
| Site | Live at https://keenskills.d2studio.dev (Vercel project `skills`, team `raja-altus-projects`, Root Directory `apps/site`, custom domain). Redeploys on every push to `main` |
| CI | `.github/workflows/test.yml`: repo, page-as-data (Node 22/24), diagrams (Python 3.9/3.13), site (build + page tests + page-as-data self-check). `publish.yml` publishes on annotated tags `<package>@v<version>` using the org secret `NPM_TOKEN` |
| Old repos | `keenskills/page-as-data` and `keenskills/drawing-architecture-diagrams` (forks of gjohnpaull's), archived with a "Moved" note. `keenskills/writing-design-documents`: not archived yet |

## Phases

1. Monorepo move — done (plan `2026-09-29-monorepo-phase-1.md`).
2. Diagram skill install + shared installer (`shared/skill-installer.mjs`, vendored by `pnpm sync`) — done (plan `2026-09-29-monorepo-phase-2.md`).
3. Site skeleton — done (plan `2026-09-29-site-phase-3.md`). Docs are built from the packages at build time (`apps/site/scripts/build-content.mjs`); `pnpm site:check` runs page-as-data on every page at 390 and 1440 px (46 checks, 0 errors, 0 warnings, locally and live).
4. Showcases and motion — done on branch `site-phase-4` (plan `2026-09-29-site-phase-4.md`). Neutral palette after jakubantalik.com, Inter, theme toggle with a no-flash head script; page-as-data "a screenshot vs the data" (its own screenshots and `read` output of `test/fixture.html` at 390/1440) and a replayed `check`; diagram "lint, render, look, fix" on the Northwind example (a linted draft from `apps/site/showcase/northwind_draft.py`, fixes, final render, before/after slider, downloads); copy prompt, copy buttons, npm/pnpm/bun switcher, Preview/Install/Prompts tabs, prompt gallery; two animated SVG illustrations on the home page; transitions.dev motion (`app/motion.css`, `app/scenes.css`); phase 3 deferred minors fixed. Exit gate: `pnpm site:check` 48 checks, 0 errors, 0 warnings (now includes `/404`); reduced-motion pass done (all scenes, hero and replays show their final state); Lighthouse mobile on `/`: CLS 0, LCP = FCP = 1.87 s with DevTools throttling (5.6 s simulated) — over the 1.5 s budget, bound by the CSS and font fetch, not by motion; open for a decision.
   Deviations: the fixture is shown as page-as-data's own screenshot, not a live iframe (its planted errors would fail the site's self-check); the mobile docs sidebar uses the FAQ accordion tween instead of Panel reveal; terminal lines use a shortened Texts reveal.
   Regenerate showcases after changing the fixture, page-as-data's output format, the Northwind example or archdiagram lint: `pnpm --filter @keenskills/site showcases` locally (Chrome + draw.io desktop), then commit. CI runs `test:showcases` and fails on drift.
5. Launch — domain is done (keenskills.d2studio.dev). SEO is done: per-page canonical, Open Graph and Twitter metadata (`apps/site/lib/meta.ts`), `robots.txt`, `sitemap.xml`, web manifest, JSON-LD (WebSite, FAQPage, SoftwareApplication), the D2 Studio favicon, and social cards in `apps/site/public/og` (regenerate with `pnpm --filter @keenskills/site og` after changing the tagline, a skill's summary or its install command; needs Chrome). Google Analytics uses d2studio.dev's GA4 property (`SITE.analytics` in `apps/site/lib/site.mjs`) and loads only on the live host. Still to do: README badges, submit the sitemap in Search Console.

## Third skill (2026-10-03)

`packages/writing-design-documents`, same shape as the diagram package: skill folder `skills/writing-design-documents/` (SKILL.md, `scripts/docbuilder.py`, `examples/example_design_doc.py`), Node `cli.mjs`/`install.mjs`, `doctor` checks Python 3.9+, python-docx, pymupdf and says when `finalize` needs Word on Windows. A copied example finds `docbuilder.py` via `DOCBUILDER_DIR`, `.claude/skills`, `.agents/skills` or `~/.claude/skills`. CI: own job with setup-python + `pip install -r requirements.txt`; `publish.yml` sets up Python and installs a package's `requirements.txt` before `npm test`.
Site: `/design-documents` docs; "Write, check, fix" showcase (`components/showcase-design-docs.tsx`) built from real `docbuilder.py check` output on a draft made from the Contoso example by `apps/site/showcase/contoso_draft.py` (regenerate with `pnpm --filter @keenskills/site showcases --only design-documents`, needs python-docx; CI's `test:showcases` fails on drift); home illustration `components/illustrations/doc-check.tsx`; skill cards are now full-width rows; social cards regenerated.
Known: the site job's palette test (`tests/tokens.test.mjs`, "match the reference palette") has failed on `main` since the 2026-09-30 "updated" commits changed `--bg`; either restore the colours or update the test.

## Deferred minors from earlier phases (not yet fixed)

- Installer `--json` output carries an internal `prune` field (absolute path) in both CLIs.
- A symlinked `.claude/skills/<name>` makes `uninstall` fail with ENOTDIR part-way.
- The diagram example checks `<project>/scripts/archdiagram.py` before installed skills and walks up from cwd, not from the script's folder.
- Diagram `install.mjs` frontmatter parse breaks on a quoted or folded description or CRLF.
- The install counter stays hidden until npm reports download stats for `@keenskills/*` (the API 404s for the new scope today).

## How work has been run

Each phase: spec → plan with `superpowers:writing-plans` → user picks **native** execution (`superpowers:executing-plans`) → work on a branch, ledger in the git-ignored `.superpowers/sdd/<plan>/progress.md` → fresh Opus reviewer on the whole branch → fix Critical/Important with a failing test first → user confirms outward steps (push, tag, publish, Vercel) → fast-forward `main`.

Release: from the package folder `npm version <patch|minor|major> --no-git-tag-version`, add a `## <version>` entry to its `CHANGELOG.md`, commit, then `git tag -a <package>@v<version> -m "<package> <version>"` and `git push --follow-tags`.

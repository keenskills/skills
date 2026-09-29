# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`keenskills/skills` is the monorepo for the Keen Skills agent skills. Each package under `packages/` is a separate product with its own version, changelog, tests and `CLAUDE.md`; read the package's `CLAUDE.md` before changing it. The design for the repo and the upcoming site is `docs/superpowers/specs/2026-09-29-skills-monorepo-and-site-design.md`.

| Path | What |
| --- | --- |
| `packages/page-as-data` | `@keenskills/page-as-data`, Node 22+, zero dependencies, tests need Chrome |
| `packages/drawing-architecture-diagrams` | `@keenskills/drawing-architecture-diagrams`, Node 22+ installer around a Python 3.9+ skill; rendering needs draw.io desktop |
| `shared/skill-installer.mjs` | The one installer both packages ship; vendored into `packages/*/lib/` by `pnpm sync` |
| `scripts/sync-shared.mjs` | Writes those copies; `test/sync-shared.test.mjs` fails on a stale one |
| `.claude-plugin/marketplace.json` | Claude Code marketplace `keenskills`; lists each plugin separately |
| `scripts/release-target.mjs` | Maps a tag like `page-as-data@v0.2.0` to its package for `publish.yml` |

## Commands

```sh
pnpm test                 # root checks, every package's npm test, the diagram selftest
pnpm test:repo            # root checks only: marketplace, release tags
pnpm --filter @keenskills/page-as-data test
pnpm test:diagrams
pnpm sync                 # after editing shared/
```

## Release

From the package folder: `npm version <patch|minor|major> --no-git-tag-version`, commit, then from the repo root `git tag -a <package>@v<version> -m "<package> <version>"` and `git push --follow-tags` (`--follow-tags` only pushes annotated tags). `publish.yml` tests and publishes only that package, with provenance (needs the `NPM_TOKEN` secret). A local `npm publish` fails because of provenance; publish from CI. Add a `## <version>` entry to the package's `CHANGELOG.md` before tagging; `test/repo.test.mjs` checks it.

## Conventions

- Packages stay independent: no imports across `packages/` and no runtime dependencies. Code both need lives in `shared/` and is copied in by `pnpm sync`.
- The marketplace test in `test/repo.test.mjs` checks every listed plugin; keep a plugin's `plugin.json` version equal to its `package.json`.
- LF line endings only.
- Never use real client names in examples.

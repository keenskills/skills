# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## What this is

`@keenskills/drawing-architecture-diagrams`: a skill that draws professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF. The skill itself is `skills/drawing-architecture-diagrams/` (SKILL.md, `scripts/archdiagram.py`, `references/icons.md`, `examples/`); that folder is what the Claude Code plugin, `init` and Agent Skills tools read. The Node side (`cli.mjs`, `install.mjs`) only installs it and checks tools.

## Commands

```sh
npm test                                  # node tests (init/uninstall/doctor in temp folders) + python3 tests/selftest.py
python3 tests/selftest.py                 # lint rules and the worked example; no draw.io needed
node cli.mjs init --dry-run --dir /tmp/x  # what init would write
node cli.mjs doctor                       # Python 3.9+ and draw.io
```

## Rules

- `install.mjs` `FILES` lists every file in the skill folder except SKILL.md; a test fails when a new file is not listed.
- `lib/skill-installer.mjs` is generated from the monorepo's `shared/skill-installer.mjs`: edit that, then run `pnpm sync` at the root.
- Keep `.claude-plugin/plugin.json` at the package version (`npm version` runs `scripts/build-plugin.mjs`).
- Examples use fictional names only (Northwind Traders, Contoso).

## Release

From this folder: `npm version <patch|minor|major> --no-git-tag-version`, add a `## <version>` entry to `CHANGELOG.md`, commit, then from the repo root `git tag -a drawing-architecture-diagrams@v<version> -m "drawing-architecture-diagrams <version>"` and `git push --follow-tags`.

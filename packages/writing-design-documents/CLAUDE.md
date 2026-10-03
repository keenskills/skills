# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## What this is

`@keenskills/writing-design-documents`: a skill that writes client-facing design documents in Word on the client's own template, and checks them for what makes a document read as machine-made. The skill itself is `skills/writing-design-documents/` (SKILL.md, `scripts/docbuilder.py`, `examples/`); that folder is what the Claude Code plugin, `init` and Agent Skills tools read. The Node side (`cli.mjs`, `install.mjs`) only installs it and checks tools.

## Commands

```sh
npm test                                  # node tests (init/uninstall/doctor in temp folders) + python3 tests/selftest.py
python3 tests/selftest.py                 # typesetting, a clean build, every check rule; DOCB_WORD=1 adds Word checks on Windows
node cli.mjs init --dry-run --dir /tmp/x  # what init would write
node cli.mjs doctor                       # Python 3.9+, python-docx, pymupdf, Word
```

The tests need `pip install -r requirements.txt` (python-docx, pymupdf) in the `python3` they run with.

## Rules

- `install.mjs` `FILES` lists every file in the skill folder except SKILL.md; a test fails when a new file is not listed.
- `lib/skill-installer.mjs` is generated from the monorepo's `shared/skill-installer.mjs`: edit that, then run `pnpm sync` at the root.
- Keep `.claude-plugin/plugin.json` at the package version (`npm version` runs `scripts/build-plugin.mjs`).
- Examples use fictional names only (Contoso, Northwind Traders).

## Release

From this folder: `npm version <patch|minor|major> --no-git-tag-version`, add a `## <version>` entry to `CHANGELOG.md`, commit, then from the repo root `git tag -a writing-design-documents@v<version> -m "writing-design-documents <version>"` and `git push --follow-tags`.

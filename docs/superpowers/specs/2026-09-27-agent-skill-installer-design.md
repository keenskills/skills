# Agent skill installer — design

Date: 2026-09-27
Status: approved in conversation, awaiting written-spec review

## Goal

Make `page-as-data` easy to adopt as a skill for AI coding agents. A user runs one command and every agent they use in that project learns to read screens with `page-as-data` instead of taking screenshots.

Success means:

- `npx @rajaaltus/page-as-data init` in a project installs the skill for each agent the project already uses, in that agent's native format.
- Claude Code users can also install it as a plugin: `/plugin marketplace add rajaaltus/page-as-data`, then `/plugin install page-as-data@page-as-data`.
- Running `init` again is safe: it updates its own content and never changes content it did not write.
- The package stays zero-dependency, Node 22+.

## Decisions

| Topic | Decision |
| --- | --- |
| What becomes the skill | `page-as-data` itself (read a UI screen as data). No diagram-generation feature. |
| Agents in v1 | Claude Code; AGENTS.md readers (Codex, opencode, Amp and others); Gemini CLI; Cursor; Windsurf; Cline; GitHub Copilot |
| Registries in v1 | npm, and the Claude Code plugin marketplace (this repo as the marketplace) |
| Package name | `@rajaaltus/page-as-data`, published from the fork `github.com/rajaaltus/page-as-data` |
| Credit | MIT license kept with the original copyright line; `gjohnpaull` listed in `contributors` |
| Installer shape | An `init` / `uninstall` subcommand in the existing CLI (not a separate package) |

Out of scope for v1: Homebrew, JSR, a Codex-native skills folder, an auto-update check.

## Targets

One source text, `skill/page-as-data.md`, holds the skill body: when to use the tool, the `read` / `check` / `--inspect` commands, exit codes, and when a screenshot is still the right tool. Commands in it use `npx @rajaaltus/page-as-data`, so agents need no global install.

`init` wraps that body in each agent's format:

| Agent | Detected by | File written | Format |
| --- | --- | --- | --- |
| Claude Code | `.claude/` or `CLAUDE.md` | `.claude/skills/page-as-data/SKILL.md` (with `--global`: `~/.claude/skills/page-as-data/SKILL.md`) | frontmatter `name`, `description` |
| AGENTS.md readers | `AGENTS.md` | `AGENTS.md` | marked block |
| Gemini CLI | `GEMINI.md` | `GEMINI.md` | marked block |
| Cursor | `.cursor/` or `.cursorrules` | `.cursor/rules/page-as-data.mdc` | frontmatter `description`, `alwaysApply: false` |
| Windsurf | `.windsurf/` or `.windsurfrules` | `.windsurf/rules/page-as-data.md` | frontmatter `trigger: model_decision`, `description` |
| Cline | `.clinerules` | `.clinerules/page-as-data.md` | plain markdown |
| GitHub Copilot | `.github/copilot-instructions.md` or `.github/instructions/` | `.github/instructions/page-as-data.instructions.md` | frontmatter `applyTo: "**"` |

`.clinerules` can be a single file instead of a folder. When it is a file, Cline is treated as a shared file: the body goes into it as a marked block.

### Detection

- Without `--agent`, `init` installs only for agents whose marker exists in the project.
- When no marker is found, it installs for Claude Code and AGENTS.md, and says that it used this fallback.
- `--agent claude,cursor` names agents explicitly. `--agent all` installs for every agent. Agent ids: `claude`, `agents`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot`.
- `--global` applies only to Claude Code. With `--global` and no `--agent`, only the Claude Code skill is installed.

### Safety on existing files

- **Shared files** (`AGENTS.md`, `GEMINI.md`, a single-file `.clinerules`): the body goes between `<!-- page-as-data:start -->` and `<!-- page-as-data:end -->`. A rerun replaces the text between the markers. Text outside the markers is never changed. A missing file is created holding only the block.
- **Owned files** (all others): every rendered file contains the marker `page-as-data:managed` (in a comment). A rerun overwrites a file only if it carries the marker. A file at the same path without the marker is skipped with a warning, unless `--force` is given.
- A file whose content would not change is reported as `unchanged`, not rewritten.
- `--dry-run` prints the plan and writes nothing.

### Uninstall

`uninstall` removes owned files that carry the marker, and strips the marked block from shared files. A shared file left holding only whitespace is deleted. An empty folder that `init` created (`.claude/skills/page-as-data/`) is removed. It follows the same `--agent`, `--global`, `--dry-run` and `--dir` flags.

## Code structure

New file `install.mjs`: pure planning plus a thin writer. `cli.mjs` stays focused on Chrome.

- `AGENTS`: a table of `{ id, label, detect(root), target(root, { global, home }), shared, render(body) }`, one entry per agent.
- `planInstall({ root, agents, global, force, home })` returns `[{ agent, path, action, reason, content }]`, where `action` is one of `create`, `update`, `unchanged`, `skip`. It reads the filesystem but never writes.
- `planUninstall({ root, agents, global, home })` returns the same shape with `action` of `remove`, `strip-block` or `skip`.
- `applyPlan(plan)` carries out the actions: creates folders, writes and removes files.
- `renderSkill()` returns the Claude Code `SKILL.md` text. The plugin build uses it too.
- `home` defaults to `os.homedir()`. Tests pass a temp folder.

`cli.mjs` changes:

- `main()` sends `init` and `uninstall` to `install.mjs` before any Chrome code runs.
- `parseArgs` gains `--agent <list>`, `--global`, `--force`, `--dry-run`, `--dir <path>` (project root, default `process.cwd()`).
- `HELP` lists the new commands and flags.
- Output is one line per file, e.g. `✔ created .cursor/rules/page-as-data.mdc (Cursor)` or `– skipped .github/instructions/page-as-data.instructions.md (exists, not written by page-as-data; use --force)`. With `--json`, the plan is printed as JSON.
- Exit codes keep their meaning: `0` done, `2` bad flag, unknown agent, or a write failure.

## Claude Code plugin

Files at the repo root:

- `.claude-plugin/marketplace.json`: marketplace `page-as-data`, one plugin entry with `source: "./"`.
- `.claude-plugin/plugin.json`: `name`, `version`, `description`, `author`, `repository`, `license`.
- `skills/page-as-data/SKILL.md`: generated by `npm run build:skill` from `renderSkill()`, and committed.

A test fails when the committed `SKILL.md` differs from `renderSkill()`, or when the plugin version differs from `package.json`. So the plugin install and the npm install always carry the same text and version.

## Packaging

`package.json` changes:

- `name`: `@rajaaltus/page-as-data`.
- `bin` stays `{ "page-as-data": "cli.mjs" }`.
- `files` adds `install.mjs` and `skill/`.
- `exports` adds `"./install": "./install.mjs"`.
- `publishConfig`: `{ "access": "public", "provenance": true }`.
- `repository`, `bugs`, `homepage` point to `rajaaltus/page-as-data`. `author`: `rajaaltus`. `contributors`: `["gjohnpaull"]`.
- `scripts` adds `build:skill`.

`LICENSE` keeps the original copyright line and adds a line for the fork's author.

## Release

New workflow `.github/workflows/publish.yml`:

- Trigger: push of a tag matching `v*`.
- Permissions: `contents: read`, `id-token: write`.
- Steps: checkout; setup Node 22 with the npm registry; `npm test`; fail if the tag differs from `v` + the `package.json` version; `npm publish`.
- Auth: the `NPM_TOKEN` repository secret, or npm trusted publishing configured for the repo.

Release flow: `npm version <patch|minor|major>`, then `git push --follow-tags`. No automatic version bump. `npm version` must also update `.claude-plugin/plugin.json`; a `version` lifecycle script does this and stages the file.

## Tests

New file `test/install.test.mjs`. It needs no Chrome. Each test works in a fresh temp folder with a fake `home`.

- Each agent is detected by each of its markers, and only then.
- With no marker, the plan holds Claude Code and AGENTS.md.
- `--agent all` plans every agent; an unknown agent id is an error.
- `--dry-run` through the CLI writes nothing.
- A second `init` gives only `unchanged` actions.
- A changed marked block is replaced, and text before and after it in `AGENTS.md` is unchanged byte for byte.
- A same-named file without the marker is skipped; with `force` it is overwritten.
- `uninstall` removes owned files, strips only the marked block, and leaves user text.
- `--global` writes the Claude Code skill under the fake `home`, not the project.
- Committed `skills/page-as-data/SKILL.md` equals `renderSkill()`.
- `.claude-plugin/plugin.json` version equals `package.json` version.

The existing Chrome tests are unchanged.

## Docs

- `README.md`: new package name in all commands; a new "Install as an agent skill" section covering `init`, its flags, `uninstall`, and the Claude Code plugin. It replaces the manual "paste this into your CLAUDE.md" snippet.
- `CLAUDE.md`: new commands (`init`, `build:skill`), `install.mjs` in the architecture section, and the release flow.

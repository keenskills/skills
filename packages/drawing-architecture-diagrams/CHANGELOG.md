# Changelog

## 0.1.0

- First npm release as `@keenskills/drawing-architecture-diagrams`.
- `init` installs the skill folder (SKILL.md, `archdiagram.py`, icon references, the worked example) for Claude Code, and the text plus `.agents/skills/drawing-architecture-diagrams/` for AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline and Copilot. `uninstall` removes only what `init` wrote.
- `doctor` checks for Python 3.9+ and draw.io desktop.
- A copied example finds `archdiagram.py` in `.claude/skills`, `.agents/skills`, `~/.claude/skills`, or `ARCHDIAGRAM_DIR`.
- Claude Code plugin: `/plugin install drawing-architecture-diagrams@keenskills`.

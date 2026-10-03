# Changelog

## 0.1.0

- First npm release as `@keenskills/writing-design-documents`.
- `init` installs the skill folder (SKILL.md, `docbuilder.py`, the worked example) for Claude Code, and the text plus `.agents/skills/writing-design-documents/` for AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline and Copilot. `uninstall` removes only what `init` wrote.
- `doctor` checks for Python 3.9+ with python-docx, pymupdf for the PDF page checks, and says when `finalize` needs Microsoft Word on Windows.
- A copied example finds `docbuilder.py` in `.claude/skills`, `.agents/skills`, `~/.claude/skills`, or `DOCBUILDER_DIR`.
- Claude Code plugin: `/plugin install writing-design-documents@keenskills`.

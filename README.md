# Keen Skills

Agent skills for Claude Code, Codex, Cursor, Gemini CLI and other coding agents, by rajaaltus and gjohnpaull. Each skill is its own package: install only the ones you want.

Docs and install guide: https://keenskills.d2studio.dev

| Skill | What it does | Install |
| --- | --- | --- |
| [page-as-data](packages/page-as-data) | Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths. | `npx skills add keenskills/skills --skill page-as-data` |
| [drawing-architecture-diagrams](packages/drawing-architecture-diagrams) | Professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF. | `npx skills add keenskills/skills --skill drawing-architecture-diagrams` |
| [writing-design-documents](packages/writing-design-documents) | Client-facing design documents in Word on the client's own template, checked until nothing reads as machine-made. | `npx skills add keenskills/skills --skill writing-design-documents` |

Each skill is also an npm package with its own installer: `npx @keenskills/<skill> init`.

## What they make

A page read as data, not pixels:

![page-as-data output next to a screenshot](https://raw.githubusercontent.com/keenskills/skills/main/packages/page-as-data/docs/diagram/how-it-helps.png)

An A4 architecture diagram from one prompt:

![Fictional event-driven order platform on A4](https://raw.githubusercontent.com/keenskills/skills/main/packages/drawing-architecture-diagrams/docs/sample-a4.png)

A design document page on a client template:

![Fictional Contoso network security design](https://raw.githubusercontent.com/keenskills/skills/main/packages/writing-design-documents/docs/sample-page.png)

## Claude Code

    /plugin marketplace add keenskills/skills
    /plugin install page-as-data@keenskills
    /plugin install drawing-architecture-diagrams@keenskills
    /plugin install writing-design-documents@keenskills

## License

MIT. See each package for its own copyright lines.

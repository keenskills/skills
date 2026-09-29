# Keen Skills

Agent skills by rajaaltus and gjohnpaull. Each skill is its own package: install only the ones you want.

Docs and install guide: see `apps/site` (deployed on Vercel).

| Skill | What it does | Install |
| --- | --- | --- |
| [page-as-data](packages/page-as-data) | Read a web page as data instead of a screenshot: what is on screen, what broke behind it, and layout defects at phone and desktop widths. | `npx @keenskills/page-as-data init` |
| [drawing-architecture-diagrams](packages/drawing-architecture-diagrams) | Professional, print-ready architecture diagrams as editable draw.io files plus PNG and PDF. | `npx @keenskills/drawing-architecture-diagrams init` |

## Claude Code

    /plugin marketplace add keenskills/skills
    /plugin install page-as-data@keenskills
    /plugin install drawing-architecture-diagrams@keenskills

## License

MIT. See each package for its own copyright lines.

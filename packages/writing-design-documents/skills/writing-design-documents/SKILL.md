---
name: writing-design-documents
description: Use when producing a client-facing design, architecture, security or assessment document in Word (.docx), especially on a client's own template (cover, change record, table of contents, numbered headings), with diagrams or findings tables, or with facts gathered from a live environment such as Azure. Also use when a document must not read as AI-written.
---

# Writing Design Documents

## Overview
Build the document from a script on the client's template with `scripts/docbuilder.py`, finalize it in Word, and run
`check()` until it returns nothing. The template carries the look, the script carries the content, and `check()` catches
what makes a document look machine-made or reveals how the facts were collected.

**Core rule:** the client reads a design, not a log of your session. State every fact as the configuration
*as of a date*. Never write how it was obtained.

## Workflow
1. **Facts.** Record each as current configuration. Anything unknown becomes "to be confirmed by <team>".
2. **Figures.** Draw with the `drawing-architecture-diagrams` skill. Export figure-only images (`frame_content()`) and put
   the tables and notes in the document text, not inside the image.
3. **Build script.** Copy `examples/example_design_doc.py` next to the outputs (a copy finds `scripts/` in
   `.claude/skills` or `.agents/skills` of the project or a parent folder, or in `~/.claude/skills`; otherwise set
   `DOCBUILDER_DIR=<this skill's folder>/scripts`). `DesignDoc(template, out)`, then
   `replace_text()` for the cover, `change_record()`, `clear_body()`, then content.
4. **Finalize.** `finalize(out)` refreshes the table of contents (if the template has one) and all fields, and exports
   a PDF (Windows with Word). Don't add a table of contents the template doesn't have.
5. **Check.** `python scripts/docbuilder.py check out.docx --pdf out.pdf` must print `check: clean`. Pass client-specific
   words with `--banned`.
6. **Look.** Render PDF pages to images and view them. `check()` covers text and pagination, not visual balance.
7. **Deliver** `.docx` and `.pdf`. Keep the build script beside them for the next revision.

## How the text reads
- Current state: "As of 24-Sep-2026, sql-contoso-data allows public access." Unknowns: "The hub team needs to confirm the prefix."
- Recommendations: "We recommend ..." One idea per sentence, commas and "and" as separators.
- Bold only for a standalone label (`**In scope**`). Captions and titles: "Figure 1: ...", "Table 1: ...".
- Arrows only inside flow and route tables.
- `DesignDoc` typesets for you: "·" becomes a comma, " + " becomes "and", quotes become curly, inline `**` is dropped.

| Thought | Reality |
|---|---|
| "Saying it was read-only shows we were careful" | The client did not ask how. It exposes access and tooling. State the configuration. |
| "Mentioning the CLI makes it verifiable" | Verification belongs in your working notes, not the deliverable. |
| "The hub couldn't be read, I must say so" | Write "managed by the hub team, to be confirmed". |
| "It looks fine in python-docx" | Pagination, TOC and blank pages only exist after Word lays it out. Finalize and check. |

## Quick reference
`DesignDoc(template, out, accent=None)` · `replace_text(old, new)` · `change_record(values)` · `clear_body()` ·
`h1/h2/h3` · `para(text)` · `bullets(items)` · `table(headers, rows, widths, title=None, size=9.5)` · `caption` ·
`figure(png, caption, heading=None, note=None, after=None, width_cm=None)` (own landscape page) · `new_section(landscape)` ·
`save()` · `finalize(docx)` · `check(docx, pdf, banned)`. Self-test: `python tests/selftest.py` (`DOCB_WORD=1` adds Word checks).

## Common mistakes
| Mistake | Fix |
|---|---|
| "captured using read-only Azure CLI", "logs show", "could not be read" | Configuration as of a date; owner for unknowns |
| Diagram side panels repeated in the document | Figure-only export; tables in the text |
| Empty page before a landscape figure | Use `figure()` / `new_section()`, which drop the trailing blank line |
| Caption or note spills onto the next page | Lower `width_cm`, or move the note into `after()` |
| Change record split across pages | `change_record()` keeps it together |
| Table title alone at the bottom of a page | `table(title=...)` keeps title and header with the first row |
| Lead-in sentence at the bottom of a page, its table on the next | End the lead-in with ':' and `table()` keeps them together |
| "Section 7.5" wrong after inserting a section | `check()` flags it; renumber the reference |
| Heading 2 in a different colour from Heading 1 | `DesignDoc` sets H2/H3 to the Heading 1 colour |

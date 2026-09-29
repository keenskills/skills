---
name: drawing-architecture-diagrams
description: Use when asked to create, redraw, rearrange or polish an architecture diagram - cloud (Azure, AWS, GCP), network topology, hub-and-spoke, landing zone, private endpoints, solution or infrastructure design - that must look professionally designed, fit a print page such as A4 or A3, or be delivered as an editable draw.io file with PNG/PDF.
---

# Drawing Professional Architecture Diagrams

## Overview
Generate the diagram **from a Python script** with `scripts/archdiagram.py` (a small design system on top of
draw.io XML), then **lint → render → look → fix** until the PNG is clean. Scripted layout makes every
rearrangement a cheap re-run, and the design system gives consistent type, colour and spacing.

**Core principle:** you are not done until you have *viewed the rendered PNG* and seen no overlaps.
Estimates of text width are always wrong somewhere.

## When to use / not
- Use for: infrastructure/solution diagrams, inventory-to-diagram work, "make it look like this reference",
  "fit on A4", "less white space", "align these in a grid".
- Not for: quick sketches in chat (use Mermaid), data charts (use a charting skill).
- For an Azure estate, gather facts first with `azure:azure-resource-lookup` (or `az` CLI); see Workflow 1.

## Workflow
1. **Gather verified facts.** Resources, SKUs, IPs, subnets, private endpoints (+ target and sub-resource),
   DNS zone links, route tables / next hops, peering, public-access flags, identities, monitoring targets.
   Only draw relationships you verified; say "inferred from naming" otherwise. Never put secret values on a diagram.
2. **Plan the page before coordinates.** Pick the **smallest page that fits at font 10**: `A4L` default,
   `A3L` when detail would not fit, `A5L` (827×583) for small systems. **Test for small:** after compacting on
   A4L, if a whitespace finding remains that only filler or bigger icons would clear, rebuild on A5L and keep
   it when everything fits at font 10. **Slack rule:** on the chosen page, keep bands tight and park any leftover
   height in ONE band directly above the footer (lint allows it); never spread it as gaps between bands.
   Sketch the bands (below). Count items per row and check `pitch ≥ widest label + 8`.
3. **Write the build script** in the working folder: copy `examples/event_driven_platform_a4.py` (its import falls back
   to `~/.claude/skills/drawing-architecture-diagrams/scripts`, so a copy runs anywhere). Create scripts with the
   Write tool and change them with Edit or a patch-script file; never inline code in shell heredocs (quotes break them).
4. **Loop:** `d.save()` → `lint_file()` → `render()` → **Read the PNG** → fix → repeat. Two or three passes is normal.
   Lint reports overlaps **and whitespace** (boxes holding only a title, boxes under 15% filled, one-sided gaps,
   empty areas over 3% of the page, empty bands ≥ 32 px across half the page - connector lines count as content),
   plus icons over 40 px and cells hidden behind a filled box. Fix each finding by removing the
   space: move a real panel into the gap, shrink the box, tighten the band, or pick a smaller page.
   **Filler is not a fix:** no tables that repeat the drawing, no padded notes, no inflated icons to raise fill.
5. **Deliver:** `.drawio` (editable), `.png` (3× ≈ 300 dpi on A4), `.pdf` (page size). Every image gets breathing
   room and an outer border: full pages already have the sheet frame from `frame_title()`; a figure exported without it
   (e.g. a crop for a Word document) calls `d.frame_content()` just before `save()`. `render()` adds a 12 px white
   margin around the PNG, so no border ever touches the image edge. Keep the build script next to
   them. Before overwriting a file the user may have edited in draw.io, check its mtime and back it up.

## Layout bands (top → bottom)
| Band | Contents |
|---|---|
| Title | `frame_title()`: title, subtitle, environment chip, blue rule |
| Context | legend · key flows · external actors + hub/edge network · observations · title block |
| Network | main container (VNet/VPC) full width: workload subnets row, then the private-endpoint subnet |
| Services | PaaS/managed services **outside** the network container, in uniform rows under their endpoints |
| Operations | monitoring · DNS · images/identities panels; footer with provenance |

Fill the margins with panels (legend, flows, DNS, observations, title block) rather than leaving an empty column.

## Design rules
| Rule | Why |
|---|---|
| Lay out in final page units at **font size 10** (title 16). Never scale a drawing down to fit | Scaled A4 text drops to ~4 pt |
| Doesn't fit → shorten labels, move detail to the notes/markdown, or go A3. Don't shrink | Legibility beats completeness |
| Label = **bold name** + one grey detail line; status in colour (`d.color("public on","red")`) | Scannable and consistent |
| Shorten repeated context: IPs as `.9.4` when the subnet header has the /24 | Saves width in grids |
| Repeated items on a column grid (`d.columns`); pitch ≥ widest label + 8 | Uniform rhythm, no collisions |
| Two-row grids use **lanes**: row A exits left to `cx-LANE`, row B exits right to `cx+LANE`; services sit on the lanes | Lines never cross labels |
| Every edge: explicit `exit`/`entry` + waypoints; straight segments only | draw.io auto-routing wanders |
| Legend lists only edge kinds actually drawn | No dead legend entries |
| Draw only verified attributes: `subnet()` NSG / route-table badges stay off unless `badges=True` is backed by facts | A default icon is a claim |
| Fixed icon sizes: resources 24-28 px, endpoints 20-22 px, badges 10-14 px | Oversized icons are filler |
| Place row icons by their bottom edge (`icon_b`) so labels share one baseline | Mixed icon heights make ragged rows |
| Number the key flows (`badge`) and explain them in `numbered_list` | Reader follows the story |
| Problems go in a `bullets` panel (red ▲); good facts are shown as green status in the resource label, never as ▲ | Red means "act on this" |
| Prefer a numbered badge to an edge label; if a label is needed, pass `label_pos` so it sits on a clear segment | Auto-placed labels land on icons |

## Nodes with many connections (apps, gateways)
An icon's **label side is off-limits** to edges. Give each remaining side one job (e.g. inbound on the left,
private endpoint below, telemetry on the right) and split a shared side with exit/entry fractions (`0.3` / `0.7`).
Relationships that are properties rather than flows (VNet integration, delegation) go as text inside the subnet,
not as edges. Plan these nodes first; they constrain everything around them.
- **Egress via an integration subnet:** draw data flows from the integration subnet (the app's egress point) to the
  target private endpoints; the source subnet must span every column it drops into (`rel()` raises otherwise).
  Name the calling app in the key flow.
- **Managed private endpoints** (Front Door Premium origins, Fabric / Power BI private link, managed VNets) live on
  the provider side: draw service → target directly, labelled 'Private Link (managed)', never through your PE subnet.

## Quick reference (`archdiagram.py`)
`Diagram(page=A5L|A4L|A3L…, font_size=10)` · `frame_title` · `container(kind=vnet|hub|subnet|group)` · `subnet(name, cidr)` ·
`icon / icon_c(cx) / icon_b(cx, bottom)` · `card(icon=path|"shape=...")` · `cloud` · `text` · `panel(accent)` · `legend(kinds)` ·
`numbered_list` · `bullets(h=None → auto)` · `table` · `title_block` · `badge(n,x,y)` · `edge(kind, src, tgt, exit, entry, points)` ·
`rel(id, x=|y=)` (raises if outside the cell) · `columns` · `footer` · `frame_content(pad)` (outer border for figures
without a sheet frame) · `add_edge_kind` · `save` · `lint_file(path)` · `render(path, border=12)`.
`save()` draws containers largest-first, so declaration order never hides content.
CLI: `python archdiagram.py lint|render <file.drawio>`; the example takes `out.drawio --render`. Icon paths: `references/icons.md`.

## Common mistakes
| Mistake | Fix |
|---|---|
| Declaring done from the script, not the render | Always Read the PNG after each change |
| Trusting "lint: 0 issues" | Lint checks label/title overlaps and whitespace. Still check by eye: lines crossing labels or container titles, edge-label placement, free text under lines |
| Leaving empty bands, half-empty panels, wide boxes with one line of text | Act on every `whitespace:` finding; resize boxes to their content |
| Label overlaps a neighbour / line runs through a label | Widen pitch, move to lanes, or shorten the label |
| Icon renders as a grey box | Style must *start* with `image;` (lint flags it) |
| Heading overlaps a panel subtitle | Leave ≥ 18 px under panel titles |
| Container title crossed by a vertical line | Align the title away from the line (right/bottom) |
| Shell heredoc with an apostrophe breaks the command | Write scripts to files |
| PNG export is cropped, PDF is page-sized | Check the fit via the frame, the PDF via the printed page size |
| Figure for a document starts at the image edge, no border | Call `frame_content()` before `save()`; keep `render()`'s default 12 px margin |
| Guessed relationship drawn as fact | Draw only verified links; mark inferred ones |

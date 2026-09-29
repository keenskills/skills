#!/usr/bin/env python3
"""archdiagram - professional architecture diagrams as editable draw.io files (A4 / A3 ready).

Library:
    from archdiagram import Diagram, render, lint_file
    d = Diagram("A4L")                       # A4 landscape page, font size 10
    top = d.frame_title("Title", "subtitle", chip="PRODUCTION")
    ...                                      # containers, icons, panels, edges, badges
    d.save("out.drawio")
    print(*lint_file("out.drawio"), sep="\n")
    render("out.drawio")                     # -> out.png (3x, 12 px margin) + out.pdf (page size)

CLI:
    python archdiagram.py lint   <file.drawio>
    python archdiagram.py render <file.drawio> [--scale 3] [--formats png,pdf] [--border 12]

Coordinates are draw.io page units (A4 landscape = 1169 x 827). Lay out at the final page size
and keep the font size fixed; never shrink a finished drawing to fit a page.
"""
from __future__ import annotations

import html
import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

PAGES = {"A5L": (827, 583), "A5P": (583, 827), "A4L": (1169, 827), "A4P": (827, 1169), "A3L": (1654, 1169), "A3P": (1169, 1654)}

COLORS = dict(dark="#323130", grey="#605E5C", faint="#8A8886", blue="#0078D4", red="#A4262C", green="#107C10",
              orange="#CA5010", purple="#8661C5", amber="#E8A317", teal="#008575", navy="#243A5E")

# edge kind -> (style, legend text). Add project-specific kinds with Diagram.add_edge_kind().
EDGE_KINDS = {
    "https": ("dashed=1;dashPattern=6 3 1 3;strokeColor=#243A5E;strokeWidth=1.2;", "HTTPS / app traffic"),
    "data": ("strokeColor=#243A5E;strokeWidth=1.2;", "Data flow"),
    "ssh": ("dashed=1;dashPattern=6 3;strokeColor=#008575;strokeWidth=1.3;", "RDP / SSH (admin)"),
    "udr": ("dashed=1;dashPattern=6 3 1 3;strokeColor=#8A8886;strokeWidth=1.2;", "Forced tunnel (UDR)"),
    "pe": ("strokeColor=#3A96DD;strokeWidth=1.3;", "Private endpoint"),
    "dns": ("dashed=1;dashPattern=2 2;strokeColor=#E8A317;strokeWidth=1.3;", "Private DNS link"),
    "peer": ("dashed=1;dashPattern=2 2;strokeColor=#8A8886;strokeWidth=1.2;startArrow=blockThin;startFill=1;startSize=4;", "VNet peering"),
    "mon": ("strokeColor=#CA5010;strokeWidth=1.2;", "Monitoring"),
    "pull": ("dashed=1;dashPattern=6 3;strokeColor=#8661C5;strokeWidth=1.2;", "Image pull"),
    "vni": ("dashed=1;dashPattern=3 2;strokeColor=#0078D4;strokeWidth=1.2;", "VNet integration"),
    "thin": ("strokeColor=#A19F9D;strokeWidth=1;", "Association"),
}

# container kind -> (stroke, fill, dash pattern, stroke width)
CONTAINERS = {
    "vnet": ("#0078D4", "#F7FBFE", "4 2", 1.2),
    "hub": ("#8A8886", "#F8F8F8", "4 2", 1.2),
    "subnet": ("#A19F9D", "#FAFAFA", "3 2", 1),
    "group": ("#C8C6C4", "#FFFFFF", "3 2", 1),
}

POS = {
    "bottom": "verticalLabelPosition=bottom;verticalAlign=top;align=center;spacingTop=-2;",
    "left": "labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;spacingRight=4;",
    "right": "labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=4;",
}


def _c(name: str) -> str:
    return COLORS.get(name, name)


class Diagram:
    def __init__(self, page="A4L", font_size=10, font="Segoe UI", name="Architecture"):
        self.W, self.H = PAGES[page] if isinstance(page, str) else page
        self.fs = font_size
        self.F = f"fontFamily={font};"
        self.name = name
        self.cells: list[dict] = []
        self.geo: dict[str, tuple] = {}
        self.edge_kinds = dict(EDGE_KINDS)
        dark = COLORS["dark"]
        self.TEXT = f"text;html=1;whiteSpace=wrap;{self.F}fontSize={self.fs};fontColor={dark};"
        self.PANEL = (f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#D2D0CE;verticalAlign=top;align=left;"
                      f"spacingLeft=8;spacingTop=3;{self.F}fontSize={self.fs};fontStyle=1;fontColor={dark};")
        self.CARD = (f"rounded=1;absoluteArcSize=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#C8C6C4;"
                     f"{self.F}fontSize={self.fs};fontColor={dark};align=left;verticalAlign=middle;")
        self.BADGE = (f"ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={COLORS['blue']};strokeColor=#FFFFFF;strokeWidth=1;"
                      f"fontColor=#FFFFFF;fontStyle=1;{self.F}fontSize={self.fs - 1};spacing=0;")
        self.EDGE = (f"edgeStyle=orthogonalEdgeStyle;rounded=1;jumpStyle=arc;jumpSize=4;html=1;endArrow=blockThin;endFill=1;endSize=4;"
                     f"{self.F}fontSize={self.fs};fontColor={dark};labelBackgroundColor=#FFFFFF;")

    # ---------- text helpers ----------
    @staticmethod
    def label(name: str, *details: str) -> str:
        """Bold resource name + grey detail lines (keep to 1-2 detail lines)."""
        return f"<b>{name}</b>" + "".join(f'<br><font color="{COLORS["grey"]}">{d}</font>' for d in details)

    @staticmethod
    def color(text: str, color: str) -> str:
        return f'<font color="{_c(color)}">{text}</font>'

    def add_edge_kind(self, kind: str, style: str, legend_text: str):
        self.edge_kinds[kind] = (style, legend_text)

    # ---------- geometry helpers ----------
    def rel(self, id: str, x: float | None = None, y: float | None = None) -> float:
        """Fraction of a cell's width (x) or height (y) - for exit/entry points at a given page coordinate."""
        gx, gy, gw, gh = self.geo[id]
        f = round((x - gx) / gw, 4) if x is not None else round((y - gy) / gh, 4)
        if not -0.001 <= f <= 1.001:
            raise ValueError(f"rel({id!r}): point lies outside the cell (fraction {f}); "
                             "make the source/target span that coordinate")
        return f

    @staticmethod
    def columns(x: float, width: float, n: int) -> list[float]:
        """Centres of n equal columns across [x, x+width]."""
        return [x + width / n * (i + 0.5) for i in range(n)]

    # ---------- primitives ----------
    def vertex(self, id, x, y, w, h, style, value="", layer=0):
        if id in self.geo:
            raise ValueError(f"duplicate id: {id}")
        self.geo[id] = (x, y, w, h)
        self.cells.append(dict(t="v", id=id, g=(x, y, w, h), style=style, value=value, layer=layer))
        return id

    def edge(self, id, kind, src, tgt, exit=(0.5, 1), entry=(0.5, 0), points=None, label="", label_pos=None):
        """Straight orthogonal edge. Prefer a numbered badge over a label; if you label, set label_pos
        (-1 = at source, 0 = middle of the path, 1 = at target) so the text lands on a clear segment."""
        if id in self.geo:
            raise ValueError(f"duplicate id: {id}")
        self.geo[id] = None
        style = self.EDGE + self.edge_kinds[kind][0] + f"exitX={exit[0]};exitY={exit[1]};entryX={entry[0]};entryY={entry[1]};"
        self.cells.append(dict(t="e", id=id, src=src, tgt=tgt, style=style, value=label, points=points or [], label_pos=label_pos, layer=2))
        return id

    def icon(self, id, path, x, y, w, h, label="", pos="bottom"):
        """Image icon. `path`: 'img/lib/...', 'https://...', or shorthand relative to img/lib/azure2/."""
        img = path if path.startswith(("img/", "http")) else f"img/lib/azure2/{path}"
        style = f"image;sketch=0;aspect=fixed;html=1;points=[];{self.F}fontSize={self.fs};fontColor={COLORS['dark']};labelBackgroundColor=none;{POS[pos]}image={img};"
        return self.vertex(id, x, y, w, h, style, label, layer=1)

    def icon_c(self, id, path, cx, y, w, h, label="", pos="bottom"):
        """Icon positioned by its horizontal centre."""
        return self.icon(id, path, cx - w / 2, y, w, h, label, pos)

    def icon_b(self, id, path, cx, bottom, w, h, label="", pos="bottom"):
        """Icon by horizontal centre and BOTTOM edge - use for rows so labels share one baseline."""
        return self.icon(id, path, cx - w / 2, bottom - h, w, h, label, pos)

    def text(self, id, x, y, w, h, value, align="left", valign="middle", color="dark", size=None):
        style = self.TEXT + f"align={align};verticalAlign={valign};fontColor={_c(color)};" + (f"fontSize={size};" if size else "")
        return self.vertex(id, x, y, w, h, style, value, layer=1)

    def badge(self, n, x, y, size=14):
        """Numbered flow callout (top-left x, y). Explain every number in a numbered_list panel."""
        return self.vertex(f"badge{n}", x, y, size, size, self.BADGE, str(n), layer=3)

    # ---------- composite shapes ----------
    def container(self, id, x, y, w, h, title, kind="vnet", align="left", valign="top", pad_left=6, pad_right=6):
        stroke, fill, dash, sw = CONTAINERS[kind]
        style = (f"rounded=1;absoluteArcSize=1;arcSize=6;whiteSpace=wrap;html=1;dashed=1;dashPattern={dash};strokeColor={stroke};"
                 f"strokeWidth={sw};fillColor={fill};verticalAlign={valign};align={align};spacingLeft={pad_left};spacingRight={pad_right};"
                 f"spacingTop=0;spacingBottom=0;{self.F}fontSize={self.fs};fontColor={COLORS['dark']};")
        return self.vertex(id, x, y, w, h, style, title)

    def subnet(self, id, x, y, w, h, name, cidr, badges=False, badge_pos="top", two_line=True, align="left"):
        """Subnet box: bold name, grey CIDR. badges=True adds NSG + route-table icons - only when both are verified."""
        sep = "<br>" if two_line else " "
        self.container(id, x, y, w, h, f'<b>{name}</b>{sep}<font color="{COLORS["grey"]}">{cidr}</font>', "subnet", align=align)
        if badges:
            by = y + 4 if badge_pos == "top" else y + h - 16
            bx = x + 6 if align == "right" else x + w - 32          # badges go opposite the title
            self.icon(id + "Nsg", "networking/Network_Security_Groups.svg", bx, by, 10, 12)
            self.icon(id + "Rt", "networking/Route_Tables.svg", bx + 14, by, 13, 12)
        return id

    def card(self, id, x, y, w, h, label, icon=None, icon_size=(12, 20)):
        """External actor / system card. `icon`: image path or a 'shape=...' style string."""
        self.vertex(id, x, y, w, h, self.CARD + f"spacingLeft={24 if icon else 8};", label)
        if icon:
            iw, ih = icon_size
            if icon.startswith("shape="):
                self.vertex(id + "Ico", x + 7, y + (h - ih) / 2, iw, ih, icon + "html=1;pointerEvents=1;", layer=1)
            else:
                self.icon(id + "Ico", icon, x + 7, y + (h - ih) / 2, iw, ih)
        return id

    def cloud(self, id, x, y, w, h, text="Internet"):
        style = f"ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#F3F2F1;strokeColor=#A19F9D;{self.F}fontSize={self.fs};fontStyle=1;fontColor={COLORS['dark']};"
        return self.vertex(id, x, y, w, h, style, text)

    def panel(self, id, x, y, w, h, title, accent="blue"):
        """White panel with a coloured top bar and a bold UPPERCASE title."""
        self.vertex(id, x, y, w, h, self.PANEL, title)
        self.vertex(id + "_bar", x, y, w, 3, f"rounded=0;fillColor={_c(accent)};strokeColor=none;")
        return id

    def legend(self, x, y, w, kinds, title="LEGEND", id="legend"):
        """Legend listing ONLY the edge kinds actually drawn. Returns its height."""
        h = 30 + 15 * len(kinds) + 2
        self.panel(id, x, y, w, h, title)
        for k, kind in enumerate(kinds):
            style, text = self.edge_kinds[kind]
            yy = y + 30 + 15 * k
            self.cells.append(dict(t="lg", id=f"{id}{k}", style="html=1;endArrow=blockThin;endFill=1;endSize=4;" + style,
                                   p=(x + 8, x + 34, yy), layer=2))
            self.text(f"{id}{k}t", x + 39, yy - 8, w - 41, 16, text)
        return h

    def numbered_list(self, id, x, y, w, title, items, *, row_h=18, accent="blue"):
        """Numbered 'KEY FLOWS' panel matching badge() numbers. Returns its height."""
        h = 22 + row_h * len(items) + 2
        self.panel(id, x, y, w, h, title, accent)
        for k, t in enumerate(items):
            yy = y + 22 + row_h * k
            self.vertex(f"{id}N{k}", x + 6, yy + (row_h - 14) / 2, 14, 14, self.BADGE, str(k + 1), layer=1)
            self.text(f"{id}T{k}", x + 24, yy, w - 24, row_h, t)
        return h

    def bullets(self, id, x, y, w, h, title, items, accent="red", marker="▲"):
        """Findings panel - problems only. h=None sizes it to the wrapped text. Returns its height."""
        if h is None:
            cpl = max(1.0, (w - 11) / (self.fs * 0.49))
            lines = sum(max(1, -(-(len(t) + 2) // cpl)) for t in items)
            h = int(20 + lines * self.fs * 1.3 + 4)
        self.panel(id, x, y, w, h, title, accent)
        m = self.color(marker, accent)
        self.text(f"{id}Text", x + 8, y + 16, w - 11, h - 18, "<br>".join(f"{m} {t}" for t in items), valign="top")
        return h

    def table(self, id, x, y, w, title, headers, rows, col_widths=None, accent="blue"):
        """Compact table panel - for facts the drawing cannot show, never to repeat what it shows. Returns its height."""
        row_h = round(self.fs * 1.3)
        n = len(headers)
        col_widths = col_widths or [(w - 16) / n] * n
        body_h = row_h * (len(rows) + 1) + 4
        h = 20 + body_h + 4
        self.panel(id, x, y, w, h, title, accent)
        cx = x + 8
        for j, cw in enumerate(col_widths):
            cells = [f"<b>{headers[j]}</b>"] + [str(r[j]) for r in rows]
            self.text(f"{id}C{j}", cx, y + 18, cw, body_h, "<br>".join(cells), valign="top")
            cx += cw
        return h

    def title_block(self, id, x, y, w, h, lines, accent="blue"):
        """Drawing information block: first line bold, the rest grey."""
        value = f"<b>{lines[0]}</b>" + "".join(f'<br><font color="{COLORS["grey"]}">{l}</font>' for l in lines[1:])
        self.vertex(id, x, y, w, h, self.PANEL.replace("fontStyle=1;", "fontStyle=0;") + "verticalAlign=middle;spacingTop=0;", value)
        self.vertex(id + "_bar", x, y, w, 3, f"rounded=0;fillColor={_c(accent)};strokeColor=none;")
        return id

    def frame_title(self, title, subtitle, chip=None, chip_colors=("#FFF4CE", "#E3B400", "#7A5B00")):
        """Sheet frame + title band + optional environment chip. Returns the y where content starts."""
        self.vertex("frame", 10, 10, self.W - 20, self.H - 20, "rounded=0;fillColor=#FFFFFF;strokeColor=#C8C6C4;")
        self.text("title", 24, 11, self.W * 0.7, 38,
                  f'<font style="font-size:{self.fs + 6}px"><b>{title}</b></font><br><font color="{COLORS["grey"]}">{subtitle}</font>',
                  valign="top")
        if chip:
            cw = max(80, len(chip) * 7 + 18)
            fill, stroke, fc = chip_colors
            self.vertex("envchip", self.W - 24 - cw, 20, cw, 20,
                        f"rounded=1;arcSize=50;html=1;fillColor={fill};strokeColor={stroke};{self.F}fontSize={self.fs};fontStyle=1;fontColor={fc};", chip)
        self.vertex("rule", 24, 53, self.W - 48, 1.5, f"rounded=0;fillColor={COLORS['blue']};strokeColor=none;")
        return 64

    def frame_content(self, pad=16, id="frame"):
        """Outer border for a figure that has no sheet frame (e.g. a crop placed in a Word document): a rounded
        rectangle `pad` px outside every shape, icon label and edge waypoint. Call it last, just before save()."""
        boxes = []
        for c in self.cells:
            if c["t"] == "v":
                x, y, w, h = c["g"]
                boxes.append((x, y, x + w, y + h))
                st = _style(c["style"])
                if c["value"] and "image" in st:
                    r = _label_rect(x, y, w, h, c["value"], st, self.fs)
                    if r:
                        boxes.append(r)
            elif c["t"] == "lg":
                x1, x2, yy = c["p"]
                boxes.append((min(x1, x2), yy, max(x1, x2), yy))
            else:
                boxes += [(px, py, px, py) for px, py in c["points"]]
        if not boxes:
            raise ValueError("frame_content(): nothing to frame")
        x0, y0 = min(b[0] for b in boxes) - pad, min(b[1] for b in boxes) - pad
        x1, y1 = max(b[2] for b in boxes) + pad, max(b[3] for b in boxes) + pad
        return self.vertex(id, x0, y0, x1 - x0, y1 - y0,
                           "rounded=1;absoluteArcSize=1;arcSize=12;fillColor=#FFFFFF;strokeColor=#C8C6C4;strokeWidth=1;")

    def footer(self, text):
        return self.text("footer", 24, self.H - 28, self.W - 48, 15, text, color="faint")

    # ---------- output ----------
    def save(self, path):
        mxfile = ET.Element("mxfile", host="Electron")
        diag = ET.SubElement(mxfile, "diagram", name=self.name, id=re.sub(r"\W+", "-", self.name.lower()))
        model = ET.SubElement(diag, "mxGraphModel", dict(dx=str(self.W), dy=str(self.H), grid="0", gridSize="10", guides="1", tooltips="1",
                                                         connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth=str(self.W),
                                                         pageHeight=str(self.H), background="#FFFFFF", math="0", shadow="0"))
        root = ET.SubElement(model, "root")
        ET.SubElement(root, "mxCell", id="0")
        ET.SubElement(root, "mxCell", id="1", parent="0")
        missing = [c["id"] for c in self.cells if c["t"] == "e" and (c["src"] not in self.geo or c["tgt"] not in self.geo)]
        if missing:
            raise ValueError(f"edges reference unknown cells: {missing}")
        def order(c):                                    # containers largest-first, then icons < edges < badges
            big = c["t"] == "v" and c["layer"] == 0
            return (c["layer"], -(c["g"][2] * c["g"][3]) if big else 0)

        for c in sorted(self.cells, key=order):         # stable sort keeps call order within a size
            if c["t"] == "v":
                x, y, w, h = c["g"]
                cell = ET.SubElement(root, "mxCell", id=c["id"], value=c["value"], style=c["style"], vertex="1", parent="1")
                ET.SubElement(cell, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})
            elif c["t"] == "lg":
                x1, x2, yy = c["p"]
                cell = ET.SubElement(root, "mxCell", id=c["id"], style=c["style"], edge="1", parent="1")
                geo = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
                ET.SubElement(geo, "mxPoint", {"x": str(x1), "y": str(yy), "as": "sourcePoint"})
                ET.SubElement(geo, "mxPoint", {"x": str(x2), "y": str(yy), "as": "targetPoint"})
            else:
                cell = ET.SubElement(root, "mxCell", id=c["id"], value=c["value"], style=c["style"], edge="1", parent="1",
                                     source=c["src"], target=c["tgt"])
                geo = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
                if c.get("label_pos") is not None:
                    geo.set("x", str(c["label_pos"]))
                    ET.SubElement(geo, "mxPoint", {"as": "offset"})
                if c["points"]:
                    arr = ET.SubElement(geo, "Array", {"as": "points"})
                    for px, py in c["points"]:
                        ET.SubElement(arr, "mxPoint", {"x": str(px), "y": str(py)})
        ET.indent(mxfile, space="  ")
        ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=False)
        return path


# ---------------- lint: estimated label boxes ----------------
def _style(s: str) -> dict:
    out = {}
    for tok in filter(None, s.split(";")):
        k, eq, v = tok.partition("=")
        out[k] = v if eq else True
    return out


def _label_rect(x, y, w, h, value, st, fs):
    lines = [html.unescape(re.sub(r"<[^>]+>", "", l)).strip() for l in re.split(r"<br\s*/?>", value)]
    lines = [l for l in lines if l]
    if not lines:
        return None
    bold_first = value.lstrip().startswith("<b>")
    tw = max(len(l) * fs * (0.56 if (i == 0 and bold_first) else 0.52) for i, l in enumerate(lines))
    th = len(lines) * fs * 1.25
    cy = y + h / 2
    if st.get("labelPosition") == "left":
        return (x - 4 - tw, cy - th / 2, x - 4, cy + th / 2)
    if st.get("labelPosition") == "right":
        return (x + w + 4, cy - th / 2, x + w + 4 + tw, cy + th / 2)
    cx = x + w / 2
    return (cx - tw / 2, y + h, cx + tw / 2, y + h + th)


def _hit(a, b, tol=1.0):
    return a[0] < b[2] - tol and b[0] < a[2] - tol and a[1] < b[3] - tol and b[1] < a[3] - tol


def _title_rect(x, y, w, h, value, st, fs):
    """Estimated box of a container/panel/card title (text drawn inside the shape)."""
    lines = [html.unescape(re.sub(r"<[^>]+>", "", l)).strip() for l in re.split(r"<br\s*/?>", value)]
    lines = [l for l in lines if l]
    if not lines:
        return None
    cw = fs * 0.49                                        # calibrated on rendered Segoe UI titles
    sl, sr = float(st.get("spacingLeft", 2)), float(st.get("spacingRight", 2))
    avail = max(1.0, w - sl - sr)
    if st.get("whiteSpace") == "wrap":
        n = sum(max(1, -(-len(l) * cw // avail)) for l in lines)
        tw, th = min(avail, max(len(l) * cw for l in lines)), n * fs * 1.25
    else:
        tw, th = max(len(l) * cw for l in lines), len(lines) * fs * 1.25
    st_, sb = float(st.get("spacingTop", 0)), float(st.get("spacingBottom", 0))
    align, valign = st.get("align", "center"), st.get("verticalAlign", "middle")
    tx = x + sl if align == "left" else (x + w - sr - tw if align == "right" else x + (w - tw) / 2)
    ty = y + st_ if valign == "top" else (y + h - sb - th if valign == "bottom" else y + (h - th) / 2)
    return (tx, ty, tx + tw, ty + th)


def lint_file(path, whitespace=True) -> list[str]:
    """Flag overlapping icon labels, labels over other icons, labels outside the frame, icons that render as boxes,
    and container / panel / card titles covered by an icon or an icon label.

    Label widths are estimates (~5.2-5.6 px/char at font 10): treat hits as 'look here'.
    Also runs whitespace_file() (empty boxes, side gaps, empty page areas) unless whitespace=False.
    NOT checked: lines crossing labels, edge labels, free text overlapping other items.
    A clean lint is necessary, not sufficient - always view the rendered PNG.
    """
    root = ET.parse(path).getroot()
    model = root.find(".//mxGraphModel")
    W, H = float(model.get("pageWidth", 1169)), float(model.get("pageHeight", 827))
    issues, icons, labels, titles, order, below = [], [], [], [], [], []
    frame = (0, 0, W, H)
    for c in root.iter("mxCell"):
        if c.get("vertex") != "1":
            continue
        g = c.find("mxGeometry")
        x, y, w, h = (float(g.get(k, 0)) for k in ("x", "y", "width", "height"))
        s = c.get("style", "")
        order.append((c.get("id"), (x, y, x + w, y + h), s))
        if s.startswith("image;") and max(w, h) > 40:
            issues.append(f"{c.get('id')}: icon is {int(w)}x{int(h)} - keep icons 20-28 px; never enlarge icons to fill space")
        if c.get("id") == "frame":
            frame = (x, y, x + w, y + h)
        if "image=" in s and not s.startswith("image;") and "shape=image" not in s:
            issues.append(f"{c.get('id')}: style has image= but does not start with 'image;' -> renders as a plain box")
        if not s.startswith("image;"):
            if c.get("value") and not s.startswith(("text;", "ellipse")) and c.get("id") not in ("frame", "rule"):
                st0 = _style(s)
                tr = _title_rect(x, y, w, h, c.get("value", ""), st0, float(st0.get("fontSize", 10)))
                if tr:
                    titles.append((c.get("id"), tr))
            continue
        st = _style(s)
        icons.append((c.get("id"), (x, y, x + w, y + h)))
        r = _label_rect(x, y, w, h, c.get("value", ""), st, float(st.get("fontSize", 10)))
        if r:
            labels.append((c.get("id"), r))
            if st.get("labelPosition") not in ("left", "right"):
                below.append((c.get("id"), (x, y, x + w, y + h), r[1]))
    for i, (a, ra) in enumerate(labels):
        if not _hit(ra, frame, 0) or ra[0] < frame[0] or ra[2] > frame[2] or ra[3] > frame[3]:
            issues.append(f"{a}: label extends outside the frame")
        for b, rb in labels[i + 1:]:
            if _hit(ra, rb):
                issues.append(f"{a} / {b}: labels overlap")
        for b, rb in icons:
            if b != a and _hit(ra, rb):
                issues.append(f"{a}: label overlaps icon {b}")
    for i, (bid, rb, sb) in enumerate(order):          # a filled box drawn AFTER a cell hides it
        stb = _style(sb)
        if sb.startswith(("image;", "text;")) or stb.get("fillColor") == "none" or (rb[2] - rb[0]) * (rb[3] - rb[1]) < 6000:
            continue
        hidden = [aid for aid, ra, _ in order[:i] if aid != "frame" and _inside(ra, rb)]
        if hidden:
            issues.append(f"{len(hidden)} cell(s) hidden behind {bid} ({', '.join(hidden[:3])}...) - containers must be drawn first")
    for i, (a, ra, ta) in enumerate(below):            # same row, labels 2-8 px apart = ragged baseline
        for b, rb, tb in below[i + 1:]:
            overlap = min(ra[3], rb[3]) - max(ra[1], rb[1])
            if overlap > 0.5 * min(ra[3] - ra[1], rb[3] - rb[1]) and 1.5 < abs(ta - tb) < 8:
                issues.append(f"{a} / {b}: labels in one row are {abs(ta - tb):.0f}px off a common baseline"
                              " - place row icons with icon_b()")
    for t, rt in titles:
        for b, rb in icons:
            if _hit(rt, rb):
                issues.append(f"{t}: title overlaps icon {b}")
        for b, rb in labels:
            if _hit(rt, rb):
                issues.append(f"{t}: title overlaps label of {b}")
    if whitespace:
        issues += whitespace_file(path)
    return issues


# ---------------- whitespace ----------------
def _inside(r, b, tol=1.0):
    return r[0] >= b[0] - tol and r[1] >= b[1] - tol and r[2] <= b[2] + tol and r[3] <= b[3] + tol


def whitespace_file(path, max_gap_frac=0.4, min_gap=50, page_frac=0.03, min_side=60, band_min=32, cell=8) -> list[str]:
    """Flag wasted space.

    1. Boxes (containers, subnets, panels) that hold only a title, or whose content leaves a side gap
       larger than max(min_gap, max_gap_frac x that dimension).
    2. Empty page areas: the largest empty rectangles inside the frame (below the title rule) that cover
       more than page_frac of the frame and are at least min_side on both sides, and empty BANDS that span
       half the frame width and are at least band_min tall (dead strips between sections).
    Findings are prompts: fill the space (move a panel/legend there) or tighten the layout.
    """
    root = ET.parse(path).getroot()
    model = root.find(".//mxGraphModel")
    W, H = float(model.get("pageWidth", 1169)), float(model.get("pageHeight", 827))
    frame, top = (0.0, 0.0, W, H), 0.0
    ink, shapes, geo, lines = [], [], {}, []  # shapes: (id, box, title box, text-is-the-content)
    for c in root.iter("mxCell"):
        if c.get("vertex") != "1":
            continue
        g = c.find("mxGeometry")
        x, y, w, h = (float(g.get(k, 0)) for k in ("x", "y", "width", "height"))
        cid, s_, v = c.get("id"), c.get("style", ""), c.get("value", "")
        geo[cid] = (x, y, w, h)
        st = _style(s_)
        fs = float(st.get("fontSize", 10))
        if cid == "frame":
            frame = (x, y, x + w, y + h)
            continue
        if cid == "rule":
            top = y + h
            continue
        if w <= 4 or h <= 4:                  # accent bars, hairlines
            continue
        if s_.startswith("image;"):
            ink.append((x, y, x + w, y + h))
            r = _label_rect(x, y, w, h, v, st, fs)
            if r:
                ink.append(r)
        elif s_.startswith("text;"):
            r = _title_rect(x, y, w, h, v, st, fs) if v else None
            if r:
                ink.append(r)
        elif s_.startswith("ellipse") or (not st.get("dashed") and w * h < 6000):
            ink.append((x, y, x + w, y + h))  # badges, clouds, cards, chips count as solid content
        else:
            shapes.append((cid, (x, y, x + w, y + h), _title_rect(x, y, w, h, v, st, fs) if v else None,
                           st.get("verticalAlign", "middle") == "middle"))

    # 3. connector lines count as content for the page-level check (a gap crossed by lines is not dead)
    for c in root.iter("mxCell"):
        if c.get("edge") != "1" or c.get("source") not in geo or c.get("target") not in geo:
            continue
        st = _style(c.get("style", ""))
        sg, tg = geo[c.get("source")], geo[c.get("target")]
        pts = [(sg[0] + sg[2] * float(st.get("exitX", 0.5)), sg[1] + sg[3] * float(st.get("exitY", 0.5)))]
        pts += [(float(p.get("x")), float(p.get("y"))) for p in c.findall("./mxGeometry/Array/mxPoint")]
        pts.append((tg[0] + tg[2] * float(st.get("entryX", 0.5)), tg[1] + tg[3] * float(st.get("entryY", 0.5))))
        for a, b in zip(pts, pts[1:]):
            k = (b[0], a[1])                  # orthogonal: horizontal then vertical
            for u, q in ((a, k), (k, b)):
                lines.append((min(u[0], q[0]) - 1, min(u[1], q[1]) - 1, max(u[0], q[0]) + 1, max(u[1], q[1]) + 1))

    issues = []
    # 1. boxes that are mostly empty
    for sid, b, tr, text_is_content in shapes:
        bw, bh = b[2] - b[0], b[3] - b[1]
        if bw * bh < 6000:
            continue
        body = [r for r in ink if _inside(r, b)]
        body += [ob for oid, ob, _, _ in shapes if oid != sid and _inside(ob, b)]
        if text_is_content:
            body += [tr] if tr else []
            if not body:
                continue
        if not body:
            issues.append(f"whitespace: {sid} ({int(bw)}x{int(bh)}) holds only its title - remove it, shrink it or put content in it")
            continue
        content = body + ([tr] if tr else [])
        fill = sum((r[2] - r[0]) * (r[3] - r[1]) for r in content) / (bw * bh)
        if bw * bh > 15000 and fill < 0.15:
            issues.append(f"whitespace: {sid} ({int(bw)}x{int(bh)}) is mostly empty (content ~{int(100 * fill)}%) - shrink it or move content in")
            continue
        x0, y0 = min(r[0] for r in content), min(r[1] for r in content)
        x1, y1 = max(r[2] for r in content), max(r[3] for r in content)
        for side, gap, dim, word in (("left", x0 - b[0], bw, "width"), ("right", b[2] - x1, bw, "width"),
                                     ("top", y0 - b[1], bh, "height"), ("bottom", b[3] - y1, bh, "height")):
            if gap > max(min_gap, max_gap_frac * dim):
                issues.append(f"whitespace: {sid} has {int(gap)}px empty on the {side} ({int(100 * gap / dim)}% of its {word})"
                              f" - shrink it or move content in")

    # 2. large empty areas on the page (maximal empty rectangles on a coarse grid)
    fx0, fy0, fx1, fy1 = frame[0] + 6, max(frame[1], top) + 6, frame[2] - 6, frame[3] - 6
    cols, rows = int((fx1 - fx0) // cell), int((fy1 - fy0) // cell)
    if cols <= 0 or rows <= 0:
        return issues
    occ = [[False] * cols for _ in range(rows)]

    def mark(r):
        c0, c1 = max(0, int((r[0] - fx0) // cell)), min(cols, int((r[2] - fx0) // cell) + 1)
        r0, r1 = max(0, int((r[1] - fy0) // cell)), min(rows, int((r[3] - fy0) // cell) + 1)
        for i in range(r0, r1):
            for j in range(c0, c1):
                occ[i][j] = True

    for r in ink + lines + [b for _, b, _, _ in shapes]:
        mark(r)
    frame_area = (fx1 - fx0) * (fy1 - fy0)
    reported = 0
    for _ in range(12):                       # look past thin strips for up to 3 real gaps
        best, rect = 0, None
        heights = [0] * cols
        for i in range(rows):
            for j in range(cols):
                heights[j] = heights[j] + 1 if not occ[i][j] else 0
            stack = []
            for j in range(cols + 1):
                hh = heights[j] if j < cols else 0
                start = j
                while stack and stack[-1][1] >= hh:
                    s0, sh = stack.pop()
                    if sh * (j - s0) > best:
                        best, rect = sh * (j - s0), (s0, i - sh + 1, j, i + 1)
                    start = s0
                stack.append((start, hh))
        if not rect or best * cell * cell < min(page_frac * frame_area, 0.5 * (fx1 - fx0) * band_min):
            break
        c0, r0, c1, r1 = rect
        ex, ey, ew, eh = fx0 + c0 * cell, fy0 + r0 * cell, (c1 - c0) * cell, (r1 - r0) * cell
        for i in range(r0, r1):
            for j in range(c0, c1):
                occ[i][j] = True
        band = ew >= 0.5 * (fx1 - fx0) and eh >= band_min
        big = min(ew, eh) >= min_side and ew * eh >= page_frac * frame_area
        if not (band or big):
            continue
        if band and not big and ey + eh >= fy1 - 30:  # slack parked above the footer is intentional
            continue
        issues.append(f"whitespace: empty {'band' if band and not big else 'area'} {int(ew)}x{int(eh)} at x={int(ex)},y={int(ey)} "
                      f"({int(100 * ew * eh / frame_area)}% of page) - move a panel here or tighten the layout")
        reported += 1
        if reported == 3:
            break
    return issues


# ---------------- render via draw.io desktop ----------------
def find_drawio() -> str | None:
    for cand in (os.environ.get("DRAWIO"), shutil.which("drawio"), shutil.which("draw.io"),
                 r"C:\Program Files\draw.io\draw.io.exe",
                 os.path.expandvars(r"%LOCALAPPDATA%\Programs\draw.io\draw.io.exe"),
                 "/Applications/draw.io.app/Contents/MacOS/draw.io", "/usr/bin/drawio", "/snap/bin/drawio"):
        if cand and Path(cand).exists():
            return cand
    return None


def render(path, formats=("png", "pdf"), scale=3, border=12) -> list[str]:
    """Export with draw.io desktop. PNG is cropped to content at `scale` with a `border` px white margin, so the
    sheet frame (or frame_content()) never touches the image edge; PDF uses the page size."""
    exe = find_drawio()
    if not exe:
        raise SystemExit("draw.io desktop not found - install it or set DRAWIO=<path to draw.io executable>")
    src = Path(path)
    outs = []
    for fmt in formats:
        out = src.with_suffix(f".{fmt}")
        cmd = [exe, "-x", "-f", fmt, "-o", str(out)]
        if fmt == "png":
            cmd += ["-s", str(scale), "-b", str(border)]
        subprocess.run(cmd + [str(src)], capture_output=True, timeout=240)
        if not out.exists():
            raise SystemExit(f"export failed: {out}")
        outs.append(str(out))
        if fmt == "pdf":
            boxes = set(re.findall(rb"/MediaBox\s*\[([^\]]+)\]", out.read_bytes()))
            for b in boxes:
                wpt, hpt = (float(v) for v in b.split()[2:4])
                print(f"{out.name}: {round(wpt / 72 * 25.4)} x {round(hpt / 72 * 25.4)} mm")
    return outs


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("lint", "render"):
        sys.exit(__doc__)
    if sys.argv[1] == "lint":
        found = lint_file(sys.argv[2])
        print("\n".join(found) if found else "lint: no overlaps or whitespace findings (still view the PNG)")
        sys.exit(1 if found else 0)
    args = sys.argv[3:]
    scale = int(args[args.index("--scale") + 1]) if "--scale" in args else 3
    fmts = tuple(args[args.index("--formats") + 1].split(",")) if "--formats" in args else ("png", "pdf")
    border = int(args[args.index("--border") + 1]) if "--border" in args else 12
    print("\n".join(render(sys.argv[2], fmts, scale, border)))

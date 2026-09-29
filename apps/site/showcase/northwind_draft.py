"""Makes the "first draft" for the site's lint -> fix showcase from the finished Northwind example.

It undoes three things the lint pass exists to catch - an oversized icon, an icon off its row's
baseline, and two labels on top of each other - and keeps each change only when the real linter
reports it, so the draft's findings are genuine archdiagram.py output.

Usage: python3 northwind_draft.py <final.drawio> <draft.drawio>   (prints the fixes as JSON)
Needs ARCHDIAGRAM_DIR = the skill's scripts folder.
"""
import copy
import json
import os
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.environ["ARCHDIAGRAM_DIR"])
from archdiagram import lint_file  # noqa: E402


def icons(tree):
    for c in tree.getroot().iter("mxCell"):
        if c.get("vertex") == "1" and (c.get("style") or "").startswith("image;"):
            yield c, c.find("mxGeometry")


def by_id(tree, cid):
    return next((c, g) for c, g in icons(tree) if c.get("id") == cid)


def lint(tree):
    fd, path = tempfile.mkstemp(suffix=".drawio")
    os.close(fd)
    try:
        tree.write(path, encoding="utf-8")
        return lint_file(path)
    finally:
        os.unlink(path)


def num(g, k):
    return float(g.get(k))


def fmt(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def first_that_lints(tree, changes, expect):
    """Applies the first change that adds a lint finding containing `expect`."""
    before = set(lint(tree))
    for change in changes:
        trial = copy.deepcopy(tree)
        cid, fix = change(trial)
        hits = [f for f in set(lint(trial)) - before if expect in f]
        if hits:
            return trial, cid, fix(sorted(hits)[0]) if callable(fix) else fix
    sys.exit(f"no candidate produced a lint finding containing '{expect}'")


def grow(cid):
    def change(t):
        _, g = by_id(t, cid)
        w, h = num(g, "width"), num(g, "height")
        g.set("width", "44")
        g.set("height", "44")
        return cid, f"{cid}: icon back to {fmt(w)}×{fmt(h)} px (the draft had it at 44×44)"
    return change


def drop(cid):
    def change(t):
        _, g = by_id(t, cid)
        g.set("y", fmt(num(g, "y") + 7))
        return cid, f"{cid}: moved 7 px up, back onto its row's baseline"
    return change


def crowd(cid, other):
    def change(t):
        (_, g), (_, go) = by_id(t, cid), by_id(t, other)
        x = num(g, "x")
        g.set("x", fmt(num(go, "x") + 12))
        # Name the label the linter saw overlap ("a / b: labels overlap"), not the icon it was moved next to.
        def fix(hit):
            pair = [p.strip() for p in hit.split(":")[0].split("/")]
            hit_other = next((p for p in pair if p != cid), other)
            return f"{cid}: moved back to x={fmt(x)}, so its label no longer overlaps {hit_other}'s"
        return cid, fix
    return change


def main(src, out):
    tree = ET.parse(src)
    ids = [c.get("id") for c, _ in icons(tree)]
    fixes, used = [], set()
    tree, cid, fix = first_that_lints(tree, [grow(i) for i in ids], "keep icons 20-28 px")
    fixes.append(fix)
    used.add(cid)
    tree, cid, fix = first_that_lints(tree, [drop(i) for i in ids if i not in used], "off a common baseline")
    fixes.append(fix)
    used.add(cid)
    pairs = [(i, j) for i in ids for j in ids if i != j and i not in used and j not in used]
    tree, cid, fix = first_that_lints(tree, [crowd(i, j) for i, j in pairs], "overlap")
    fixes.append(fix)
    ET.indent(tree.getroot(), space="  ")
    tree.write(out, encoding="utf-8")
    print(json.dumps(fixes, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

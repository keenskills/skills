"""Self-test: the example lints clean and every lint rule still fires. Run: python tests/selftest.py"""
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from archdiagram import Diagram, lint_file  # noqa: E402

tmp = Path(tempfile.mkdtemp())
ok = True


def check(name, cond):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + name)


# 1. the worked example is clean
out = tmp / "example.drawio"
subprocess.run([sys.executable, str(ROOT / "examples" / "event_driven_platform_a4.py"), str(out)], check=True, capture_output=True)
check("example lints clean", lint_file(out) == [])

# 2. each rule fires on a seeded defect
d = Diagram("A4L")
d.frame_title("selftest", "seeded defects")
d.icon_c("a", "compute/Virtual_Machine.svg", 200, 300, 24, 24, d.label("sql-contoso-prod-westeurope-001", "neighbour"))
d.icon_c("b", "compute/Virtual_Machine.svg", 260, 300, 24, 24, d.label("app-contoso-portal-api-001", "neighbour"))
d.icon("c", "compute/Virtual_Machine.svg", 1130, 400, 24, 24, d.label("label-running-past-the-frame"), "right")
d.vertex("broken", 500, 500, 24, 24, "aspect=fixed;image;image=img/lib/azure2/compute/Virtual_Machine.svg;")
d.icon_c("big", "compute/Virtual_Machine.svg", 700, 500, 60, 60)
d.icon_c("r1", "compute/Virtual_Machine.svg", 900, 600, 24, 24, d.label("one", "x"))
d.icon_c("r2", "storage/Storage_Accounts.svg", 1000, 600, 28, 22, d.label("two", "y"))
d.save(tmp / "neg.drawio")
found = "\n".join(lint_file(tmp / "neg.drawio"))
check("overlapping labels", "labels overlap" in found)
check("label outside frame", "outside the frame" in found)
check("icon renders as box", "plain box" in found)
check("oversized icon", "never enlarge icons" in found)
check("ragged baseline", "common baseline" in found)
check("whitespace", "whitespace:" in found)

# 3. hidden cells in a hand-edited file
t = ET.parse(out)
root = t.getroot().find(".//root")
vnet = [c for c in root if c.get("id") == "vnet"][0]
root.remove(vnet)
root.append(vnet)
t.write(tmp / "hidden.drawio", encoding="utf-8")
check("hidden cells", any("hidden behind vnet" in i for i in lint_file(tmp / "hidden.drawio")))

# 4. frame_content() encloses every shape and label, so lint sees nothing outside the frame
f = Diagram("A4L")
f.icon_c("x", "compute/Virtual_Machine.svg", 300, 300, 24, 24, f.label("a-long-resource-name-under-the-icon", "detail"))
f.icon("y", "compute/Virtual_Machine.svg", 600, 200, 24, 24, f.label("label-to-the-right"), "right")
f.frame_content()
f.save(tmp / "framed.drawio")
check("frame_content encloses labels", not any("outside the frame" in i for i in lint_file(tmp / "framed.drawio")))

# 5. rel() refuses points outside a cell
try:
    d.rel("a", x=10_000)
    check("rel() raises outside the cell", False)
except ValueError:
    check("rel() raises outside the cell", True)

sys.exit(0 if ok else 1)

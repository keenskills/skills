"""How page-as-data helps — A4 landscape, font 10.

Built with archdiagram.py from https://github.com/gjohnpaull/drawing-architecture-diagrams.
Point ARCHDIAGRAM_DIR at that repo's scripts/ folder (or install it as a Claude skill), then:

    python docs/diagram/how-it-helps.py docs/diagram/how-it-helps.drawio --render
"""
import os
import sys
from pathlib import Path

for cand in (os.environ.get("ARCHDIAGRAM_DIR"), Path.home() / ".claude" / "skills" / "drawing-architecture-diagrams" / "scripts"):
    if cand and (Path(cand) / "archdiagram.py").exists():
        sys.path.insert(0, str(cand))
        break
from archdiagram import Diagram, lint_file, render  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "how-it-helps.drawio"

d = Diagram("A4L", name="How page-as-data helps")
d.add_edge_kind("cmd", "strokeColor=#243A5E;strokeWidth=1.3;", "You run a command")
d.add_edge_kind("inject", "dashed=1;dashPattern=6 3;strokeColor=#8661C5;strokeWidth=1.3;", "Injected over DevTools Protocol")
d.add_edge_kind("reads", "strokeColor=#008575;strokeWidth=1.3;", "Reads the rendered page")
d.add_edge_kind("event", "dashed=1;dashPattern=2 2;strokeColor=#CA5010;strokeWidth=1.3;", "Browser events (errors, requests)")
d.add_edge_kind("report", "strokeColor=#0078D4;strokeWidth=1.3;", "Answer as data")
d.add_edge_kind("fallback", "dashed=1;dashPattern=4 4;strokeColor=#8A8886;strokeWidth=1.1;", "Last resort only")
L = d.label

# ============ title band ============
d.frame_title("page-as-data — read the screen as data, not as a screenshot",
              "How a developer or an AI coding agent checks a web page while fixing a bug · zero dependencies · Chrome DevTools Protocol",
              chip="v0.1")

# ============ context band: how it works | what a screenshot misses ============
CY = 70
d.numbered_list("flows", 24, CY, 560, "HOW IT WORKS",
                ["You (or an AI agent, or CI) run  page-as-data read <url>  or  check <url>",
                 "The CLI opens a tab and injects page-as-data.js before the app's own scripts",
                 "The script waits until the screen has really finished, then reads it",
                 "Chrome reports what broke behind the page: exceptions, console, requests",
                 "You get the screen as text or JSON, with exit code 1 when something is wrong",
                 "Fix, run again. A screenshot only for what data cannot answer"], row_h=16)
d.bullets("misses", 592, CY, 553, 120, "WHAT A SCREENSHOT MISSES",
          ["A button cut off by its container just looks absent",
           "A hidden element looks the same as one that does not exist",
           "Console errors, uncaught exceptions and failed requests are invisible",
           "Colour and contrast are guessed from compressed pixels",
           "A background tab shows a half-loaded page, which reads as a bug",
           "Every look costs a large image in an AI agent's context"])

# ============ flow band ============
d.card("you", 24, 244, 158, 58, L("You · AI agent · CI", "runs one command"))
d.card("cli", 236, 244, 168, 58, L("page-as-data CLI", "cli.mjs · read · check"))
d.legend(24, 314, 188, ["cmd", "inject", "reads", "event", "report", "fallback"])

d.container("chrome", 452, 214, 474, 222,
            "<b>Chrome</b>  <font color=\"#605E5C\">your signed-in debug Chrome (--port 9222) or headless (--launch)</font>")
d.card("app", 472, 244, 196, 58, L("Your web app", "unchanged · nothing installed"))
d.card("probe", 472, 360, 196, 58, L("page-as-data.js", "injected before the app's scripts"))
d.container("inpage", 690, 238, 222, 184, "<b>Inside the page</b>", kind="group")
d.text("inpageText", 698, 256, 208, 164,
       "<b>settle</b> — waits for router requests, React streams, skeletons, animations"
       "<br><b>read</b> — headings, text, dialogs, alerts, tables, form fields and their errors, buttons and their state"
       "<br><b>inspect</b> — visible? cut off by what? colour, contrast"
       "<br><b>click / fill</b> — reproduce the bug"
       "<br><b>check</b> — overflow, cut-off controls, broken sticky, WCAG touch targets",
       valign="top")

d.card("report", 972, 244, 173, 58, L("The screen as data", "text or JSON · exit 0 / 1 / 2"))
d.card("shot", 972, 344, 173, 58, L("Screenshot", "--screenshot · images, charts, polish"))

# ============ output band ============
OY = 452
OH = 92
d.bullets("readPanel", 24, OY, 270, OH, "READ — WHAT IS ON SCREEN",
          ["Headings, main text, open dialogs",
           "Alerts and status messages",
           "Tables as rows, with links",
           "Form fields, values, validation errors",
           "Buttons and links, disabled or expanded"], accent="blue", marker="•")
d.bullets("behindPanel", 302, OY, 270, OH, "BEHIND THE PAGE",
          ["Uncaught exceptions",
           "console.error and warnings",
           "Failed requests (4xx, 5xx, network)",
           "Broken images",
           "Pages that never finish loading, and why"], accent="orange", marker="•")
d.bullets("inspectPanel", 580, OY, 290, OH, "INSPECT AND CHECK",
          ["Visible? Hidden by what? Cut off by what?",
           "Colour and WCAG contrast, incl. oklch and gradients",
           "Page wider than the phone screen",
           "Controls cut off where nothing scrolls to them",
           "Sticky headers that can never stick"], accent="teal", marker="•")
d.bullets("found", 878, OY, 267, OH, "CAUGHT ON A REAL APP",
          ["'New product' and 'New user' cut off at 390px",
           "Table header 48px down, over the first row",
           "Primary button text at 4.02:1 contrast",
           "A page read as 'settled' before it switched"])

TY = OY + OH + 10
TH = 112
d.panel("try", 24, TY, 580, TH, "TRY IT")
d.text("tryText", 32, TY + 18, 566, TH - 20,
       "<font face=\"Consolas\">npx page-as-data read http://localhost:3000/orders --width 390</font>"
       "<br><font color=\"#605E5C\">what is on the orders screen on a phone, and what went wrong behind it</font>"
       "<br><font face=\"Consolas\">npx page-as-data read …/orders --click \"New order\" --fill \"Email=a@b.co\"</font>"
       "<br><font color=\"#605E5C\">reproduce a bug step by step, then read the result</font>"
       "<br><font face=\"Consolas\">npx page-as-data check …/ …/orders --widths 390,1440</font>"
       "<br><font color=\"#605E5C\">CI gate: exit code 1 when a page has a defect</font>",
       valign="top")
d.bullets("runs", 612, TY, 533, TH, "WHERE IT RUNS",
          ["Node 22 or newer, and Chrome, Chromium or Edge. Nothing else to install",
           "Pages behind a sign-in: start Chrome with --remote-debugging-port=9222, sign in once, pass --port 9222",
           "Public pages and CI: --launch starts its own headless Chrome",
           "Any framework. settle also knows React 19 streaming and the Next.js App Router",
           "From Playwright or Chrome DevTools MCP: inject page-as-data.js and call window.__pageAsData"],
          accent="navy", marker="•")

d.footer("page-as-data v0.1 · MIT · github.com/gjohnpaull/page-as-data · diagram built with drawing-architecture-diagrams")

# ============ edges ============
d.edge("e1", "cmd", "you", "cli", (1, 0.5), (0, 0.5))
d.edge("e2", "inject", "cli", "probe", (0.5, 1), (0, 0.5), [(320, 389)])
d.edge("e3", "reads", "probe", "app", (0.5, 0), (0.5, 1))
d.edge("e4", "event", "app", "cli", (0, 0.5), (1, 0.5))
d.edge("e5", "report", "inpage", "report", (1, d.rel("inpage", y=273)), (0, 0.5))
d.edge("e6", "cmd", "report", "you", (0.5, 0), (0.5, 0), [(1058, 202), (103, 202)])
d.edge("eShot", "fallback", "report", "shot", (0.5, 1), (0.5, 0))

for n, (x, y) in enumerate([(202, 256), (326, 330), (576, 322), (430, 256), (940, 256), (600, 195)], start=1):
    d.badge(n, x, y)

d.save(OUT)
issues = lint_file(OUT)
print(f"saved {OUT} - lint: {len(issues)} issue(s)")
print("\n".join(issues))
if "--render" in sys.argv:
    print("\n".join(render(OUT)))

"""Worked example: a short design document on a client's Word template.

Shows every pattern in the skill: template cover and change record kept, sample body cleared, facts stated as
"configuration as of <date>", tables in the template's colours, one diagram on its own landscape page with an
explanatory table after it, then Word finalize and check.

Run:  python example_design_doc.py [template.docx] [out.docx] [--figure diagram.png]
      (no template -> python-docx's default template, handy for a dry run)
"""
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if not (_SCRIPTS / "docbuilder.py").exists():               # copied elsewhere: use the installed skill
    _SCRIPTS = Path.home() / ".claude" / "skills" / "writing-design-documents" / "scripts"
sys.path.insert(0, str(_SCRIPTS))
from docbuilder import DesignDoc, check, finalize  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
figure = sys.argv[sys.argv.index("--figure") + 1] if "--figure" in sys.argv else None
if figure in args:
    args.remove(figure)
template = args[0] if args else None
out = args[1] if len(args) > 1 else "example-design.docx"

if template is None:                                          # dry run without a client template
    from docx import Document
    template = Path(out).with_name("_blank_template.docx")
    Document().save(template)

d = DesignDoc(template, out)
d.replace_text("Design Document Template", "Network Security Design")   # cover subtitle, if the template has it
d.change_record(["24-Sep-2026", "Initial draft", "1.0", "First issue for review"])
d.clear_body()

d.h1("Purpose")
d.para("This document describes the proposed network security design for the Contoso pre-production web "
       "applications. It records the current configuration as of 24-Sep-2026, the target design and the changes "
       "needed to implement it.")

d.h1("Scope")
d.para("**In scope**")
d.bullets(["The three web applications and their private endpoints.",
           "Network security groups and application security groups in the spoke VNet."])
d.para("**Out of scope**")
d.bullets(["Hub network resources, which are managed by the hub team."])

d.h1("Current State")
d.para("This section summarises the configuration of the pre-production subscription as of 24-Sep-2026.")
d.table(["Resource", "Public access", "Private endpoint"], [
    ["app-contoso-portal · Web app", "Disabled", "10.20.1.4"],
    ["sql-contoso-data · Azure SQL", "Enabled", "10.20.1.5"],
], [45, 25, 30])
d.table(["#", "Finding", "Impact"], [
    ["1", "sql-contoso-data allows public access with the 'Allow Azure services' rule.",
     "Any Azure resource can reach the public endpoint, regardless of subscription."],
], [5, 60, 35], title="Table 1: Findings")

if figure:
    def after_figure():
        d.h2("Key Flows")
        d.table(["#", "Flow"], [["1", "Internet → Application Gateway WAF → web app private endpoint"]], [6, 94], size=9)
    d.figure(figure, "Figure 1: Target architecture", heading="Proposed Architecture", after=after_figure)
else:
    d.h1("Proposed Architecture")

d.para("Internet traffic enters through an Application Gateway with WAF. We recommend keeping the database private "
       "and removing the public firewall rules once the application teams confirm their dependencies.")

d.h1("Implementation Plan")
d.table(["#", "Activity", "Owner"], [
    ["1", "Disable public access on sql-contoso-data and remove the 'Allow Azure services' rule", "Cloud team"],
], [5, 75, 20])
d.save()

pdf = finalize(out)                       # Windows + Word: TOC refreshed, PDF exported; elsewhere returns None
problems = check(out, pdf)
print("check:", "clean" if not problems else "\n  " + "\n  ".join(problems))

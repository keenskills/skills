"""Worked example (fictional): an event-driven order platform on ONE A4 landscape page, all text at font size 10.

Northwind Traders is invented; every name and address here is made up.

Patterns shown:
  left-to-right column layout (clients -> VNet -> messaging -> data) instead of top-down bands,
  a vertical private-endpoint subnet whose rows line up 1:1 with the services on its right,
  subnet-to-subnet trunks for "workloads reach the endpoints", custom edge kinds (sign-in),
  row icons placed with icon_b() so labels share baselines, panels filling the context band,
  numbered flow badges + KEY FLOWS panel, lint + render + look.

Run:  python event_driven_platform_a4.py out.drawio [--render]
"""
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if not (_SCRIPTS / "archdiagram.py").exists():          # copied elsewhere: use the installed skill
    _SCRIPTS = Path.home() / ".claude" / "skills" / "drawing-architecture-diagrams" / "scripts"
sys.path.insert(0, str(_SCRIPTS))
from archdiagram import Diagram, lint_file, render  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "event_driven_platform_a4.drawio"

d = Diagram("A4L", name="Order platform (A4)")
d.add_edge_kind("auth", "dashed=1;dashPattern=2 2;strokeColor=#8661C5;strokeWidth=1.2;", "Sign-in (Entra ID)")
L = d.label

# ============ title band ============
d.frame_title("Northwind Traders — Event-Driven Order Platform on Azure",
              "Production · West Europe · AKS microservices, Service Bus orders, event capture to the lake · fictional sample",
              chip="PRODUCTION")

# ============ context band: legend | key flows | design decisions | drawing info ============
d.legend(24, 64, 160, ["https", "pe", "data", "auth", "mon", "pull"])
d.numbered_list("flows", 192, 64, 408, "KEY FLOWS",
                ["Users → Front Door (HTTPS, WAF)",
                 "Front Door → App Gateway → AKS services",
                 "AKS services → Service Bus, Cosmos DB, SQL, Key Vault",
                 "Functions consume the orders queue, update Cosmos DB",
                 "Event Hubs Capture → Data Lake → Synapse",
                 "Workload telemetry → App Insights → Log Analytics"])
d.bullets("design", 608, 64, 537, 132, "DESIGN DECISIONS",
          ["Private endpoints for every data service; public access disabled",
           "Orders are commands on Service Bus; telemetry streams to Event Hubs",
           "Event Hubs Capture lands raw events in the Data Lake for Synapse",
           "AKS pods use workload identity; secrets live in Key Vault",
           "Zone-redundant AKS, Cosmos DB, SQL and Service Bus Premium",
           "Two WAF layers: Front Door at the edge, App Gateway in the VNet"],
          accent="blue", marker="●")
d.title_block("titleBlock", 908, 252, 237, 110,
              ["Northwind Traders · Order Platform", "Production · West Europe",
               "Fictional sample architecture", "A4 landscape · Rev 1.0"])

# ============ rows shared by the private endpoints and the services they serve ============
R = [284 + 70 * k for k in range(6)]          # row centres: 284, 354, 424, 494, 564, 634

# ---- clients column ----
d.icon_c("users", "identity/Users.svg", 100, R[0] - 12, 24, 24, L("Users", "web & mobile"), "left")
d.icon_c("afd", "networking/Front_Doors.svg", 100, R[1] - 12, 24, 24, L("afd-nw-prod", "Premium · WAF"))
d.icon_c("entra", "identity/Azure_Active_Directory.svg", 100, R[3] - 12, 24, 24, L("Entra ID", "customer sign-in"))

# ---- VNet ----
d.container("vnet", 184, 206, 516, 466, "<b>VNET</b> · vnet-nw-prod-01 · 10.40.0.0/16", "vnet", pad_left=30)
d.icon("vnetIco", "networking/Virtual_Networks.svg", 190, 212, 20, 12)
d.subnet("snAgw", 196, 318, 344, 72, "SNET-AGW", "10.40.0.0/24")
d.subnet("snAks", 196, 400, 344, 126, "SNET-AKS", "10.40.1.0/22")
d.subnet("snFunc", 196, 536, 344, 126, "SNET-FUNC", "10.40.8.0/24")
d.icon_c("agw", "networking/Application_Gateways.svg", 312, R[1] - 12, 24, 24, L("agw-nw-prod", "WAF_v2 · ingress"), "right")
d.icon_c("aks", "containers/Kubernetes_Services.svg", 312, R[2] - 12, 24, 24, L("aks-nw-prod", "3 zones · workload identity"), "right")
d.text("aksSvc", 300, 474, 232, 40, "orders-svc · inventory-svc · shipping-svc<br>(namespaces on the user node pool)", color="grey")
d.icon_c("func", "compute/Function_Apps.svg", 312, R[4] - 12, 24, 24, L("func-nw-orders", "Premium EP1 · VNet integrated"), "right")
d.text("funcSvc", 300, 612, 170, 40, "orders-processor · stock-sync<br>(Service Bus triggers)", color="grey")

# ---- private endpoint subnet: one row per service ----
d.subnet("snPE", 552, 226, 138, 434, "SNET-PE", "10.40.9.0/24")
PE = "networking/Private_Endpoint.svg"
for k, (name, ip) in enumerate([("Service Bus", ".9.4"), ("Event Hubs", ".9.5"), ("Data Lake", ".9.6"),
                                ("Cosmos DB", ".9.7"), ("SQL", ".9.8"), ("Key Vault", ".9.9")]):
    d.icon_c(f"pe{k}", PE, 668, R[k] - 10, 22, 20, L(name, ip), "left")

# ---- messaging & lake (column C) / data & analytics (column D) ----
CC, CD = 830, 1045
d.text("hdrC", CC - 80, 232, 160, 16, "<b>MESSAGING & LAKE</b>", align="center", color="grey")
d.text("hdrD", CD - 80, 386, 160, 16, "<b>DATA & ANALYTICS</b>", align="center", color="grey")
d.icon_b("sb", "integration/Service_Bus.svg", CC, R[0] + 12, 24, 24, L("sb-nw-prod", "Premium · orders queue"))
d.icon_b("evh", "analytics/Event_Hubs.svg", CC, R[1] + 12, 24, 24, L("evh-nw-prod", "Capture → stnwlake"))
d.icon_b("lake", "storage/Data_Lake_Storage_Gen1.svg", CC, R[2] + 12, 24, 24, L("stnwlake", "Data Lake · raw events"))
d.icon_b("syn", "analytics/Azure_Synapse_Analytics.svg", CD, R[2] + 12, 24, 24, L("synw-nw-prod", "Synapse · managed VNet"))
d.icon_b("cosmos", "databases/Azure_Cosmos_DB.svg", CD, R[3] + 12, 24, 24, L("cosmos-nw-prod", "NoSQL · zone-redundant"))
d.icon_b("sql", "databases/SQL_Database.svg", CD, R[4] + 12, 24, 24, L("sql-nw-prod", "Business Critical"))
d.icon_b("kv", "security/Key_Vaults.svg", CD, R[5] + 12, 24, 24, L("kv-nw-prod", "RBAC · purge protection"))

# ============ bottom band ============
BY, BH = 686, 100
d.panel("platform", 24, BY, 548, BH, "PLATFORM & SECURITY", "purple")
for sid, path, name, detail, cx in [
    ("defender", "security/Azure_Defender.svg", "Defender for Cloud", "CSPM + containers", 110),
    ("mi", "identity/Managed_Identities.svg", "id-nw-workloads", "workload identity", 300),
    ("acr", "containers/Container_Registries.svg", "acrnwprod", "Premium · geo-replicated", 490),
]:
    d.icon_b(sid, path, cx, BY + 52, 24, 24, L(name, detail))

d.panel("observability", 580, BY, 565, BH, "OBSERVABILITY", "orange")
for sid, path, name, detail, cx in [
    ("appi", "devops/Application_Insights.svg", "appi-nw-prod", "App Insights", 760),
    ("law", "analytics/Log_Analytics_Workspaces.svg", "log-nw-prod", "Log Analytics", 920),
    ("monitor", "management_governance/Monitor.svg", "Azure Monitor", "alerts · action groups", 1070),
]:
    d.icon_b(sid, path, cx, BY + 52, 24, 24, L(name, detail))

d.footer("Fictional sample architecture for the drawing-architecture-diagrams skill · all names and addresses are invented")

# ============ edges ============
d.edge("eUsersAfd", "https", "users", "afd", (0.5, 1), (0.5, 0))
d.edge("eAuth", "auth", "users", "entra", (1, 0.5), (1, 0.5), [(150, R[0]), (150, R[3])])
d.edge("eAfdAgw", "https", "afd", "agw", (1, 0.5), (0, 0.5))
d.edge("eAgwAks", "https", "agw", "aks", (0.5, 1), (0.5, 0))
d.edge("eAksPe", "https", "snAks", "snPE", (1, d.rel("snAks", y=460)), (0, d.rel("snPE", y=460)))
d.edge("eFuncPe", "https", "snFunc", "snPE", (1, d.rel("snFunc", y=600)), (0, d.rel("snPE", y=600)))
for k, svc in enumerate(["sb", "evh", "lake", "cosmos", "sql", "kv"]):
    d.edge(f"ePe{k}", "pe", f"pe{k}", svc, (1, 0.5), (0, 0.5))
d.edge("eLakeSyn", "data", "lake", "syn", (1, 0.5), (0, 0.5))
d.edge("eTelemetry", "mon", "vnet", "appi", (d.rel("vnet", x=680), 1), (0.5, 0), [(680, 679), (760, 679)])
d.edge("eAppiLaw", "mon", "appi", "law", (1, 0.5), (0, 0.5))
d.edge("eLawMon", "mon", "law", "monitor", (1, 0.5), (0, 0.5))
d.edge("ePull", "pull", "acr", "snAks", (0.5, 0), (d.rel("snAks", x=490), 1))

for n, (x, y) in enumerate([(93, 305), (165, 347), (544, 453), (544, 593), (931, 417), (673, 672)], start=1):
    d.badge(n, x, y)

d.save(OUT)
issues = lint_file(OUT)
print(f"saved {OUT} - lint: {len(issues)} issue(s)")
print("\n".join(issues))
if "--render" in sys.argv:
    print("\n".join(render(OUT)))

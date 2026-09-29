# Icon reference (draw.io)

Paths verified to return HTTP 200 from `https://app.diagrams.net/<path>`. In `Diagram.icon()` a path
without `img/` or `http` is taken relative to `img/lib/azure2/`.

## Azure (`img/lib/azure2/…`)

| Resource | Path |
|---|---|
| Virtual network | `networking/Virtual_Networks.svg` |
| Subnet NSG badge | `networking/Network_Security_Groups.svg` |
| Route table | `networking/Route_Tables.svg` |
| Private endpoint | `networking/Private_Endpoint.svg` |
| Private Link | `networking/Private_Link.svg` |
| Bastion | `networking/Bastions.svg` |
| VNet gateway | `networking/Virtual_Network_Gateways.svg` |
| NIC | `networking/Network_Interfaces.svg` |
| Network Watcher | `networking/Network_Watcher.svg` |
| DNS zone (public) | `networking/DNS_Zones.svg` |
| Firewall Manager | `networking/Azure_Firewall_Manager.svg` |
| Virtual machine | `compute/Virtual_Machine.svg` |
| App Service / web app | `app_services/App_Services.svg` |
| App Service plan | `app_services/App_Service_Plans.svg` |
| API Management | `app_services/API_Management_Services.svg` |
| SQL server | `databases/SQL_Server.svg` |
| SQL database | `databases/SQL_Database.svg` |
| Redis | `databases/Cache_Redis.svg` |
| Purview | `databases/Azure_Purview_Accounts.svg` |
| Storage account | `storage/Storage_Accounts.svg` |
| Key Vault | `security/Key_Vaults.svg` |
| Container registry | `containers/Container_Registries.svg` |
| Managed identity | `identity/Managed_Identities.svg` |
| Event Grid topic | `integration/Event_Grid_Topics.svg` |
| Log Analytics | `analytics/Log_Analytics_Workspaces.svg` |
| Application Insights | `devops/Application_Insights.svg` |
| Alerts | `management_governance/Alerts.svg` |
| Recovery Services vault | `management_governance/Recovery_Services_Vaults.svg` |
| Front Door | `networking/Front_Doors.svg` (`Front_Door_and_CDN_Profiles.svg` is 404) |
| Users / administrators | `identity/Users.svg` |
| AKS | `containers/Kubernetes_Services.svg` |
| Function App | `compute/Function_Apps.svg` |
| Application Gateway | `networking/Application_Gateways.svg` |
| Service Bus | `integration/Service_Bus.svg` |
| Event Hubs | `analytics/Event_Hubs.svg` |
| Cosmos DB | `databases/Azure_Cosmos_DB.svg` |
| Data Lake storage | `storage/Data_Lake_Storage_Gen1.svg` |
| Synapse | `analytics/Azure_Synapse_Analytics.svg` |
| Entra ID | `identity/Azure_Active_Directory.svg` |
| Defender for Cloud | `security/Azure_Defender.svg` |
| Azure Monitor | `management_governance/Monitor.svg` |
| Static Web App | `preview/Static_Apps.svg` |

## Other libraries

| Resource | Path / style |
|---|---|
| Azure Firewall | `img/lib/mscae/Azure_Firewall.svg` |
| Private DNS zone | `img/lib/mscae/DNS_Private_Zones.svg` |
| Microsoft Fabric | `https://icons.diagrams.net/assets/microsoft-fabric/1/Microsoft_Fabric.svg` |
| On-premises building | style `shape=mxgraph.azure.enterprise;fillColor=#605E5C;strokeColor=none;` (use via `card(icon=...)`) |
| Internet | `Diagram.cloud()` (cloud shape) |

## Finding and verifying new icons (AWS, GCP, Kubernetes, anything else)

1. Search: draw.io MCP `search_shapes` (e.g. `"aws lambda"`, `"gcp bigquery"`, `"kubernetes pod"`). Copy the
   `image=` path from the returned style. For stencil shapes (`shape=mxgraph.aws4....`), pass the whole
   style to `Diagram.vertex()` instead of `icon()`.
2. Verify before using:
   `curl -s -o /dev/null -w "%{http_code}" https://app.diagrams.net/img/lib/azure2/<path>` must print `200`.
3. Search misses happen: `search_shapes` did not return VM, App Service or SQL for Azure, yet the paths
   above exist. Guess the path from the library naming convention and verify with curl.
4. Record new verified paths in this file.

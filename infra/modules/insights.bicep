// Log Analytics Workspace & Application Insights Deploy Module
param name string
param location string
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-workspace'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
  }
}

output workspaceId string = workspace.id
output workspaceName string = workspace.name
output insightsId string = appInsights.id
output insightsName string = appInsights.name
output connectionString string = appInsights.properties.ConnectionString

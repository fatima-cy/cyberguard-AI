// Azure Blob Storage Deploy Module
param name string
param location string
param tags object
param skuName string = 'Standard_LRS'
param enableVersioning bool = true
param enableSoftDelete bool = true
param workspaceId string = '' // Optional Log Analytics workspace ID for diagnostics (§1.3)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: enableVersioning // Hardening: Enable Blob Versioning (§1.10)
    deleteRetentionPolicy: {
      enabled: enableSoftDelete // Hardening: Enable Soft-Delete Retention Policy (§1.10)
      days: 7
    }
  }
}

// Containers defined in Env.env.example
var containers = [
  'policies'
  'reports'
  'certificates'
  'knowledge-sources'
  'avatars'
]

resource storageContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = [for container in containers: {
  parent: blobService
  name: container
  properties: {
    publicAccess: 'None'
  }
}]

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (workspaceId != '') {
  scope: storageAccount
  name: '${name}-diagnostics'
  properties: {
    workspaceId: workspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

output id string = storageAccount.id
output name string = storageAccount.name
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob

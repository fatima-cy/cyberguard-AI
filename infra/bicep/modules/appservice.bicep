// Azure App Service Plan & Web App Deploy Module
param name string
param location string
param tags object
param planSkuName string = 'B1' // Basic 1 (cost-effective)
param cosmosEndpoint string
param redisEndpoint string
param serviceBusNamespace string
param openaiEndpoint string
param aiSearchEndpoint string
param blobEndpoint string
param keyVaultUri string
param appConfigEndpoint string
param appInsightsConnectionString string = ''

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  sku: {
    name: planSkuName
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned' // Generates a Managed Identity automatically
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true // Hardening: Enforce HTTPS (§1.1)
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      minTlsVersion: '1.2' // Hardening: Set minimum TLS version (§1.1)
      ftpsState: 'Disabled' // Hardening: Disable legacy FTP/FTPS (§1.1)
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'APP_PORT'
          value: '3000'
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'REDIS_ENDPOINT'
          value: redisEndpoint
        }
        {
          name: 'SERVICEBUS_NAMESPACE'
          value: serviceBusNamespace
        }
        {
          name: 'OPENAI_ENDPOINT'
          value: openaiEndpoint
        }
        {
          name: 'AISEARCH_ENDPOINT'
          value: aiSearchEndpoint
        }
        {
          name: 'BLOB_ENDPOINT'
          value: blobEndpoint
        }
        {
          name: 'KEYVAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'APP_CONFIG_ENDPOINT'
          value: appConfigEndpoint
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
  }
}

output id string = webApp.id
output name string = webApp.name
output principalId string = webApp.identity.principalId

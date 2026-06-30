// Azure Managed Redis Deploy Module (Replacement for retired Azure Cache for Redis §1)
param name string
param location string
param tags object
param skuName string = 'Balanced_B5' // Entry level SKU for Azure Managed Redis

resource redisEnterprise 'Microsoft.Cache/redisEnterprise@2024-05-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  properties: {
    minimumTlsVersion: '1.2'
  }
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2024-05-01-preview' = {
  name: 'default'
  parent: redisEnterprise
  properties: {
    clientProtocol: 'Encrypted'
    port: 10000
    clusteringPolicy: 'OSSCluster'
    evictionPolicy: 'NoEviction'
    accessKeysAuthentication: 'Enabled'
  }
}

output id string = redisEnterprise.id
output name string = redisEnterprise.name
output hostName string = redisEnterprise.properties.hostName
output sslPort int = 10000

@secure()
output primaryKey string = redisDatabase.listKeys().primaryKey // Marked secure — redacted in deployment history

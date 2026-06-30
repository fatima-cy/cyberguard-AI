// Azure Cache for Redis Deploy Module
param name string
param location string
param tags object
param skuName string = 'Basic'
param skuFamily string = 'C'
param skuCapacity int = 0

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: skuFamily
      capacity: skuCapacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxfragmentationmemory-reserved': '50'
      'maxmemory-delta': '50'
      'maxmemory-reserved': '50'
    }
  }
}

output id string = redis.id
output name string = redis.name
output hostName string = redis.properties.hostName
output sslPort int = redis.properties.sslPort
output primaryKey string = redis.listKeys().primaryKey // Export access key to wire to Key Vault

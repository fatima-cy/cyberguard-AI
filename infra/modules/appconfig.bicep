// Azure App Configuration Deploy Module
param name string
param location string
param tags object
param skuName string = 'free'

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
}

output id string = appConfig.id
output name string = appConfig.name
output endpoint string = appConfig.properties.endpoint

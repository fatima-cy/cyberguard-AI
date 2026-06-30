// Azure AI Search Deploy Module
param name string
param location string
param tags object
param skuName string = 'basic'

resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
  }
}

output id string = search.id
output name string = search.name
output endpoint string = 'https://${name}.search.windows.net'

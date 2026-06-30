// Azure OpenAI Service Deploy Module
param name string
param location string
param tags object

resource openAI 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
  }
}

// gpt-chat-latest Chat model deployment (latest active version)
resource chatModel 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAI
  name: 'gpt-4o-mini' // Keep deployment name for application compatibility
  sku: {
    name: 'GlobalStandard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-chat-latest'
      version: '2026-05-05'
    }
  }
}

// Embeddings model deployment (using GlobalStandard for West Europe compatibility)
resource embeddingModel 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAI
  name: 'text-embedding-3-large'
  sku: {
    name: 'GlobalStandard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-large'
      version: '1'
    }
  }
}

output id string = openAI.id
output name string = openAI.name
output endpoint string = openAI.properties.endpoint

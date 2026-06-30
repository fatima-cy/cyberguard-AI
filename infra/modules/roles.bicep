// Role Assignments for App Service Managed Identity (RBAC)
param principalId string
param cosmosAccountName string
param keyVaultName string
param storageAccountName string
param serviceBusName string
param openaiName string
param aisearchName string
param appconfigName string

// Role Definition IDs (Standard Azure Built-in Roles)
var keyVaultSecretsUser = '4633e12f-d50e-4e08-9b8e-04ae79e1410f'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var serviceBusDataOwner = '090c5cfd-751d-490a-894a-3ce6f1109419'
var cognitiveServicesUser = '5e0bd9bd-3559-43c4-b487-e736a30fd7d3'
var searchIndexDataContributor = '8ebe96e8-c1cc-437e-8fd5-04f504b8066f'
var appConfigDataReader = '516239f1-63e1-4d78-a4de-a74fb236a071'

// Reference existing resources
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosAccountName
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource sb 'Microsoft.ServiceBus/namespaces@2021-11-01' existing = {
  name: serviceBusName
}

resource openai 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: openaiName
}

resource search 'Microsoft.Search/searchServices@2023-11-01' existing = {
  name: aisearchName
}

resource appconfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appconfigName
}

// 1. Cosmos DB Built-in Data Contributor (SQL Role Assignment)
resource cosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  parent: cosmos
  name: guid(cosmos.id, principalId, 'cosmos-contributor')
  properties: {
    // Built-in SQL Data Contributor ID: 00000000-0000-0000-0000-000000000002
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: principalId
    scope: cosmos.id
  }
}

// 2. Key Vault Secrets User Role
resource kvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, principalId, keyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// 3. Storage Blob Data Contributor Role
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// 4. Service Bus Data Owner Role
resource sbRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sb.id, principalId, serviceBusDataOwner)
  scope: sb
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', serviceBusDataOwner)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// 5. Cognitive Services User Role (OpenAI)
resource openaiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openai.id, principalId, cognitiveServicesUser)
  scope: openai
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUser)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// 6. Search Index Data Contributor Role
resource searchRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(search.id, principalId, searchIndexDataContributor)
  scope: search
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', searchIndexDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// 7. App Configuration Data Reader Role
resource appconfigRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appconfig.id, principalId, appConfigDataReader)
  scope: appconfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReader)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

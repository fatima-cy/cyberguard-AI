// ─── CyberGuard AI — Root Bicep Template ───────────────────────────────────
targetScope = 'subscription'

param projectName string = 'cyberguard-platform'
param environment string = 'dev'
param location string = 'westeurope'
param isServerless bool = true
param secondaryLocation string = ''
param budgetAmount int = 200
param budgetStartDate string = '2026-07-01'
param contactEmails array = ['fatima@cloudsecure.ai']

// Hardening & Observability Parameters
param enablePurgeProtection bool = false
param enableLocks bool = false
param appServicePlanSku string = 'B1'
param appConfigSku string = 'free'
param enableBlobVersioning bool = true
param enableBlobSoftDelete bool = true

var tags = {
  Project: projectName
  Environment: environment
  CostCenter: 'engineering'
  Module: 'platform'
  Owner: 'tech-lead'
  ManagedBy: 'bicep'
}

// Generate a globally unique suffix to avoid name collisions §15.2
var suffix = uniqueString(subscription().id)

var kvName = 'cs-${environment}-kv-${suffix}'
var cosmosName = 'cs-${environment}-cosmos-${suffix}'
var redisName = 'cs-${environment}-redis-${suffix}'
var serviceBusName = 'cs-${environment}-bus-${suffix}'
var openaiName = 'cs-${environment}-openai-${suffix}'
var aisearchName = 'cs-${environment}-search-${suffix}'
// Storage account name must be alphanumeric, lowercase, and <= 24 characters
var storageName = take('cs${environment}blob${suffix}', 24)
var appconfigName = 'cs-${environment}-appconfig-${suffix}'
var appserviceName = 'cs-${environment}-api-${suffix}'
var insightsBaseName = 'cs-${environment}-${suffix}'

// 1. Create Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'cs-${environment}-rg'
  location: location
  tags: tags
}

// 2. Deploy Log Analytics + Application Insights first — other modules wire
//    diagnostics into this workspace
module insights 'modules/insights.bicep' = {
  scope: rg
  name: 'insights-deploy'
  params: {
    name: insightsBaseName
    location: location
    tags: tags
  }
}

// 3. Deploy Key Vault
module kv 'modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-deploy'
  params: {
    name: kvName
    location: location
    tags: tags
    enablePurgeProtection: enablePurgeProtection
    workspaceId: insights.outputs.workspaceId
  }
}

// 4. Deploy Cosmos DB
module cosmos 'modules/cosmosdb.bicep' = {
  scope: rg
  name: 'cosmosdb-deploy'
  params: {
    name: cosmosName
    location: location
    tags: tags
    isServerless: isServerless
    secondaryLocation: secondaryLocation
    workspaceId: insights.outputs.workspaceId
  }
}

// 5. Deploy Redis
module redis 'modules/redis.bicep' = {
  scope: rg
  name: 'redis-deploy'
  params: {
    name: redisName
    location: location
    tags: tags
  }
}

// 5a. Seed Redis primary key into Key Vault (interim until AAD-based Redis
//     auth is adopted — tracked as a follow-up)
module redisSecret 'modules/keyvault-secret.bicep' = {
  scope: rg
  name: 'redis-secret-deploy'
  params: {
    keyVaultName: kv.outputs.name
    secretName: 'redis-primary-key'
    secretValue: redis.outputs.primaryKey
  }
}

// 6. Deploy Service Bus
module servicebus 'modules/servicebus.bicep' = {
  scope: rg
  name: 'servicebus-deploy'
  params: {
    name: serviceBusName
    location: location
    tags: tags
  }
}

// 7. Deploy OpenAI
module openai 'modules/openai.bicep' = {
  scope: rg
  name: 'openai-deploy'
  params: {
    name: openaiName
    location: location
    tags: tags
  }
}

// 8. Deploy AI Search
module aisearch 'modules/aisearch.bicep' = {
  scope: rg
  name: 'aisearch-deploy'
  params: {
    name: aisearchName
    location: location
    tags: tags
  }
}

// 9. Deploy Blob Storage
module storage 'modules/storage.bicep' = {
  scope: rg
  name: 'storage-deploy'
  params: {
    name: storageName
    location: location
    tags: tags
    enableVersioning: enableBlobVersioning
    enableSoftDelete: enableBlobSoftDelete
    workspaceId: insights.outputs.workspaceId
  }
}

// 10. Deploy App Configuration
module appconfig 'modules/appconfig.bicep' = {
  scope: rg
  name: 'appconfig-deploy'
  params: {
    name: appconfigName
    location: location
    tags: tags
    skuName: appConfigSku
  }
}

// 11. Deploy App Service (Linux Web App)
module appservice 'modules/appservice.bicep' = {
  scope: rg
  name: 'appservice-deploy'
  params: {
    name: appserviceName
    location: location
    tags: tags
    planSkuName: appServicePlanSku
    cosmosEndpoint: cosmos.outputs.endpoint
    redisEndpoint: '${redis.outputs.hostName}:${redis.outputs.sslPort}'
    serviceBusNamespace: servicebus.outputs.endpoint
    openaiEndpoint: openai.outputs.endpoint
    aiSearchEndpoint: aisearch.outputs.endpoint
    blobEndpoint: storage.outputs.blobEndpoint
    keyVaultUri: kv.outputs.uri
    appConfigEndpoint: appconfig.outputs.endpoint
    appInsightsConnectionString: insights.outputs.connectionString
  }
}

// 12. Deploy Budgets (FinOps)
module budgets 'modules/budgets.bicep' = {
  scope: rg
  name: 'budgets-deploy'
  params: {
    budgetName: 'cs-${environment}-budget'
    amount: budgetAmount
    startDate: budgetStartDate
    contactEmails: contactEmails
  }
}

// 13. Managed Identity Role Assignments (RBAC)
module roles 'modules/roles.bicep' = {
  scope: rg
  name: 'rbac-roles-deploy'
  params: {
    principalId: appservice.outputs.principalId
    cosmosAccountName: cosmos.outputs.name
    keyVaultName: kv.outputs.name
    storageAccountName: storage.outputs.name
    serviceBusName: servicebus.outputs.name
    openaiName: openai.outputs.name
    aisearchName: aisearch.outputs.name
    appconfigName: appconfig.outputs.name
  }
}

// 14. Resource Group lock — Staging/Prod only
module rgLock 'modules/locks.bicep' = if (enableLocks) {
  scope: rg
  name: 'rg-lock-deploy'
  params: {
    lockName: 'PreventDeletion-${environment}'
    notes: 'Prevent accidental deletion of ${environment} resource group'
  }
}

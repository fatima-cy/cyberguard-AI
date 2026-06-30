// Cosmos DB (NoSQL API) Deploy Module
param name string
param location string
param tags object
param databaseName string = 'cloudsecure_platform'
param isServerless bool = true
param secondaryLocation string = ''

var locations = concat(
  [
    {
      locationName: location
      failoverPriority: 0
      isZoneRedundant: false
    }
  ],
  (secondaryLocation != '') ? [
    {
      locationName: secondaryLocation
      failoverPriority: 1
      isZoneRedundant: false
    }
  ] : []
)

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: name
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: locations
    capabilities: isServerless ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    backupPolicy: {
      type: 'Continuous' // Required for PITR recovery §20.2
      continuousModeProperties: {
        tier: 'Continuous30Days'
      }
    }
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// 15 core collections with data_classification tags as metadata (Sprint 0 §23.3)
var containerDefinitions = [
  { name: 'users', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'organizations', partitionKey: '/id', classification: 'internal' }
  { name: 'subscriptions', partitionKey: '/organizationId', classification: 'internal' }
  { name: 'billing_records', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'payments', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'audit_logs', partitionKey: '/organizationId', classification: 'internal' }
  { name: 'chat_sessions', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'chat_messages', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'phishing_analyses', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'generated_policies', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'risk_assessments', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'refresh_tokens', partitionKey: '/userId', classification: 'restricted' }
  { name: 'trusted_devices', partitionKey: '/userId', classification: 'confidential' }
  { name: 'ai_guardrail_logs', partitionKey: '/organizationId', classification: 'confidential' }
  { name: 'usage_events', partitionKey: '/organizationId', classification: 'internal' }
]

resource containers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = [for container in containerDefinitions: {
  parent: database
  name: container.name
  tags: {
    data_classification: container.classification
  }
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [
          container.partitionKey
        ]
        kind: 'Hash'
      }
    }
  }
}]

output id string = cosmosAccount.id
output name string = cosmosAccount.name
output endpoint string = cosmosAccount.properties.documentEndpoint

// Service Bus Namespace & Queues/Topics Module
param name string
param location string
param tags object

resource sbNamespace 'Microsoft.ServiceBus/namespaces@2021-11-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard' // Standard required for Topics support
    tier: 'Standard'
  }
}

// Queues defined in Env.env.example
var queues = [
  'policy-export-queue'
  'report-generation-queue'
  'webhook-processing-queue'
  'knowledge-ingestion-queue'
  'email-delivery-queue'
]

resource sbQueues 'Microsoft.ServiceBus/namespaces/queues@2021-11-01' = [for queue in queues: {
  parent: sbNamespace
  name: queue
  properties: {
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P14D'
  }
}]

// Topics defined in Env.env.example
var topics = [
  'user.events'
  'org.events'
  'subscription.events'
  'ai.events'
  'notification.events'
]

resource sbTopics 'Microsoft.ServiceBus/namespaces/topics@2021-11-01' = [for topic in topics: {
  parent: sbNamespace
  name: topic
  properties: {
    defaultMessageTimeToLive: 'P14D'
  }
}]

output id string = sbNamespace.id
output name string = sbNamespace.name
output endpoint string = '${name}.servicebus.windows.net'

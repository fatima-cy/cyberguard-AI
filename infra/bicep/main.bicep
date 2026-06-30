// ─── CyberGuard AI — Root Bicep Template ───────────────────────────────────
// Orchestrates all resources for the platform.
// Target location: South Africa North (primary staging/prod) or West Europe (dev)

targetScope = 'subscription'

param projectName string = 'cyberguard-platform'
param environment string = 'dev'
param location string = 'westeurope'

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'cs-${environment}-rg'
  location: location
  tags: {
    Project: projectName
    Environment: environment
    CostCenter: 'engineering'
    Module: 'platform'
    Owner: 'tech-lead'
    ManagedBy: 'bicep'
  }
}

// Stubs for individual modules:
// - App Service Bicep
// - Cosmos DB Built-in Data Contributor (NoSQL)
// - Redis Cache
// - Service Bus Namespace
// - Cognitive Services (OpenAI, AI Search, AI Language)
// - App Configuration (Feature Flags)
// - Key Vault

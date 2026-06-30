using '../main.bicep'

param projectName = 'cyberguard-platform'
param environment = 'prod'
param location = 'southafricanorth'
param isServerless = false
param secondaryLocation = 'westeurope' // DR: geo-replication enabled (§20.2)
param budgetAmount = 2500
param budgetStartDate = '2026-07-01'
param contactEmails = ['fatima@cloudsecure.ai']

// Hardening & Observability Parameters
param enablePurgeProtection = true // Hardening: Prevent purging vaults (§1.4)
param enableLocks = true // Hardening: Prevent deletion of Prod resource groups (§1.9)
param appServicePlanSku = 'S1'
param appConfigSku = 'standard'
param enableBlobVersioning = true
param enableBlobSoftDelete = true

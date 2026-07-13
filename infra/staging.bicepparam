using 'main.bicep'

param projectName = 'cyberguard-platform'
param environment = 'staging'
param location = 'southafricanorth'
param isServerless = false
param secondaryLocation = '' // Intentional: no geo-replication for Staging (cost decision). Prod uses westeurope.
param budgetAmount = 800
param budgetStartDate = '2026-07-01'
param contactEmails = ['fatima@cloudsecure.ai']
param deployBudget = false // MS-AZR-0036P Sponsorship subscription does not support Cost Management Budgets

// Hardening & Observability Parameters
param enablePurgeProtection = true
param enableLocks = false // Intentional: CanNotDelete locks reserved for Prod only (§1.9)
param appServicePlanSku = 'S1'
param appConfigSku = 'standard'
param enableBlobVersioning = true
param enableBlobSoftDelete = true


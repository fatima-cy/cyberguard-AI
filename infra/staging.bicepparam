using 'main.bicep'

param projectName = 'cyberguard-platform'
param environment = 'staging'
param location = 'southafricanorth'
param isServerless = false
param secondaryLocation = ''
param budgetAmount = 800
param budgetStartDate = '2026-07-01'
param contactEmails = ['fatima@cloudsecure.ai']

// Hardening & Observability Parameters
param enablePurgeProtection = true
param enableLocks = false
param appServicePlanSku = 'S1' // Autoscale enabled
param appConfigSku = 'standard' // Standard SLA
param enableBlobVersioning = true
param enableBlobSoftDelete = true

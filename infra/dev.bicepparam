using 'main.bicep'

param projectName = 'cyberguard-platform'
param environment = 'dev'
param location = 'swedencentral'
param isServerless = true
param secondaryLocation = ''
param budgetAmount = 200
param contactEmails = ['fatima@cloudsecure.ai']

// Azure Sponsorship account does not support Cost Management Budgets
param deployBudget = false

// Azure consumption budgets Deploy Module (Resource Group scoped)
param budgetName string
param amount int
param contactEmails array
param startDate string = '2026-07-01' // Parameterized start date to stay valid after date passes (§1.8)

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      Alert80Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: contactEmails
        thresholdType: 'Actual'
      }
      Alert100Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: contactEmails
        thresholdType: 'Actual'
      }
    }
  }
}

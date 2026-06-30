# Disaster Recovery Simulation Template

Use this document to log quarterly Disaster Recovery (DR) simulations.

## Simulation Log Details
- **Date**: [Date of Simulation]
- **Lead Engineer**: [Name]
- **Target environment**: Staging / Production
- **Scenario**: Full regional outage in South Africa North; Failover to West Europe.

---

## 1. Pre-Failover Verification
- [ ] Confirm Cosmos DB West Europe replication lag is less than 60 seconds.
- [ ] Confirm App Service in West Europe is running at minimum instance count (1 instance).
- [ ] Confirm Azure OpenAI instance in West Europe is responding.

---

## 2. Failover execution
- **T+00:00**: Disable South Africa North backend in Azure Front Door.
- **T+00:05**: Monitor Cosmos DB automatic failover trigger. 
  - *If manual failover is required, run:*
    ```bash
    az cosmosdb failover-priority-change \
      --account-name cs-prod-cosmos \
      --failover-policies westeurope=0
    ```
- **T+00:20**: Verify health endpoint via the West Europe App Service directly:
  ```bash
  curl https://cs-prod-api.westeurope.azurewebsites.net/health
  ```
- **T+00:30**: Update `OPENAI_ENDPOINT` in Key Vault to point to West Europe if the South Africa North AI service is down.

---

## 3. Post-Failover Verification Checklist
- [ ] Verify health status is `healthy` with West Europe headers.
- [ ] Verify Cosmos DB writes succeed from the failover environment.
- [ ] Verify AI Chat functions (if OpenAI is routed).
- [ ] Verify billing integrations resolve.

---

## 4. Failback Execution (SA North Restored)
- **T+00:00**: Verify SA North is stable for 30 minutes.
- **T+00:30**: Re-enable SA North in Azure Front Door.
- **T+01:00**: Restore Cosmos DB primary priority:
  ```bash
  az cosmosdb failover-priority-change \
    --account-name cs-prod-cosmos \
    --failover-policies southafricanorth=0 westeurope=1
  ```
- **T+01:30**: Monitor error rates; confirm baseline is reached.

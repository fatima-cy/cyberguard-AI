# ADR-004: Multi-Tenancy Model: Shared Infrastructure vs Silo

## Status
Accepted

## Context
CloudSecure AI Platform serves multiple customer organizations (tenants). The tenancy design determines how data is isolated, how costs are allocated, and how resources scale.

## Options Considered
- **Option A: Silo Model**: Dedicated resources (database, App Service, OpenAI) per tenant. Maximum isolation but cost-prohibitive ($500+/tenant/month).
- **Option B: Shared Database, Partition Key Isolation**: Single Cosmos DB account. Tenants share collection space but documents are physically isolated via `/organizationId` partition key.
- **Option C: Hybrid Pool/Silo Model**: Pooled resources for standard users, siloed resources for enterprise premium tiers.

## Decision
**Option B: Shared database with partition key isolation.**

### Rationale
1. **Cost Efficiency**: Serverless or provisioned autoscaled Cosmos DB scales resource costs down to zero when idle, making standard tenant onboarding near zero-cost.
2. **Robust Isolation**: The partition key design guarantees database-level isolation of query execution, so one tenant cannot search across another tenant's partition.
3. **Future Extension**: If a premium enterprise customer requires true physical isolation, we can provision a dedicated Cosmos DB container or account in Phase 5 without changing the code schema.

## Consequences
- **Positive**: High scaling efficiency, lower cloud spend, single database schema to manage.
- **Negative**: Risk of cross-tenant data leaks due to bugs in application code.
- **Mitigation**: Implement automated tenant isolation integration tests running in CI to block any PR that breaks boundaries.

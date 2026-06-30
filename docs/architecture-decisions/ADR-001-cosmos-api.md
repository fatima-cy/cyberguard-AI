# ADR-001: Cosmos DB API: NoSQL Native vs MongoDB API

## Status
Accepted

## Context
CloudSecure AI Platform requires a globally distributed, scalable NoSQL database for a multi-tenant SaaS platform with AI workloads (RAG/embeddings, usage metering, audit logging). Azure Cosmos DB is the selected database service on Azure. The choice of API is permanent without a full data re-provisioning exercise, making this a key decision that must be resolved before infrastructure provisioning starts.

## Options Considered
- **Option A: Cosmos DB for MongoDB API**: Familiar MongoDB Query Language (MQL) and Mongoose ODM support. Lower onboarding friction. No native Azure AD auth or native vector search.
- **Option B: Cosmos DB NoSQL API**: Native Azure SDK with excellent type safety, built-in Entra ID (Managed Identity) authentication, native vector search (DiskANN/HNSW), and hierarchical partition keys.

## Decision
**Option B: Azure Cosmos DB for NoSQL (Native API).**

### Rationale
1. **Native Vector Search**: DiskANN and HNSW support allows storing and querying vector embeddings directly in Cosmos DB, eliminating the mandatory $250/month Azure AI Search dependency.
2. **Managed Identity**: Supports native token authentication via `@azure/cosmos` SDK and `DefaultAzureCredential`, removing connection strings in production.
3. **Hierarchical Partition Keys**: Clean multi-tenant isolation via partition keys (e.g. `/organizationId` + `/userId`).
4. **TypeScript SDK**: Better TS developer experience with native type inference.

## Consequences
- **Positive**: Estimated $250/month cost savings on search service; Managed Identity security alignment; cleaner partition patterns.
- **Negative**: The team must learn the `@azure/cosmos` SDK instead of Mongoose.
- **Mitigation**: Abstract the SDK logic behind a thin repository layer (`packages/api/src/models/`).

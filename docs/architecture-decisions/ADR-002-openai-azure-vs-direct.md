# ADR-002: AI Provider: Azure OpenAI vs OpenAI Direct API

## Status
Accepted

## Context
The platform requires a large language model for core security assistant chat, phishing email analysis, policy generation, and risk assessment scoring.

## Options Considered
- **Option A: Azure OpenAI Service**: Microsoft-managed OpenAI models (GPT-4o). High enterprise security, data privacy, and region-locked residency.
- **Option B: OpenAI Direct API (api.openai.com)**: Direct developer API. Simpler setup, lower costs, but data leaves the Azure ecosystem.

## Decision
**Option A: Azure OpenAI Service.**

### Rationale
1. **Data Residency**: Complies with GDPR/NDPR by ensuring customer data stays inside our Azure tenant and region.
2. **Security**: Allows using private endpoints and Managed Identity authentication, removing the need for static API keys.
3. **Compliance**: No data is sent to OpenAI for model training, satisfying strict customer security requirements.

## Consequences
- **Positive**: Strict NDPR compliance, high data privacy, zero API key rotation overhead in production.
- **Negative**: Minor delay (2-4 weeks) for newly released OpenAI models to be provisioned on Azure; slightly higher regional costs.

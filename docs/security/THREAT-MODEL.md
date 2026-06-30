# CyberGuard AI Platform — Threat Model

This document outlines the threat modeling analysis for the CyberGuard AI Platform, utilizing the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) and schedules our security review checkpoints.

## STRIDE Threat Analysis

| Threat Category | Specific Threat | Component at Risk | Mitigation |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker forge `organizationId` in JWT claims | APIM + Auth Middleware | Asymmetric RS256 JWT signatures. APIM validates signature before routing. |
| **Spoofing** | Attacker reuses a stolen refresh token | Auth Service | Token rotation + replay detection. Refresh tokens are SHA-256 hashed at rest. |
| **Spoofing** | Attacker impersonates a Paystack billing webhook | Webhook Handler | HMAC-SHA512 signature verification. Idempotency checks. |
| **Tampering** | Attacker modifies chat message payload in transit | API -> Client | TLS 1.3 mandatory; HSTS header enabled. |
| **Tampering** | Attacker injects malicious prompt via chat input | AI Guardrails Layer | 9-step input validation (PII mask, length check, injection scoring). |
| **Repudiation** | User denies performing a specific action | Audit Log System | Immutable audit logs with TTL (365d), linked to JWT Session via unique IDs. |
| **Information Disclosure** | Cross-tenant database leakage | Cosmos DB Data Layer | Partition key strictly enforced via `/organizationId` column. |
| **Information Disclosure** | AI response contains user PII | AI Guardrail Output | Step 7 output PII scrubbing (NER scan) and content filtering. |
| **Information Disclosure** | Credentials exposed in console logs | Application Logs | Managed Identity eliminates static credentials; no logging of raw secrets. |
| **Denial of Service** | Token exhaustion attack (cost inflation) | Usage Metering | Pre-call length limits, per-user rolling quotas, and budget alerts. |
| **Denial of Service** | Brute force login | Auth Service | 5-failure lockout (30m), exponential backoff at APIM gateway. |
| **Elevation of Privilege** | User accesses admin endpoint via URL manipulation | RBAC Middleware | Strict JWT role claim verification and database ownership checks. |
| **Elevation of Privilege** | Jailbreak attempt to expose AI system prompt | AI Guardrails Layer | Prompt injection signature detection blocking at 0.80 threshold. |

---

## Security Review Checkpoints (Release Gates)

To ensure the security posture of the application is maintained, the following checkpoints must be passed before promotions:

1. **SC-01: Baseline Security (Sprint 0)**: No static connection strings in code; Managed Identity configured in Bicep; branch protection active.
2. **SC-02: Auth Layer Review (Sprint 1)**: All 8 tenant isolation tests pass; JWT RS256 verified; token rotation live.
3. **SC-03: AI Guardrails Review (Sprint 2)**: 9-step guardrails calibrated and logging.
4. **SC-04: Payment Gateways (Sprint 3)**: HMAC validation functional; payment flow validated.
5. **SC-05: Product Launch (Staging -> Prod)**: Continuous backup verified; privacy policy and NDPR compliance audit.

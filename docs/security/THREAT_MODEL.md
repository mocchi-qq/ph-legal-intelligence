# Threat Model — Philippine Legal Intelligence Platform

**Methodology:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
**Last Updated:** 2026-11-09
**Version:** Gate 0 Specification

---

## 1. System Boundary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHILIPPINE LEGAL INTELLIGENCE PLATFORM               │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Web App    │  │   Admin App  │  │   API (Wkr)  │  │  Ingestion   │   │
│  │  (React)     │  │  (React)     │  │  (Workers)   │  │  (Workers)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┼─────────────────┼─────────────────┘            │
│                           ▼                 ▼                              │
│                  ┌─────────────────────────────────────┐                   │
│                  │      Cloudflare Edge Network        │                   │
│                  │  ┌─────────┐ ┌─────────┐ ┌────────┐ │                   │
│                  │  │   D1    │ │   R2    │ │Vectorize│ │                   │
│                  │  │ (Meta)  │ │ (Docs)  │ │(Embeds) │ │                   │
│                  │  └─────────┘ └─────────┘ └────────┘ │                   │
│                  │  ┌─────────┐ ┌─────────┐            │                   │
│                  │  │ Queues  │ │Durable  │            │                   │
│                  │  │(Async)  │ │Objects  │            │                   │
│                  │  └─────────┘ └─────────┘            │                   │
│                  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL DEPENDENCIES                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ AI Providers │  │ Legal Sources│  │  Monitoring  │  │  Auth Prov.  │    │
│  │ (NVIDIA,     │  │ (SC E-Lib,   │  │  (Logs,      │  │  (Future)    │    │
│  │  OpenAI,     │  │   LawPhil,   │  │   Metrics,   │  │              │    │
│  │  Anthropic)  │  │   Gazette)   │  │   Alerts)    │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Trust Boundaries

| Boundary ID | Description | Trust Level |
|-------------|-------------|-------------|
| TB-01 | Client Browser ↔ Cloudflare Edge | Untrusted (public internet) |
| TB-02 | Cloudflare Edge ↔ Workers API | Trusted (WAF, rate limiting, TLS) |
| TB-03 | Workers API ↔ D1/R2/Vectorize | Trusted (private network, mTLS) |
| TB-04 | Workers API ↔ AI Providers | Semi-trusted (API keys, contracts) |
| TB-05 | Workers API ↔ Legal Sources | Untrusted (public HTTP, no auth) |
| TB-06 | Ingestion Worker ↔ R2/Queues | Trusted (internal) |
| TB-07 | Admin ↔ Workers API | Trusted (authenticated, authorized) |

---

## 3. Asset Inventory

| Asset ID | Asset | Classification | Location | Owner |
|----------|-------|----------------|----------|-------|
| AST-01 | User credentials (hashed) | Highly Restricted | D1 | Auth Service |
| AST-02 | Session tokens | Confidential | D1/KV | Auth Service |
| AST-03 | Legal documents (original) | Public / Internal | R2 | Ingestion |
| AST-04 | Legal documents (extracted) | Internal | R2 + D1 | Ingestion |
| AST-05 | Embeddings/vectors | Internal | Vectorize | Search |
| AST-06 | User uploaded documents | Confidential | R2 (private) | Document Intelligence |
| AST-07 | Audit logs | Internal | R2/D1 | Observability |
| AST-08 | API keys (AI providers) | Highly Restricted | Workers Secrets | Platform |
| AST-09 | Personal data (PII) | Highly Restricted | D1 | User Management |
| AST-10 | Billing/payment data | Highly Restricted | D1 | Billing |

### 3.1 Control Domains Covered

This threat model covers all required security domains: authentication, authorization, tenant isolation, api security, database security, file storage, secrets management, encryption, audit logging, backups, ai security, and administration. Each domain is analyzed below through STRIDE, with mitigations in §4 and the control mapping in §7.

---

## 4. STRIDE Threat Analysis

### 4.1 Spoofing (S)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| S-01 | AST-01, AST-02 | Credential stuffing / password spray | Account takeover | High | Rate limiting, MFA, account lockout, breach detection |
| S-02 | AST-02 | Session token theft (XSS, MITM) | Session hijacking | Medium | HttpOnly, Secure, SameSite cookies; short TTL; rotation |
| S-03 | AST-08 | API key leakage (logs, repo) | Unauthorized AI usage, cost abuse | Medium | Workers Secrets (never in code/env), rotation, monitoring |
| S-04 | AST-09 | Impersonation via forged JWT | Privilege escalation | Low | RS256 signatures, short expiry, key rotation, claim validation |
| S-05 | AST-06 | Malicious file upload with spoofed MIME | Code execution, data exfil | Medium | File signature validation, sandboxed processing, type allowlist |

### 4.2 Tampering (T)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| T-01 | AST-03, AST-04 | Malicious ingestion connector | Corrupted legal corpus | Low | Source verification, checksums, immutable versions, human review |
| T-02 | AST-05 | Poisoned embeddings | Degraded search quality | Low | Embedding model versioning, quality checks, rollback capability |
| T-03 | AST-06 | Document manipulation pre-upload | Misleading analysis | Medium | Immutable uploads, hash verification, audit trail |
| T-04 | AST-07 | Log injection / tampering | Forensic integrity loss | Low | Append-only logs, structured logging, log forwarding to SIEM |
| T-05 | AST-09 | SQL injection / NoSQL injection | Data corruption, leakage | Low | Parameterized queries (D1), ORM, input validation |
| T-06 | AST-10 | Payment data manipulation | Financial fraud | Low | Payment processor handles sensitive data; webhook verification |

### 4.3 Repudiation (R)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| R-01 | AST-07 | Admin denies action | Accountability gap | Medium | Immutable audit logs with tamper-evident hashing |
| R-02 | AST-09 | User denies data submission | Compliance dispute | Low | Signed requests, audit trail with timestamps |
| R-03 | AST-06 | Uploader denies document content | Legal liability | Low | SHA-256 of original stored, timestamped, signed |
| R-04 | AST-08 | AI provider denies usage | Billing dispute | Medium | Provider usage logs, local request/response logging |

### 4.4 Information Disclosure (I)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| I-01 | AST-06 | Cross-tenant document access | Confidentiality breach | High | Tenant isolation at R2 (prefix), D1 (org_id), API authz |
| I-02 | AST-09 | PII in logs / error messages | Privacy violation | Medium | PII redaction, structured logging, no PII in errors |
| I-03 | AST-03, AST-04 | Legal corpus leakage (public vs private) | IP exposure | Low | Public/private document separation, access control |
| I-04 | AST-05 | Embedding inversion attacks | Training data extraction | Low | No raw text in vector metadata; access-controlled queries |
| I-05 | AST-08 | AI provider sees confidential prompts | Third-party exposure | High | Data processing agreements; on-prem/local models for sensitive |
| I-06 | AST-01 | Timing attacks on auth | User enumeration | Low | Constant-time comparison, generic error messages |
| I-07 | AST-07 | Audit log exposure | Operational security | Low | Role-based log access, retention policies |

### 4.5 Denial of Service (D)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| D-01 | All | Volumetric DDoS | Service unavailable | Medium | Cloudflare WAF, rate limiting, auto-scaling |
| D-02 | API | Application-layer DoS (slowloris, large payloads) | Resource exhaustion | Medium | Request size limits, timeouts, queue depth limits |
| D-03 | AST-05 | Embedding query flood | Vectorize quota exhaustion | Medium | Per-tenant rate limits, query complexity limits |
| D-04 | AST-06 | Large file upload flood | R2 storage/cost exhaustion | Medium | File size limits, per-tenant quotas, async processing |
| D-05 | Ingestion | Malicious source connector loop | Queue backlog, cost | Low | Circuit breakers, max retries, dead-letter queues |
| D-06 | AST-08 | AI provider rate limit / outage | Feature degradation | Medium | Multi-provider fallback, caching, graceful degradation |

### 4.6 Elevation of Privilege (E)

| Threat ID | Asset | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|-------|---------------|--------|------------|------------|
| E-01 | AST-01, AST-09 | Privilege escalation via RBAC flaw | Admin access | Low | Principle of least privilege, role hierarchy validation |
| E-02 | AST-06 | Path traversal in document access | Cross-tenant read | Medium | Path normalization, tenant prefix enforcement, no user-controlled paths |
| E-03 | AST-08 | Prompt injection → tool use | Unauthorized actions | Medium | Prompt isolation, tool allowlists, output validation |
| E-04 | AST-05 | Vector namespace confusion | Cross-tenant search | Low | Namespace per tenant, strict query scoping |
| E-07 | AST-10 | Billing manipulation | Free tier abuse | Low | Server-side entitlement checks, webhook verification |

---

## 5. Summary Risk Matrix

| Threat Category | Critical | High | Medium | Low |
|-----------------|----------|------|--------|-----|
| Spoofing | 0 | 1 (S-01) | 3 | 1 |
| Tampering | 0 | 0 | 2 | 4 |
| Repudiation | 0 | 0 | 1 | 3 |
| Info Disclosure | 0 | 2 (I-01, I-05) | 3 | 2 |
| DoS | 0 | 0 | 5 | 1 |
| Elevation of Privilege | 0 | 0 | 2 | 2 |

---

## 6. Residual Risk Acceptance

| Risk ID | Description | Residual Level | Accepted By | Date | Review Date |
|---------|-------------|----------------|-------------|------|-------------|
| I-05 | AI provider sees prompts (mitigated by contracts, fallback) | Medium | CTO | 2026-11-09 | 2027-05-09 |
| D-03 | Vectorize quota exhaustion under attack | Medium | Platform Lead | 2026-11-09 | 2027-05-09 |
| S-01 | Credential stuffing (mitigated by Cloudflare + app controls) | Low | Security Lead | 2026-11-09 | 2027-05-09 |

---

## 7. Security Controls Mapping (Dossier Section 13.1)

| Dossier Requirement | Implementation |
|---------------------|----------------|
| Secure sessions, MFA option, session revocation | JWT + refresh tokens, MFA via TOTP, revocation list in D1 |
| RBAC plus resource-level access control | `@phli/permissions` package, ABAC policies |
| Enforced organization and user boundaries | Tenant isolation at D1 (org_id), R2 (prefix), Vectorize (namespace) |
| Schema validation, rate limits, origin controls | Zod validation, Cloudflare rate limits, CORS |
| Least-privilege access and prepared statements | D1 parameterized queries, Workers service bindings |
| Private buckets and short-lived download authorization | R2 private buckets, signed URLs with TTL |
| Cloudflare secrets, never frontend env variables | Workers Secrets, no `VITE_` prefix for secrets |
| TLS and encryption at rest | Cloudflare managed TLS, D1/R2/Vectorize encryption |
| Immutable or tamper-evident audit records | Append-only audit table, hash chaining |
| Recovery tests and documented retention | Point-in-time recovery (D1), R2 versioning, quarterly drills |
| Prompt-injection and data-exfiltration defenses | Prompt templates, output validation, tool allowlists |
| Privileged access restrictions and audit logs | Admin role, approval workflows, comprehensive audit |

---

## 8. Monitoring & Detection

| Signal | Source | Alert Threshold | Response |
|--------|--------|-----------------|----------|
| Failed login rate | Auth service | >10/min per IP | Auto-block, notify |
| 4xx/5xx spike | Workers logs | >5% for 5min | Page on-call |
| R2 egress anomaly | Cloudflare analytics | >2x baseline | Investigate |
| Vectorize query latency | Workers metrics | >p99 2s | Scale/optimize |
| Queue backlog | Queues metrics | >1000 messages | Alert, manual drain |
| AI provider errors | AI gateway logs | >10% error rate | Failover, notify |
| Audit log gaps | Audit service | >1hr gap | Alert, investigate |
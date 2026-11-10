# Security Architecture — Philippine Legal Intelligence Platform

**Version:** Gate 0 Specification
**Last Updated:** 2026-11-09

---

## 1. Zero-Trust Principles

This platform adopts a **zero-trust architecture** with the following core tenets:

1. **Never trust, always verify** — Every request authenticated and authorized regardless of network location
2. **Least privilege** — Minimum permissions necessary for each identity and service
3. **Assume breach** — Design for containment, detection, and rapid response
4. **Verify explicitly** — Cryptographic verification of identity, integrity, and intent
5. **Encrypt everything** — Data in transit (TLS 1.3) and at rest (AES-256)

---

## 2. Layered Tenant Isolation

Tenant isolation is enforced at **six independent layers** — failure of any single layer does not compromise isolation.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         TENANT ISOLATION LAYERS                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Network (Cloudflare)                                               │
│  ├─ Workers runtime isolation (per-account)                                  │
│  ├─ D1 database per account (logical)                                        │
│  ├─ R2 bucket per account (prefix-based)                                     │
│  └─ Vectorize namespace per account                                          │
│                                                                              │
│  Layer 2: Application (API Gateway)                                          │
│  ├─ JWT validation (issuer, audience, expiry, signature)                     │
│  ├─ Org ID extraction from token → request context                           │
│  ├─ All DB queries auto-scoped to org_id                                     │
│  └─ All R2 operations prefixed with org_id/                                  │
│                                                                              │
│  Layer 3: Data Access (Repository Layer)                                     │
│  ├─ Repository interfaces require `org_id` parameter                         │
│  ├─ No "global" query methods exposed                                        │
│  ├─ Cross-tenant queries require explicit admin permission                   │
│  └─ Query builders inject `WHERE org_id = ?` automatically                   │
│                                                                              │
│  Layer 4: Authorization (ABAC)                                               │
│  ├─ `@phli/permissions` evaluates ResourceAccess per request                 │
│  ├─ Policies: role, resource ownership, org membership, document classification │
│  ├─ Decision cached with TTL; audit logged                                   │
│  └─ Default deny                                                             │
│                                                                              │
│  Layer 5: AI Gateway                                                          │
│  ├─ Per-tenant prompt templates (no user-controlled system prompts)          │
│  ├─ Context injection scoped to tenant's retrieved passages                  │
│  ├─ Output validation: no cross-tenant citations in response                 │
│  └─ Provider API keys never leave Workers Secrets                            │
│                                                                              │
│  Layer 6: Observability                                                       │
│  ├─ Logs/metrics tagged with org_id                                          │
│  ├─ Alerting rules per-tenant                                                │
│  ├─ No PII in structured logs                                                │
│  └─ Audit events immutable, hash-chained                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User → /auth/login (email, password, [MFA code])                         │
│         │                                                                    │
│         ▼                                                                    │
│  2. Verify credentials (Argon2id hash in D1)                                 │
│         │                                                                    │
│         ▼                                                                    │
│  3. Issue JWT pair:                                                          │
│     ├─ Access Token (15 min, RS256, claims: sub, org_id, role, permissions) │
│     └─ Refresh Token (30 days, rotating, stored hashed in D1)                │
│         │                                                                    │
│         ▼                                                                    │
│  4. Set cookies:                                                             │
│     ├─ __session (access token, HttpOnly, Secure, SameSite=Strict)          │
│     └─ __refresh (refresh token, HttpOnly, Secure, SameSite=Strict)         │
│         │                                                                    │
│         ▼                                                                    │
│  5. Subsequent requests:                                                     │
│     ├─ Middleware validates access token                                     │
│     ├─ If expired → use refresh token to rotate                              │
│     ├─ If revoked → clear cookies, 401                                       │
│     └─ Attach org_id, role, permissions to request context                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Token Claims

```typescript
interface AccessTokenClaims {
  sub: string; // user_id
  org_id: string; // organization_id (required for all but public)
  role: Role; // platform role
  permissions: string[]; // flattened permission strings
  tier: "public" | "professional" | "institutional";
  iat: number;
  exp: number;
  iss: "phli-auth";
  aud: "phli-api";
}
```

### 3.2 Session Revocation

- **Immediate:** Add `session_id` to revocation list in D1 (TTL = access token expiry)
- **Bulk:** User logout all devices → increment `user.revocation_epoch`
- **Admin:** Admin can revoke all sessions for an org/user

---

## 4. Authorization Model (RBAC + ABAC)

### 4.1 Roles (Platform-Level)

| Role             | Description                 | Default Permissions                    |
| ---------------- | --------------------------- | -------------------------------------- |
| `platform_admin` | Full system access          | All permissions                        |
| `org_admin`      | Organization administration | `org:*`, `members:*`, `billing:*`      |
| `lawyer`         | Verified legal professional | `research:*`, `draft:*`, `matters:*`   |
| `researcher`     | Legal researcher            | `research:*`, `library:read`           |
| `student`        | Law student                 | `research:educational`, `library:read` |
| `public_user`    | Unverified public           | `research:public`, `library:read`      |

### 4.2 Permissions (Resource-Action)

Format: `resource:action` (e.g., `documents:read`, `matters:create`, `admin:users:delete`)

| Resource    | Actions                                                              |
| ----------- | -------------------------------------------------------------------- |
| `research`  | `query`, `history:read`, `history:delete`, `export`                  |
| `library`   | `read`, `search`, `bookmark`, `download`                             |
| `documents` | `upload`, `read`, `analyze`, `delete`, `share`                       |
| `drafts`    | `create`, `read`, `update`, `delete`, `export`, `collaborate`        |
| `matters`   | `create`, `read`, `update`, `delete`, `assign`, `deadline`           |
| `org`       | `read`, `update`, `members:invite`, `members:remove`, `billing:read` |
| `admin`     | `users:read`, `users:update`, `sources:manage`, `ingestion:trigger`  |

### 4.3 ABAC Policies (Resource-Level)

```typescript
// Example: Document access policy
policy document_access {
  allow if (
    // Owner full access
    resource.owner_id == principal.user_id
    // Org members with explicit share
    || (resource.org_id == principal.org_id && resource.shared_with.includes(principal.user_id))
    // Public documents
    || resource.classification == 'public'
    // Admin override
    || principal.role == 'platform_admin'
  );
  
  deny if (
    resource.classification == 'highly_restricted'
    && !principal.permissions.includes('documents:highly_restricted')
  );
}
```

---

## 5. API Security

### 5.1 Request Validation

- **All inputs validated** with Zod schemas at API boundary
- **No raw SQL** — D1 parameterized queries only
- **Size limits:** Request body ≤ 10MB, file upload ≤ 50MB
- **Rate limits:** Per-IP, per-org, per-endpoint (configurable)

### 5.2 CORS & Origin Controls

- **Strict CORS:** Only configured origins allowed
- **No wildcards** in production
- **Credentials:** `credentials: 'include'` required for auth endpoints

### 5.3 Security Headers (via Cloudflare Workers)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.phlegal-intelligence.ph
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 6. Data Protection

### 6.1 Encryption

| State               | Mechanism                    | Key Management |
| ------------------- | ---------------------------- | -------------- |
| In Transit          | TLS 1.3 (Cloudflare managed) | Cloudflare     |
| At Rest (D1)        | AES-256 (Cloudflare managed) | Cloudflare     |
| At Rest (R2)        | AES-256 (Cloudflare managed) | Cloudflare     |
| At Rest (Vectorize) | AES-256 (Cloudflare managed) | Cloudflare     |
| Secrets             | Workers Secrets (HSM-backed) | Cloudflare     |

### 6.2 Key Separation

- **No cross-environment keys** — Dev/staging/prod use separate Cloudflare accounts
- **Rotation:** AI provider keys rotated quarterly; JWT signing keys rotated annually
- **No keys in code** — All via Workers Secrets

### 6.3 File Storage Security

```
R2 Bucket Structure:
├── public/                    # Public legal documents
│   └── {source_id}/
├── private/
│   └── {org_id}/              # Tenant-isolated
│       ├── uploads/           # User uploaded documents
│       │   └── {upload_id}/
│       │       ├── original.{ext}
│       │       ├── extracted.txt
│       │       └── chunks/
│       ├── exports/           # Generated drafts/exports
│       └── temp/              # Temporary processing files
└── system/                    # Platform internal
    ├── embeddings/
    └── backups/
```

- **Upload validation:** MIME type allowlist, file signature verification, size limits
- **Malware scanning:** ClamAV in ingestion pipeline (async, quarantine on detection)
- **Signed URLs:** All downloads via time-limited (1hr) signed URLs
- **No direct public access** — All R2 access via Workers

---

## 7. Audit & Accountability

### 7.1 Audit Event Categories

| Category          | Events                                                                 | Retention |
| ----------------- | ---------------------------------------------------------------------- | --------- |
| Authentication    | login, logout, mfa_challenge, token_refresh, revocation                | 2 years   |
| Authorization     | access_granted, access_denied, policy_evaluation                       | 2 years   |
| Data Access       | document_read, document_download, search_query, export                 | 1 year    |
| Data Modification | document_upload, document_delete, draft_create, draft_update           | 7 years   |
| Admin             | user_create, user_update, role_assign, source_manage, config_change    | 7 years   |
| Security          | threat_detected, anomaly_alert, incident_created, incident_resolved    | 7 years   |
| AI                | research_query, citation_verification, draft_generation, provider_call | 1 year    |
| Billing           | subscription_change, payment_success, payment_failed, credit_use       | 7 years   |

### 7.2 Audit Log Structure

```typescript
interface AuditEvent {
  id: string; // UUID v7 (time-ordered)
  timestamp: string; // ISO 8601 UTC
  actor: {
    type: "user" | "system" | "admin";
    id: string; // user_id or service name
    org_id?: string;
    role?: string;
  };
  action: string; // e.g., "documents.upload"
  resource: {
    type: string; // e.g., "document"
    id: string;
    org_id: string;
  };
  outcome: "success" | "failure" | "partial";
  metadata: Record<string, unknown>; // Context (no PII)
  // Tamper-evidence
  prev_hash: string; // SHA-256 of previous event
  hash: string; // SHA-256 of this event (incl. prev_hash)
}
```

### 7.3 Log Integrity

- **Hash chaining:** Each event includes `prev_hash` → tampering detectable
- **Immutable storage:** Append-only audit table in D1; no UPDATE/DELETE
- **External forwarding:** Optional SIEM integration (structured JSON)

---

## 8. Backup & Recovery

| Component      | Backup Strategy                       | RPO    | RTO     | Test Cadence |
| -------------- | ------------------------------------- | ------ | ------- | ------------ |
| D1 (metadata)  | Point-in-time recovery (Cloudflare)   | <1 min | <15 min | Quarterly    |
| R2 (documents) | Cross-region replication + versioning | 0      | <1 hr   | Quarterly    |
| Vectorize      | Re-index from R2/D1 source of truth   | N/A    | <4 hr   | Semi-annual  |
| Workers code   | Git (source of truth)                 | 0      | <5 min  | Per deploy   |
| Secrets        | Workers Secrets (manual backup)       | 0      | <1 hr   | Quarterly    |

---

## 9. AI Security

### 9.1 Prompt Injection Defenses

- **System prompts static** — Never user-controlled
- **User input isolated** — Passed as structured data, not string concatenation
- **Output validation** — Citations must resolve to tenant's retrieved passages
- **Tool allowlist** — Only approved functions callable by AI

### 9.2 Data Exfiltration Prevention

- **No raw corpus in prompts** — Only retrieved passages (scoped to tenant)
- **Provider contracts** — DPAs with AI providers; zero-retention where available
- **Local fallback** — Critical workloads can route to self-hosted models

### 9.3 Model Governance

- **Version pinning** — Specific model versions in config
- **Evaluation gates** — New models must pass benchmark before deployment
- **Rollback capability** — Instant revert to previous model version

---

## 10. Administration Security

### 10.1 Privileged Access

- **Platform admins** — Separate identity provider (future), hardware MFA required
- **Break-glass procedure** — Time-limited, audited, requires dual approval
- **Admin actions** — All require explicit confirmation, logged with justification

### 10.2 Configuration Management

- **Infrastructure as Code** — All Cloudflare config via Wrangler/Terraform
- **Change control** — PR required for config changes; automated validation
- **Drift detection** — Periodic comparison of live vs. declared state

---

## 11. Compliance Mapping (Dossier Section 13.1)

| Requirement                        | Architecture Control                           | Evidence            |
| ---------------------------------- | ---------------------------------------------- | ------------------- |
| Secure sessions, MFA, revocation   | §3 JWT + refresh, MFA, revocation list         | Auth service impl   |
| RBAC + resource-level access       | §4 Roles, permissions, ABAC policies           | `@phli/permissions` |
| Tenant isolation                   | §2 Six-layer isolation                         | Data access layer   |
| API schema validation, rate limits | §5 Zod, Cloudflare limits                      | API middleware      |
| Least-privilege DB access          | §3.3 Repository pattern, parameterized queries | D1 usage            |
| Private buckets, signed URLs       | §6.3 R2 structure, signed URLs                 | Ingestion impl      |
| Secrets in Workers Secrets         | §6.2 Key separation                            | No env secrets      |
| TLS + encryption at rest           | §6.1 Encryption table                          | Cloudflare defaults |
| Immutable audit records            | §7.2 Hash-chained append-only                  | Audit service       |
| Recovery tests, retention          | §8 Backup table                                | Runbook             |
| Prompt injection defense           | §9.1 Static prompts, isolation                 | AI gateway          |
| Privileged access restrictions     | §10.1 Break-glass, dual approval               | Admin workflow      |

---

## 12. Incident Response

### 12.1 Severity Levels

| Level | Definition                                     | Response Time | Escalation                   |
| ----- | ---------------------------------------------- | ------------- | ---------------------------- |
| SEV-1 | Active breach, data exfiltration, service down | 15 min        | CTO, Legal, NPC (if PII)     |
| SEV-2 | Vulnerability exploited, partial outage        | 1 hr          | Security Lead, Platform Lead |
| SEV-3 | Suspicious activity, degraded performance      | 4 hr          | On-call engineer             |
| SEV-4 | Security hygiene, config drift                 | 24 hr         | Team lead                    |

### 12.2 Response Phases

1. **Detect** — Alerting, user reports, threat intel
2. **Triage** — Severity, scope, evidence preservation
3. **Contain** — Revoke tokens, block IPs, disable features
4. **Eradicate** — Root cause, patch, rotate keys
5. **Recover** — Restore service, verify integrity
6. **Postmortem** — Timeline, root cause, action items (within 5 business days)

---

## 13. Future Enhancements (Post-Gate 0)

- **Hardware security keys** (WebAuthn) for admin MFA
- **eBPF-based runtime monitoring** for Workers
- **Automated pen testing** in CI/CD
- **Zero-knowledge proof** for citation verification
- **Confidential computing** for AI inference (TEE)

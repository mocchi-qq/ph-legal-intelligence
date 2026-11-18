# Phase 3 — Capability & Evaluation Research

**Part of:** Research Roadmap (roadmap.md), Phase 3.
**Status:** In Progress — B-16 blocked (needs authorized corpus/eval set); B-20, B-23, B-24 in progress.
**Research questions:** QP-11, QP-18, QP-19, QP-23, QP-24.
**Backlog items:** B-16, B-20, B-23, B-24.
**Counsel-gated:** B-16 (Vectorize benchmark — needs authorized corpus/eval set).
**Not counsel-gated:** B-20 (KV usage audit — code inspection), B-23 (institutional API feasibility), B-24 (multi-language needs).

---

## 3.1 B-20 — KV usage audit (code inspection, NOT counsel-gated)

**Objective:** Confirm KV is used only for session/cache, never authorization state (eventual consistency, 1 write RPS/key). Authorization decisions need stronger consistency (D1).

**Findings (code inspection, verified 2026-11-18):**

**No KV usage anywhere in the codebase:**
- `apps/api/wrangler.toml` and `apps/ingestion/wrangler.toml` declare **no** `[[kv_namespaces]]` bindings and no `[[d1_databases]]` bindings (bindings are injected at deploy time via Cloudflare dashboard/env).
- No `.ts` source file contains `KV`, `kv.`, `KV_NAMESPACE`, `Namespace`, or `namespace` references.
- All data operations go through `D1DatabaseLike` interface (`d1-types.ts`): `prepare(query)` and `batch(statements[])`. Used by `counsel-d1-store.ts` (authorization/determinations), `authority-d1-store.ts` (authority core), `authorization-audit.ts` (audit events), `corpus-d1-writer.ts`/`corpus-d1-reader.ts` (corpus read/write).

**Conclusion (B-20 complete):**
- KV is **not used at all** in the current codebase — so it cannot be used for authorization state.
- All authorization decisions go through D1 (stronger consistency than KV's eventual consistency + 1 write RPS/key limit).
- D-04 (KV only for session/cache, never authorization state) is satisfied by the current architecture; if KV is introduced later, it must be restricted to session/cache only.

**Status:** Complete.

---

## 3.2 B-23 — Institutional verification API (F15) feasibility

**Objective:** Evaluate whether the project should offer an institutional verification API — B2B revenue; needs stable verifier + terms. Post-R3.

**Findings (public research, verified 2026-11-18):**

**Reference model — CourtListener citation-lookup API (Free Law Project, launched April 16, 2024):**
- Explicitly launched to "combat hallucinations" and provide a guardrail for AI-generated legal content.
- Accepts blocks of text up to ~50 pages (64,000 characters), extracts citations, identifies invalid/ambiguous ones, matches good citations to opinions in CourtListener's database.
- Returns one object per citation with `status` (200 found, 404 not found, 400 unknown reporter, 300 ambiguous, 429 rate-limited).
- Rate limits: up to 250 citations per request, 60 valid citations per minute, 64,000 characters of text.
- Free (rate-limited; free token raises limits).
- Purpose: hallucination guardrail — exactly the project's verification API use case.

**Applicability to this project:**
- The project's four-layer verifier (existence → location → support → current/temporal) maps directly onto the CourtListener guardrail use case (existence check is the core).
- The project already has the verifier infrastructure specified (Gates 9–10) on synthetic fixtures.
- A stable verifier is a prerequisite before exposing any verification API (B-23 depends on verifier stability, post-R3).

**Status:** Findings documented; institutional API remains post-R3, pending stable verifier.

---

## 3.3 B-24 — Multi-language (Filipino/English) needs assessment

**Objective:** Assess whether multi-language UI or legal-text handling is needed. Deferred per QP-19.

**Findings (public research, verified 2026-11-18):**
- English remains the primary and predominant language used in Philippine courtrooms, legal pleadings, and published judicial decisions.
- Laws and court decisions are largely written in English and are rarely translated into Filipino.
- The Supreme Court has issued at least one decision in Filipino (to advance access to justice), but this is exceptional, not the norm.
- Code-switching may be observed in spoken proceedings, but written legal authorities are predominantly English.

**Implication:** Multi-language UI/Filipino legal-text handling is not a first-order constraint. Defer per QP-19 (user research needed later).

**Status:** Findings documented; deferred.

---

## Boundary confirmation

- No legal corpus downloaded. No production DB populated. No D1 research tables created. No documents ingested. No vector index created for research. No deployment. No push. No authorization state changed.
- KV audit is code inspection only. No production code modified.
- Counsel determinations remain 0; all 350 source-authorization cells UNKNOWN; 4 pilot docs BLOCKED_AUTHORIZATION.

# Phase 4 — Competitor & Technology Watch

**Part of:** Research Roadmap (roadmap.md), Phase 4.
**Status:** In Progress — B-22 (competitor citator watch) and Cloudflare D1/Workers watch in progress.
**Research questions:** QP-17, QP-21, QP-22.
**Backlog items:** B-22, plus ongoing monitoring.
**Counsel-gated:** None (monitoring public vendor pages only).
**Frequency:** Ongoing, low frequency (quarterly watch brief).

---

## 4.1 B-22 — Competitor citator watch (Anycase, BatasDB, Digest AI)

**Objective:** Monitor whether Anycase/BatasDB/Digest AI add a citator. Narrows the window to authority-state moat; speed to authority state matters.

**Baseline (research-findings.md F-A-5/F-A-8, verified 2026-11-18):**
- Anycase.ai: no citator claimed. Vendor claims: "14,000+ users", "14 hours saved" (unverified), corpus count inconsistent (140k vs 160k). Only identified PH-native paid AI product with public pricing (Free/Pro ₱999/Education ₱599).
- BatasDB: no citator claimed. Vendor claims only; no independent evaluation found.
- Digest AI: mentioned alongside Anycase as tools in use in PH (Oxford Tech & Justice piece). No detail verified.

**Findings (public research, verified 2026-11-18):**
- **Anycase.ai** (anycase.ai): Positioned as "AI-powered legal research & workspace for Philippine law" — "Research jurisprudence, compare doctrines, resolve procedural questions, and draft legal documents using verified Philippine legal authorities and full-text sources." Claims "verified Philippine legal authorities." Blog: "Before legal materials can support an AI answer, they need to be verified." LinkedIn: "grounded on thorough verification with our team of Filipino lawyers to source and vet across 150+ government [sources]." **No citator claimed.** Adds sources: IPOPHL and COA issuances joined the library September 2026; CICC, GPPB, NTC documents as of August 2026. Voice dictation added.
- **BatasDB:** No citator claimed. Vendor claims only; no independent evaluation found. No change from baseline.
- **Digest AI:** Mentioned alongside Anycase as tools in use in PH (Oxford Tech & Justice piece). No detail verified. No change from baseline.

**Status:** No competitor has added a citator. Anycase is moving toward verification ("verified authorities," lawyer-vetted sources) but has not launched a citator (positive/negative treatment tracking). The window to authority-state moat remains open. Continue monitoring.

---

## 4.2 Cloudflare D1/Workers technology watch

**Objective:** Monitor Cloudflare D1/Workers changes affecting the stack decision (D-03).

**Findings (public research, verified 2026-11-18):**

**D1 read replication (public beta, Oct 23, 2026 changelog):**
- D1 read replication is available in public beta to lower average latency and increase throughput for read-heavy applications.
- Read replicas are automatically created by Cloudflare (one in each supported D1 region), active/inactive based on query traffic, transparently routed at no additional cost.
- Workers leverage read-only database copies via the Sessions API.
- **Relevance:** Addresses one independent-report concern (read replication didn't help one team's overload), but read replicas don't solve write overload. Writes still go to the primary then replicate. Write latency remains real.

**D1 JavaScript transactions (sneak peek, blog.cloudflare.com):**
- Cloudflare is working on bringing JavaScript transactions to D1.
- **Relevance:** Would address the `batch()` atomicity gap (currently sequential, recovery-safe not binding-atomic). Worth re-evaluating when GA.

**D1 reliability concerns (independent, Reddit/community):**
- "D1 is highly unreliable" for write-heavy workloads; recommendation: batch writes with `.batch()`, enable read replication so reads stop queuing.
- Write latency is real: writes go to primary, then replicate.

**Status:** Stack decision (D-03: keep Cloudflare/D1/Workers) remains valid. Read replication now available (public beta) and JS transactions in sneak peek — both supportive of the project's direction. Continue watching for transaction GA and any 10 GB cap changes.

---

## Boundary confirmation

- No legal corpus downloaded. No production DB populated. No D1 research tables created. No documents ingested. No vector index created for research. No deployment. No push. No authorization state changed.
- All monitoring is of public vendor pages/documentation only. No scraping, no crawling, no paywall circumvention.
- Counsel determinations remain 0; all 350 source-authorization cells UNKNOWN; 4 pilot docs BLOCKED_AUTHORIZATION.

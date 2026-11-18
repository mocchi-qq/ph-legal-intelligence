# Phase 1 — Cloudflare/D1 Operational Verification

**Part of:** Research Roadmap (roadmap.md), Phase 1.
**Status:** In Progress — capacity & cost brief written; real-D1 tests pending remote access.
**Research questions:** QP-05, QP-12, QP-15.
**Backlog items:** B-07, B-12, B-14, B-15, B-19.
**Owner:** Engineering (real-D1 tests require remote D1 access; workerd cannot start locally on this ARM64/PRoot host).

---

## 1. Verified D1 limits (official docs, C-01/C-02, accessed 2026-11-18)

| Limit | Free | Workers Paid | Notes |
|-------|------|--------------|-------|
| Databases per account | 10 | 1,000,000 | First 100,000 included; $0.10/month per additional DB |
| Max database size | 500 MB | 10 GB | Cannot be increased |
| Max storage per account | 5 GB | 1 TB | |
| Time Travel (PITR) | 7 days | 30 days | |
| Max Time Travel restores | \multicolumn{3}{c}{10 per 10 minutes per database} |
| Queries per Worker invocation | 50 | 1,000 | `db.batch()` counts as ONE query regardless of statement count |
| Max columns per table | \multicolumn{3}{c}{100} |
| Max rows per table | \multicolumn{3}{c}{Unlimited (within per-DB storage)} |
| Max string/BLOB/row size | \multicolumn{3}{c}{2,000,000 bytes (2 MB)} |
| Max SQL statement length | \multicolumn{3}{c}{100,000 bytes (100 KB)} |
| Max bound parameters per query | \multicolumn{3}{c}{100} |
| Max SQL query duration | \multicolumn{3}{c}{30 seconds} |
| Max query result size | \multicolumn{3}{c}{50 MB (enforced from 2026-11-04)} |
| Max file import (`d1 execute`) | \multicolumn{3}{c}{5 GB (uploaded to R2)} |
| Simultaneous D1 connections per Worker | \multicolumn{3}{c}{6} |
| Concurrency model | \multicolumn{3}{c}{Single-threaded per DB; queries processed one at a time; overload error when queue full} |
| Read replication | \multicolumn{3}{c}{Sessions API; read-only queries retried automatically; writes not retried} |
| Data jurisdiction | \multicolumn{3}{c}{`us` jurisdiction available (since 2026-10-02)} |
| Undelete | \multicolumn{3}{c}{Databases deleted within last 7 days only (since 2026-10-23)} |

### D1 pricing (official)

| Metric | Free | Workers Paid |
|--------|------|--------------|
| Rows read | 5 million/day | First 25 billion/month included + $0.001/million |
| Rows written | 100,000/day | First 50 million/month included + $1.00/million |
| Storage | 5 GB total | First 5 GB included + $0.75/GB-month |
| Databases | 10 | First 100,000 included + $0.10/extra DB/month |
| Data transfer/egress | None charged | None charged |

### Workers pricing

- Free plan: limited usage.
- Paid plan: $5/month minimum; includes Workers, Pages Functions, KV, Hyperdrive, Durable Objects.

---

## 2. Independent evidence (operational experience, NOT verified fact)

| Source | Finding | Reliability |
|--------|---------|-------------|
| camelAI experience report (C-09) | D1 overload errors on 5.6 MB / 15,000-row DB with a few hundred queries/minute; indexes, read replication, caching did not stop it; noisy-neighbor explanation from D1 team; moved shared DB to PlanetScale Postgres via Hyperdrive; kept Durable Objects for per-account state. DO: 128 MB memory, cold starts >10 s. | INDEPENDENT (anecdotal, distinguished from verified fact) |
| Cloudflare community architecture review (C-10) | Single 8.8 GB D1 DB (88% of 10 GB cap); ~40K document versions, 160K derived artifacts, 1.38M semantic index entries, 559K FTS5 rows; FTS5 export blocked (virtual tables); ~3,000 DO invocations per queue-consumer execution due to rate-limiter DO contention; horizontal scaling = many small DBs with custom scatter-gather in the Worker. | INDEPENDENT |

**Interpretation:** D1 is officially positioned as read-heavy and horizontally scalable, but independent reports show overload on small DBs despite mitigations. Treat as a known operational risk to monitor, not a blocker.

---

## 3. D1 capacity-and-cost brief (B-07, B-12)

### Row estimates per document (grounded in verified schema)

Per successfully ingested document (from `migrations/d1/` and `packages/legal-ingestion/src/pipeline.ts`):

| Table | Rows per document |
|-------|-------------------|
| `legal_documents` | 1 (canonical document identity) |
| `document_versions` | 1 (initially; +1 per re-ingestion with changed content) |
| `source_manifestations` | 1 |
| `ingestion_runs` | 1 per ingestion attempt |
| `legal_provisions` | N — one per extracted provision; ~20–200+ typical for a Philippine legal document |
| `document_chunks` | N — one per extracted chunk; typically proportional to provisions |
| `document_citations` | 0+ — only when the artifact includes citation relationships |
| `document_relationships` | 0+ — only when explicit relationships with evidence are provided |

**Working estimate:** ~500 rows written per document (4 fixed rows + ~250 provisions + ~250 chunks), varying by document length/complexity. The four fixed rows are mandatory; provisions/chunks scale with document size.

### Assumptions
These estimates are based on official D1 limits/pricing only. They are NOT load-tested. Real-D1 verification (remote HTTP API) is pending.

| Document profile scale | Rows written (one-time ingestion) | Storage (est.) | Ongoing writes/day (est.) | D1 plan fit | Monthly cost (est.) |
|------------------------|-----------------------------------|----------------|---------------------------|-------------|---------------------|
| 10k profiles | ~5M | ~100 MB | ~5K | Free tier | ~$0 (within free limits) |
| 100k profiles | ~50M | ~1 GB | ~50K | Free tier | ~$0 (within free limits) |
| 1M profiles | ~500M | ~10 GB | ~500K | Paid tier (10 GB cap) | ~$5/mo min + storage over 5 GB |

### Binding constraints
1. **10 GB per DB cap cannot be increased.** At ~1M profiles (est. 10 GB), the project hits the hard cap and must scale out to multiple D1 DBs before reaching it.
2. **Single-threaded per DB.** All queries to one DB serialize. Burst write traffic causes overload errors; independent reports show overload on small DBs.
3. **100K writes/day free tier.** At 100k profiles, one-time ingestion (~50M rows) exceeds the free daily write budget — ingestion must be spread over days or the paid tier used.
4. **5M reads/day free tier.** Read-heavy research traffic could approach this at scale; paid plan needed.
5. **50 queries/free Worker invocation (1,000 paid).** A Worker serving a read-heavy research page could burn through the free invocation query budget quickly; paid plan needed at scale.
6. **50 MB max query result.** Large export/report queries must be paginated.

### Cost model (paid)
- Storage: first 5 GB included, then $0.75/GB-month. At 10 GB: ~$3.75/mo storage + $5/mo Workers minimum ≈ ~$8.75/mo.
- Reads: first 25 billion/month included, then $0.001/million. Not binding at projected scale.
- Writes: first 50 million/month included, then $1.00/million. Not binding at projected scale.
- Extra DBs: $0.10/month per DB above 100,000. Not binding (scale-out needs far fewer DBs).

### Recommendation (B-07)
D1 remains the correct metadata store for current synthetic scale. Plan per-source/per-tenant D1 DBs with scatter-gather in the Worker **before** approaching the 10 GB cap (target: shard at ~6–7 GB, i.e. ~70–80% of cap, leaving headroom). Do not rely on `batch()` atomicity — it is sequential, recovery-safe only (commit-marker pattern already used in Gate 7).

---

## 4. D1 overload-handling design (B-14)

**Problem:** D1 is single-threaded per DB and returns overload errors when the query queue is full. Independent reports confirm overload on small DBs despite indexes/read replication/caching.

**Design pattern (recommended):**
1. **Retry read-only queries** with exponential backoff + jitter. Read-only queries are retried automatically by the Sessions API; implement application-level retry for non-session reads.
2. **Do NOT retry writes.** Writes are not retried by D1; a failed write may be partially applied. Use idempotent, recoverable writes via the commit-marker pattern (Gate 7).
3. **Surface overload as a retryable transient error** with backoff to the caller; do not fail the whole request on a single overload.
4. **Queue depth awareness:** if overload errors exceed a threshold, return 503/backpressure to the client rather than hammering D1.
5. **Read replication:** use the Sessions API for read-only queries; route writes to the primary.

**Concrete batch() context (from repo):** `packages/legal-ingestion/src/counsel-d1-store.ts` uses `this.db.batch(statements)` in `registerProfessional` (line 264), `recordDetermination` (line 464), and a private batch method (line 925). Migration `0008_gate7_registry_commit.sql` creates `counsel_registry_commits` as the commit marker — the last statement in a determination write batch, making the determination visible to authorization projection only after every related record is written. Per Cloudflare semantics, `db.batch()` runs statements sequentially (recovery-safe, not binding-atomic), so the commit marker is the correct durability mechanism.

**Implementation note:** This is a code change routed through the normal gate workflow, not implemented by research.

---

## 5. Real-D1 failure-injection test plan (B-15)

**Goal:** Confirm the commit-marker recovery pattern under real-D1 failure injection (durability/recovery behavior). Gate 7 was partial — workerd cannot start locally, so this must run against real D1 via remote HTTP API.

**What to test:**
- Write failure mid-batch: does the commit marker allow safe recovery / re-ingestion without duplication?
- Overload error injection: does retry-read / no-retry-write behave correctly?
- Time Travel restore: can a DB be restored within the 7-day (free) / 30-day (paid) window?
- Undelete: can a deleted DB be recovered within the 7-day window?

**Prerequisite:** Remote D1 access credentials (not held by this research runway; must be provided by engineering). Local workerd cannot start (TCMalloc `MmapAligned(1GiB)` fail on ARM64/PRoot).

**Status:** Not started — awaiting remote D1 access.

---

## 6. Horizontal scale-out architecture recommendation (B-19)

**Problem:** D1 is designed for many smaller (per-tenant/per-entity) databases, not one monolithic 10 GB DB. Independent community review shows a single 8.8 GB DB hitting 88% of cap with FTS5 export blocked and DO rate-limiter contention.

**Recommended design:**
1. **Per-source / per-tenant D1 databases** instead of one monolithic DB. Each Philippine source (or each customer/tenant) gets its own D1 DB.
2. **Scatter-gather in the Worker:** a request fans out queries to multiple D1 DBs (up to 6 simultaneous connections per Worker) and merges results.
3. **Shard at ~6–7 GB per DB** (70–80% of the 10 GB cap) to leave headroom before forced migration.
4. **FTS5 workaround:** `wrangler d1 export` fails on databases with virtual tables (FTS5). Drop FTS5 indexes before export, or avoid FTS5 in shards that need export.
5. **Rate-limiter DO contention:** avoid a single rate-limiter Durable Object shared across queue consumers; shard rate limiters per tenant/source.

**Migration path:** When a shard approaches the cap, split it into two shards and update the Worker's scatter-gather routing. Data lives in D1; blobs in R2 (hash + immutable key).

---

## 7. Open questions / unverified

| Question | Why unverified | Needed |
|----------|----------------|--------|
| Real-D1 binding behavior under concurrent write load | workerd cannot start locally; D1 verified remotely only | Remote D1 access |
| Workers AI model suitability for English–Filipino legal text | No benchmark | Engineering benchmark |
| Cost at 10k/100k/1M document profiles (measured) | Not load-tested; estimates from official pricing only | Remote D1 load test |
| D1 read-replication latency and consistency for authority projection | Not measured | Remote D1 test |

---

## 8. Boundary confirmation

- No legal corpus downloaded. No production DB populated. No D1 research tables created. No documents ingested. No vector index created for research. No deployment. No push. No authorization state changed.
- All estimates are based on official D1 documentation and independent experience reports (labeled as such). None are load-tested.
- Real-D1 tests (failure injection, overload, cost measurement) require remote D1 access not held by this research runway.

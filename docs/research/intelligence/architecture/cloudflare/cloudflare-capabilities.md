# G — Cloudflare Ecosystem Capability Verification

**Domain:** G (Cloudflare ecosystem)
**Research date:** 2026-11-18
**Status:** synthesized
**Source register:** `docs/research/intelligence/source-register.md` (C-01 through C-10)
**Constraint:** official Cloudflare documentation prioritized; no feature, pricing, runtime compatibility, or transaction semantics assumed.

## 1. Verified capabilities and limits (official docs, accessed 2026-11-18)

### D1 (serverless SQL)

| Capability | Verified detail |
|------------|-----------------|
| Databases per account | Free: 10. Workers Paid: 1,000,000 (first 100,000 included; $0.10/month per additional DB) |
| Max database size | Paid: 10 GB (cannot be increased). Free: 500 MB |
| Max storage per account | Paid: 1 TB. Free: 5 GB |
| Time Travel (PITR) | Paid: 30 days. Free: 7 days |
| Max Time Travel restores | 10 per 10 minutes per database |
| Queries per Worker invocation | Paid: 1,000. Free: 50. `db.batch()` counts as ONE query regardless of statement count |
| Max columns per table | 100 |
| Max rows per table | Unlimited (within per-DB storage) |
| Max string/BLOB/row size | 2,000,000 bytes (2 MB) |
| Max SQL statement length | 100,000 bytes (100 KB) |
| Max bound parameters per query | 100 |
| Max SQL query duration | 30 seconds |
| Max query result size | 50 MB (enforced from 2026-11-04) |
| Max file import (`d1 execute`) | 5 GB (uploaded to R2) |
| Simultaneous D1 connections per Worker | 6 |
| Concurrency model | Each D1 database is single-threaded; queries processed one at a time. Overload error when queue full. |
| Read replication | Sessions API; read-only queries retried automatically; writes are not retried |
| Data location / jurisdiction | `us` jurisdiction available (2026-10-02) |
| Undelete | Limited to databases deleted within last 7 days (2026-10-23) |
| HTTP API | External/non-Worker access via REST API; no transactional batch guaranteed (sequential `batch()`) |
| AI Search integration | AI Search can use a D1 database as a read-only data source (2026-11-12 changelog) |
| FTS5 | Supported in D1; but `wrangler d1 export` fails on databases with virtual tables (FT5); workaround = drop FTS5 before export |

### D1 pricing (official)

| Metric | Free | Workers Paid |
|--------|------|--------------|
| Rows read | 5 million/day | First 25 billion/month included + $0.001/million |
| Rows written | 100,000/day | First 50 million/month included + $1.00/million |
| Storage | 5 GB total | First 5 GB included + $0.75/GB-month |
| Databases | 10 | First 100,000 included + $0.10/extra DB/month |
| Data transfer/egress | None charged | None charged |

### Workers (pricing/plans)

- Free plan: limited usage.
- Paid plan: $5/month minimum; includes Workers, Pages Functions, KV, Hyperdrive, Durable Objects.

### Storage options guidance (official)

- D1: lightweight, serverless, read-heavy apps; global users benefiting from read replication; not for managing a traditional RDBMS.
- Workers KV: session storage, credentials (API keys), configuration; high read rates; **1 write RPS per unique key limit**; eventual consistency; internal cache (~500 µs–10 ms hot reads).
- Durable Objects: stateful serverless, per-user/per-customer SQL state, strict serializability; embedded SQLite per DO; 128 MB memory per DO; single-threaded execution per DO; Alarms API; zero-latency SQLite.
- D1 and Queues are built on Durable Objects.

### Workers AI / Vectorize

- Vectorize: globally distributed vector database for AI-powered apps with Workers + Workers AI.
- Workers AI: edge AI models. (Details not re-verified beyond existence.)

### Workflows / Queues / R2 / KV

- Workflows: process orchestration (durable, retryable, background).
- Queues: message processing; ingestion/embedding pipelines.
- R2: egress-free object storage (document blobs).
- KV: key-value, eventually consistent.

## 2. Independent evidence (operational experience)

- **camelAI experience report** (independent): D1 overload errors (`D1 DB is overloaded. Requests queued for too long.`) on a 5.6 MB / 15,000-row database with a few hundred queries/minute; indexes, read replication, and caching did not stop it; noisy-neighbor explanation from D1 team; moved shared DB to PlanetScale Postgres via Hyperdrive; kept Durable Objects for per-account state. DO: 128 MB memory, cold starts >10 s, restarts on deploy/runtime, reset when over memory.
- **Cloudflare community architecture review** (independent): single 8.8 GB D1 database (88% of 10 GB limit), ~40K document versions, 160K derived artifacts, 1.38M semantic index entries, 559K FTS5 rows; FTS5 export blocked; ~3,000 DO invocations per queue-consumer execution due to contention on a single rate-limiter DO; horizontal scaling = many small DBs with custom scatter-gather in the Worker.

## 3. Applicability to the project

| Project need | Cloudflare fit | Risk / note |
|--------------|---------------|-------------|
| Registry + versions | D1 (already used; Gates 1–7) | Single-threaded per DB; 10 GB cap; overload risk under burst |
| Document blobs | R2 (not yet used) | Hash + immutable key; egress-free |
| Queue-based ingestion | Queues (config exists) | Event-driven; rate-limiter DO contention risk at scale |
| Vector recall | Vectorize (roadmap) | Add only with evaluation; exact-match bypass first |
| Workers API | existing apps | Verify timeout/size limits; 6 simultaneous D1 connections |
| Audit | D1 append-only tables | Proven in Gate 7 |
| Session/credential storage | KV | 1 write RPS/key; eventual consistency — not for authorization state needing strong consistency |
| Durable workflows | Workflows | Available; not yet used |
| AI inference | Workers AI | Model/provider terms; no training on unlicensed content |

## 4. Recommendations (research-backed)

1. **Keep the Cloudflare/D1/Workers stack.** No stack replacement justified. D1's limits (10 GB per DB, single-threaded, overload risk) are documented and manageable for the current synthetic scale.
2. **Design for horizontal scale-out early.** D1 is designed for many smaller (per-tenant/per-entity) databases, not one monolithic 10 GB DB. If the corpus grows toward the 10 GB limit, plan per-source or per-tenant D1 databases with scatter-gather in the Worker — before hitting the cap.
3. **Do not rely on D1 transactional batch.** `batch()` runs statements sequentially (no atomicity proven on real D1); recovery-safe, not binding-atomic. Design idempotent, recoverable writes (already the project's pattern via commit markers, Gate 7).
4. **Use KV only for session/cache, not authorization state.** KV is eventually consistent with a 1 write RPS/key limit; authorization decisions need stronger consistency (D1).
5. **Add Vectorize only with a measured evaluation set.** Exact-match and lexical search first; vector as recall booster behind a reranker; avoid exact-citation regressions.
6. **Plan for D1 overload handling.** Retry read-only queries; do not retry writes; surface overload as a retryable transient error with backoff.
7. **Consider US jurisdiction** if Philippine data residency becomes a requirement (available since 2026-10-02).

## 5. What remains unverified

- Real-D1 binding behavior under concurrent write load (workerd cannot start locally; D1 verified remotely only).
- Workers AI model suitability for English–Filipino legal text (no benchmark).
- Cost at 10k/100k/1M document profiles (not load-tested).
- D1 read-replication latency and consistency for the authority projection.

# Source Register — Research Runway

**Research date / access date:** 2026-11-18 unless stated.
**Classification:** `PRIMARY/OFFICIAL` · `VENDOR` · `INDEPENDENT` · `SECONDARY` · `BLOCKED` · `INTERNAL`.
**Rule:** a claim without a register entry does not appear in research findings. Machine-readable links are recorded here; no full articles or PDFs are stored.

## Sources used in this runway session

| ID | Source | Publisher | URL | Date shown / accessed | Type | Claims supported | Class |
|----|--------|-----------|-----|----------------------|------|------------------|-------|
| C-01 | D1 platform limits | Cloudflare | https://developers.cloudflare.com/d1/platform/limits/ | updated 2026-10-30; accessed 2026-11-18 | PRIMARY/OFFICIAL | D1 limits: 10 DB free / 1,000,000 paid; 10 GB paid / 500 MB free per DB; 5M rows read/day free, 100K written/day free; 50 queries/Worker invocation free; 100 bound params/query; 2 MB max row; 100 KB max SQL; 30 s max query duration; 50 MB max query result (from 2026-11-04); single-threaded per DB; 6 simultaneous connections/Worker; batch() counts as one query | PRIMARY/OFFICIAL |
| C-02 | D1 platform pricing | Cloudflare | https://developers.cloudflare.com/d1/platform/pricing/ | updated 2026-10-30; accessed 2026-11-18 | PRIMARY/OFFICIAL | D1 billing: rows read/written/storage; Free 5M reads/day, 100K writes/day, 5 GB storage; Paid first 25B reads + $0.001/million, first 50M writes + $1.00/million, first 5 GB + $0.75/GB-mo, $0.10 per extra DB above 100K | PRIMARY/OFFICIAL |
| C-03 | Choose a data or storage product | Cloudflare | https://developers.cloudflare.com/workers/platform/storage-options/ | accessed 2026-11-18 | PRIMARY/OFFICIAL | D1 read-heavy/serverless; KV for session storage/credentials (1 write RPS per key); Durable Objects strict serializability + embedded SQLite; D1 HTTP API for external access; D1 not colocated with Worker code | PRIMARY/OFFICIAL |
| C-04 | Workers pricing | Cloudflare | https://developers.cloudflare.com/workers/platform/pricing/ | accessed 2026-11-18 | PRIMARY/OFFICIAL | Workers Free plan limited; Paid plan $5/month minimum; includes Workers, Pages Functions, KV, Hyperdrive, Durable Objects | PRIMARY/OFFICIAL |
| C-05 | D1 changelog (50 MB result limit) | Cloudflare | https://developers.cloudflare.com/changelog/post/2026-10-30-query-result-size-limit/ | 2026-10-30 | PRIMARY/OFFICIAL | D1 max query result size 50 MB enforced from 2026-11-04 | PRIMARY/OFFICIAL |
| C-06 | D1 changelog (undelete 7 days) | Cloudflare | https://developers.cloudflare.com/changelog/post/2026-10-23-undelete-seven-day-window/ | 2026-10-23 | PRIMARY/OFFICIAL | D1 undelete API limited to databases deleted within last 7 days | PRIMARY/OFFICIAL |
| C-07 | D1 changelog (US jurisdiction) | Cloudflare | https://developers.cloudflare.com/changelog/post/2026-10-02-us-jurisdiction/ | 2026-10-02 | PRIMARY/OFFICIAL | D1 databases can be created with `us` jurisdiction for data residency | PRIMARY/OFFICIAL |
| C-08 | D1 changelog (AI Search + D1) | Cloudflare | https://developers.cloudflare.com/changelog/product/d1/ | accessed 2026-11-18 | PRIMARY/OFFICIAL | AI Search can use a D1 database as a data source (read-only query, indexes each returned row) | PRIMARY/OFFICIAL |
| C-09 | Should you build on Cloudflare (D1/DO experience report) | camelAI (Illiana Reed) | https://camelai.com/blog/should-you-build-on-cloudflare | accessed 2026-11-18 | INDEPENDENT | D1 overload errors on 5.6 MB DB; noisy-neighbor; DO 128 MB memory, cold starts >10 s; moved shared DB to PlanetScale Postgres via Hyperdrive; kept DO for per-account state | INDEPENDENT |
| C-10 | Architecture review: single shared dataset on Cloudflare | Cloudflare community (ippolito.mike) | https://community.cloudflare.com/t/architecture-review-single-shared-dataset-high-volume-pipelines-on-cloudflare-d/960654 | 2026-09-19 | INDEPENDENT | D1 8.8 GB / 10 GB limit; FTS5 export blocked (virtual tables); 3,000 DO invocations per queue consumer due to rate-limiter DO contention; horizontal scaling = many small DBs with scatter-gather | INDEPENDENT |
| P-01 | NPC Advisory No. 2024-04 (AI guidelines) | National Privacy Commission (Philippines) | https://privacy.gov.ph/wp-content/uploads/2025/02/Advisory-2024.12.19-Guidelines-on-Artificial-Intelligence-w-SGD.pdf | issued 2024-12-19; accessed 2026-11-18 | PRIMARY/OFFICIAL | DPA applied to AI systems processing personal data: transparency, accountability, fairness, accuracy, data minimization, lawful basis, human intervention, data subject rights, PIA, privacy-by-design | PRIMARY/OFFICIAL |
| P-02 | Data Privacy Act of 2012 (RA 10173) | National Privacy Commission | https://privacy.gov.ph/data-privacy-act/ | accessed 2026-11-18 | PRIMARY/OFFICIAL | RA 10173 effective 2012-09-08; NPC regulator; protects personal data, lawful basis sections 12–13 | PRIMARY/OFFICIAL |
| P-03 | NPC data scraping advisory (2026) | DataGuidance / NPC | https://www.dataguidance.com/jurisdictions/philippines | 2026-06-15 | SECONDARY | NPC Advisory No. 2026-01 on lawful data scraping of publicly available personal data | SECONDARY |
| S-01 | OWASP LLM Top 10 (2025) | OWASP Foundation | https://owasp.org/projects/top-10-for-large-language-model-applications | accessed 2026-11-18 | INDEPENDENT | LLM01 Prompt Injection (direct + indirect) is #1; LLM02 sensitive info disclosure; LLM04 data/model poisoning; LLM07 system prompt leakage; LLM08 vector/embedding weaknesses | INDEPENDENT |
| S-02 | LLM Prompt Injection Prevention Cheat Sheet | OWASP | https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html | accessed 2026-11-18 | INDEPENDENT | Treat retrieved/user content as untrusted; separate instructions from data; constrain model actions | INDEPENDENT |
| S-03 | EchoLeak / ForcedLeak / Slack AI incidents | OWASP/Pwned Labs summary | https://pwnedlabs.io/blog/owasp-llm-top-10 | accessed 2026-11-18 | INDEPENDENT | EchoLeak CVE-2025-32711 zero-click indirect injection in M365 Copilot; ForcedLeak Salesforce Agentforce; Slack AI Aug 2024 data exfiltration via indirect injection | INDEPENDENT |
| PH-01 | LawPhil Project (Arellano Law Foundation) | Arellano Law Foundation | https://www.lawphil.net/ | live; accessed 2026-11-18 | SECONDARY | Philippine statutes/jurisprudence compilation; MC 135–140 (Oct 2026); cases 2026; disclaims accuracy; no reuse license; AsianLII mirror | SECONDARY |
| PH-02 | Supreme Court of the Philippines | SC Judiciary | https://sc.judiciary.gov.ph/ | live; accessed 2026-11-18 | PRIMARY/OFFICIAL | SC decisions, G.R. numbers, promulgation dates, court locator | PRIMARY/OFFICIAL |
| IT-01 | GlobaLex Philippine legal research | NYU Law | https://www.nyulawglobal.org/globalex/philippines.html | accessed 2026-11-18 | SECONDARY | Overview of Philippine legal system and research resources | SECONDARY |

## Pre-existing sources (international dossier, 2026-11-14)

Carried over from `docs/research/international-legal-tech/15_SOURCE_REGISTER.md` and `source-register.json` (S01–S17): Westlaw (S01), Lexis+ (S02), Vincent/vLex (S03), Bloomberg Law (S04), Harvey (S05), CoCounsel (S06), CourtListener (S07), legislation.gov.uk (S08), Stanford RegLab hallucination study (S09), SC E-Library (S10), Official Gazette (S11), LawPhil AUP (S12), Anycase (S13), Singapore Statutes Online (S14), EUR-Lex (S15), access-blocked platforms (S16), project gate docs (S17).

## Conflicts and access failures (this session)

- None new beyond the international dossier's recorded access failures (CanLII, AustLII, Indian Kanoon, HKLII, CAP blocked; EUR-Lex consolidation JS-blocked).

## Copyright and access

Only public pages, public documentation, and public data were accessed. No paywall was bypassed, no account created, no competitor database scraped or mirrored, no substantial copyrighted text reproduced. Short factual quotations used for identification only.

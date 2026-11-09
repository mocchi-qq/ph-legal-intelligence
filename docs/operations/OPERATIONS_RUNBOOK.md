# Operations Runbook — Philippine Legal Intelligence Platform

## Source Monitoring

### Daily Checks

- [ ] Verify source registry status: `pnpm source:status`
- [ ] Check ingestion queue depth: `wrangler queue list --queue ingest`
- [ ] Confirm no failed ingest jobs in the last 24h
- [ ] Update source acquisition timestamps in D1

### Weekly Checks

- [ ] Review new source additions to the registry
- [ ] Check for broken links or failed fetches in the source log
- [ ] Validate crawl rates against robots.txt for each legal source
- [ ] Update KNOWN_LIMITATIONS.md if new gaps identified

### Source Connector Status

| Source | Last Fetch | Status | Notes |
|---|---|---|---|
| Supreme Court E-Library | _(date)_ | ✅/❌ | Check PDF integrity |
| LawPhil Project | _(date)_ | ✅/❌ | Verify case completeness |
| Official Gazette | _(date)_ | ✅/❌ | Gazette publication lag |
| Agency APIs | _(date)_ | ✅/❌/⚠️ | Per-agency variation |

## Ingestion Ops

### Normal Ingestion Pipeline

1. **Fetch** — Source connector fetches new/updated documents
2. **Parse** — `document-parser` extracts text, metadata, structure
3. **Validate** — Schema validation against `legal-schema` definitions
4. **Embed** — Text chunked and embedded via Cloudflare Vectorize
5. **Store** — Metadata to D1, document to R2
6. **Queue** — Cloudflare Queues trigger downstream processing

### Failure Handling

- **Parse failure**: Document marked with `AcquisitionStatus.REJECTED`, error logged, retry queue after 1h
- **Embed failure**: Retry with exponential backoff (1m, 5m, 15m, 1h). After 3 failures, alert.
- **D1 write failure**: Retry 3 times. On persistent failure, alert and mark for manual review.
- **R2 write failure**: Alert immediately. Document metadata preserved in D1; binary re-try later.

### Manual Ingestion

```bash
# Trigger manual ingestion for a specific source
pnpm ingest:source --source=lawphil

# Re-process a single document
pnpm ingest:document --id=<doc-id>
```

## Incident Response

### Severity Classification

| Severity | Description | Response Time | Escalation |
|---|---|---|---|
| **P0 — Critical** | Platform completely down; no legal research access; data loss | 15 minutes | CTO → Engineering lead |
| **P1 — High** | Major feature broken; search producing wrong results; citation engine degraded | 1 hour | Engineering lead → Team |
| **P2 — Medium** | Minor UI issue; slow ingestion; non-critical error | 24 hours | Team lead |
| **P3 — Low** | Documentation typo; cosmetic issue; minor config | 1 week | Team lead |

### P0 Response Checklist

- [ ] Assess scope: is this frontend, backend, data, or infrastructure?
- [ ] Check recent deployments — rollback if recent change caused issue
- [ ] Verify D1 database connectivity: `pnpm db:migrate --dry-run`
- [ ] Check Cloudflare status page for outages
- [ ] Verify Wrangler version and local env compatibility
- [ ] Alert on #engineering-alerts (Slack/Discord)
- [ ] Document incident in `docs/incident-logs/` with timeline
- [ ] Post-mortem after resolution (if P0 or P1)

### Common Incidents

| Incident | First Response | Resolution |
|---|---|---|
| Search returns no results | Verify Vectorize index is populated; run `pnpm db:seed` | Re-index from source registry |
| Ingestion pipeline stuck | Check queue depth; restart worker; verify source credentials | Clear queue, fix credentials, restart |
| Citation verification timeout | Check model gateway availability; reduce concurrency | Increase timeout or fallback model |
| D1 migration failure | Review migration file for schema drift; regenerate if needed | `pnpm db:generate` then `pnpm db:migrate` |

### Post-Incident

1. Complete Incident Report template (docs/incident-logs/template.md)
2. Identify root cause
3. Add preventive action to KNOWN_LIMITATIONS.md if applicable
4. Update runbook if procedure changed
5. Notify team via daily standup

*Runbook version 1.0.0. Last updated: 2026-11-09.*
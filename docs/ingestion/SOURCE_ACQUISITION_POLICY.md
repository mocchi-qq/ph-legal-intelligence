# Source Acquisition Policy

## Five Acquisition Statuses

Every legal source in the registry is assigned exactly one of the following statuses:

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| **Approved** | Collection and intended reuse reviewed and authorized | Proceed with automated ingestion per connector spec |
| **Restricted** | Limited access or use conditions apply (e.g., rate limits, partial corpus, non-commercial only) | Document restrictions; design ingestion to comply; legal review required before production |
| **Manual** | Human-assisted collection required (e.g., no API, CAPTCHA, login, physical documents) | Define manual workflow; assign responsible personnel; log each collection |
| **Pending** | Technical or legal review outstanding | Block automated ingestion; queue for review |
| **Rejected** | Acquisition method is prohibited or unacceptable (e.g., ToS violation, copyright restriction, ethical concern) | Document reason; do not attempt collection; monitor for policy changes |

**Default status for all new sources: `Pending`**

---

## Reuse Review Requirements

Before any source is marked `Approved`, the following must be documented:

1. **Copyright / License Analysis**
   - Identify copyright holder
   - Determine license terms (if any)
   - Assess fair use / statutory exceptions for Philippine law
   - Document whether bulk download and redistribution (internal or derived) is permitted

2. **Terms of Service Review**
   - Read and archive source website ToS
   - Identify clauses on scraping, bulk access, commercial use
   - Determine if API terms differ from website ToS

3. **Technical Feasibility**
   - Document access method (API, RSS, HTML scraping, manual download)
   - Assess rate limits, authentication, pagination
   - Estimate ingestion time and resource cost

4. **Data Quality Assessment**
   - Sample 50+ documents for extraction accuracy
   - Measure metadata completeness (dates, docket numbers, parties)
   - Identify duplicate rates within and across sources

5. **Legal Risk Sign-off**
   - Philippine counsel reviews reuse analysis
   - Written approval recorded in source registry
   - Sign-off date and reviewer stored

---

## No-Bypass Rules (Non-Negotiable)

The ingestion system **must not**:

- Circumvent authentication (login walls, API keys not issued to us)
- Bypass CAPTCHAs or bot detection
- Ignore robots.txt disallow directives for legal content
- Access paywalled content without authorized subscription
- Use credentials not explicitly granted to the platform
- Exceed published rate limits
- Store or redistribute content where reuse_review = "required" and status ≠ "Approved"

Violations of these rules are security incidents and must be reported per `SECURITY.md`.

---

## Acquisition Workflow

```
Source Discovery
      ↓
Add to Registry (status: Pending)
      ↓
Technical Assessment (connector spec)
      ↓
Legal Reuse Review (counsel sign-off)
      ↓
Status → Approved / Restricted / Manual / Rejected
      ↓
If Approved: Build Connector → Test → Deploy
If Restricted: Document Constraints → Conditional Deploy
If Manual: Define SOP → Assign Owner → Schedule
If Rejected: Archive Reason → Monitor Quarterly
```

---

## Source Registry Fields

Every source record must contain:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| source_id | string | Yes | Unique, lowercase, snake_case |
| name | string | Yes | Human-readable |
| institution | string | Yes | Issuing authority |
| authority_level | enum | Yes | official_primary, official_secondary, unofficial |
| jurisdiction | string | Yes | ISO 3166-1 alpha-2 (e.g., "PH") |
| coverage | string[] | Yes | Controlled vocabulary tags |
| acquisition_status | enum | Yes | Approved, Restricted, Manual, Pending, Rejected |
| access_method | string | Yes | reviewed_connector, manual, api, rss, etc. |
| reuse_review | enum | Yes | required, completed, not_applicable |
| last_checked_at | ISO 8601 / null | Yes | When source was last verified accessible |
| last_successful_sync_at | ISO 8601 / null | Yes | When ingestion last completed successfully |

---

## Update Cadence

- **Quarterly**: Review all `Pending` and `Restricted` sources for status changes
- **Per-release**: Verify `last_successful_sync_at` for all `Approved` sources
- **On legal change**: Re-evaluate `reuse_review` if source ToS or copyright law changes
- **On error**: Failed ingestion → increment retry → alert → if persistent, downgrade to `Manual` or `Rejected`

---

## Local Ordinance Sources (Tier 4)

Special handling required:

- No centralized registry exists for all LGU ordinances
- Geographic metadata mandatory: `region → province → city/municipality → barangay`
- Each LGU source requires individual reuse review
- Do not claim nationwide coverage without measured evidence
- Track coverage percentage per region in `docs/architecture/KNOWN_LIMITATIONS.md`

---

## Documentation

- All reuse review evidence stored in `legal-data/source-registry/evidence/`
- Legal counsel sign-offs stored with source_id and date
- Connector specs in `apps/ingestion/src/connectors/{source_id}/`
- This policy reviewed annually or on major legal change
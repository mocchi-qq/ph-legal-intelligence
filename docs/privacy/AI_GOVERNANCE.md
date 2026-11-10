# AI Governance — Philippine Legal Intelligence Platform

**Version:** Gate 0 Specification
**Last Updated:** 2026-11-09
**Primary Benchmark:** Supreme Court of the Philippines, A.M. No. 25-11-28-SC (February 18, 2026), Governance Framework on Human-Centered Augmented Intelligence in the Judiciary. Also aligned with NPC Guidelines on Artificial Intelligence.

> **Scope note:** A.M. No. 25-11-28-SC governs the Judiciary. This platform is a private provider, so the framework is adopted as a design benchmark and not misrepresented as a blanket regulation binding private legal AI. It represents best-practice alignment with Philippine public-sector AI governance.

---

## 1. Governing Principles (mapped from A.M. No. 25-11-28-SC)

| Principle | Framework Expectation | Platform Commitment |
|-----------|----------------------|---------------------|
| Fairness | AI must not produce discriminatory or biased outcomes | Benchmark across legal domains; bias review; diverse evaluation set |
| Accountability | Clear human responsibility for AI-assisted outputs | Named owners; audit trails; human sign-off for professional outputs |
| Transparency | Users understand AI capabilities and limits | Disclosures; source citations; model/version reporting |
| Privacy | Personal data protected per DPA and NPC guidance | Privacy Specification; minimization; no default training |
| Security | Systems robust against misuse and attack | Security Architecture; prompt-injection defense; tenant isolation |
| Robustness | Reliable behavior under edge cases | Abstention policy; red-team testing; fallback providers |
| Human Oversight | Humans retain meaningful control | Human-in-the-loop gates; no autonomous legal conclusions |
| Data Governance | Legal data sourced, versioned, and traceable | Canonical document model; provenance; immutable versions |

---

## 2. Human-in-the-Loop Requirements

### 2.1 Mandatory Human Review

| Output | Human Review Required | Rationale |
|--------|----------------------|-----------|
| Public legal information | No (AI-generated, labeled) | Low risk; informational |
| Research answers (educational) | No (labeled, cited) | Educational; citations verifiable |
| Professional research answers | Recommended | Professional reliance risk |
| Generated drafts | **Yes — before finalization** | Legal effect; professional responsibility |
| Case digests / doctrine extraction | **Yes — before publication as authoritative** | Accuracy-critical |
| Citation verification flags | Human confirms `NEEDS_REVIEW` items | Release-critical |
| "Good law" status | **Yes — never auto-displayed as authoritative** | Subsequent-treatment complexity |
| Any output used in a court filing | **Yes — attorney of record** | Professional responsibility |

### 2.2 Prohibited Autonomous Actions

The system **must not**, without human authorization:

- File documents with any court or agency
- Issue legal advice as a licensed professional
- Declare a case overruled/reversed as authoritative fact
- Delete or overwrite original legal source documents
- Publish AI summaries as authoritative primary sources
- Make binding decisions affecting a person's legal rights

---

## 3. Transparency Requirements

Every AI-assisted output must make visible:

- That AI was used
- Which model/provider and version
- The date/time of generation
- Retrieval configuration and corpus cutoff
- Citations with verification status
- A clear "verify against original source" notice for legal content
- Known limitations relevant to the answer

### 3.1 Answer Provenance Record

```json
{
  "answer_id": "uuid",
  "generated_at": "ISO-8601",
  "model": { "provider": "...", "model_id": "...", "version": "..." },
  "prompt_version": "...",
  "retrieval_config": { "lexical_weight": 0.4, "semantic_weight": 0.6, "rerank_top_k": 50 },
  "corpus_cutoff": "YYYY-MM-DD",
  "document_versions_used": ["..."],
  "retrieved_passages": ["..."],
  "citation_verification": ["..."],
  "human_reviewed": false,
  "disclosure_shown": true
}
```

---

## 4. Accuracy and Quality Governance

- Every release passes the legal benchmark (docs/ai-evaluation/LEGAL_BENCHMARK.md)
- Citation identity and passage verification are release-blocking
- Unsupported certainty is release-blocking (zero tolerance)
- Model changes require re-evaluation before deployment
- Continuous source monitoring keeps the corpus current
- Red-team scenarios run before each major release

### 4.1 Release Gates (aligned with dossier §15.3)

| Gate | Requirement |
|------|-------------|
| Canonical identity accuracy | ≥99% on audited records |
| Citation identity accuracy | ≥99% |
| Citation passage accuracy | ≥98% |
| Material claims with traceable support | 100% |
| Historical law selection | ≥98% on benchmark |
| Retrieval Recall@10 | ≥95% |
| Cross-tenant data leakage | 0 |
| Critical security vulnerabilities | 0 |
| Unverified source presented as verified | 0 |
| Unsupported legal certainty | 0 in release benchmark |

---

## 5. Data Governance for Legal Corpora

- Original sources preserved with checksums and provenance
- Immutable document versions; no silent overwrites
- Every correction is an audited event preserving the original
- Source acquisition only with documented reuse review
- Temporal model distinguishes publication/approval/promulgation/effectivity/amendment/repeal dates
- Provenance required on every published legal document

---

## 6. Model Governance Lifecycle

1. **Selection:** Evaluate candidate models against legal benchmark
2. **Approval:** Document decision (ADR), record limitations
3. **Deployment:** Pin version; configure in model gateway
4. **Monitoring:** Track quality, latency, cost, drift
5. **Re-evaluation:** On model update, quarterly review
6. **Retirement:** Planned migration with rollback

### 6.1 Model Risk Register (initial)

| Risk | Description | Mitigation |
|------|-------------|------------|
| Hallucinated citations | Model invents authorities | Four-layer citation verification; abstention |
| Outdated law | Model uses superseded text | Temporal retrieval; corpus cutoff disclosure |
| Provider outage | Single point of failure | Multi-provider gateway; fallback |
| Data leakage to provider | Confidential prompt exposure | DPAs; local/self-hosted option for sensitive |
| Model drift | Quality regression after update | Benchmark gating; version pinning |
| Prompt injection | Malicious document instructions | Static system prompts; isolation |

---

## 7. Accountability Structure

| Role | Responsibility |
|------|----------------|
| Data Protection Officer | Privacy compliance, DPIAs, DSRs, breach notification |
| AI Governance Lead | Model lifecycle, evaluation, disclosures |
| Legal Content Reviewer | Source verification, corrections, publication approval |
| Security Lead | Threat model, incident response, audits |
| Engineering Lead | Architecture, release gates, reproducibility |

---

## 8. Complaints and Redress

- Users can report incorrect legal information and citation errors
- Every correction creates an audited event
- Escalation path documented for unresolved accuracy disputes
- NPC complaint process referenced for privacy matters

---

## 9. Review and Evolution

This governance document is reviewed:
- Annually
- On new Supreme Court, NPC, or legislative guidance
- On material architecture or model change

Last review: 2026-11-09. Next review: 2027-11-09 or on regulatory change.
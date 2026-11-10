# Citation Verification Engine

Status: Gate 0 specification
Owners: Citation Engine working group
Last updated: 2026-11-09

This document specifies the four-layer citation verification engine for the
Philippine Legal Intelligence Platform. It defines the verification pipeline,
result schema, citation display formats, and the unsupported-answer policy that
governs AI behavior when citations cannot be verified.

## 1. Four-Layer Verification Model

Every citation passes through four independent verification layers. A citation
is only considered fully verified when all four layers pass.

### Layer 1 — Identity (Does the authority exist?)

**Question:** Does the cited legal authority (court, legislature, agency) exist
and have the claimed jurisdiction?

**Checks:**

- Court exists in the Supreme Court / Court of Appeals / RTC registry
- Republic Act number exists in the Official Gazette index
- Executive Order number matches Presidential Records
- Agency has rulemaking authority for the cited regulation
- Treaty is ratified and published

**Evidence sources:** SC E-Library, Official Gazette, agency websites, treaty
depositaries.

**Failure modes:** Fabricated case names, invented RA numbers, non-existent
agencies, repealed courts.

### Layer 2 — Location (Does the cited section/passage exist?)

**Question:** Does the specific section, paragraph, or page cited actually exist
in the identified authority?

**Checks:**

- Case: Paragraph number exists in the decision text
- Statute: Section/article number exists in the enrolled bill text
- Regulation: Section exists in the published IRR
- Page/paragraph references resolve to actual text spans
- Pinpoint citations map to `DocumentChunk` with valid `charStart`/`charEnd`

**Evidence sources:** Canonical `DocumentVersion`, `LegalProvision`, and
`DocumentChunk` records with provenance to `SourceManifestation`.

**Failure modes:** Hallucinated paragraph numbers, section references beyond
document length, citations to non-existent provisions.

### Layer 3 — Support (Does the passage support the proposition?)

**Question:** Does the cited text actually say what the answer claims it says?

**Checks:**

- Semantic entailment: cited passage → proposition (not mere keyword overlap)
- No cherry-picking: surrounding context does not contradict the claim
- Quoted text matches the canonical text exactly (allowing normalization)
- Legal principle cited is the holding, not dicta (for cases)
- Provision cited is the operative text, not a repealed version

**Evidence sources:** LLM-based entailment check with highlighted spans,
`LegalProvision.legalStatus` to exclude repealed text.

**Failure modes:** Misquotation, taking dicta as holding, citing repealed
provisions, overgeneralizing a narrow holding.

### Layer 4 — Temporal Validity (Does it apply to the relevant date?)

**Question:** Was the cited authority in force on the date relevant to the
legal question?

**Checks:**

- `effectivityDate <= relevantDate < effectiveTo` (or `effectiveTo` is null)
- For cases: decision not reversed or overruled as of relevant date
- For statutes: not repealed, not amended in relevant provisions
- Amendment history traced via `DocumentRelationship` edges (`AMENDS`,
  `REPEALS`, `SUPERSEDES`)
- Point-in-time retrieval uses provision-level `effectiveFrom`/`effectiveTo`

**Evidence sources:** `LegalProvision` temporal fields, `DocumentRelationship`
graph, `LegalStatus` enum.

**Failure modes:** Citing law before effectivity, citing repealed provision,
ignoring amendment that changed the cited text, using superseded case law.

---

## 2. Citation Verification Result Schema

```typescript
enum VerificationLayer {
  IDENTITY = "IDENTITY",
  LOCATION = "LOCATION",
  SUPPORT = "SUPPORT",
  TEMPORAL_VALIDITY = "TEMPORAL_VALIDITY",
}

interface LayerResult {
  passed: boolean;
  evidence?: string;
  notes?: string;
}

type LayerResults = Record<VerificationLayer, LayerResult>;

enum VerificationMethod {
  AUTOMATED = "AUTOMATED",
  MANUAL = "MANUAL",
  HYBRID = "HYBRID",
}

enum VerificationStatus {
  VERIFIED = "VERIFIED",
  PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED",
  FAILED = "FAILED",
  PENDING = "PENDING",
}

interface CitationVerificationResult {
  citationId: string;
  documentId: string;
  passageId: string;
  citationText: string;
  identityVerified: boolean;
  passageVerified: boolean;
  propositionSupported: boolean;
  temporalValidity: boolean;
  verificationMethod: VerificationMethod;
  verificationStatus: VerificationStatus;
  layerResults: LayerResults;
}
```

### Field Definitions

| Field                  | Type                 | Description                                                                    |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------ |
| `citationId`           | `string`             | UUID for this verification run                                                 |
| `documentId`           | `string`             | `LegalDocument.id` of the cited authority                                      |
| `passageId`            | `string`             | `DocumentChunk.id` or `LegalProvision.id` cited                                |
| `citationText`         | `string`             | Human-readable citation (e.g., "People v. Smith, G.R. No. 12345, Jan 15 2020") |
| `identityVerified`     | `boolean`            | Layer 1 result                                                                 |
| `passageVerified`      | `boolean`            | Layer 2 result                                                                 |
| `propositionSupported` | `boolean`            | Layer 3 result                                                                 |
| `temporalValidity`     | `boolean`            | Layer 4 result                                                                 |
| `verificationMethod`   | `VerificationMethod` | How verification was performed                                                 |
| `verificationStatus`   | `VerificationStatus` | Aggregated status                                                              |
| `layerResults`         | `LayerResults`       | Per-layer detail with evidence/notes                                           |

### Aggregation Rules

- `VERIFIED`: All four layers `passed === true`
- `PARTIALLY_VERIFIED`: At least one layer passed, at least one failed
- `FAILED`: All layers failed, or critical layer (Identity/Location) failed
- `PENDING`: Verification not yet attempted

---

## 3. Citation Display Formats

### 3.1 Case Citations

**Format:** `Case Title, G.R. No. XXXXX, Month DD, YYYY, Court, Source, Paragraph [Open Original]`

**Example:**  
`People of the Philippines v. Juan Dela Cruz, G.R. No. 256789, January 15, 2024, Supreme Court En Banc, Official Gazette, ¶ 12 [Open Original]`

**Fields:**

- `caseTitle`: Full case title as promulgated
- `grNumber`: `docketNumber` from `LegalDocument`
- `promulgationDate`: `promulgationDate` from `LegalDocument`
- `court`: `issuingBody` (e.g., "Supreme Court En Banc", "Court of Appeals")
- `source`: `SourceManifestation.sourceType` + authority level badge
- `paragraph`: Pinpoint citation to `DocumentChunk` or `LegalProvision`
- `openOriginal`: Link to `SourceManifestation.storageKey` (presigned URL)

### 3.2 Legislation Citations

**Format:** `Republic Act No. XXXX, § X, Approved Month DD, YYYY, Effectivity Month DD, YYYY, Amendment History [Official Source]`

**Example:**  
`Republic Act No. 11900, § 5, Approved July 30, 2022, Effectivity August 14, 2022, Amended by RA 12001 (2024) [Official Gazette]`

**Fields:**

- `raNumber`: Republic Act number (or CA/PD/BP/EO/AO as applicable)
- `section`: `LegalProvision.label` (e.g., "Section 5", "Article 3")
- `approvedDate`: `approvalDate` from `LegalDocument`
- `effectivityDate`: `effectivityDate` from `LegalDocument`
- `amendmentHistory`: Chain from `DocumentRelationship` edges (`AMENDS`, `REPEALS`)
- `officialSource`: Primary `SourceManifestation` with `authorityLevel = official_primary`

---

## 4. Unsupported-Answer Policy

The AI **must refuse** to make definitive legal claims when any of the
following conditions hold. The response must explicitly state the refusal
reason and surface the verification gaps.

| Condition                               | Refusal Template                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No supporting authority found           | "I cannot find a controlling authority for this proposition. [Details of search performed]."                                                                    |
| Source unavailable                      | "The cited source [citation] is not available in the platform's verified corpus. [Reason: not ingested / access restricted / conflicting manifestations]."      |
| Law version cannot be established       | "I cannot determine which version of [law] applies to your date [date]. The amendment history shows [conflict/gap]."                                            |
| Authorities conflict                    | "There is a conflict between [authority A] and [authority B] on this point. [Summary of conflict]. This requires legal analysis beyond automated verification." |
| Cited passage doesn't support statement | "The passage cited ([citation]) does not support the proposition that [claim]. The text states: '[excerpt]'."                                                   |
| Question depends on facts not provided  | "This question depends on factual determinations not provided (e.g., [missing fact]). I can explain the legal framework but cannot apply it."                   |

### Enforcement

- The citation verification engine returns `verificationStatus` for every
  citation used in an answer.
- The answer generation pipeline **must** check all citations before
  finalizing output.
- If any citation is anything other than `VERIFIED` — i.e. `FAILED`,
  `PENDING`, or `PARTIALLY_VERIFIED` (any layer failed) — the answer must
  either:
  1. Remove the unsupported claim, or
  2. Add the appropriate refusal notice per the table above.
- A `PARTIALLY_VERIFIED` citation may never be presented as fully verified,
  and must carry a notice naming the failed layer (e.g. support).
- Answers with zero verified citations must not present legal conclusions as
  definitive.

---

## 5. Verification Pipeline Interface

```typescript
interface CitationInput {
  citationText: string;
  documentId?: string; // If known
  passageId?: string; // If known
  proposition: string; // The claim the citation is offered to support
  relevantDate?: string; // ISO date for temporal validity (Layer 4)
}

interface CitationVerifier {
  verify(citation: CitationInput): Promise<CitationVerificationResult>;
}
```

### Implementation Notes

- **Layer 1 (Identity):** Resolve `citationText` → `LegalDocument` via
  identity resolution keys (docket number, RA number, `identityKey`).
  Check `authorityLevel` and `verificationStatus`.
- **Layer 2 (Location):** Resolve `passageId` or pinpoint citation →
  `DocumentChunk`/`LegalProvision`. Validate `charStart`/`charEnd` against
  `DocumentVersion.normalizedText`.
- **Layer 3 (Support):** Run entailment check: `passageText` entails
  `proposition`? Use structured prompt with highlighted spans. Flag dicta vs.
  holding for cases.
- **Layer 4 (Temporal Validity):** Evaluate `LegalProvision` temporal status
  at `relevantDate` (or `promulgationDate` for cases). Check
  `DocumentRelationship` for amendments/repeals after `relevantDate`.

---

## 6. Invariants

1. Every citation in an AI answer has a `CitationVerificationResult`.
2. `layerResults` contains all four `VerificationLayer` keys.
3. `verificationStatus` is derived from `layerResults` per aggregation rules.
4. A `FAILED` Identity or Location layer → overall `FAILED` (cannot verify
   what doesn't exist).
5. `citationText` in result matches the citation displayed to the user.
6. `evidence` in `LayerResult` is human-readable and auditable.
7. `VerificationMethod.AUTOMATED` results are flagged for periodic human audit.

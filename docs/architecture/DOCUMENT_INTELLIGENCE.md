# Document Intelligence

Status: Gate 0 specification
Owners: Document Intelligence working group
Last updated: 2026-11-09

This document specifies how the platform ingests, stores, parses, indexes and
drafts legal documents. It covers the upload pipeline, prompt injection defense,
the supported drafting categories, the editor surface and the human approval
requirement. It is the reference for `@phli/document-parser` and
`@phli/document-engine`.

## 1. Design principles

1. **Tenant isolation by default.** No document, extracted chunk, embedding or
   draft may be read across tenants. Enforcement is layered: object key prefixes,
   database `tenant_id` columns with row-level security (RLS), and a
   tenant-scoped vector index.
2. **Untrusted input.** Every uploaded file is untrusted data, never an
   instruction to a model or a human operator.
3. **No autonomous filing.** The platform assists a lawyer. It never files,
   serves or finalizes a document without human approval.
4. **Minimize and expire.** Documents are retained only as long as the matter
   and applicable obligations require, then deleted.

## 2. Document upload pipeline

Uploads are synchronous to accept and asynchronous to process. Each step is
recorded in an audit trail keyed by `document_id` and `tenant_id`.

```
client ──▶ API (auth + tenant check)
            │
            ▼
     private R2 bucket (original, encrypted)
            │
            ▼
   file validation ──▶ reject on failure
            │
            ▼
   malware scan (ClamAV) ──▶ quarantine on detection
            │
            ▼
   text extraction / OCR (scanned PDFs, images)
            │
            ▼
   sensitive data detection
            │
            ▼
   normalize + chunk (page/section aware)
            │
            ▼
   embeddings ──▶ tenant-isolated index
            │
            ▼
   parser (structure + clauses) ──▶ document-parser
```

### 2.1 Storage: private R2

- Originals are written to a **private R2 bucket**. Public access and public
  bucket domains are disabled; all reads go through the API with an
  authorization check.
- Object keys are opaque and namespaced by tenant:
  `tenants/<tenant_id>/documents/<document_id>/<uuid>`. Client filenames are
  stored as metadata only, never used as keys.
- Objects are encrypted at rest (R2 default) and in transit (TLS). Presigned
  URLs are short-lived, single-purpose and scoped to the authenticated tenant.
- Object versioning is enabled so a mistaken overwrite is recoverable.

### 2.2 File validation

Before any parsing or storage of derived data:

- Allowlist MIME types and extensions: PDF, DOCX, DOC, TXT, RTF, PNG, JPEG,
  TIFF. Anything else is rejected.
- Verify the declared MIME type against magic bytes; a mismatch is rejected.
- Enforce size limits (per-file and per-tenant quota).
- Reject encrypted PDFs that cannot be opened, and archive formats.
- Reject oversized page counts before OCR to bound compute.
- Record a rejection reason in the audit trail without storing the payload.

### 2.3 Malware scan

Every uploaded file is **malware scanned** before it reaches text extraction,
OCR or any model. Scans use ClamAV (antivirus signatures refreshed continuously).

- The file is written to a quarantine prefix first. It is only promoted to the
  document prefix after a clean scan.
- A positive detection moves the object to quarantine, blocks processing,
  notifies the tenant administrator and records the signature that matched.
- Scan failure (timeout, scanner unavailable) is fail-closed: the document stays
  in quarantine and is retried; it is never parsed.
- Files are re-scanned if the scanner version changes and the document is still
  within retention.

### 2.4 OCR and text extraction

- Digital PDFs and DOCX use native text extraction first.
- Scanned PDFs and images fall back to OCR. OCR output carries a confidence
  score; low-confidence pages are flagged in `ParseResult.warnings`.
- Layout is retained where possible (headings, numbered paragraphs, tables) to
  inform structure detection.
- OCR text is untrusted and is never concatenated into a system prompt.

### 2.5 Sensitive data detection

After extraction, the pipeline classifies and tags:

- Personal identifiers (names, addresses, dates of birth, contact details).
- Government identifiers (TIN, SSS, GSIS, PhilHealth, passport, driver's
  licence).
- Financial data (account numbers, amounts) and health data.
- Privileged material (attorney-client communications, work product).

Detection drives redaction before indexing, stricter access controls and
retention rules. Detected sensitive fields are logged by type and location, not
by value, in application logs.

### 2.6 Chunking

- Chunk on document structure first (section, numbered paragraph), then by token
  budget with overlap.
- Every chunk stores `tenant_id`, `document_id`, page and character offsets so
  citations can be resolved back to the source.
- Chunk text is normalized (whitespace, ligatures) but never paraphrased before
  indexing.
- Chunk metadata records the parser version and OCR confidence.

### 2.7 Tenant-isolated indexing

- Embeddings and lexical indexes are namespaced by `tenant_id`. Vector queries
  always carry a mandatory tenant filter; the filter is applied in the query
  layer, not only in application code.
- The index never mixes tenants in one namespace, so a retrieval cannot leak a
  neighbouring tenant's document even if a prompt is manipulated.
- Cross-tenant isolation is verified by tests that attempt retrieval with a
  forged tenant context and expect zero results.

## 3. Prompt injection defense

Uploaded documents are adversarial input. A contract clause, a footnote or
white-on-white text can contain instructions aimed at the model.

Defenses, in order:

1. **Treat document content as data, not instructions.** Extracted text is
   wrapped in a delimited, labelled data block. System prompts state that
   content inside the block is evidence to analyse, never a command.
2. **Instruction stripping.** Known injection patterns ("ignore previous
   instructions", role-play, tool-call requests, exfiltration URLs) are detected
   and neutralized; matches are recorded as warnings on the parse result.
3. **No tool authority from document text.** Document content cannot trigger
   tools, file writes, network calls or citation insertion. Only the
   authenticated user's explicit action can.
4. **Least privilege retrieval.** Retrieved chunks are limited to the requesting
   tenant and matter; the model cannot be steered into reading another tenant's
   documents.
5. **Output validation.** Generated drafts and answers are checked for
   unsupported citations and unexpected URLs before display.
6. **Human review.** Every AI-assisted output is advisory and must be reviewed
   by a lawyer before use.

Injection attempts are logged with the document, page and matched pattern for
security review. They do not automatically delete the document; they raise its
risk flag.

## 4. Supported drafting categories

The drafting engine ships curated template families for:

| Category                  | Internal key                | Typical use                                    |
| ------------------------- | --------------------------- | ---------------------------------------------- |
| Affidavit                 | `affidavit`                 | Sworn statements of fact                       |
| Demand letter             | `demand_letter`             | Pre-litigation demands and money claims        |
| Special power of attorney | `special_power_of_attorney` | Limited authority for a specific act           |
| Motion                    | `motion`                    | Relief sought in a pending case                |
| Pleading                  | `pleading`                  | Complaints, answers, replies and other filings |
| Corporate resolution      | `corporate_resolution`      | Board or stockholder approvals                 |
| Employment agreement      | `employment_agreement`      | Hiring terms, confidentiality, termination     |

Each category defines required sections, jurisdiction-specific formatting,
caption blocks for Philippine courts and a checklist of mandatory attachments.
Templates are versioned; a draft records the template version it was created
from.

## 5. Editor features

The drafting editor is a rich-text editor backed by structured sections rather
than a single opaque blob.

- **Structured sections** with headings, numbering and required-section
  validation.
- **Rich-text editor** with headings, lists, tables, page breaks and legal
  numbering (Roman, alpha, decimal).
- **Template insertion** from the category template family, with placeholders
  for party names, dates and amounts.
- **Inline assistance**: suggest, rewrite, cite and summarize against the
  selected section. Suggestions are shown in a side panel, never auto-inserted,
  and every accepted suggestion creates a new draft version.
- **Citation attachment**: verified citations from the citation engine can be
  attached to a section; unverified citations are visibly flagged.
- **Version history**: every save, accepted suggestion and review action creates
  an immutable `DraftVersion` with author, timestamp and change summary.
- **Comparison view** between any two versions.
- **Export** to PDF and DOCX (and Markdown/TXT for internal use) from a
  finalized version only.

## 6. Human approval requirement

**No draft is finalized, filed, served or exported as an execution copy without
human approval.**

- A draft moves `draft → in_review → approved → finalized`. Transitions to
  `approved` and `finalized` require an authenticated lawyer reviewer.
- The approving reviewer is recorded on the version (`approvedBy`,
  `approvedAt`) together with an audit event.
- AI output is labelled as a suggestion everywhere it appears; it never carries
  the reviewer's identity.
- The system shall not file or transmit a document on its own. Filing is a
  separate, explicit user action outside the drafting engine.
- If the approved content changes, approval is invalidated and the draft returns
  to `in_review`.

## 7. Retention and deletion

- Each tenant configures a retention period per document class, bounded by
  applicable professional and data-protection rules.
- Documents past retention are deleted from R2, the parser store, the chunk
  store and the tenant-isolated index. A deletion tombstone is kept for audit
  without content.
- Tenant offboarding triggers deletion of all document objects and derived data
  within the contractual window.
- Data-subject requests (right to erasure) are honoured by locating all chunks
  and embeddings for the subject's documents and deleting them; the audit trail
  records the request without retaining the erased content.
- Legal holds suspend deletion until released; the hold is itself audited.
- Backups expire on a defined schedule so deleted content does not persist
  indefinitely.

## 8. Interfaces

- `@phli/document-parser` exports `ParseResult`, `DocumentStructure`,
  `ExtractedClause` and `ParserOptions`.
- `@phli/document-engine` exports `Draft`, `DraftVersion`, `Template`,
  `ExportFormat`, `DraftSection`, `InlineAssistance` and `CitationAttachment`.
- Types are the contract between the API, worker and editor; they intentionally
  contain no runtime behaviour in Gate 0.

## 9. Threats and controls

| Threat                             | Control                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| Malicious upload                   | Allowlist validation, malware scanning, quarantine, fail-closed  |
| Prompt injection via document text | Data-delimited prompts, instruction stripping, no tool authority |
| Cross-tenant data leak             | Tenant-keyed storage, `tenant_id` + RLS, tenant-isolated index   |
| Sensitive data exposure            | Detection, redaction before indexing, access controls            |
| Unauthorized filing                | Human approval gate, immutable version audit                     |
| Indefinite retention               | Per-class retention, deletion jobs, legal holds                  |

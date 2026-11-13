// @phli/legal-schema — Core legal data model interfaces
//
// The model has four objects, layered from the physical to the computed:
//
//   1. SOURCE        SourceManifestation  — one retrieval of a document from one source
//   2. CANONICAL     LegalDocument         — the identity of the legal instrument itself
//                    DocumentVersion       — an authoritative version of that instrument
//   3. EXTRACTED     ExtractedText         — machine-readable text from one manifestation
//                    LegalProvision        — a provision within a version (amendment-tracked)
//   4. CHUNKS        DocumentChunk         — a retrievable slice of extracted text
//
// DocumentCitation, DocumentRelationship and VerificationRecord are edges and
// records that bind the four objects together. See
// docs/architecture/LEGAL_DATA_MODEL.md and LEGAL_TEMPORAL_MODEL.md.

import type {
  AcquisitionStatus,
  AuthorityLevel,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "./taxonomy";

/** An ISO-8601 calendar date, e.g. `1987-02-02`. */
export type IsoDateString = string;

/** An ISO-8601 instant with timezone, e.g. `2026-11-09T12:00:00Z`. */
export type IsoDateTimeString = string;

/** The kind of edge between two canonical documents. */
export type DocumentRelationshipType =
  | "AMENDS"
  | "PARTIALLY_AMENDS"
  | "REPEALS"
  | "PARTIALLY_REPEALS"
  | "SUPERSEDES"
  | "IMPLEMENTS"
  | "INTERPRETS"
  | "APPLIES"
  | "DISTINGUISHES"
  | "REVERSES"
  | "MODIFIES"
  | "CITES"
  | "CONSOLIDATES"
  | "DERIVES_FROM"
  | "RELATED";

/** The structural level a provision occupies within a document. */
export type ProvisionType =
  | "PREAMBLE"
  | "ARTICLE"
  | "SECTION"
  | "RULE"
  | "PARAGRAPH"
  | "SUBPARAGRAPH"
  | "CLAUSE"
  | "ITEM";

/** The pipeline stage a chunk is destined for. */
export type ChunkKind =
  | "provision"
  | "paragraph"
  | "table"
  | "footnote"
  | "page";

/** How a document was verified. */
export type VerificationMethod =
  | "automated"
  | "manual"
  | "cross_source"
  | "operator_asserted";

/**
 * Object 2 (canonical): the identity of a legal instrument, independent of any
 * one file, source or extraction. Dates beyond `promulgationDate` are optional
 * because not every instrument type is promulgated the same way — statutes are
 * approved and published, decisions are promulgated, ordinances are enacted.
 */
export interface LegalDocument {
  id: string;
  documentType: DocumentType;
  title: string;
  shortTitle?: string | null;
  /** The canonical, human-facing citation, e.g. `G.R. No. 123456`. */
  citationText?: string | null;
  /** Court docket / G.R. number, where applicable. */
  docketNumber?: string | null;
  /** The body that issued the instrument. */
  issuingBody?: string | null;
  /** Jurisdiction code, e.g. `PH` or a local government unit code. */
  jurisdiction?: string | null;
  /** Date the instrument was promulgated (decisions, rules). */
  promulgationDate?: IsoDateString | null;
  /** Date the instrument was approved/signed (statutes, executive orders). */
  approvalDate?: IsoDateString | null;
  /** Date the instrument was published (Official Gazette, newspaper). */
  publicationDate?: IsoDateString | null;
  /** Date the instrument took effect. */
  effectivityDate?: IsoDateString | null;
  /** Date of the most recent amendment, if any. */
  amendmentDate?: IsoDateString | null;
  /** Date the instrument was repealed, if any. */
  repealDate?: IsoDateString | null;
  legalStatus: LegalStatus;
  verificationStatus: VerificationStatus;
  authorityLevel: AuthorityLevel;
  /** The source registry entry this document was first acquired from. */
  sourceId?: string | null;
  /** Stable identity key used for deduplication across sources. */
  identityKey?: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

/**
 * Object 2 (canonical): an authoritative version of a document. A document has
 * at least one version; amendments and consolidations create new versions
 * without mutating prior ones.
 */
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  versionLabel?: string | null;
  /** Hash of the normalized canonical text, used for change detection. */
  contentHash: string;
  /** First date this version is legally in effect. */
  effectiveFrom?: IsoDateString | null;
  /** Date this version ceased to be in effect, null if current. */
  effectiveTo?: IsoDateString | null;
  isCurrent: boolean;
  /** Human-readable summary of what changed from the previous version. */
  changeSummary?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * Object 1 (source): one manifestation of a document at one source — a PDF on
 * the Supreme Court website, an HTML page on the Official Gazette, a scan of a
 * printed copy. Many manifestations may map to a single canonical document.
 */
export interface SourceManifestation {
  id: string;
  documentId?: string | null;
  /** Source registry entry this manifestation came from. */
  sourceId: string;
  sourceUrl: string;
  /** e.g. `official_gazette`, `supreme_court_elibrary`, `lawphil`. */
  sourceType: string;
  authorityLevel: AuthorityLevel;
  acquisitionStatus: AcquisitionStatus;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  /** Object-store key for the archived copy, if retained. */
  storageKey?: string | null;
  /** Hash of the retrieved bytes, used for deduplication. */
  contentHash?: string | null;
  /** True when this is the authoritative manifestation for the document. */
  isPrimary: boolean;
  /** Date this manifestation was retrieved from the source. */
  retrievedAt: IsoDateTimeString;
  retrievedBy?: string | null;
  /** HTTP status or error string from the retrieval, if it failed. */
  retrievalStatus?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * A citation edge: `sourceDocumentId` cites `targetDocumentId`, with the raw
 * citation text and the location within the citing document.
 */
export interface DocumentCitation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  citationText: string;
  /** Section or provision in which the citation appears. */
  location?: string | null;
  pageNumber?: number | null;
  context?: string | null;
  createdAt: IsoDateTimeString;
}

/** A typed, directed edge between two canonical documents. */
export interface DocumentRelationship {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  relationshipType: DocumentRelationshipType;
  /** Provision-level scope, if the relationship targets a single provision. */
  scope?: string | null;
  /** Date the relationship takes legal effect, if established. */
  effectiveDate?: IsoDateString | null;
  /** Quoted passage from the source document that evidences the relationship. */
  evidencePassage?: string | null;
  /** How the relationship was established — never inferred from similarity alone. */
  verificationStatus: VerificationStatus;
  notes?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * One execution of the ingestion pipeline over one artifact. Recorded so that
 * re-runs are auditable and idempotent, and so a failure is never mistaken for
 * a successful publish.
 */
export interface IngestionRun {
  id: string;
  inputContentHash: string;
  sourceId: string;
  pipelineVersion: string;
  extractorVersion: string;
  normalizerVersion: string;
  status: "SUCCEEDED" | "DUPLICATE" | "FAILED" | "IDENTITY_AMBIGUOUS";
  /** What permitted this ingest: a written source approval, an owner risk acceptance, or a synthetic fixture. */
  authorizationBasis?:
    | "source_authorization"
    | "owner_authorization"
    | "synthetic_fixture";
  /** Gate 4 primary activity decision that permitted a strict ingestion, if any. */
  authorizationDecisionRef?: string | null;
  /** All Gate 4 activity decisions that permitted a strict ingestion. */
  authorizationDecisionRefs?: string[] | null;
  /** Gate 4 basis of that decision, kept distinct from the legacy enum. */
  authorizationBasisDetail?:
    | "COUNSEL_DETERMINATION"
    | "OWNER_RISK_ACCEPTANCE"
    | "SYNTHETIC_FIXTURE"
    | null;
  documentId?: string | null;
  versionId?: string | null;
  manifestId?: string | null;
  failureReason?: string | null;
  startedAt: IsoDateTimeString;
  finishedAt?: IsoDateTimeString | null;
}

/**
 * Object 3 (extracted): a provision within a document version. Provisions are
 * the unit of amendment tracking — a single provision can be amended while the
 * rest of the document survives.
 */
export interface LegalProvision {
  id: string;
  documentId: string;
  versionId: string;
  provisionType: ProvisionType;
  /** Structural label, e.g. `Section 5`, `Article III`, `Rule 45.2`. */
  label: string;
  heading?: string | null;
  text: string;
  /** Ordinal position within the document, for stable ordering. */
  ordinal: number;
  parentProvisionId?: string | null;
  legalStatus: LegalStatus;
  /** First date this provision's text is in effect. */
  effectiveFrom?: IsoDateString | null;
  /** Date this provision was superseded or repealed, null if current. */
  effectiveTo?: IsoDateString | null;
  /** The document that amended, repealed or superseded this provision. */
  amendedByDocumentId?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * Object 3 (extracted): machine-readable text produced from one manifestation
 * by one extraction job.
 */
export interface ExtractedText {
  id: string;
  documentId: string;
  versionId?: string | null;
  manifestationId: string;
  extractionJobId: string;
  rawText: string;
  /** Whitespace-normalized text; ligatures resolved, line breaks kept. */
  normalizedText?: string | null;
  language?: string | null;
  pageCount?: number | null;
  ocrUsed: boolean;
  /** 0..1 average OCR confidence, null when native text extraction was used. */
  ocrConfidence?: number | null;
  parserVersion?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * Object 4 (chunks): a retrievable slice of extracted text, carrying enough
 * provenance to resolve a citation back to the source byte range.
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  versionId?: string | null;
  provisionId?: string | null;
  chunkKind: ChunkKind;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  charStart?: number | null;
  charEnd?: number | null;
  pageNumber?: number | null;
  /** Identifier assigned by the embedding index, if embedded. */
  embeddingId?: string | null;
  createdAt: IsoDateTimeString;
}

/**
 * A verification event recording the trust state of a document at a point in
 * time, including who or what performed the check and against which source.
 */
export interface VerificationRecord {
  id: string;
  documentId: string;
  verificationStatus: VerificationStatus;
  method: VerificationMethod;
  /** Manifestation checked against, when cross-source. */
  sourceManifestationId?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: IsoDateTimeString | null;
  /** Machine-readable reasons, e.g. `["hash_mismatch"]`. */
  findings?: string | null;
  notes?: string | null;
  createdAt: IsoDateTimeString;
}

// @phli/legal-ingestion — Bounded ingestion contracts
// Gate 1. See docs/gates/gate-1/04_INGESTION_REPORT.md
//
// This pipeline is deliberately bounded: it ingests one supplied artifact at a
// time. It is not a crawler, and it refuses any artifact that is neither
// explicitly synthetic nor drawn from an explicitly authorized source.

import type {
  DocumentChunk,
  DocumentRelationship,
  DocumentVersion,
  IngestionRun,
  LegalDocument,
  LegalProvision,
  SourceManifestation,
} from "@phli/legal-schema";
import type {
  ActivityAuthorizationRegistry,
  AuthorizationBasis,
} from "./authorization";
import type { AuthorizationAuditService } from "./authorization-audit";

/** A single artifact submitted for ingestion. Metadata is explicit, never guessed. */
export interface ArtifactInput {
  artifactId: string;
  sourceId: string;
  sourceUrl: string;
  mimeType: string;
  retrievedAt: string;
  /** True only for fixtures created for testing. Never set for real material. */
  synthetic: boolean;
  /** Raw bytes or text of the artifact. */
  content: string | Uint8Array;
  documentType: string;
  /** Stable identity key, e.g. `REPUBLIC_ACT:1001`. Required. */
  identityKey: string;
  title: string;
  officialNumber?: string;
  docketNumber?: string;
  issuingBody?: string;
  jurisdiction?: string;
  promulgationDate?: string;
  approvalDate?: string;
  publicationDate?: string;
  effectivityDate?: string;
  legalStatus?: string;
  authorityLevel?: string;
  /** Relationships asserted by the source artifact, with evidence. Never inferred. */
  relationships?: Array<{
    toIdentityKey: string;
    type: string;
    scope?: string;
    effectiveDate?: string;
    evidencePassage?: string;
  }>;
}

export interface CorpusState {
  documents: LegalDocument[];
  versions: DocumentVersion[];
  manifestations: SourceManifestation[];
  provisions: LegalProvision[];
  chunks: DocumentChunk[];
  relationships: DocumentRelationship[];
  runs: IngestionRun[];
  /** Relationships whose target has not been ingested yet. */
  pendingRelationships: Array<{
    fromDocumentId: string;
    toIdentityKey: string;
    type: string;
    scope?: string;
    effectiveDate?: string;
    evidencePassage?: string;
  }>;
}

export interface OwnerAuthorization {
  /** Reference to the owner decision record. Not a legal reuse determination. */
  reference: string;
  scope: string;
  authorizedBy: string;
  date: string;
}

export interface IngestOptions {
  pipelineVersion: string;
  extractorVersion: string;
  normalizerVersion: string;
  /** Source IDs explicitly authorized for non-synthetic ingestion. Empty at Gate 1. */
  authorizedSourceIds?: readonly string[];
  /** Owner-level risk acceptance for a bounded internal pilot; never legal authorization. */
  ownerAuthorization?: OwnerAuthorization;
  /** Gate 4 activity-specific decisions. Required when strict enforcement is on. */
  activityAuthorization?: ActivityAuthorizationRegistry;
  /** When true, non-synthetic ingestion fails unless every required activity is allowed. */
  enforceActivityAuthorization?: boolean;
  /** Explicit opt-in to the legacy coarse source gate. Never set for new sources. */
  allowLegacySourceGate?: boolean;
  /** Bases accepted in strict mode. Defaults to counsel determination only. */
  acceptedAuthorizationBases?: readonly AuthorizationBasis[];
  satisfiedAuthorizationConditions?: readonly string[];
  authorizationNow?: string;
  /** Optional centralized authorization audit. Audit failure fails closed. */
  authorizationAudit?: AuthorizationAuditService;
  now?: () => string;
}

export type IngestStatus =
  | "SUCCEEDED"
  | "DUPLICATE"
  | "FAILED"
  | "IDENTITY_AMBIGUOUS";

export interface IngestOutcome {
  status: IngestStatus;
  runId: string;
  documentId?: string;
  versionId?: string;
  manifestId?: string;
  contentHash: string;
  chunkCount: number;
  provisionCount: number;
  duplicate: boolean;
  reason?: string;
}

export function emptyCorpusState(): CorpusState {
  return {
    documents: [],
    versions: [],
    manifestations: [],
    provisions: [],
    chunks: [],
    relationships: [],
    runs: [],
    pendingRelationships: [],
  };
}

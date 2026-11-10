// @phli/citation-engine — Citation verification types
// Responsibility: see docs/architecture/CITATION_VERIFICATION.md

/** The four verification layers defined in the citation verification spec. */
export enum VerificationLayer {
  IDENTITY = "IDENTITY",
  LOCATION = "LOCATION",
  SUPPORT = "SUPPORT",
  TEMPORAL_VALIDITY = "TEMPORAL_VALIDITY",
}

/** Result of a single verification layer. */
export interface LayerResult {
  /** Whether this layer passed. */
  passed: boolean;
  /** Human-readable evidence supporting the result. */
  evidence?: string;
  /** Additional notes (e.g., why a layer failed, dicta warning). */
  notes?: string;
}

/** Per-layer results keyed by VerificationLayer. */
export type LayerResults = Record<VerificationLayer, LayerResult>;

/** How the verification was performed. */
export enum VerificationMethod {
  AUTOMATED = "AUTOMATED",
  MANUAL = "MANUAL",
  HYBRID = "HYBRID",
}

/** Explicit per-layer states. `VERIFIED` is never used as a blanket status. */
export type CitationState =
  | "VERIFIED_IDENTITY"
  | "VERIFIED_LOCATION"
  | "VERIFIED_SUPPORT"
  | "VERIFIED_TEMPORAL_STATUS"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED"
  | "CONFLICTING"
  | "INVALID";

/** Aggregated verification status. */
export enum VerificationStatus {
  VERIFIED = "VERIFIED",
  PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED",
  FAILED = "FAILED",
  PENDING = "PENDING",
}

/** Input to the citation verifier. */
export interface CitationInput {
  /** The full human-readable citation text. */
  citationText: string;
  /** LegalDocument ID if already resolved. */
  documentId?: string;
  /** DocumentChunk or LegalProvision ID if already resolved. */
  passageId?: string;
  /** Pinpoint location within the document, e.g. `Section 2` or `¶ 4`. */
  location?: string;
  /** The legal proposition this citation is offered to support. */
  proposition: string;
  /** ISO date (YYYY-MM-DD) for temporal validity evaluation. */
  relevantDate?: string;
}

/** Complete result of citation verification across all four layers. */
export interface CitationVerificationResult {
  /** Unique ID for this verification run. */
  citationId: string;
  /** LegalDocument ID of the cited authority. */
  documentId: string;
  /** DocumentChunk or LegalProvision ID of the cited passage. */
  passageId: string;
  /** The citation text that was verified. */
  citationText: string;
  /** Layer 1: Authority exists and has jurisdiction. */
  identityVerified: boolean;
  /** Layer 2: Cited section/passage exists in the authority. */
  passageVerified: boolean;
  /** Layer 3: Passage supports the proposition. */
  propositionSupported: boolean;
  /** Layer 4: Authority was in force at relevant date. */
  temporalValidity: boolean;
  /** How verification was performed. */
  verificationMethod: VerificationMethod;
  /** Aggregated status. */
  verificationStatus: VerificationStatus;
  /** Per-layer detail with evidence and notes. */
  layerResults: LayerResults;
  /** Explicit states; never a blanket `VERIFIED`. */
  states?: CitationState[];
}

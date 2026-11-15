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

/** How the cited passage relates to the proposition. */
export type SupportClass =
  | "FULL_SUPPORT"
  | "DIRECT_QUOTE"
  | "LEXICAL_ONLY"
  | "NO_SUPPORT"
  | "INSUFFICIENT_CONTEXT"
  | "PARTIAL_SUPPORT"
  | "CONTRADICTED";

/** Human-reviewed labels supplied by an evaluation set, never by the model. */
export type SupportAnnotation =
  | "FULL_SUPPORT"
  | "PARTIAL_SUPPORT"
  | "NO_SUPPORT"
  | "CONTRADICTED"
  | "INSUFFICIENT_CONTEXT";

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
  /**
   * Optional label from an independently reviewed evaluation set. When absent,
   * support is decided by the deterministic lexical proxy only.
   */
  supportAnnotation?: SupportAnnotation;
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
  /** Classification of the support relationship; never a single opaque score. */
  supportClass?: SupportClass;
  /** `technical_annotation` when a reviewed label was supplied, else `lexical_proxy`. */
  supportMethod?: "lexical_proxy" | "technical_annotation";
  /**
   * Where the temporal layer's answer came from: the authority projection
   * (Gate 8 reviewed evidence) or the legacy effectivity/repeal fields.
   */
  temporalSource?: "authority_projection" | "legacy_fields";
  /** Authority projection status, when the temporal layer consulted it. */
  authorityStatus?: AuthorityStatusView | null;
}

/**
 * Read-only projection of an authority's reviewed state for a point in time.
 * Mirrors the Gate 8 projection without importing legal-ingestion.
 */
export interface AuthorityStatusView {
  outcome: string;
  state: string;
  explanation: string;
  abstained: boolean;
  /** Evidence gaps the projection reported (e.g. `VERSION_NOT_IN_EFFECT`). */
  missing?: string[];
  /** Version established for the as-of date, when exactly one covers it. */
  versionId?: string | null;
}

/** Resolves the projected authority status for a document/provision at a date. */
export type AuthorityStatusLookup = (request: {
  documentId: string;
  provisionId?: string | null;
  asOf: string;
}) => Promise<AuthorityStatusView>;

/** Optional collaborators for the citation verifier. */
export interface CitationVerifierOptions {
  authority?: AuthorityStatusLookup;
}

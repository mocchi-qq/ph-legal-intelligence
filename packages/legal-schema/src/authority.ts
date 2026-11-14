import type { IsoDateString, IsoDateTimeString } from "./types";

export const EFFECT_TYPES = [
  "ENACTMENT",
  "AMENDMENT",
  "PARTIAL_AMENDMENT",
  "REPEAL",
  "PARTIAL_REPEAL",
  "SUSPENSION",
  "JUDICIAL_INVALIDATION",
  "REINSTATEMENT",
  "EFFECTIVITY",
  "CONSOLIDATION",
  "RENUMBERING",
  "OTHER",
] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export const ASSERTION_STATES = [
  "UNREVIEWED",
  "PENDING_REVIEW",
  "CONFLICTED",
  "SUPERSEDED",
  "UNKNOWN",
] as const;
export type AssertionState = (typeof ASSERTION_STATES)[number];

export const REVIEW_OUTCOMES = [
  "CONFIRMED",
  "CONFIRMED_WITH_CONDITIONS",
  "REJECTED",
  "INCONCLUSIVE",
  "CONFLICTED",
] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const REVIEW_STATUSES = ["ACTIVE", "SUPERSEDED", "REVOKED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EVIDENCE_AVAILABILITY = [
  "AVAILABLE",
  "UNAVAILABLE",
  "NOT_RECEIVED",
] as const;
export type EvidenceAvailability = (typeof EVIDENCE_AVAILABILITY)[number];

export const EVIDENCE_CLASSES = [
  "OFFICIAL_PRIMARY",
  "OFFICIAL_SECONDARY",
  "UNOFFICIAL",
  "EDITORIAL",
  "INFERENCE",
  "UNKNOWN",
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const PROVISION_MAPPING_TYPES = [
  "SAME",
  "RENUMBERED",
  "SPLIT",
  "MERGED",
  "DELETED",
  "NEW",
  "UNCERTAIN",
  "NONE",
] as const;
export type ProvisionMappingType = (typeof PROVISION_MAPPING_TYPES)[number];

export const MAPPING_REVIEW_STATES = [
  "UNREVIEWED",
  "REVIEWED",
  "CONFLICTED",
] as const;
export type MappingReviewState = (typeof MAPPING_REVIEW_STATES)[number];

export const AUTHORITY_QUERY_OUTCOMES = [
  "DETERMINED_WITH_REVIEWED_EVIDENCE",
  "PARTIALLY_DETERMINED",
  "UNKNOWN",
  "CONFLICTED",
  "INSUFFICIENT_EVIDENCE",
  "UNAUTHORIZED",
] as const;
export type AuthorityQueryOutcome = (typeof AUTHORITY_QUERY_OUTCOMES)[number];

export const AUTHORITY_STATES = [
  "UNKNOWN",
  "IN_FORCE",
  "NOT_YET_EFFECTIVE",
  "AMENDED",
  "PARTIALLY_AMENDED",
  "REPEALED",
  "PARTIALLY_REPEALED",
  "SUSPENDED",
  "INVALIDATED",
  "REINSTATED",
  "CONSOLIDATED",
  "RENUMBERED",
] as const;
export type AuthorityState = (typeof AUTHORITY_STATES)[number];

export interface EffectAssertion {
  id: string;
  effectType: EffectType;
  sourceDocumentId: string;
  sourceVersionId: string | null;
  sourceProvisionId: string | null;
  targetDocumentId: string;
  targetProvisionIdentityId: string | null;
  targetVersionId: string | null;
  scope: string;
  claimedDate: IsoDateString | null;
  claimedEffectiveDate: IsoDateString | null;
  evidenceId: string;
  sourceLocator: string | null;
  assertionOrigin: string;
  recordedAt: IsoDateTimeString;
  recordedBy: string;
  state: AssertionState;
  supersedesAssertionId: string | null;
  conflictGroupId: string | null;
}

export interface AuthorityProjection {
  outcome: AuthorityQueryOutcome;
  documentId: string;
  provisionIdentityId: string | null;
  versionId: string | null;
  asOf: IsoDateString;
  state: AuthorityState;
  assertions: string[];
  reviews: string[];
  evidence: string[];
  conflicts: string[];
  missing: string[];
  explanation: string;
  abstained: boolean;
  authorization: "NOT_CHECKED" | "AUTHORIZED" | "UNAUTHORIZED";
}

export interface EffectEvidence {
  id: string;
  assertionId: string;
  documentVersionId: string | null;
  provisionVersionId: string | null;
  artifactId: string | null;
  contentHash: string | null;
  passage: string | null;
  locator: string | null;
  evidenceDate: IsoDateString | null;
  classification: EvidenceClass;
  availability: EvidenceAvailability;
  checkedAt: IsoDateTimeString | null;
}

export interface LegalEffectReview {
  id: string;
  assertionId: string;
  outcome: ReviewOutcome;
  reviewerId: string;
  reviewerCapacity: string;
  decisionDate: IsoDateString;
  scope: string;
  propositionReviewed: string;
  conditions: string[];
  evidenceRefs: string[];
  notes: string | null;
  supersedesReviewId: string | null;
  status: ReviewStatus;
  recordedAt: IsoDateTimeString;
}

export interface ProvisionIdentity {
  id: string;
  documentId: string;
  provisionType: string;
  canonicalLabel: string;
  createdAt: IsoDateTimeString;
}

export interface ProvisionVersionMapping {
  id: string;
  provisionIdentityId: string;
  provisionVersionId: string;
  documentVersionId: string;
  mappingType: ProvisionMappingType;
  rationale: string;
  reviewStatus: MappingReviewState;
  createdAt: IsoDateTimeString;
}

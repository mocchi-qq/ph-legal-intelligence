// @phli/legal-schema — Document type taxonomy and controlled vocabularies
//
// These enumerations are the single source of truth for the legal data model.
// They are mirrored, value for value, by the TEXT CHECK IN (...) constraints in
// `migrations/d1/0001_legal_documents.sql`. Keep the two in lockstep: changing a
// member here without changing the migration (or vice versa) will cause writes
// that the application accepts but D1 rejects.

/**
 * The kind of legal instrument a canonical document represents.
 *
 * The ordering groups instruments by family: constitutive and legislative
 * (constitution through local ordinance) followed by reference material.
 */
export enum DocumentType {
  CONSTITUTION = 'CONSTITUTION',
  STATUTE = 'STATUTE',
  REPUBLIC_ACT = 'REPUBLIC_ACT',
  COMMONWEALTH_ACT = 'COMMONWEALTH_ACT',
  PRESIDENTIAL_DECREE = 'PRESIDENTIAL_DECREE',
  BATAS_PAMBANSA = 'BATAS_PAMBANSA',
  EXECUTIVE_ORDER = 'EXECUTIVE_ORDER',
  ADMINISTRATIVE_ORDER = 'ADMINISTRATIVE_ORDER',
  COURT_DECISION = 'COURT_DECISION',
  SIGNED_RESOLUTION = 'SIGNED_RESOLUTION',
  COURT_RULE = 'COURT_RULE',
  COURT_CIRCULAR = 'COURT_CIRCULAR',
  AGENCY_REGULATION = 'AGENCY_REGULATION',
  ADMINISTRATIVE_DECISION = 'ADMINISTRATIVE_DECISION',
  TREATY = 'TREATY',
  LOCAL_ORDINANCE = 'LOCAL_ORDINANCE',
  LEGAL_REFERENCE = 'LEGAL_REFERENCE',
}

/**
 * The current legal effect of a canonical document.
 *
 * `UNKNOWN` is the safe default until verification establishes a status.
 * `PARTIALLY_AMENDED` and `AMENDED` describe documents whose provisions have
 * diverged over time; `SUPERSEDED` is reserved for replacement by a later
 * instrument without an express repeal.
 */
export enum LegalStatus {
  UNKNOWN = 'UNKNOWN',
  IN_FORCE = 'IN_FORCE',
  PARTIALLY_AMENDED = 'PARTIALLY_AMENDED',
  AMENDED = 'AMENDED',
  REPEALED = 'REPEALED',
  SUPERSEDED = 'SUPERSEDED',
  EXPIRED = 'EXPIRED',
  NOT_YET_EFFECTIVE = 'NOT_YET_EFFECTIVE',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

/**
 * The trust state of a canonical document or a single manifestation.
 *
 * A document is only promoted to `VERIFIED` after the citation verification
 * engine reconciles all of its manifestations against authoritative sources.
 */
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  DEFECTIVE_EXTRACTION = 'DEFECTIVE_EXTRACTION',
}

/**
 * How authoritative a source manifestation is.
 *
 * `official_primary` is the issuing body's own publication (e.g. the Official
 * Gazette); `official_secondary` is an official re-publication; `unofficial`
 * covers every other source and may never be treated as conclusive.
 */
export enum AuthorityLevel {
  OFFICIAL_PRIMARY = 'official_primary',
  OFFICIAL_SECONDARY = 'official_secondary',
  UNOFFICIAL = 'unofficial',
}

/**
 * The lifecycle of a source in the acquisition/ingestion pipeline.
 *
 * `Approved` sources may be crawled automatically; `Restricted` ones need a
 * licence review; `Manual` ones are human-mediated; `Pending` ones are awaiting
 * review; `Rejected` ones are excluded from ingestion.
 */
export enum AcquisitionStatus {
  APPROVED = 'Approved',
  RESTRICTED = 'Restricted',
  MANUAL = 'Manual',
  PENDING = 'Pending',
  REJECTED = 'Rejected',
}

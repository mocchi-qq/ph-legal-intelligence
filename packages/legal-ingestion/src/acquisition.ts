// @phli/legal-ingestion — acquisition manifest with an authorization gate
// Gate 2. See docs/gates/gate-2/02_ACQUISITION_AND_PROVENANCE.md
//
// A manifest can only be produced for an explicitly authorized source, or for a
// synthetic fixture with a synthetic:// locator. There is no network client here:
// transport is intentionally absent because no real source is authorized.

import type {
  ActivityAuthorizationRegistry,
  AuthorizationBasis,
} from "./authorization";
import { assertFetchableUrl } from "./guards";
import { sha256 } from "./store";

export type AuthorizationState =
  | "UNKNOWN"
  | "NOT_REVIEWED"
  | "REVIEW_REQUIRED"
  | "RESTRICTED"
  | "AUTHORIZED_WITH_CONDITIONS"
  | "AUTHORIZED"
  | "PROHIBITED";

export interface AuthorizationRef {
  sourceId: string;
  state: AuthorizationState;
  /** Path or ID of the written determination. Required for any AUTHORIZED state. */
  evidenceRef?: string | null;
  reviewedAt?: string | null;
  reviewer?: string | null;
}

export interface AcquisitionInput {
  artifactId: string;
  sourceId: string;
  sourceUrl: string;
  officialTitle: string;
  legalIdentifier?: string | null;
  documentType: string;
  retrievedAt: string;
  publicationDate?: string | null;
  promulgationDate?: string | null;
  effectivityDate?: string | null;
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
  acquisitionMethod: string;
  authorization: AuthorizationRef;
  attribution?: string | null;
  synthetic?: boolean;
  /** Gate 4 activity-specific decisions for the acquisition path. */
  activityAuthorization?: ActivityAuthorizationRegistry;
  enforceActivityAuthorization?: boolean;
  /** Explicit opt-in to the legacy coarse source gate. Never set for new sources. */
  allowLegacySourceGate?: boolean;
  acceptedAuthorizationBases?: readonly AuthorizationBasis[];
  satisfiedAuthorizationConditions?: readonly string[];
  authorizationNow?: string;
}

export interface AcquisitionRecord {
  internalDocumentId: string;
  sourceRegistryId: string;
  officialTitle: string;
  legalIdentifier: string | null;
  documentType: string;
  originalUrl: string;
  retrievalTimestamp: string;
  publicationDate: string | null;
  promulgationDate: string | null;
  effectivityDate: string | null;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  acquisitionMethod: string;
  authorizationRecordRef: string;
  attribution: string | null;
  acquisitionOutcome: "ACQUIRED" | "REJECTED";
  verificationStatus: "UNVERIFIED" | "PENDING_REVIEW";
  reason?: string;
}

const AUTHORIZED_STATES: AuthorizationState[] = [
  "AUTHORIZED",
  "AUTHORIZED_WITH_CONDITIONS",
];

export function buildAcquisitionRecord(
  input: AcquisitionInput,
): { ok: true; record: AcquisitionRecord } | { ok: false; reason: string } {
  const synthetic = input.synthetic === true;
  let strictRef: string | null = null;
  if (synthetic) {
    if (!input.sourceUrl.startsWith("synthetic://"))
      return { ok: false, reason: "synthetic_flag_without_synthetic_locator" };
  } else {
    const strict = input.enforceActivityAuthorization === true;
    if (!strict) {
      if (input.allowLegacySourceGate !== true)
        return { ok: false, reason: "activity_authorization_required" };
      if (!AUTHORIZED_STATES.includes(input.authorization.state)) {
        return {
          ok: false,
          reason: `source_not_authorized:${input.authorization.state}`,
        };
      }
      if (
        !input.authorization.evidenceRef ||
        input.authorization.evidenceRef.trim().length === 0
      ) {
        return { ok: false, reason: "authorization_evidence_missing" };
      }
    }

    const urlCheck = assertFetchableUrl(input.sourceUrl);
    if (!urlCheck.ok)
      return { ok: false, reason: `unsafe_url:${urlCheck.reason}` };

    if (strict) {
      const registry = input.activityAuthorization;
      if (!registry)
        return { ok: false, reason: "activity_authorization_registry_missing" };
      const check = registry.check(input.sourceId, "downloading", {
        now: input.authorizationNow,
        satisfiedConditions: input.satisfiedAuthorizationConditions,
        allowedBases: input.acceptedAuthorizationBases ?? [
          "COUNSEL_DETERMINATION",
        ],
      });
      if (!check.allowed)
        return {
          ok: false,
          reason: `activity_not_authorized:downloading:${check.reason}`,
        };
      strictRef = check.decision?.id ?? null;
      if (!strictRef)
        return { ok: false, reason: "authorization_evidence_missing" };
    }
  }

  if (input.bytes.length === 0) return { ok: false, reason: "empty_artifact" };
  if (input.authorization.sourceId !== input.sourceId)
    return { ok: false, reason: "authorization_source_mismatch" };

  const record: AcquisitionRecord = {
    internalDocumentId: input.artifactId,
    sourceRegistryId: input.sourceId,
    officialTitle: input.officialTitle,
    legalIdentifier: input.legalIdentifier ?? null,
    documentType: input.documentType,
    originalUrl: input.sourceUrl,
    retrievalTimestamp: input.retrievedAt,
    publicationDate: input.publicationDate ?? null,
    promulgationDate: input.promulgationDate ?? null,
    effectivityDate: input.effectivityDate ?? null,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    fileSizeBytes: input.bytes.length,
    sha256: sha256(input.bytes),
    acquisitionMethod: input.acquisitionMethod,
    authorizationRecordRef: synthetic
      ? "synthetic_fixture"
      : (strictRef ?? (input.authorization.evidenceRef as string)),
    attribution: input.attribution ?? null,
    acquisitionOutcome: "ACQUIRED",
    verificationStatus: "PENDING_REVIEW",
  };
  return { ok: true, record };
}

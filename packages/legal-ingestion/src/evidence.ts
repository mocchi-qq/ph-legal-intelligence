// @phli/legal-ingestion — evidence metadata and availability contract
// Gate 7. See docs/gates/gate-7/08_EVIDENCE_METADATA_AND_AVAILABILITY.md
//
// This module models what the registry knows about an evidence reference. It is
// deliberately not a store: there is no upload, download or serving surface, and
// no real counsel document is bundled here. A file being present says nothing
// about whether its contents are legally sufficient or who it binds.

import { sha256 } from "./store";

/**
 * Registry-side evidence states, from "we have nothing" to "recorded as
 * verified". `AVAILABLE_UNVERIFIED` is not a weaker
 * `VERIFIED_FOR_RECORDING`: bytes can be present and intact while no human has
 * attested identity or authority.
 */
export const EVIDENCE_STATES = [
  "NOT_RECEIVED",
  "REFERENCE_INVALID",
  "FILE_UNAVAILABLE",
  "HASH_MISMATCH",
  "IDENTITY_UNVERIFIED",
  "AUTHORITY_UNVERIFIED",
  "EVIDENCE_INCOMPLETE",
  "AVAILABLE_UNVERIFIED",
  "VERIFIED_FOR_RECORDING",
] as const;

export type EvidenceAvailability = (typeof EVIDENCE_STATES)[number];

export type EvidenceKind =
  | "COUNSEL_OPINION"
  | "COUNSEL_IDENTITY"
  | "AUTHORITY_GRANT"
  | "SUPPORTING_ATTACHMENT";

/**
 * What a named human has actually checked.
 *   NONE            — bytes received, nothing verified;
 *   IDENTITY_ONLY   — the signer is who they claim to be;
 *   AUTHORITY_ONLY  — the signer may bind the source;
 *   FULL            — both, by a named verifier.
 */
export type EvidenceAttestation =
  | "NONE"
  | "IDENTITY_ONLY"
  | "AUTHORITY_ONLY"
  | "FULL";

/**
 * Metadata only. `contentHash` is the hash of bytes received and checked
 * elsewhere; no bytes are stored or returned by this module.
 */
export interface EvidenceMetadata {
  reference: string;
  kind: EvidenceKind;
  contentHash: string | null;
  sizeBytes: number | null;
  received: boolean;
  /** The bytes were located in the external evidence store. */
  fileAvailable: boolean;
  attestation: EvidenceAttestation;
  /** Date the evidence was issued, ISO-8601. */
  issuedAt: string | null;
  /** Named human who performed verification, when any attestation exists. */
  verifiedBy: string | null;
}

export interface EvidenceLookup {
  lookup(reference: string): Promise<EvidenceMetadata | null>;
}

/** Default implementation. No evidence store exists, so nothing is available. */
export class UnavailableEvidenceStore implements EvidenceLookup {
  async lookup(reference: string): Promise<EvidenceMetadata | null> {
    void reference;
    return null;
  }
}

/**
 * Test-only catalogue. Every reference must be explicitly synthetic so a
 * fixture can never be mistaken for a real counsel document.
 */
export class SyntheticEvidenceCatalogue implements EvidenceLookup {
  private readonly records = new Map<string, EvidenceMetadata>();

  constructor(records: readonly EvidenceMetadata[] = []) {
    for (const record of records) this.add(record);
  }

  add(record: EvidenceMetadata): void {
    if (!record.reference.startsWith("synthetic://"))
      throw new Error("synthetic_evidence_reference_required");
    this.records.set(record.reference, { ...record });
  }

  async lookup(reference: string): Promise<EvidenceMetadata | null> {
    const record = this.records.get(reference);
    return record ? { ...record } : null;
  }
}

const HASH_PATTERN = /^[a-f0-9]{64}$/i;

/** Assess one reference. The first failing rule wins. */
export function assessEvidence(
  reference: string,
  record: EvidenceMetadata | null,
): EvidenceAvailability {
  if (typeof reference !== "string" || !reference.trim())
    return "REFERENCE_INVALID";
  if (!record) return "NOT_RECEIVED";
  if (record.reference !== reference) return "REFERENCE_INVALID";
  if (!record.received) return "NOT_RECEIVED";
  if (record.contentHash !== null && !HASH_PATTERN.test(record.contentHash))
    return "HASH_MISMATCH";
  if (record.kind === "COUNSEL_OPINION" && record.contentHash === null)
    return "EVIDENCE_INCOMPLETE";
  if (!record.fileAvailable) return "FILE_UNAVAILABLE";
  if (
    record.contentHash === null ||
    record.sizeBytes === null ||
    record.sizeBytes <= 0 ||
    !record.issuedAt
  )
    return "EVIDENCE_INCOMPLETE";
  if (record.attestation === "NONE") return "AVAILABLE_UNVERIFIED";
  if (!record.verifiedBy?.trim()) return "EVIDENCE_INCOMPLETE";
  if (record.attestation === "IDENTITY_ONLY") return "AUTHORITY_UNVERIFIED";
  if (record.attestation === "AUTHORITY_ONLY") return "IDENTITY_UNVERIFIED";
  return "VERIFIED_FOR_RECORDING";
}

/** Verify received bytes against the recorded metadata hash. */
export function verifyEvidenceBytes(
  metadata: EvidenceMetadata,
  bytes: Uint8Array,
): boolean {
  return metadata.contentHash === sha256(bytes);
}

/**
 * Resolve the availability of every reference a determination relies on.
 * A missing reference resolves to `NOT_RECEIVED`, never to approval.
 */
export async function resolveEvidenceStatuses(
  references: readonly string[],
  store: EvidenceLookup,
): Promise<Map<string, EvidenceAvailability>> {
  const statuses = new Map<string, EvidenceAvailability>();
  for (const reference of references) {
    const record = await store.lookup(reference);
    statuses.set(reference, assessEvidence(reference, record));
  }
  return statuses;
}

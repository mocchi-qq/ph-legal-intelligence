// @phli/legal-ingestion — deterministic authority record ids
//
// Authority rows are content-addressed: a record's identity fields always hash
// to the same id, in any process and whatever order those fields were written.
// That is what makes an authority record replayable. A re-ingest of an unchanged
// claim derives the id already on file, so the append-only ledger and the D1
// adapter reject it as a duplicate instead of forking history with a
// near-duplicate row.
//
// Only identity fields are hashed. Provenance is deliberately excluded — when a
// row was recorded, by whom, and when its evidence was last checked — so simply
// re-running the pipeline cannot mint a new id for an unchanged claim. Lifecycle
// fields are excluded for the same reason: review state moves, the claim does
// not, and a hashed state would fork history at the first transition.
//
// This module is pure: no I/O, no mutation of its inputs, no clock, no global
// state. Two calls with equal inputs return equal ids on any machine.

import { createHash } from "node:crypto";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "@phli/legal-schema";

const UNSUPPORTED_CANONICAL_VALUE = "unsupported_canonical_value";
const INVALID_AUTHORITY_ID_KIND = "invalid_authority_id_kind";
const ID_KIND_PATTERN = /^[a-z][a-z0-9]*$/;

/** Digest characters kept from the sha256 hex: 128 bits of the hash. */
const ID_DIGEST_LENGTH = 32;

function unsupported(detail?: string): never {
  // The bare code is the fallback; a labelled variant names what was refused so
  // a failure is diagnosable. Callers match the prefix, not the whole message.
  throw new Error(
    detail === undefined
      ? UNSUPPORTED_CANONICAL_VALUE
      : `${UNSUPPORTED_CANONICAL_VALUE}: ${detail}`,
  );
}

function encode(value: unknown, insideArray: boolean): string {
  if (value === null) return "null";
  if (value === undefined) {
    // A missing object key carries no information; an array slot does, so it
    // becomes an explicit null rather than shifting the following elements.
    if (insideArray) return "null";
    return unsupported();
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      // NaN and ±Infinity stringify to "null", which would collide with a real
      // null. Refuse them instead of silently conflating two records.
      if (!Number.isFinite(value)) return unsupported();
      // `JSON.stringify(-0)` is `"0"`, so a negative zero would hash identically
      // to a real zero. Refuse it rather than collapse two distinct values.
      if (value === 0 && 1 / value === -Infinity) return unsupported();
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        const items = value as unknown[];
        // A hole and an explicit `undefined` would both encode to `"null"` and
        // collide. Require a dense array (own enumerable indices cover 0..n-1).
        if (items.length !== Object.keys(items).length) return unsupported();
        const encoded: string[] = [];
        for (const item of items) encoded.push(encode(item, true));
        return `[${encoded.join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(value) as object | null;
      if (prototype !== Object.prototype && prototype !== null) {
        // Dates, Maps, class instances and typed arrays have state that plain
        // JSON would drop; hashing them as "{}" would be a silent collision.
        // Name the constructor where one exists so the failure is diagnosable.
        const name = (
          prototype as { constructor?: { name?: string } | undefined }
        ).constructor?.name;
        return unsupported(name);
      }
      const record = value as Record<string, unknown>;
      const encoded: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const field = record[key];
        if (field === undefined) continue;
        encoded.push(`${JSON.stringify(key)}:${encode(field, false)}`);
      }
      return `{${encoded.join(",")}}`;
    }
    default:
      return unsupported();
  }
}

/**
 * Deterministic JSON for hashing. Rules, in full:
 *
 * - `null` → `"null"`, and a top-level `undefined` throws.
 * - `undefined` as an object value → the key is skipped; as an array element →
 *   `"null"` (so positions after it do not shift).
 * - booleans → `true` / `false`; finite numbers → their JSON form (NaN and
 *   ±Infinity throw rather than stringify to `null`). Negative zero throws too,
 *   because `JSON.stringify(-0)` is `"0"` and would collide with a real zero.
 * - strings → JSON-escaped, double-quoted.
 * - arrays → original order preserved; order is significant, because `["a","b"]`
 *   and `["b","a"]` are different facts for conditions and evidence refs. Arrays
 *   must be dense: a hole and an explicit `undefined` would otherwise encode
 *   identically, so a sparse array throws.
 * - plain objects → keys sorted by UTF-16 code unit order, so `{a:1,b:2}` and
 *   `{b:2,a:1}` encode identically. This is the whole point: `JSON.stringify`
 *   preserves insertion order, and an id derived from it would differ between
 *   two processes that built the same record in a different sequence.
 * - anything else (functions, symbols, bigints, non-plain objects) throws an
 *   error beginning `"unsupported_canonical_value"`. A non-plain object appends
 *   its constructor name, e.g. `"unsupported_canonical_value: Date"`.
 */
export function canonicalJson(value: unknown): string {
  return encode(value, false);
}

/**
 * `${kind}_${32 hex chars of sha256(canonicalJson(fields))}`.
 *
 * `kind` is a short lowercase tag (`pi`, `pm`, `lea`, `lee`, `ler`) that keeps
 * ids readable and type-obvious. The digest is truncated to 128 bits, which
 * leaves collision risk negligible for this table's expected scale.
 */
export function deriveAuthorityId(
  kind: string,
  fields: Record<string, unknown>,
): string {
  if (!ID_KIND_PATTERN.test(kind)) {
    throw new Error(INVALID_AUTHORITY_ID_KIND);
  }
  const digest = createHash("sha256")
    .update(canonicalJson(fields), "utf8")
    .digest("hex");
  return `${kind}_${digest.slice(0, ID_DIGEST_LENGTH)}`;
}

/** Stable id for a logical provision: document, type and canonical label. */
export function deriveProvisionIdentityId(
  identity: Omit<ProvisionIdentity, "id" | "createdAt">,
): string {
  return deriveAuthorityId("pi", {
    documentId: identity.documentId,
    provisionType: identity.provisionType,
    canonicalLabel: identity.canonicalLabel,
  });
}

/**
 * Stable id for a mapping from one logical provision to one provision version.
 *
 * Identity is the edge itself: which logical provision maps to which provision
 * version, in which document version, under which mapping type, justified by
 * which rationale.
 *
 * `reviewStatus` is lifecycle, not identity: a mapping moves UNREVIEWED →
 * REVIEWED/CONFLICTED as it is reviewed, and hashing it would mint a new id for
 * the same edge at the first review. Excluded, so re-deriving after a review
 * yields the id already on file and the append-only store rejects it as
 * `duplicate_authority_record` rather than forking history. A genuine lifecycle
 * transition therefore requires an additive record type, which does not exist
 * yet (deferred, not implemented).
 */
export function deriveProvisionMappingId(
  mapping: Omit<ProvisionVersionMapping, "id" | "createdAt">,
): string {
  return deriveAuthorityId("pm", {
    provisionIdentityId: mapping.provisionIdentityId,
    provisionVersionId: mapping.provisionVersionId,
    documentVersionId: mapping.documentVersionId,
    mappingType: mapping.mappingType,
    rationale: mapping.rationale,
  });
}

/**
 * Stable id for a claimed legal effect.
 *
 * Identity is the claim: the effect type, the provisions and versions it links,
 * the scope, the claimed dates, the evidence and locator that support it, and
 * the origin that produced it. Those stay hashed — a different claim is a
 * different record.
 *
 * `state` is lifecycle, not identity: an assertion moves UNREVIEWED →
 * PENDING_REVIEW → CONFLICTED/SUPERSEDED, and hashing it would mint a new id for
 * the same claim at the first transition. Excluded, so re-deriving after a
 * lifecycle change yields the id already on file and the append-only store
 * rejects it as `duplicate_authority_record` rather than forking history. A
 * genuine lifecycle transition therefore requires an additive record type,
 * which does not exist yet (deferred, not implemented).
 *
 * `recordedAt` and `recordedBy` are provenance and likewise excluded: two
 * registrars recording the same claim must derive the same id, so the second
 * attempt lands as a duplicate rather than a fork.
 *
 * `conflictGroupId` is review-time metadata, not the claim: it is grouping
 * assigned after the fact, so hashing it would mint a new id the moment a claim
 * is grouped. Excluded. `supersedesAssertionId` IS identity (lineage), so it
 * stays hashed.
 */
export function deriveAssertionId(
  assertion: Omit<EffectAssertion, "id" | "recordedAt" | "recordedBy">,
): string {
  return deriveAuthorityId("lea", {
    effectType: assertion.effectType,
    sourceDocumentId: assertion.sourceDocumentId,
    sourceVersionId: assertion.sourceVersionId,
    sourceProvisionId: assertion.sourceProvisionId,
    targetDocumentId: assertion.targetDocumentId,
    targetProvisionIdentityId: assertion.targetProvisionIdentityId,
    targetVersionId: assertion.targetVersionId,
    scope: assertion.scope,
    claimedDate: assertion.claimedDate,
    claimedEffectiveDate: assertion.claimedEffectiveDate,
    evidenceId: assertion.evidenceId,
    sourceLocator: assertion.sourceLocator,
    assertionOrigin: assertion.assertionOrigin,
    supersedesAssertionId: assertion.supersedesAssertionId,
  });
}

/**
 * Stable id for evidence supporting an assertion.
 *
 * The hashed fields, in full: `assertionId`, `documentVersionId`,
 * `provisionVersionId`, `artifactId`, `contentHash`, `passage`, `locator`,
 * `evidenceDate` and `classification`. Those are the substantive facts about
 * the evidence — a different citation is a different record.
 *
 * `checkedAt` is provenance and excluded. `availability` is lifecycle, not
 * identity: evidence moves NOT_RECEIVED → AVAILABLE over time, and hashing it
 * would fork the same evidence at the first change. Excluded, so re-deriving
 * after an availability update yields the id already on file and the
 * append-only store rejects it as `duplicate_authority_record`.
 */
export function deriveEvidenceId(
  evidence: Omit<EffectEvidence, "id" | "checkedAt">,
): string {
  return deriveAuthorityId("lee", {
    assertionId: evidence.assertionId,
    documentVersionId: evidence.documentVersionId,
    provisionVersionId: evidence.provisionVersionId,
    artifactId: evidence.artifactId,
    contentHash: evidence.contentHash,
    passage: evidence.passage,
    locator: evidence.locator,
    evidenceDate: evidence.evidenceDate,
    classification: evidence.classification,
  });
}

/**
 * Stable id for a review decision.
 *
 * Identity is the decision: the reviewed assertion, the `outcome`, the reviewer
 * and their capacity, the decision date, the scope, the proposition reviewed and
 * the conditions, evidence and notes attached to it. Those stay hashed — a
 * different decision is a different record. `outcome` in particular is hashed
 * deliberately: it is the substantive finding (CONFIRMED, REJECTED, and so on),
 * not lifecycle.
 *
 * `recordedAt` is provenance and excluded: two registrars recording the same
 * decision must derive the same id, so the second attempt lands as a duplicate
 * rather than a fork.
 *
 * `status` is lifecycle, not identity: a review moves ACTIVE → SUPERSEDED/
 * REVOKED, and hashing it would mint a new id for the same decision at the
 * first transition. Excluded, so re-deriving after a status change yields the id
 * already on file and the append-only store rejects it as
 * `duplicate_authority_record` rather than forking history. Two rows recording
 * the same decision by the same reviewer on the same date therefore derive the
 * same id regardless of status.
 *
 * Retirement is still separable, because `supersedesReviewId` IS identity: a
 * revocation is a new review row carrying its own `supersedesReviewId`, and that
 * distinct value derives a different id from the row it retires. Excluding
 * `status` does not collapse the two.
 */
export function deriveReviewId(
  review: Omit<LegalEffectReview, "id" | "recordedAt">,
): string {
  return deriveAuthorityId("ler", {
    assertionId: review.assertionId,
    outcome: review.outcome,
    reviewerId: review.reviewerId,
    reviewerCapacity: review.reviewerCapacity,
    decisionDate: review.decisionDate,
    scope: review.scope,
    propositionReviewed: review.propositionReviewed,
    conditions: review.conditions,
    evidenceRefs: review.evidenceRefs,
    notes: review.notes,
    supersedesReviewId: review.supersedesReviewId,
  });
}

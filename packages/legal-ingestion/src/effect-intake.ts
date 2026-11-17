// @phli/legal-ingestion — Gate 16 effect-claim intake
// Responsibility: docs/gates/gate-16/00_PLAN.md
//
// Ingestion stops at documents, versions, provisions and chunks; the authority
// ledger holds assertions, evidence and reviews. This module is the seam: it
// turns one analyst's claimed legal effect, plus the corpus artifact that
// evidences it, into unpersisted ledger records.
//
// It is deliberately bounded. No storage, no clock, no inference, no review.
// A claim that cannot be pointed at bytes is refused, because a claim without
// evidence is an opinion, not an authority record.

import type {
  DocumentChunk,
  DocumentVersion,
  EffectAssertion,
  EffectEvidence,
  EffectType,
  EvidenceClass,
  LegalDocument,
  LegalProvision,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "@phli/legal-schema";
import { EFFECT_TYPES, EVIDENCE_CLASSES } from "@phli/legal-schema";
import {
  deriveAssertionId,
  deriveEvidenceId,
  deriveProvisionIdentityId,
  deriveProvisionMappingId,
} from "./authority-ids";
import { normalizeLabel } from "./citation-resolver";
import type { CorpusState } from "./types";

/** Where the claimed effect comes from: the amending/repealing instrument. */
export interface EffectClaimSource {
  documentId: string;
  versionId: string;
  provisionId?: string | null;
  locator?: string | null;
}

/** What the claimed effect acts on: the affected instrument. */
export interface EffectClaimTarget {
  documentId: string;
  provisionLabel?: string | null;
}

/** The corpus bytes that evidence the claim. */
export interface EffectClaimEvidence {
  chunkId: string;
  charStart?: number | null;
  charEnd?: number | null;
  classification?: EvidenceClass;
}

export interface EffectClaimInput {
  effectType: EffectType;
  scope: string;
  source: EffectClaimSource;
  target: EffectClaimTarget;
  claimedDate?: string | null;
  claimedEffectiveDate?: string | null;
  evidence: EffectClaimEvidence;
  analyst: { id: string; recordedAt: string };
  supersedesAssertionId?: string | null;
  conflictGroupId?: string | null;
}

export interface EffectClaimRecords {
  assertion: EffectAssertion;
  evidence: EffectEvidence;
  provisionIdentity: ProvisionIdentity | null;
  provisionMapping: ProvisionVersionMapping | null;
}

export type EffectClaimResult =
  | { ok: true; records: EffectClaimRecords; warnings: string[] }
  | { ok: false; reason: string };

/** Warning raised, never fatal: both sides of the claim are the same instrument. */
export const TARGET_IS_SOURCE = "target_is_source";
/** Warning raised, never fatal: the claimed date postdates the effective date. */
export const CLAIMED_DATE_AFTER_EFFECTIVE = "claimed_date_after_effective";
/** Warning raised, never fatal: the cited chunk is the whole document version. */
export const EVIDENCE_CHUNK_COVERS_WHOLE_DOCUMENT =
  "evidence_chunk_covers_whole_document";

/**
 * Placeholder written in the assertion's hashed `evidenceId` field.
 *
 * `deriveAssertionId` hashes `evidenceId`, and `deriveEvidenceId` hashes
 * `assertionId`, so deriving both ids from the final records is a cycle that no
 * content-addressed scheme can satisfy. The cycle is broken here by deriving the
 * assertion id first, with its `evidenceId` set to this fixed placeholder, then
 * deriving the evidence id from that real assertion id plus the evidence facts,
 * and only then binding the real evidence id onto the assertion row.
 *
 * Consequences, stated explicitly:
 *
 * - Assertion ids are deterministic for the same claim: the same input hashes
 *   the same fields with the same placeholder, so a replay derives the id
 *   already on file rather than forking history.
 * - Evidence ids are unique per claim, because the real assertion id is part of
 *   the hashed evidence identity. Two claims read from the same passage — say an
 *   AMENDMENT and an EFFECTIVITY claim over one section — therefore get different
 *   evidence ids, and both can be recorded. Deriving the evidence first instead
 *   would make those two claims collide on one `lee_…` id and the append-only
 *   store would reject the second, blocking a legitimate case rather than
 *   preventing a duplicate.
 * - The finished assertion is NOT recomputable by calling `deriveAssertionId`
 *   on it alone: the stored row carries the real evidence id, not the
 *   placeholder. Re-deriving requires resetting `evidenceId` to
 *   `EVIDENCE_ID_PLACEHOLDER` first. The ids carried by the finished rows are
 *   the ids to reuse.
 * - Two claims whose assertion fields are identical but whose evidence differs
 *   collapse to one assertion id. That is correct: the claim is the same, and the
 *   evidence is a property of it. The second assertion write is rejected as
 *   `duplicate_authority_record`; its evidence row carries a different id and can
 *   still be recorded.
 *
 * `authority-ids.ts` was not changed: its exclusions are deliberate (Gate 11).
 */
const EVIDENCE_ID_PLACEHOLDER = "";

const EFFECT_TYPE_SET: ReadonlySet<string> = new Set(EFFECT_TYPES);
const EVIDENCE_CLASS_SET: ReadonlySet<string> = new Set(EVIDENCE_CLASSES);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A SHA-256 digest in hex, which is what the ledger's `content_hash` column
 * accepts (64 characters, hex only). Ingestion writes `sha256(...)` digests, so
 * anything else is a corrupt corpus rather than an alternative encoding.
 */
const CONTENT_HASH_PATTERN = /^[0-9A-Fa-f]{64}$/;

/**
 * Section-type prefix on an unparsed provision label, e.g. the `"Sec."` in
 * `"Sec. 2"`. Stripped before normalisation so the styles compare equal.
 */
const SECTION_TYPE_PREFIX_PATTERN = /^\s*(?:SECTION|SEC\.?|S\.)\s*(?=\d|\()/i;

/**
 * Canonical form of a provision label, for the intake's exact-label match.
 *
 * The character-level folding is the package's `normalizeLabel`
 * (`./citation-resolver`), so a label is normalised the same way here as in a
 * citation lookup: one idea, one implementation.
 *
 * `normalizeLabel` keeps a section-type prefix — `"Section 2"` folds to
 * `"SECTION2"`, `"Sec. 2"` to `"SEC.2"`, `"2"` to `"2"` — because its own call
 * site compares both the prefixed and the raw form. Intake labels arrive
 * unparsed, so the prefix is stripped first and the rest is delegated. That
 * reproduces the previous local copy's behaviour: `"2"`, `"Section 2"` and
 * `"Sec. 2"` all fold to `"2"`, while `"Section 2(a)"` folds to `"2_A"` and
 * stays distinct from `"Section 2A"` -> `"2A"`.
 *
 * Folding this way is equal-or-more permissive than the copy it replaced, never
 * stricter: `normalizeLabel` also drops punctuation the copy kept, so a label
 * with a trailing comma (`"Section 2,"`) now matches `"Section 2"`, and an en
 * dash (`"Section 2–A"`) folds to `"2A"` like `"Section 2A"`. The `-` and `.`
 * that carry legal meaning are preserved, so `"2-A"` and `"2.1"` stay distinct.
 */
function normalizeProvisionLabel(label: string): string {
  return normalizeLabel(label.replace(SECTION_TYPE_PREFIX_PATTERN, ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string after trimming; blank ids never identify anything. */
function atLeastOne(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return (
    ISO_DATE_PATTERN.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  );
}

function isDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

/** Read-only view of a possibly malformed corpus; never mutates the input. */
function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function versionNumber(version: DocumentVersion): number {
  return typeof version.versionNumber === "number" &&
    Number.isFinite(version.versionNumber)
    ? version.versionNumber
    : 0;
}

/**
 * The target's current version, if it has one.
 *
 * `isCurrent` is the stored answer; `versionNumber` and `id` only break ties so
 * a malformed corpus with two current versions still resolves deterministically.
 * A document with versions but none current yields `null`, which the assertion
 * type allows.
 */
function currentVersionOf(
  versions: DocumentVersion[],
  documentId: string,
): DocumentVersion | null {
  const candidates = versions.filter(
    (v) => isRecord(v) && v.documentId === documentId && v.isCurrent === true,
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => versionNumber(b) - versionNumber(a) || a.id.localeCompare(b.id),
  )[0];
}

type TargetProvisionLookup =
  | { kind: "matched"; provision: LegalProvision }
  | { kind: "ambiguous" }
  | { kind: "missing" };

/**
 * The target provision a label resolves to, or why it does not.
 *
 * Version scope. The label is searched in the target document's **current**
 * version whenever one exists. An assertion records the target's current
 * `versionId`; binding a provision from a superseded version would leave the
 * assertion naming current text while its provision identity came from text no
 * longer in force. The current-version preference is therefore applied as a
 * scope, not as a tie-break: no provision of the current version means no
 * match. Only when the document has versions but none is marked current — a
 * corpus that cannot say which text is in force — does the search fall back to
 * all of its versions, and the assertion then carries a null `targetVersionId`.
 *
 * Ambiguity. `normalizeProvisionLabel` folds `"Section 2"`, `"Sec. 2"` and
 * `"2"` to one key, so two provisions of the searched set can carry the same
 * label: a renumbered or duplicated section, or one stored with and one without
 * the section prefix. Which of them the analyst meant is not knowable here, and
 * picking whichever sorts first would silently bind the claim to one of them.
 * The lookup reports `ambiguous` and the intake refuses rather than chooses.
 * Ordering never resolves that: it is kept as the documented selection order
 * (newest version first, then ordinal, then id) so a chosen provision never
 * depends on corpus array order, and the ambiguity refusal above means at most
 * one candidate reaches it.
 */
function matchTargetProvision(
  provisions: LegalProvision[],
  versions: DocumentVersion[],
  targetDocumentId: string,
  targetVersionId: string | null,
  label: string,
): TargetProvisionLookup {
  const wanted = normalizeProvisionLabel(label);
  if (wanted.length === 0) return { kind: "missing" };
  const candidates = provisions.filter(
    (p) =>
      isRecord(p) &&
      p.documentId === targetDocumentId &&
      typeof p.label === "string" &&
      normalizeProvisionLabel(p.label) === wanted,
  );
  if (candidates.length === 0) return { kind: "missing" };

  // Current version only; all versions only when the document has none current.
  const searched =
    targetVersionId === null
      ? candidates
      : candidates.filter((p) => p.versionId === targetVersionId);
  if (searched.length === 0) return { kind: "missing" };
  if (searched.length > 1) return { kind: "ambiguous" };

  const versionsById = new Map<string, DocumentVersion>();
  for (const v of versions) {
    if (isRecord(v) && typeof v.id === "string") versionsById.set(v.id, v);
  }

  const rank = (p: LegalProvision): number => {
    const version = versionsById.get(p.versionId);
    return version ? versionNumber(version) : 0;
  };
  const ordinal = (p: LegalProvision): number =>
    typeof p.ordinal === "number" && Number.isFinite(p.ordinal) ? p.ordinal : 0;

  return {
    kind: "matched",
    provision: [...searched].sort(
      (a, b) =>
        rank(b) - rank(a) ||
        ordinal(a) - ordinal(b) ||
        a.id.localeCompare(b.id),
    )[0],
  };
}

/**
 * Resolve the evidence span against the chunk.
 *
 * No span means the whole chunk. A partial span is not a span: supplying only
 * one bound is refused rather than guessed at. Every bound must be a finite
 * integer and the span must be non-empty and inside the chunk's content.
 */
function resolveSpan(
  evidence: Record<string, unknown>,
  chunk: DocumentChunk,
): { start: number; end: number } | null {
  const content = typeof chunk.content === "string" ? chunk.content : "";
  const rawStart = evidence.charStart;
  const rawEnd = evidence.charEnd;
  const hasStart = rawStart !== undefined && rawStart !== null;
  const hasEnd = rawEnd !== undefined && rawEnd !== null;
  if (!hasStart && !hasEnd) return { start: 0, end: content.length };
  if (!hasStart || !hasEnd) return null;
  if (typeof rawStart !== "number" || typeof rawEnd !== "number") return null;
  if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) return null;
  if (rawStart < 0 || rawStart >= rawEnd || rawEnd > content.length)
    return null;
  return { start: rawStart, end: rawEnd };
}

function refuse(reason: string): EffectClaimResult {
  return { ok: false, reason };
}

/**
 * Turn one analyst claim into ledger records, or refuse it.
 *
 * Validation follows the Gate 16 table in order; the first failure wins, so a
 * claim with several defects names the earliest one. The input is treated as
 * `unknown` at runtime: a non-object, a non-string id, a blank id, a NaN span or
 * a missing nested object fails closed with the matching reason instead of
 * throwing. The corpus is only read; nothing here writes storage, reads a clock,
 * or creates a review.
 *
 * Two refusals here are cross-checks rather than field validation, and both are
 * fail-closed:
 *
 * - the evidence chunk must be the one that carries the claimed source provision
 *   (`chunk_provision_mismatch`), so a claim cannot quote one provision while
 *   citing another; a chunk with no provision is unsegmented and is accepted;
 * - the target label must resolve inside the target's current version
 *   (`matchTargetProvision`), and must resolve to exactly one provision
 *   (`ambiguous_target_provision`), never to whichever row happens to sort
 *   first.
 */
export function recordEffectClaim(
  corpus: CorpusState,
  input: EffectClaimInput,
): EffectClaimResult {
  const state: Partial<CorpusState> = isRecord(corpus)
    ? (corpus as unknown as Partial<CorpusState>)
    : {};
  const documents = arrayOf<LegalDocument>(state.documents);
  const versions = arrayOf<DocumentVersion>(state.versions);
  const provisions = arrayOf<LegalProvision>(state.provisions);
  const chunks = arrayOf<DocumentChunk>(state.chunks);

  const claim: unknown = input;
  if (!isRecord(claim)) return refuse("unknown_source_document");

  // 1. Source document.
  const source = isRecord(claim.source) ? claim.source : null;
  if (!source || !atLeastOne(source.documentId)) {
    return refuse("unknown_source_document");
  }
  const sourceDocumentId = source.documentId;
  if (!documents.some((d) => isRecord(d) && d.id === sourceDocumentId)) {
    return refuse("unknown_source_document");
  }

  // 2. Source version, that it belongs to the source document, and that its
  //    content hash is a real digest. The hash is copied onto every evidence row
  //    and the ledger's column accepts only 64 hex characters, so a malformed
  //    corpus is refused here rather than producing evidence with no usable hash.
  if (!atLeastOne(source.versionId)) return refuse("unknown_source_version");
  const sourceVersion = versions.find(
    (v) => isRecord(v) && v.id === source.versionId,
  );
  if (!sourceVersion) return refuse("unknown_source_version");
  if (sourceVersion.documentId !== sourceDocumentId) {
    return refuse("version_not_of_document");
  }
  if (
    typeof sourceVersion.contentHash !== "string" ||
    !CONTENT_HASH_PATTERN.test(sourceVersion.contentHash)
  ) {
    return refuse("invalid_content_hash");
  }
  const sourceVersionId = sourceVersion.id;

  // 3. Target document.
  const target = isRecord(claim.target) ? claim.target : null;
  if (!target || !atLeastOne(target.documentId)) {
    return refuse("unknown_target_document");
  }
  const targetDocumentId = target.documentId;
  if (!documents.some((d) => isRecord(d) && d.id === targetDocumentId)) {
    return refuse("unknown_target_document");
  }

  // 4. Evidence chunk.
  const evidenceClaim = isRecord(claim.evidence) ? claim.evidence : null;
  if (!evidenceClaim || !atLeastOne(evidenceClaim.chunkId)) {
    return refuse("unknown_chunk");
  }
  const chunkId = evidenceClaim.chunkId;
  const chunk = chunks.find((c) => isRecord(c) && c.id === chunkId) ?? null;
  if (!chunk) return refuse("unknown_chunk");

  // 5. The chunk must come from the claimed source version, not just any chunk,
  //    and the claimed source provision must be the chunk's own provision. A
  //    chunk with no provision is unsegmented: there is nothing to contradict,
  //    so that case is accepted rather than matched by assumption.
  if (
    chunk.documentId !== sourceDocumentId ||
    chunk.versionId !== sourceVersionId
  ) {
    return refuse("chunk_not_of_source");
  }
  const sourceProvisionId = atLeastOne(source.provisionId)
    ? source.provisionId
    : null;
  const chunkProvisionId =
    chunk.provisionId !== undefined && chunk.provisionId !== null
      ? chunk.provisionId
      : null;
  if (
    sourceProvisionId !== null &&
    chunkProvisionId !== null &&
    sourceProvisionId !== chunkProvisionId
  ) {
    return refuse("chunk_provision_mismatch");
  }

  // 6. Span.
  const span = resolveSpan(evidenceClaim, chunk);
  if (!span) return refuse("chunk_span_invalid");

  // 7. Effect type vocabulary.
  if (!atLeastOne(claim.effectType) || !EFFECT_TYPE_SET.has(claim.effectType)) {
    return refuse("invalid_effect_type");
  }
  const effectType = claim.effectType as EffectType;

  // 8. Scope, analyst, recording instant.
  if (!atLeastOne(claim.scope)) return refuse("missing_scope");
  const scope = claim.scope;

  const analyst = isRecord(claim.analyst) ? claim.analyst : null;
  if (!analyst || !atLeastOne(analyst.id)) return refuse("missing_analyst");
  const analystId = analyst.id;

  if (!atLeastOne(analyst.recordedAt) || !isDateTime(analyst.recordedAt)) {
    return refuse("invalid_recorded_at");
  }
  const recordedAt = analyst.recordedAt;

  // 9. Claim dates. Both must be real calendar dates when supplied; a blank
  // string, a non-string or an impossible date fails closed.
  const rawClaimedDate = claim.claimedDate;
  if (rawClaimedDate !== undefined && rawClaimedDate !== null) {
    if (typeof rawClaimedDate !== "string" || !isIsoDate(rawClaimedDate)) {
      return refuse("invalid_claim_date");
    }
  }
  const claimedDate =
    typeof rawClaimedDate === "string" ? rawClaimedDate : null;

  const rawClaimedEffectiveDate = claim.claimedEffectiveDate;
  if (
    rawClaimedEffectiveDate !== undefined &&
    rawClaimedEffectiveDate !== null
  ) {
    if (
      typeof rawClaimedEffectiveDate !== "string" ||
      !isIsoDate(rawClaimedEffectiveDate)
    ) {
      return refuse("invalid_claim_date");
    }
  }
  const claimedEffectiveDate =
    typeof rawClaimedEffectiveDate === "string"
      ? rawClaimedEffectiveDate
      : null;

  // 10. Target provision label, last because it needs a provision lookup. The
  //     match is scoped to the target's current version; a label carried by more
  //     than one provision of that scope is refused, not resolved by ordering.
  const rawLabel = target.provisionLabel;
  const targetVersion = currentVersionOf(versions, targetDocumentId);
  let matchedProvision: LegalProvision | null = null;
  if (rawLabel !== undefined && rawLabel !== null) {
    if (typeof rawLabel !== "string") return refuse("unknown_target_provision");
    if (rawLabel.trim().length > 0) {
      const match = matchTargetProvision(
        provisions,
        versions,
        targetDocumentId,
        targetVersion ? targetVersion.id : null,
        rawLabel,
      );
      if (match.kind === "ambiguous") {
        return refuse("ambiguous_target_provision");
      }
      if (match.kind === "missing") return refuse("unknown_target_provision");
      matchedProvision = match.provision;
    }
  }

  // ---------------------------------------------------------------------
  // Record assembly. Nothing above this line has touched the corpus.
  // ---------------------------------------------------------------------

  const targetVersionId = targetVersion ? targetVersion.id : null;

  const sourceLocator = atLeastOne(source.locator)
    ? source.locator
    : `chunk:${chunkId}`;

  const classification: EvidenceClass = EVIDENCE_CLASS_SET.has(
    evidenceClaim.classification as string,
  )
    ? (evidenceClaim.classification as EvidenceClass)
    : "UNKNOWN";

  // The plan names `contentHash` as the source version's stored hash. It was
  // validated as 64 hex characters with the source version (step 2), so it is
  // copied here rather than re-checked.
  const contentHash = sourceVersion.contentHash;

  const passage = chunk.content.slice(span.start, span.end);

  // Id derivation order — see EVIDENCE_ID_PLACEHOLDER for the full rationale.
  // Assertion first (its evidence id still a placeholder), then the evidence
  // from that real assertion id, then the real evidence id is bound onto the
  // assertion row.
  const assertionFields: Omit<
    EffectAssertion,
    "id" | "recordedAt" | "recordedBy"
  > = {
    effectType,
    sourceDocumentId,
    sourceVersionId,
    sourceProvisionId,
    targetDocumentId,
    targetProvisionIdentityId: null,
    targetVersionId,
    scope,
    claimedDate,
    claimedEffectiveDate,
    evidenceId: EVIDENCE_ID_PLACEHOLDER,
    sourceLocator,
    assertionOrigin: "ANALYST_INTAKE",
    state: "UNREVIEWED",
    supersedesAssertionId: null,
    conflictGroupId: null,
  };

  // Optional lineage/grouping are accepted only as real ids; anything else is
  // treated as absent rather than hashed into an identity.
  if (atLeastOne(claim.supersedesAssertionId)) {
    assertionFields.supersedesAssertionId = claim.supersedesAssertionId;
  }
  if (atLeastOne(claim.conflictGroupId)) {
    assertionFields.conflictGroupId = claim.conflictGroupId;
  }

  let provisionIdentity: ProvisionIdentity | null = null;
  let provisionMapping: ProvisionVersionMapping | null = null;

  if (matchedProvision) {
    const canonicalLabel = matchedProvision.label;
    const identityId = deriveProvisionIdentityId({
      documentId: targetDocumentId,
      provisionType: "SECTION",
      canonicalLabel,
    });
    provisionIdentity = {
      id: identityId,
      documentId: targetDocumentId,
      provisionType: "SECTION",
      canonicalLabel,
      createdAt: recordedAt,
    };

    // `PROVISION_MAPPING_TYPES` has no `EXACT_LABEL` member. The real member for
    // "the same logical provision, matched on its label" is `SAME`; every other
    // member asserts a structural change (RENUMBERED, SPLIT, ...).
    const rationale = `Exact label match on "${canonicalLabel}".`;
    const mappingId = deriveProvisionMappingId({
      provisionIdentityId: identityId,
      provisionVersionId: matchedProvision.id,
      documentVersionId: matchedProvision.versionId,
      mappingType: "SAME",
      rationale,
      reviewStatus: "UNREVIEWED",
    });
    provisionMapping = {
      id: mappingId,
      provisionIdentityId: identityId,
      provisionVersionId: matchedProvision.id,
      documentVersionId: matchedProvision.versionId,
      mappingType: "SAME",
      rationale,
      reviewStatus: "UNREVIEWED",
      createdAt: recordedAt,
    };
    assertionFields.targetProvisionIdentityId = identityId;
  }

  const assertionId = deriveAssertionId(assertionFields);

  const evidenceFields: Omit<EffectEvidence, "id" | "checkedAt"> = {
    assertionId,
    documentVersionId: sourceVersionId,
    provisionVersionId: sourceProvisionId,
    artifactId: null,
    contentHash,
    passage,
    locator: sourceLocator,
    evidenceDate: claimedDate,
    classification,
    // Present in the record, not in the hashed identity (Gate 11 treats
    // availability as lifecycle). The corpus holds the chunk, so it is available.
    availability: "AVAILABLE",
  };

  const evidenceId = deriveEvidenceId(evidenceFields);

  const assertion: EffectAssertion = {
    id: assertionId,
    ...assertionFields,
    evidenceId,
    recordedAt,
    recordedBy: analystId,
  };

  const evidence: EffectEvidence = {
    id: evidenceId,
    ...evidenceFields,
    checkedAt: null,
  };

  const warnings: string[] = [];
  if (sourceDocumentId === targetDocumentId) warnings.push(TARGET_IS_SOURCE);
  if (
    claimedDate !== null &&
    claimedEffectiveDate !== null &&
    claimedDate > claimedEffectiveDate
  ) {
    warnings.push(CLAIMED_DATE_AFTER_EFFECTIVE);
  }
  const chunksOfVersion = chunks.filter(
    (c) => isRecord(c) && c.versionId === sourceVersionId,
  );
  if (chunksOfVersion.length === 1 && chunksOfVersion[0].id === chunk.id) {
    warnings.push(EVIDENCE_CHUNK_COVERS_WHOLE_DOCUMENT);
  }
  warnings.sort();

  return {
    ok: true,
    records: { assertion, evidence, provisionIdentity, provisionMapping },
    warnings,
  };
}

// @phli/legal-ingestion — pure authority projection over a ledger snapshot
//
// The ledger stores assertions, evidence and reviews. This module turns one
// snapshot into a single authority answer for a document or provision as of a
// date. It is pure and storage-free, so every adapter reads the same decision
// logic instead of re-implementing it.

import type {
  AuthorityProjection,
  LegalEffectReview,
} from "@phli/legal-schema";
import type { AuthoritySnapshot } from "./authority-ledger";

// Named `ProjectionAuthorizationDecision` because `@phli/legal-ingestion` already
// exports an `AuthorizationDecision` (the counsel-registry record), and the package
// barrel star-exports both modules.
export type ProjectionAuthorizationDecision =
  | "AUTHORIZED"
  | "UNAUTHORIZED"
  | "NOT_CHECKED";

/**
 * A single decision applies to every document; a resolver is asked per document.
 * Any unrecognised value, whether returned by a resolver or passed directly, is
 * treated as NOT_CHECKED, so an unrecognised answer never authorizes processing.
 */
export type AuthorizationInput =
  | ProjectionAuthorizationDecision
  | ((documentId: string) => ProjectionAuthorizationDecision);

export interface ProjectionRequest {
  snapshot: AuthoritySnapshot;
  documentId: string;
  provisionIdentityId?: string | null;
  asOf: string;
  authorization: AuthorizationInput;
  satisfiedConditions?: string[];
}

type ProjectionOutcome = AuthorityProjection["outcome"];
type ProjectionState = AuthorityProjection["state"];
type LedgerAssertion = AuthoritySnapshot["assertions"][number];

function isRealIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const CONFIRMED_OUTCOMES: ReadonlySet<string> = new Set([
  "CONFIRMED",
  "CONFIRMED_WITH_CONDITIONS",
]);

const AUTHORIZATION_DECISIONS: ReadonlySet<string> = new Set([
  "AUTHORIZED",
  "UNAUTHORIZED",
  "NOT_CHECKED",
]);

/**
 * Resolve the authorization decision for one document. Any unrecognised value,
 * whether returned by a resolver or supplied directly, yields NOT_CHECKED: the
 * answer is untrusted, and an untrusted answer is not an authorization. A boxed
 * `String` object is not a primitive string, so it is unrecognised and therefore
 * NOT_CHECKED — fail-closed by design, not an oversight.
 */
function decide(
  input: AuthorizationInput,
  documentId: string,
): ProjectionAuthorizationDecision {
  const decision: unknown =
    typeof input === "function" ? input(documentId) : input;
  return typeof decision === "string" && AUTHORIZATION_DECISIONS.has(decision)
    ? (decision as ProjectionAuthorizationDecision)
    : "NOT_CHECKED";
}

/** Active reviews for one assertion, newest decision first superseding older. */
export function listActiveReviews(
  snapshot: AuthoritySnapshot,
  assertionId: string,
): LegalEffectReview[] {
  const forAssertion = snapshot.reviews.filter(
    (review) => review.assertionId === assertionId,
  );
  const supersededIds = new Set<string>();
  for (const review of forAssertion) {
    if (review.supersedesReviewId !== null && review.status !== "SUPERSEDED") {
      supersededIds.add(review.supersedesReviewId);
    }
  }
  return forAssertion
    .filter(
      (review) => review.status === "ACTIVE" && !supersededIds.has(review.id),
    )
    .sort(
      (a, b) =>
        a.decisionDate.localeCompare(b.decisionDate) ||
        a.id.localeCompare(b.id),
    );
}

/** Project the authority state of one target from a ledger snapshot. */
export function projectAuthorityState(
  req: ProjectionRequest,
): AuthorityProjection {
  if (!isRealIsoDate(req.asOf)) {
    return buildProjection(req, decide(req.authorization, req.documentId), {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["INVALID_DATE"],
      explanation: "Invalid as-of date.",
      abstained: true,
    });
  }

  const targetDecision = decide(req.authorization, req.documentId);

  if (targetDecision === "UNAUTHORIZED") {
    return buildProjection(req, targetDecision, {
      outcome: "UNAUTHORIZED",
      state: "UNKNOWN",
      missing: ["NOT_AUTHORIZED"],
      explanation: "Processing is not authorized for this source or activity.",
      abstained: false,
    });
  }

  if (targetDecision === "NOT_CHECKED") {
    return buildProjection(req, targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["AUTHORIZATION_NOT_CHECKED"],
      explanation:
        "Authorization for this document has not been checked; no determination is projected.",
      abstained: true,
    });
  }

  const snapshot = req.snapshot;
  if (!snapshot.documents.some((document) => document.id === req.documentId)) {
    return buildProjection(req, targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["MISSING_DOCUMENT"],
      explanation: "Document is not in the ledger.",
      abstained: true,
    });
  }

  const provisionFiltered = req.provisionIdentityId !== undefined;
  const provisionIdentityId = req.provisionIdentityId ?? null;
  const supersededAssertionIds = new Set<string>();
  for (const assertion of snapshot.assertions) {
    if (assertion.supersedesAssertionId !== null) {
      supersededAssertionIds.add(assertion.supersedesAssertionId);
    }
  }
  const assertions = snapshot.assertions
    .filter(
      (assertion) =>
        !supersededAssertionIds.has(assertion.id) &&
        assertion.targetDocumentId === req.documentId &&
        (!provisionFiltered ||
          assertion.targetProvisionIdentityId === provisionIdentityId),
    )
    .sort(compareAssertions);

  if (assertions.length === 0) {
    return buildProjection(req, targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["NO_ASSERTION"],
      explanation: "No effect assertion recorded for this target.",
      abstained: true,
    });
  }

  const sourceCodes: string[] = [];
  // One decision per source document per projection: a resolver that is not
  // deterministic (cache, side effect, I/O) must not authorize one assertion
  // from a source and refuse another from the same source in the same answer.
  const sourceDecisions = new Map<string, ProjectionAuthorizationDecision>();
  const gatedAssertions = assertions.filter((assertion) => {
    let decision = sourceDecisions.get(assertion.sourceDocumentId);
    if (decision === undefined) {
      decision = decide(req.authorization, assertion.sourceDocumentId);
      sourceDecisions.set(assertion.sourceDocumentId, decision);
    }
    if (decision === "AUTHORIZED") return true;
    sourceCodes.push(
      decision === "UNAUTHORIZED"
        ? `SOURCE_NOT_AUTHORIZED:${assertion.id}`
        : `SOURCE_AUTHORIZATION_NOT_CHECKED:${assertion.id}`,
    );
    return false;
  });
  sourceCodes.sort();

  if (gatedAssertions.length === 0) {
    return buildProjection(req, targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: sourceCodes,
      explanation:
        "Every candidate assertion came from a source whose processing is not authorized; no determination is projected.",
      abstained: true,
    });
  }

  const assertionIds = gatedAssertions.map((assertion) => assertion.id).sort();
  const active: LegalEffectReview[] = [];
  for (const assertion of gatedAssertions) {
    active.push(...listActiveReviews(snapshot, assertion.id));
  }
  const activeIds = active.map((review) => review.id).sort();

  if (active.length === 0) {
    return buildProjection(req, targetDecision, {
      outcome: "PARTIALLY_DETERMINED",
      state: "UNKNOWN",
      assertions: assertionIds,
      missing: ["NO_REVIEWED_CONCLUSION", ...sourceCodes],
      explanation: "Assertions exist but no qualified review is recorded.",
      abstained: true,
    });
  }

  const hasConflicted = active.some(
    (review) => review.outcome === "CONFLICTED",
  );
  const hasConfirmed = active.some((review) =>
    CONFIRMED_OUTCOMES.has(review.outcome),
  );
  const hasRejected = active.some((review) => review.outcome === "REJECTED");
  if (hasConflicted || (hasConfirmed && hasRejected)) {
    return buildProjection(req, targetDecision, {
      outcome: "CONFLICTED",
      state: "UNKNOWN",
      assertions: assertionIds,
      reviews: activeIds,
      conflicts: activeIds,
      missing: ["CONFLICTING_REVIEWS", ...sourceCodes],
      explanation: "Active reviews disagree; no conclusion is projected.",
      abstained: true,
    });
  }

  const confirmed = active.filter((review) =>
    CONFIRMED_OUTCOMES.has(review.outcome),
  );
  if (confirmed.length === 0) {
    if (active.some((review) => review.outcome === "INCONCLUSIVE")) {
      return buildProjection(req, targetDecision, {
        outcome: "INSUFFICIENT_EVIDENCE",
        state: "UNKNOWN",
        assertions: assertionIds,
        reviews: activeIds,
        missing: ["INCONCLUSIVE_REVIEW", ...sourceCodes],
        explanation: "Reviews are inconclusive.",
        abstained: true,
      });
    }
    return buildProjection(req, targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      assertions: assertionIds,
      reviews: activeIds,
      missing: ["NO_CONFIRMED_EFFECT", ...sourceCodes],
      explanation: "All recorded reviews rejected the assertion.",
      abstained: true,
    });
  }

  const satisfied = new Set(req.satisfiedConditions ?? []);
  const evidenceIds: string[] = [];
  const items: Array<{
    assertion: LedgerAssertion;
    review: LegalEffectReview;
  }> = [];
  for (const review of confirmed) {
    const assertion = snapshot.assertions.find(
      (candidate) => candidate.id === review.assertionId,
    );
    if (assertion === undefined) {
      return buildProjection(req, targetDecision, {
        outcome: "INSUFFICIENT_EVIDENCE",
        state: "UNKNOWN",
        assertions: assertionIds,
        reviews: activeIds,
        evidence: [...evidenceIds].sort(),
        missing: ["MISSING_ASSERTION", ...sourceCodes],
        explanation: "The reviewed assertion is not in the ledger.",
        abstained: true,
      });
    }

    const evidenceRefs =
      review.evidenceRefs.length > 0
        ? review.evidenceRefs
        : [assertion.evidenceId];
    for (const evidenceRef of evidenceRefs) {
      const evidence = snapshot.evidence.find(
        (candidate) => candidate.id === evidenceRef,
      );
      if (
        evidence === undefined ||
        evidence.assertionId !== review.assertionId ||
        evidence.availability !== "AVAILABLE"
      ) {
        return buildProjection(req, targetDecision, {
          outcome: "INSUFFICIENT_EVIDENCE",
          state: "UNKNOWN",
          assertions: assertionIds,
          reviews: activeIds,
          evidence: [...evidenceIds].sort(),
          missing: ["EVIDENCE_UNAVAILABLE", ...sourceCodes],
          explanation:
            "Supporting evidence is missing, unowned, or unavailable.",
          abstained: true,
        });
      }
      if (!evidenceIds.includes(evidence.id)) evidenceIds.push(evidence.id);
    }

    if (
      review.outcome === "CONFIRMED_WITH_CONDITIONS" &&
      !review.conditions.every((condition) => satisfied.has(condition))
    ) {
      return buildProjection(req, targetDecision, {
        outcome: "INSUFFICIENT_EVIDENCE",
        state: "UNKNOWN",
        assertions: assertionIds,
        reviews: activeIds,
        evidence: [...evidenceIds].sort(),
        missing: ["CONDITIONS_UNMET", ...sourceCodes],
        explanation: "Review conditions are not satisfied.",
        abstained: true,
      });
    }

    if (assertion.claimedEffectiveDate === null) {
      return buildProjection(req, targetDecision, {
        outcome: "INSUFFICIENT_EVIDENCE",
        state: "UNKNOWN",
        assertions: assertionIds,
        reviews: activeIds,
        evidence: [...evidenceIds].sort(),
        missing: ["UNKNOWN_EFFECTIVE_DATE", ...sourceCodes],
        explanation: "The reviewed effect has no established effective date.",
        abstained: true,
      });
    }

    items.push({ assertion, review });
  }

  const byType = new Map<string, Set<string>>();
  for (const item of items) {
    const groupKey = `${item.assertion.effectType}|${
      item.assertion.targetProvisionIdentityId ?? item.assertion.scope
    }`;
    const set = byType.get(groupKey) ?? new Set<string>();
    set.add(item.assertion.claimedEffectiveDate ?? "UNKNOWN");
    byType.set(groupKey, set);
  }
  const dateConflict = Array.from(byType.values()).some((set) => set.size > 1);
  if (dateConflict) {
    return buildProjection(req, targetDecision, {
      outcome: "CONFLICTED",
      state: "UNKNOWN",
      assertions: assertionIds,
      reviews: activeIds,
      conflicts: activeIds,
      missing: ["CONFLICTING_EFFECTIVE_DATES", ...sourceCodes],
      explanation:
        "Confirmed reviews claim different effective dates for the same effect type.",
      abstained: true,
    });
  }

  items.sort((a, b) => compareAssertions(a.assertion, b.assertion));
  const versionIds = new Set<string>();
  let versionOutOfEffect = false;
  for (const item of items) {
    const targetVersionId = item.assertion.targetVersionId;
    if (targetVersionId === null) continue;
    const version = snapshot.versions.find(
      (candidate) => candidate.id === targetVersionId,
    );
    const coversAsOf =
      version !== undefined &&
      (version.effectiveFrom === null || version.effectiveFrom <= req.asOf) &&
      (version.effectiveTo === null || version.effectiveTo > req.asOf);
    if (coversAsOf) {
      versionIds.add(targetVersionId);
    } else {
      versionOutOfEffect = true;
    }
  }
  const distinctVersionIds = Array.from(versionIds);
  const versionId =
    versionOutOfEffect || distinctVersionIds.length !== 1
      ? null
      : (distinctVersionIds[0] ?? null);
  const versionMissing = versionOutOfEffect ? ["VERSION_NOT_IN_EFFECT"] : [];

  const applied = items.filter(
    (item) =>
      item.assertion.claimedEffectiveDate !== null &&
      item.assertion.claimedEffectiveDate <= req.asOf,
  );

  if (applied.length === 0) {
    return buildProjection(req, targetDecision, {
      outcome: "DETERMINED_WITH_REVIEWED_EVIDENCE",
      state: "NOT_YET_EFFECTIVE",
      assertions: assertionIds,
      reviews: activeIds,
      evidence: [...evidenceIds].sort(),
      versionId,
      missing: [...versionMissing, ...sourceCodes],
      explanation: "Reviewed effect is prospective relative to the as-of date.",
      abstained: false,
    });
  }

  let state: ProjectionState = "UNKNOWN";
  for (const item of applied) {
    state = stateForEffect(item.assertion.effectType);
  }

  if (state === "UNKNOWN") {
    return buildProjection(req, targetDecision, {
      outcome: "PARTIALLY_DETERMINED",
      state: "UNKNOWN",
      assertions: assertionIds,
      reviews: activeIds,
      evidence: [...evidenceIds].sort(),
      versionId,
      missing: ["EFFECT_NOT_INTERPRETED", ...versionMissing, ...sourceCodes],
      explanation: "A reviewed effect exists but its state is not interpreted.",
      abstained: true,
    });
  }

  return buildProjection(req, targetDecision, {
    outcome: "DETERMINED_WITH_REVIEWED_EVIDENCE",
    state,
    assertions: assertionIds,
    reviews: activeIds,
    evidence: [...evidenceIds].sort(),
    versionId,
    missing: [...versionMissing, ...sourceCodes],
    explanation:
      "State derived from reviewed effect(s) effective on or before the as-of date.",
    abstained: false,
  });
}

interface ProjectionFields {
  outcome: ProjectionOutcome;
  state: ProjectionState;
  missing?: string[];
  explanation: string;
  abstained: boolean;
  assertions?: string[];
  reviews?: string[];
  evidence?: string[];
  conflicts?: string[];
  versionId?: string | null;
}

function buildProjection(
  req: ProjectionRequest,
  authorization: ProjectionAuthorizationDecision,
  fields: ProjectionFields,
): AuthorityProjection {
  return {
    outcome: fields.outcome,
    documentId: req.documentId,
    provisionIdentityId: req.provisionIdentityId ?? null,
    versionId: fields.versionId ?? null,
    asOf: req.asOf,
    state: fields.state,
    assertions: fields.assertions ?? [],
    reviews: fields.reviews ?? [],
    evidence: fields.evidence ?? [],
    conflicts: fields.conflicts ?? [],
    missing: fields.missing ?? [],
    explanation: fields.explanation,
    abstained: fields.abstained,
    authorization,
  };
}

function compareAssertions(a: LedgerAssertion, b: LedgerAssertion): number {
  if (a.claimedEffectiveDate === null && b.claimedEffectiveDate === null) {
    return a.id.localeCompare(b.id);
  }
  if (a.claimedEffectiveDate === null) return 1;
  if (b.claimedEffectiveDate === null) return -1;
  return (
    a.claimedEffectiveDate.localeCompare(b.claimedEffectiveDate) ||
    a.id.localeCompare(b.id)
  );
}

function stateForEffect(
  effectType: LedgerAssertion["effectType"],
): ProjectionState {
  switch (effectType) {
    case "ENACTMENT":
    case "EFFECTIVITY":
    case "REINSTATEMENT":
      return "IN_FORCE";
    case "AMENDMENT":
      return "AMENDED";
    case "PARTIAL_AMENDMENT":
      return "PARTIALLY_AMENDED";
    case "REPEAL":
      return "REPEALED";
    case "PARTIAL_REPEAL":
      return "PARTIALLY_REPEALED";
    case "SUSPENSION":
      return "SUSPENDED";
    case "JUDICIAL_INVALIDATION":
      return "INVALIDATED";
    case "CONSOLIDATION":
      return "CONSOLIDATED";
    case "RENUMBERING":
      return "RENUMBERED";
    default:
      return "UNKNOWN";
  }
}

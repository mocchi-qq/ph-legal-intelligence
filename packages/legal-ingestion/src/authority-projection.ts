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
import {
  ACTIVITIES,
  type Activity,
  type ActivityStatus,
} from "./authorization";
import type {
  DocumentActivityAuthorization,
  DocumentActivityDecision,
  DocumentRole,
} from "./document-activity-authorization";

// Named `ProjectionAuthorizationDecision` because `@phli/legal-ingestion` already
// exports an `AuthorizationDecision` (the counsel-registry record), and the package
// barrel star-exports both modules.
export type ProjectionAuthorizationDecision =
  | "AUTHORIZED"
  | "UNAUTHORIZED"
  | "NOT_CHECKED";

/**
 * A caller-asserted authorization, covering exactly one activity.
 *
 * Gate 13 asks the authorization question per (document, activity, role), so a
 * bare decision is not an input any more: a decision that does not say which
 * activity it was made for cannot be checked against the activity the projection
 * performs, and would therefore authorize whatever activity the caller happened
 * to name. The assertion carries its activity, and a projection for a different
 * activity refuses it instead of applying it.
 *
 * An assertion is still only an assertion: it is recorded as caller-asserted,
 * with no registry identity, because the system can record the claim but cannot
 * verify it.
 */
export interface AuthorizationAssertion {
  /** The one activity this assertion covers. Must equal the projection's activity. */
  readonly activity: Activity;
  readonly decision: ProjectionAuthorizationDecision;
}

export interface ProjectionRequest {
  snapshot: AuthoritySnapshot;
  documentId: string;
  provisionIdentityId?: string | null;
  asOf: string;
  /** Gate 13: the one activity this projection answers for. */
  activity: Activity;
  /**
   * Caller-asserted decision for `activity`. Exactly one of this and
   * `documentActivityAuthorization` must be supplied; the projection refuses to
   * guess which one the caller meant.
   */
  authorizationAssertion?: AuthorizationAssertion;
  /** Registry-backed decision, resolved once per (document, activity). */
  documentActivityAuthorization?: DocumentActivityAuthorization;
  satisfiedConditions?: string[];
}

/**
 * The schema projection plus Gate 13 provenance. Which activity a decision was
 * made for, and which decisions were consulted, are carried on the result so a
 * caller cannot mistake a caller assertion for a registry answer.
 */
export type AuthorityProjectionWithTrace = AuthorityProjection & {
  authorizationSource?: "document_activity" | "caller_asserted";
  authorizationChecks?: DocumentActivityDecision[];
};

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

const ACTIVITY_SET: ReadonlySet<string> = new Set<string>(ACTIVITIES);

function isDecision(value: unknown): value is ProjectionAuthorizationDecision {
  return typeof value === "string" && AUTHORIZATION_DECISIONS.has(value);
}

/** True only for a primitive string that is one of the 14 Gate 4 activities. */
function isCanonicalActivity(value: unknown): value is Activity {
  return typeof value === "string" && ACTIVITY_SET.has(value);
}

/**
 * The authorization answer for one `(documentId, activity)` pair, before a role
 * is attached. Role is provenance, not authority: the same pair must resolve the
 * same way whichever part of the request asks about it, so the role is added when
 * the check is recorded, not when the question is answered.
 */
interface Resolution {
  documentId: string;
  activity: Activity;
  decision: ProjectionAuthorizationDecision;
  sourceId: string | null;
  status: ActivityStatus | null;
  reason: string;
  decisionRef: string | null;
}

interface CallerAssertionVerdict {
  decision: ProjectionAuthorizationDecision;
  reason: string;
}

/**
 * Judge a caller assertion against the activity this projection performs, before
 * any document is resolved or authorised. Every rejection is fail-closed and
 * says why:
 *
 * - `unknown_activity` — the assertion does not name a canonical activity, so
 *   there is no activity it could be checked against.
 * - `activity_mismatch` — the assertion names a different activity from the
 *   projection; an assertion made for `viewing` says nothing about
 *   `citation_display`, so it must not authorize it.
 * - `unrecognised_decision` — the assertion is missing, malformed, or carries a
 *   decision outside AUTHORIZED / UNAUTHORIZED / NOT_CHECKED. A boxed `String`
 *   is not a primitive string, so it is unrecognised too.
 *
 * An accepted assertion is recorded with `reason: "caller_asserted"` and no
 * registry identity: the caller may state a decision, but never a source id,
 * registry status or decision reference.
 */
function readCallerAssertion(
  input: unknown,
  activity: Activity,
): CallerAssertionVerdict {
  if (typeof input !== "object" || input === null)
    return { decision: "NOT_CHECKED", reason: "unrecognised_decision" };
  const fields = input as Record<string, unknown>;
  if (!isCanonicalActivity(fields.activity))
    return { decision: "NOT_CHECKED", reason: "unknown_activity" };
  if (fields.activity !== activity)
    return { decision: "NOT_CHECKED", reason: "activity_mismatch" };
  if (!isDecision(fields.decision))
    return { decision: "NOT_CHECKED", reason: "unrecognised_decision" };
  return { decision: fields.decision, reason: "caller_asserted" };
}

/**
 * Normalise a resolver answer for the pair that was asked about.
 *
 * Gate 13 forbids an adapter from producing AUTHORIZED without identifying the
 * document and the activity it checked, so an answer is usable only when it
 * names the same pair the projection asked for. Identity is *checked against*
 * the answer, never filled in from the question: an answer that omits the pair
 * says nothing about it, and filling the pair in would attribute that silence to
 * a document and activity the adapter never considered.
 *
 * Every rejection is fail-closed for the asked pair, with the reason naming the
 * check that failed:
 *
 * - `invalid_decision` — not an object, or a decision outside AUTHORIZED /
 *   UNAUTHORIZED / NOT_CHECKED. A decision that is not a canonical literal
 *   cannot be read as an answer about anything.
 * - `unknown_activity` — the answer names no primitive-string activity, so there
 *   is no activity it could have been made for.
 * - `activity_mismatch` — the answer names a different activity; a decision made
 *   for `viewing` says nothing about `citation_display`.
 * - `document_mismatch` — the answer names no non-empty string document, or a
 *   different one, so it is an answer about some other document.
 */
function normalizeResolution(
  answer: unknown,
  documentId: string,
  activity: Activity,
): Resolution {
  const refused = (reason: string): Resolution => ({
    documentId,
    activity,
    decision: "NOT_CHECKED",
    sourceId: null,
    status: null,
    reason,
    decisionRef: null,
  });

  if (typeof answer !== "object" || answer === null)
    return refused("invalid_decision");
  const fields = answer as Record<string, unknown>;
  if (!isDecision(fields.decision)) return refused("invalid_decision");
  const answeredActivity = fields.activity;
  if (typeof answeredActivity !== "string") return refused("unknown_activity");
  if (answeredActivity !== activity) return refused("activity_mismatch");
  const answeredDocumentId = fields.documentId;
  if (
    typeof answeredDocumentId !== "string" ||
    answeredDocumentId.trim() === "" ||
    answeredDocumentId !== documentId
  )
    return refused("document_mismatch");

  const sourceId = fields.sourceId;
  const status = fields.status;
  const reason = fields.reason;
  const decisionRef = fields.decisionRef;
  return {
    documentId,
    activity,
    decision: fields.decision,
    sourceId:
      typeof sourceId === "string" && sourceId.trim() !== "" ? sourceId : null,
    status: typeof status === "string" ? (status as ActivityStatus) : null,
    reason:
      typeof reason === "string" && reason.trim() !== ""
        ? reason
        : "unrecognised_decision",
    decisionRef: typeof decisionRef === "string" ? decisionRef : null,
  };
}

/**
 * The resolved authorization context for one projection.
 *
 * `resolutions` is the memo: exactly one answer per
 * `${documentId}\u0000${activity}`, whichever input form produced it, so a
 * resolver with cache, side effects or I/O cannot answer twice for the same pair
 * within one projection.
 *
 * `checks` is the trace: one entry per `(documentId, activity, role)`. When one
 * document is consulted as both the TARGET and a SOURCE, two entries are
 * recorded — same decision, different role — because collapsing them to the
 * first asker's role misreports what the projection depended on. The decision is
 * still resolved once.
 */
interface ProjectionContext {
  activity: Activity;
  authorizationSource: "document_activity" | "caller_asserted";
  consult: (documentId: string, role: DocumentRole) => DocumentActivityDecision;
  entries: () => DocumentActivityDecision[];
}

function createContext(
  activity: Activity,
  authorizationSource: "document_activity" | "caller_asserted",
  request: {
    authorizationAssertion?: unknown;
    documentActivityAuthorization?: DocumentActivityAuthorization;
  },
): ProjectionContext {
  const resolutions = new Map<string, Resolution>();
  const checks = new Map<string, DocumentActivityDecision>();
  const resolver = request.documentActivityAuthorization;
  let caller: CallerAssertionVerdict | null = null;

  const resolutionFor = (
    documentId: string,
    role: DocumentRole,
  ): Resolution => {
    const key = `${documentId}\u0000${activity}`;
    const cached = resolutions.get(key);
    if (cached !== undefined) return cached;
    let resolution: Resolution;
    if (authorizationSource === "document_activity" && resolver !== undefined) {
      resolution = normalizeResolution(
        resolver({ documentId, activity, role }),
        documentId,
        activity,
      );
    } else {
      // One verdict covers the whole assertion: it names one activity and one
      // decision, so every document it is applied to gets the same answer.
      caller ??= readCallerAssertion(request.authorizationAssertion, activity);
      resolution = {
        documentId,
        activity,
        decision: caller.decision,
        sourceId: null,
        status: null,
        reason: caller.reason,
        decisionRef: null,
      };
    }
    resolutions.set(key, resolution);
    return resolution;
  };

  const consult = (
    documentId: string,
    role: DocumentRole,
  ): DocumentActivityDecision => {
    const checkKey = `${documentId}\u0000${activity}\u0000${role}`;
    const existing = checks.get(checkKey);
    if (existing !== undefined) return existing;
    const resolution = resolutionFor(documentId, role);
    const entry: DocumentActivityDecision = {
      documentId: resolution.documentId,
      activity: resolution.activity,
      role,
      decision: resolution.decision,
      sourceId: resolution.sourceId,
      status: resolution.status,
      reason: resolution.reason,
      decisionRef: resolution.decisionRef,
    };
    checks.set(checkKey, entry);
    return entry;
  };

  /** Trace order is stable: documentId, then role. */
  const entries = (): DocumentActivityDecision[] =>
    Array.from(checks.values()).sort(
      (a, b) =>
        a.documentId.localeCompare(b.documentId) ||
        a.role.localeCompare(b.role),
    );

  return { activity, authorizationSource, consult, entries };
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
): AuthorityProjectionWithTrace {
  const base: ProjectionBase = req;
  // `activity` is required by the type, but a caller outside the type system can
  // still supply a non-canonical string, so the runtime check stays.
  const rawActivity: unknown = (req as { activity?: unknown }).activity;
  const activity = rawActivity as Activity;
  const activityKnown =
    typeof rawActivity === "string" && ACTIVITY_SET.has(rawActivity);
  const hasAssertion = req.authorizationAssertion !== undefined;
  const hasDocumentActivity = req.documentActivityAuthorization !== undefined;

  // Exactly one input form can be resolved. Both is ambiguous and neither has
  // anything to consult, so neither case produces a context and neither can
  // authorize anything below.
  const context: ProjectionContext | null =
    hasAssertion === hasDocumentActivity
      ? null
      : createContext(
          activity,
          hasDocumentActivity ? "document_activity" : "caller_asserted",
          req,
        );

  const project = (
    authorization: ProjectionAuthorizationDecision,
    fields: ProjectionFields,
  ): AuthorityProjectionWithTrace =>
    buildProjection(base, context, authorization, fields);

  // Gate 13 validation order, before any document is consulted:
  //   (a) exactly one authorization input,
  //   (b) the activity is canonical,
  //   (c) the as-of date is real,
  //   (d) the target is resolved.
  // A request that fails (a) consulted nothing and carries no provenance; one
  // that passes (a) carries its provenance with an empty or partial trace.
  if (context === null) {
    if (hasAssertion) {
      return project("NOT_CHECKED", {
        outcome: "UNKNOWN",
        state: "UNKNOWN",
        missing: ["AUTHORIZATION_INPUT_CONFLICT"],
        explanation:
          "Two authorization inputs were supplied; exactly one is required.",
        abstained: true,
      });
    }
    return project("NOT_CHECKED", {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["AUTHORIZATION_INPUT_MISSING"],
      explanation: "No authorization input was supplied.",
      abstained: true,
    });
  }

  if (!activityKnown) {
    return project("NOT_CHECKED", {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["UNKNOWN_ACTIVITY"],
      explanation: "The requested activity is not one of the enforceable ones.",
      abstained: true,
    });
  }

  // An invalid date is reported before any authorization question is judged, and
  // no resolver is asked: the projection has nothing to project, so consulting a
  // resolver would only manufacture a decision the answer never uses. The trace
  // is empty rather than absent, and still names where the input came from.
  if (!isRealIsoDate(req.asOf)) {
    return project("NOT_CHECKED", {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["INVALID_DATE"],
      explanation: "Invalid as-of date.",
      abstained: true,
    });
  }

  const targetDecision = context.consult(req.documentId, "TARGET").decision;

  if (targetDecision === "UNAUTHORIZED") {
    return project(targetDecision, {
      outcome: "UNAUTHORIZED",
      state: "UNKNOWN",
      missing: ["NOT_AUTHORIZED", `activity:${activity}`],
      explanation: "Processing is not authorized for this source or activity.",
      abstained: false,
    });
  }

  if (targetDecision === "NOT_CHECKED") {
    return project(targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["AUTHORIZATION_NOT_CHECKED", `activity:${activity}`],
      explanation:
        "Authorization for this document has not been checked; no determination is projected.",
      abstained: true,
    });
  }

  const snapshot = req.snapshot;
  if (!snapshot.documents.some((document) => document.id === req.documentId)) {
    return project(targetDecision, {
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
    return project(targetDecision, {
      outcome: "UNKNOWN",
      state: "UNKNOWN",
      missing: ["NO_ASSERTION"],
      explanation: "No effect assertion recorded for this target.",
      abstained: true,
    });
  }

  const sourceCodes: string[] = [];
  // One decision per (source document, activity) per projection: `consult`
  // memoises, so a resolver that is not deterministic (cache, side effect, I/O)
  // must not authorize one assertion from a source and refuse another from the
  // same source in the same answer. Every source is resolved for the same
  // activity the projection is for. Supersession above has already run, so
  // gating can never resurrect an assertion a superseder removed.
  const gatedAssertions = assertions.filter((assertion) => {
    const decision = context.consult(
      assertion.sourceDocumentId,
      "SOURCE",
    ).decision;
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
    return project(targetDecision, {
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
    return project(targetDecision, {
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
    return project(targetDecision, {
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
      return project(targetDecision, {
        outcome: "INSUFFICIENT_EVIDENCE",
        state: "UNKNOWN",
        assertions: assertionIds,
        reviews: activeIds,
        missing: ["INCONCLUSIVE_REVIEW", ...sourceCodes],
        explanation: "Reviews are inconclusive.",
        abstained: true,
      });
    }
    return project(targetDecision, {
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
  // Evidence ids are only collected once every ref of a review has passed
  // authorization: an id collected early would appear on an
  // INSUFFICIENT_EVIDENCE projection that says it may not use that evidence.
  const evidenceIds: string[] = [];
  const evidenceCodes: string[] = [];
  // Every effect source above has already been consulted, whatever its decision,
  // so the evidence pass must not consult it a second time.
  const consultedSourceIds = new Set<string>(
    assertions.map((assertion) => assertion.sourceDocumentId),
  );
  const items: Array<{
    assertion: LedgerAssertion;
    review: LegalEffectReview;
  }> = [];
  for (const review of confirmed) {
    const assertion = snapshot.assertions.find(
      (candidate) => candidate.id === review.assertionId,
    );
    if (assertion === undefined) {
      return project(targetDecision, {
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
    // Scoped to this review: a ref that fails authorization discards the whole
    // review's evidence base, not just the ref that failed.
    const reviewEvidenceIds: string[] = [];
    let reviewAuthorized = true;
    for (const evidenceRef of evidenceRefs) {
      const evidence = snapshot.evidence.find(
        (candidate) => candidate.id === evidenceRef,
      );
      if (
        evidence === undefined ||
        evidence.assertionId !== review.assertionId ||
        evidence.availability !== "AVAILABLE"
      ) {
        return project(targetDecision, {
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
      // Gate 13: the document behind an evidence record is a third party to the
      // projection. Resolve it for the same activity, unless it is the target or
      // an effect source — both already consulted above. A version that is null
      // or unknown names no document, so nothing is resolved and nothing is
      // recorded for it.
      if (evidence.documentVersionId !== null) {
        const evidenceVersion = snapshot.versions.find(
          (candidate) => candidate.id === evidence.documentVersionId,
        );
        if (evidenceVersion !== undefined) {
          const evidenceDocumentId = evidenceVersion.documentId;
          if (
            evidenceDocumentId !== req.documentId &&
            !consultedSourceIds.has(evidenceDocumentId)
          ) {
            const decision = context.consult(
              evidenceDocumentId,
              "EVIDENCE",
            ).decision;
            if (decision !== "AUTHORIZED") {
              evidenceCodes.push(
                decision === "UNAUTHORIZED"
                  ? `EVIDENCE_NOT_AUTHORIZED:${evidence.id}`
                  : `EVIDENCE_AUTHORIZATION_NOT_CHECKED:${evidence.id}`,
              );
              reviewAuthorized = false;
              continue;
            }
          }
        }
      }
      if (!reviewEvidenceIds.includes(evidence.id)) {
        reviewEvidenceIds.push(evidence.id);
      }
    }

    // Only a review whose every ref passed authorization contributes ids.
    if (reviewAuthorized) {
      for (const evidenceId of reviewEvidenceIds) {
        if (!evidenceIds.includes(evidenceId)) evidenceIds.push(evidenceId);
      }
    }

    if (
      review.outcome === "CONFIRMED_WITH_CONDITIONS" &&
      !review.conditions.every((condition) => satisfied.has(condition))
    ) {
      return project(targetDecision, {
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
      return project(targetDecision, {
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

  // An evidence base that is not authorized for this activity is not an evidence
  // base: the determination is withheld rather than grounded on unverified use,
  // and no evidence id is reported because none of them may be relied on here.
  if (evidenceCodes.length > 0) {
    evidenceCodes.sort();
    return project(targetDecision, {
      outcome: "INSUFFICIENT_EVIDENCE",
      state: "UNKNOWN",
      assertions: assertionIds,
      reviews: activeIds,
      evidence: [],
      missing: [...evidenceCodes, ...sourceCodes],
      explanation:
        "Supporting evidence comes from a document whose processing is not authorized for this activity.",
      abstained: true,
    });
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
    return project(targetDecision, {
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
    return project(targetDecision, {
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
    return project(targetDecision, {
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

  return project(targetDecision, {
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

interface ProjectionBase {
  documentId: string;
  provisionIdentityId?: string | null;
  asOf: string;
}

function buildProjection(
  base: ProjectionBase,
  context: ProjectionContext | null,
  authorization: ProjectionAuthorizationDecision,
  fields: ProjectionFields,
): AuthorityProjectionWithTrace {
  const projection: AuthorityProjectionWithTrace = {
    outcome: fields.outcome,
    documentId: base.documentId,
    provisionIdentityId: base.provisionIdentityId ?? null,
    versionId: fields.versionId ?? null,
    asOf: base.asOf,
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
  // A request whose shape was rejected consulted nothing, so it carries no
  // provenance rather than a misleading empty trace.
  if (context !== null) {
    projection.authorizationSource = context.authorizationSource;
    projection.authorizationChecks = context.entries();
  }
  return projection;
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

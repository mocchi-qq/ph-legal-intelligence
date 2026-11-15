// @phli/legal-ingestion — document/activity authorization adapter
// Gate 13. See docs/gates/gate-13/01_BASELINE_AND_PLAN.md
//
// Gate 4 authorizes a *source* per activity. Gate 12's projection decides
// authorization per *document*. This module is the typed bridge between the two:
// it resolves a document to its source and asks the existing
// ActivityAuthorizationRegistry for exactly one activity.
//
// It is an adapter, not a second source of truth. It records nothing, infers
// nothing and caches nothing except the memoisation helper the caller opts into.
// Only `registry.check(...).allowed === true` produces AUTHORIZED; every input
// that cannot be resolved to a registry answer is NOT_CHECKED.

import type { ProjectionAuthorizationDecision } from "./authority-projection";
import {
  ACTIVITIES,
  type Activity,
  type ActivityAuthorizationRegistry,
  type ActivityStatus,
  type AuthorizationBasis,
  type CheckOptions,
} from "./authorization";

/** Which part of the request a document plays. Provenance, never authority. */
export type DocumentRole = "TARGET" | "SOURCE" | "EVIDENCE";

export interface DocumentActivityRequest {
  documentId: string;
  activity: Activity;
  role: DocumentRole;
  /**
   * The as-of instant of the question being asked. When present it is the clock
   * used for expiry, so a point-in-time projection is reproducible: replaying
   * the same projection asks at the same instant and gets the same answer.
   * `options.now` is only a fallback for callers outside a projection; when
   * neither is supplied the registry keeps its own default clock.
   *
   * A projection supplies a calendar date (`YYYY-MM-DD`) and validates it
   * strictly before this adapter is reached, so under a projection this is
   * always a calendar date. A full ISO instant is nonetheless accepted here,
   * because a caller outside a projection may legitimately ask a timestamped
   * question. What is never accepted is a value that cannot be parsed: that
   * fails closed (`invalid_as_of`, NOT_CHECKED) instead of falling back to the
   * wall clock.
   */
  asOf?: string;
}

export interface DocumentActivityDecision {
  documentId: string;
  activity: Activity;
  role: DocumentRole;
  /** AUTHORIZED | UNAUTHORIZED | NOT_CHECKED — the projection's vocabulary. */
  decision: ProjectionAuthorizationDecision;
  /** sourceId the document resolved to, or null when none could be resolved. */
  sourceId: string | null;
  /** Registry status when a decision record exists, else null. */
  status: ActivityStatus | null;
  /** Stable reason code, see below. */
  reason: string;
  /** Registry decision id when a record exists, else null. */
  decisionRef: string | null;
}

export type DocumentActivityAuthorization = (
  request: DocumentActivityRequest,
) => DocumentActivityDecision;

export interface RegistryAuthorizationOptions {
  registry: ActivityAuthorizationRegistry;
  /** documentId -> sourceId. Returning null means the document's source is unknown. */
  sourceOfDocument: (documentId: string) => string | null;
  /**
   * ISO instant used for expiry when the request carries no `asOf`. This is a
   * fallback for NON-projection use; a projection's fixed clock is
   * `request.asOf`, which wins. Defaults to the clock only when neither is given.
   */
  now?: string;
  satisfiedConditions?: readonly string[];
  allowedBases?: readonly AuthorizationBasis[];
}

/** Statuses that mean "nobody has decided", as opposed to "decided against". */
const UNDECIDED_STATUSES: ReadonlySet<ActivityStatus> = new Set<ActivityStatus>(
  ["UNKNOWN", "NOT_REVIEWED", "REVIEW_REQUIRED"],
);

const ACTIVITY_SET: ReadonlySet<string> = new Set<string>(ACTIVITIES);

/** True only for a primitive string that is one of the Gate 4 activities. */
export function isCanonicalActivity(value: unknown): value is Activity {
  return typeof value === "string" && ACTIVITY_SET.has(value);
}

function isDocumentRole(value: unknown): value is DocumentRole {
  return value === "TARGET" || value === "SOURCE" || value === "EVIDENCE";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** A fail-closed answer: no source, no record, no authorization. */
function unchecked(
  documentId: unknown,
  activity: unknown,
  role: unknown,
  reason: string,
): DocumentActivityDecision {
  return {
    documentId: documentId as string,
    activity: activity as Activity,
    role: role as DocumentRole,
    decision: "NOT_CHECKED",
    sourceId: null,
    status: null,
    reason,
    decisionRef: null,
  };
}

/**
 * Build a resolver over the existing registry. Reason codes, in the order they
 * are produced:
 *
 * - `unknown_document` — documentId missing, blank or not a string.
 * - `unknown_activity` — not one of the 14 Gate 4 activities.
 * - `unknown_role` — not TARGET, SOURCE or EVIDENCE.
 * - `source_lookup_failed` — `sourceOfDocument` threw.
 * - `no_source_for_document` — `sourceOfDocument` returned null or empty.
 * - `invalid_as_of` — `request.asOf` was supplied but is not a parseable
 *   instant; expiry is never evaluated against a different clock. A projection's
 *   `YYYY-MM-DD` reaches here already validated and a full ISO instant is
 *   accepted for callers outside a projection, so this reason means the value
 *   was unusable, not merely timestamped; it fails closed rather than falling
 *   back to the wall clock.
 * - `registry_error` — `registry.check` threw or answered with a non-object.
 * - otherwise the registry's own reason (`authorized`,
 *   `authorized_with_conditions_satisfied`, `no_decision_recorded`, `prohibited`,
 *   `restricted`, `authorization_expired`, `basis_not_accepted:<basis>`,
 *   `conditions_unmet:<condition>…`, `not_authorized`).
 *
 * The clock used for expiry is `request.asOf` when supplied — the projection's
 * fixed clock, so a point-in-time question replays to the same answer. Only when
 * the request carries no `asOf` is `options.now` used, and only when neither is
 * present is `now` omitted entirely so the registry keeps its own clock default.
 * No clock is invented here. An `asOf` that is present but unparseable is
 * NOT_CHECKED (`invalid_as_of`) rather than evaluated against another clock.
 */
export function createRegistryAuthorization(
  options: RegistryAuthorizationOptions,
): DocumentActivityAuthorization {
  return (request: DocumentActivityRequest): DocumentActivityDecision => {
    const input = asRecord(request);
    const documentId = input.documentId;
    const activity = input.activity;
    const role = input.role;

    if (typeof documentId !== "string" || documentId.trim() === "")
      return unchecked(documentId, activity, role, "unknown_document");
    if (!isCanonicalActivity(activity))
      return unchecked(documentId, activity, role, "unknown_activity");
    if (!isDocumentRole(role))
      return unchecked(documentId, activity, role, "unknown_role");

    let sourceId: string | null;
    try {
      const resolved: unknown = options.sourceOfDocument(documentId);
      sourceId =
        typeof resolved === "string" && resolved.trim() !== ""
          ? resolved
          : null;
    } catch {
      return unchecked(documentId, activity, role, "source_lookup_failed");
    }
    if (sourceId === null)
      return unchecked(documentId, activity, role, "no_source_for_document");

    // The projection's fixed clock wins over the wall clock. An as-of instant
    // that is present but unusable fails closed: expiry must never be judged
    // against a clock the caller did not ask for.
    let now: string | undefined;
    if (input.asOf !== undefined) {
      const asOf = input.asOf;
      if (
        typeof asOf !== "string" ||
        asOf.trim() === "" ||
        !Number.isFinite(Date.parse(asOf))
      ) {
        return unchecked(documentId, activity, role, "invalid_as_of");
      }
      now = asOf;
    } else if (options.now !== undefined) {
      now = options.now;
    }

    const checkOptions: CheckOptions = {};
    if (now !== undefined) checkOptions.now = now;
    if (options.satisfiedConditions !== undefined)
      checkOptions.satisfiedConditions = options.satisfiedConditions;
    if (options.allowedBases !== undefined)
      checkOptions.allowedBases = options.allowedBases;

    let allowed: unknown;
    let status: unknown;
    let reason: unknown;
    let record: unknown;
    try {
      const check: unknown = options.registry.check(
        sourceId,
        activity,
        checkOptions,
      );
      if (typeof check !== "object" || check === null)
        return unchecked(documentId, activity, role, "registry_error");
      const fields = check as Record<string, unknown>;
      allowed = fields.allowed;
      status = fields.status;
      reason = fields.reason;
      record = fields.decision;
    } catch {
      return unchecked(documentId, activity, role, "registry_error");
    }

    // No record means nothing was decided, so neither status nor id applies.
    const hasRecord = typeof record === "object" && record !== null;
    const decisionRef =
      hasRecord && typeof (record as Record<string, unknown>).id === "string"
        ? ((record as Record<string, unknown>).id as string)
        : null;
    const decidedStatus = hasRecord
      ? (status as ActivityStatus | null | undefined)
      : null;
    const registryStatus =
      typeof decidedStatus === "string" ? decidedStatus : null;
    // An unrecognised reason is not a reason to allow: default to denial.
    const registryReason =
      typeof reason === "string" && reason.trim() !== ""
        ? reason
        : "not_authorized";

    // The single place AUTHORIZED can be produced.
    if (allowed === true) {
      return {
        documentId,
        activity,
        role,
        decision: "AUTHORIZED",
        sourceId,
        status: registryStatus,
        reason: registryReason,
        decisionRef,
      };
    }

    // Nobody has decided: not a denial, and not an authorization either.
    if (
      registryReason === "no_decision_recorded" ||
      (registryStatus !== null && UNDECIDED_STATUSES.has(registryStatus))
    ) {
      return {
        documentId,
        activity,
        role,
        decision: "NOT_CHECKED",
        sourceId,
        status: registryStatus,
        reason: registryReason,
        decisionRef,
      };
    }

    // A decision record exists and it does not permit this call.
    return {
      documentId,
      activity,
      role,
      decision: "UNAUTHORIZED",
      sourceId,
      status: registryStatus,
      reason: registryReason,
      decisionRef,
    };
  };
}

/**
 * Cache one decision per (document, activity, as-of) for the lifetime of the
 * returned function. Authorization is a property of document + activity; `role`
 * is provenance of who asked first, so the cached decision keeps the role of the
 * first request and every later caller receives that same object (frozen, so a
 * caller cannot rewrite a cached denial into an authorization).
 *
 * The as-of instant is part of the key because expiry is judged against it: the
 * same document and activity asked at two instants are two different questions
 * and may get two different verdicts. A memoised resolver must therefore not be
 * shared across as-of instants unless sharing one memo across them is intended;
 * a request that omits `asOf` is cached in its own bucket, apart from every
 * explicit instant.
 *
 * Different activities, documents and instants are separate entries; nothing is
 * shared beyond the exact triple.
 */
export function memoizeDocumentActivity(
  fn: DocumentActivityAuthorization,
): DocumentActivityAuthorization {
  const cache = new Map<string, DocumentActivityDecision>();
  return (request: DocumentActivityRequest): DocumentActivityDecision => {
    const input = asRecord(request);
    // The as-of instant is part of the key: expiry is evaluated against it, so
    // two instants are two questions. A missing instant is its own bucket.
    const asOf = input.asOf;
    const key = `${String(input.documentId)}\u0000${String(input.activity)}\u0000${asOf ?? ""}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const decision = Object.freeze(fn(request));
    cache.set(key, decision);
    return decision;
  };
}

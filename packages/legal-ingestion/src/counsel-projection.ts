// @phli/legal-ingestion — shared counsel authorization projection
// Gate 7. See docs/gates/gate-7/02_REPOSITORY_CONTRACT.md and 07_…
//
// One pure function decides whether a counsel determination authorizes an
// activity. The in-memory repository and the D1 registry both call it, so the
// legal decision logic is never duplicated in SQL or in a second adapter.

import type {
  CounselActivity,
  CounselDetermination,
  CounselDeterminationStatus,
  CounselProfessional,
  CounselProjection,
  CounselProjectionOptions,
} from "./counsel-determinations";
import type { EvidenceAvailability } from "./evidence";

/**
 * Everything projection needs, already read from a repository. `statuses` is the
 * *effective* status after append-only revocation and supersession events; a
 * stale `determination.status` must never be used directly.
 */
export interface CounselRegistryState {
  professionals: ReadonlyMap<string, CounselProfessional>;
  /** Insertion order is preserved so conflict detection is deterministic. */
  determinations: readonly CounselDetermination[];
  statuses: ReadonlyMap<string, CounselDeterminationStatus>;
  /**
   * Effective status of evidence references. Absent means "not assessed", which
   * keeps the Gate 5/6 opt-in behaviour for callers that supply no evidence store.
   */
  evidenceStatuses?: ReadonlyMap<string, EvidenceAvailability>;
  /** Increments whenever the registry's authorized view changes. */
  revision?: number;
}

export const VERIFIED_STATUS: CounselDeterminationStatus =
  "VERIFIED_FOR_RECORDING";

const APPROVED_STATUSES = ["APPROVED", "APPROVED_WITH_CONDITIONS"] as const;

/** Project one activity against a snapshot of registry state. */
export function projectFromState(
  state: CounselRegistryState,
  sourceId: string,
  activity: CounselActivity,
  options: CounselProjectionOptions = {},
): CounselProjection {
  const base = {
    sourceId,
    activity,
    determinationId: null,
    determinationStatus: null,
    activityStatus: "NO_DECISION" as const,
  };

  const active = state.determinations.filter(
    (determination) =>
      determination.sourceId === sourceId &&
      state.statuses.get(determination.id) === VERIFIED_STATUS,
  );
  if (active.length === 0)
    return { ...base, allowed: false, reason: "no_verified_determination" };

  const matches = active.filter((determination) =>
    determination.activityDecisions.some(
      (decision) => decision.activity === activity,
    ),
  );
  if (matches.length === 0)
    return { ...base, allowed: false, reason: "activity_not_covered" };
  if (matches.length > 1)
    return { ...base, allowed: false, reason: "conflicting_determinations" };

  const determination = matches[0]!;
  const decision = determination.activityDecisions.find(
    (item) => item.activity === activity,
  )!;
  const status = state.statuses.get(determination.id) ?? determination.status;
  const scoped = {
    ...base,
    determinationId: determination.id,
    determinationStatus: status,
    activityStatus: decision.status,
  };

  if (status !== VERIFIED_STATUS) {
    if (status === "REVOKED")
      return { ...scoped, allowed: false, reason: "determination_revoked" };
    if (status === "SUPERSEDED")
      return { ...scoped, allowed: false, reason: "determination_superseded" };
    return {
      ...scoped,
      allowed: false,
      reason: "determination_not_verified",
    };
  }

  if (determination.evidenceRefs.length === 0)
    return {
      ...scoped,
      allowed: false,
      reason: "determination_evidence_missing",
    };

  const evidenceFailure = evidenceFailureFor(state, determination, options);
  if (evidenceFailure)
    return { ...scoped, allowed: false, reason: evidenceFailure };

  if (!APPROVED_STATUSES.includes(decision.status as "APPROVED")) {
    return {
      ...scoped,
      allowed: false,
      reason:
        decision.status === "PROHIBITED"
          ? "prohibited"
          : decision.status === "RESTRICTED"
            ? "restricted"
            : decision.status === "UNRESOLVED"
              ? "activity_unresolved"
              : "not_approved",
    };
  }

  if (determination.documentIds.length > 0) {
    if (!options.documentId)
      return { ...scoped, allowed: false, reason: "document_scope_required" };
    if (!determination.documentIds.includes(options.documentId))
      return { ...scoped, allowed: false, reason: "document_scope_mismatch" };
  }

  const now = options.now ?? new Date().toISOString();
  const effective = decision.effectiveDate ?? determination.effectiveDate;
  const expiry = decision.expiryDate ?? determination.expiryDate;
  if (effective && Date.parse(now) < Date.parse(effective))
    return { ...scoped, allowed: false, reason: "not_yet_effective" };
  if (expiry && Date.parse(now) >= Date.parse(expiry))
    return { ...scoped, allowed: false, reason: "expired" };

  if (decision.status === "APPROVED_WITH_CONDITIONS") {
    const satisfied = new Set(options.satisfiedConditions ?? []);
    const unmet = decision.conditions.filter(
      (condition) => !satisfied.has(condition),
    );
    if (unmet.length > 0)
      return {
        ...scoped,
        allowed: false,
        reason: `conditions_unmet:${unmet.join("|")}`,
      };
  }

  return { ...scoped, allowed: true, reason: "approved" };
}

function evidenceFailureFor(
  state: CounselRegistryState,
  determination: CounselDetermination,
  options: CounselProjectionOptions,
): string | null {
  if (state.evidenceStatuses) {
    for (const reference of determination.evidenceRefs) {
      const status = state.evidenceStatuses.get(reference);
      if (status !== "VERIFIED_FOR_RECORDING") return "evidence_unavailable";
    }
  }
  if (
    options.evidenceAvailable &&
    !determination.evidenceRefs.every((reference) =>
      options.evidenceAvailable?.(reference),
    )
  )
    return "evidence_unavailable";
  return null;
}

/** Map a projection reason onto the centralized audit event type. */
export function auditEventTypeFor(
  projection: CounselProjection,
): import("./authorization-audit").AuthorizationAuditEventType {
  if (projection.allowed) return "AUTHORIZATION_GRANTED";
  switch (projection.determinationStatus) {
    case "REVOKED":
      return "DECISION_REVOKED";
    case "SUPERSEDED":
      return "DECISION_SUPERSEDED";
    default:
      break;
  }
  if (projection.reason === "conflicting_determinations")
    return "CONFLICT_DETECTED";
  if (projection.reason === "evidence_unavailable")
    return "EVIDENCE_UNAVAILABLE";
  if (projection.reason === "expired") return "DECISION_EXPIRED";
  if (projection.reason.startsWith("conditions_unmet"))
    return "CONDITION_UNMET";
  if (projection.reason === "no_verified_determination")
    return "AUTHORIZATION_DENIED";
  return "PROJECTION_REJECTED";
}

/** Stable fingerprint of the payload a determination commit attests to. */
export function registryPayloadFingerprint(
  determination: CounselDetermination,
  activities: readonly import("./counsel-determinations").CounselActivityDecision[],
): string {
  return JSON.stringify({
    determination: {
      id: determination.id,
      sourceId: determination.sourceId,
      documentIds: [...determination.documentIds].sort(),
      counselId: determination.counselId,
      dateReceived: determination.dateReceived,
      dateIssued: determination.dateIssued,
      effectiveDate: determination.effectiveDate,
      expiryDate: determination.expiryDate,
      status: determination.status,
      scope: determination.scope,
      evidenceRefs: [...determination.evidenceRefs].sort(),
      decisionDocumentRef: determination.decisionDocumentRef,
      decisionDocumentHash: determination.decisionDocumentHash,
      recordedBy: determination.recordedBy,
      supersedesId: determination.supersedesId,
      notes: determination.notes,
    },
    activities: activities
      .map((activity) => ({
        activity: activity.activity,
        status: activity.status,
        scope: activity.scope,
        conditions: [...activity.conditions].sort(),
        limitations: [...activity.limitations].sort(),
        permittedUsers: [...activity.permittedUsers].sort(),
        effectiveDate: activity.effectiveDate,
        expiryDate: activity.expiryDate,
        evidenceRef: activity.evidenceRef,
      }))
      .sort((a, b) => a.activity.localeCompare(b.activity)),
  });
}

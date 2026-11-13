// @phli/legal-ingestion — counsel determination intake and projection
// Gate 5. See docs/gates/gate-5/04_DECISION_PROVENANCE_MODEL.md
//
// This module records structured counsel determinations. It does not read or
// interpret free-form legal prose, and it never promotes an authorization
// automatically. A determination is only usable when a human records it as
// VERIFIED_FOR_RECORDING with verified counsel identity and complete evidence.

import type {
  ActivityAuthorizationRegistry,
  DecisionInput,
} from "./authorization";

export const COUNSEL_ACTIVITIES = [
  "viewing",
  "downloading",
  "temporary_processing",
  "temporary_local_storage",
  "persistent_storage",
  "text_extraction",
  "ocr",
  "search_indexing",
  "embedding_generation",
  "ai_assisted_analysis",
  "citation_display",
  "quotation",
  "substantial_reproduction",
  "redistribution",
  "commercial_use",
  "retention",
] as const;

export type CounselActivity = (typeof COUNSEL_ACTIVITIES)[number];

export type CounselDeterminationStatus =
  | "NOT_RECEIVED"
  | "RECEIVED_UNVERIFIED"
  | "IDENTITY_UNVERIFIED"
  | "EVIDENCE_INCOMPLETE"
  | "SCOPE_AMBIGUOUS"
  | "REVIEW_REQUIRED"
  | "VERIFIED_FOR_RECORDING"
  | "SUPERSEDED"
  | "REVOKED";

export type CounselActivityDecisionStatus =
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "RESTRICTED"
  | "PROHIBITED"
  | "UNRESOLVED";

export type CounselVerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export interface CounselProfessional {
  id: string;
  name: string;
  firm: string | null;
  jurisdiction: string;
  capacity: string;
  verificationStatus: CounselVerificationStatus;
  verificationEvidenceRef: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface CounselActivityDecision {
  activity: CounselActivity;
  status: CounselActivityDecisionStatus;
  scope: string | null;
  conditions: string[];
  limitations: string[];
  permittedUsers: string[];
  effectiveDate: string | null;
  expiryDate: string | null;
  evidenceRef: string | null;
}

export interface CounselDetermination {
  id: string;
  sourceId: string;
  documentIds: string[];
  counselId: string;
  dateReceived: string;
  dateIssued: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  status: CounselDeterminationStatus;
  scope: string;
  activityDecisions: CounselActivityDecision[];
  evidenceRefs: string[];
  decisionDocumentRef: string | null;
  decisionDocumentHash: string | null;
  recordedBy: string;
  supersedesId: string | null;
  notes: string | null;
}

export type CounselAuditAction =
  | "COUNSEL_REGISTERED"
  | "DETERMINATION_RECORDED"
  | "STATUS_CHANGED"
  | "SUPERSEDED"
  | "REVOKED";

export interface CounselAuditEvent {
  id: string;
  determinationId: string | null;
  counselId: string | null;
  action: CounselAuditAction;
  previousStatus: CounselDeterminationStatus | null;
  newStatus: CounselDeterminationStatus | null;
  actor: string;
  changedAt: string;
  reason: string;
  evidenceRef: string | null;
}

export interface CounselProjectionOptions {
  now?: string;
  documentId?: string | null;
  satisfiedConditions?: readonly string[];
}

export interface CounselProjection {
  allowed: boolean;
  sourceId: string;
  activity: CounselActivity;
  determinationId: string | null;
  determinationStatus: CounselDeterminationStatus | null;
  activityStatus: CounselActivityDecisionStatus | "NO_DECISION";
  reason: string;
}

const VERIFIED: CounselDeterminationStatus = "VERIFIED_FOR_RECORDING";
const APPROVED_STATUSES: readonly CounselActivityDecisionStatus[] = [
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
];

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

/** Format check only. It does not recompute or verify the decision document hash. */
function isHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

/** Gate 5 activity -> Gate 4 enforceable activity, where a real path exists. */
const GATE4_ACTIVITY: Partial<
  Record<CounselActivity, DecisionInput["activity"]>
> = {
  viewing: "viewing",
  downloading: "downloading",
  temporary_processing: "temporary_processing",
  persistent_storage: "persistent_storage",
  text_extraction: "text_extraction",
  ocr: "ocr",
  search_indexing: "search_indexing",
  embedding_generation: "embedding_generation",
  ai_assisted_analysis: "ai_assisted_analysis",
  citation_display: "citation_display",
  quotation: "quotation",
  redistribution: "redistribution",
  commercial_use: "commercial_use",
  retention: "retention",
};

export interface DeterminationValidation {
  ok: boolean;
  reason?: string;
}

export function validateDetermination(
  determination: CounselDetermination,
  counsel: CounselProfessional | undefined,
): DeterminationValidation {
  if (!determination.id.trim()) return { ok: false, reason: "missing_id" };
  if (!determination.sourceId.trim())
    return { ok: false, reason: "missing_source" };
  if (!determination.counselId.trim())
    return { ok: false, reason: "missing_counsel" };
  if (!determination.scope.trim())
    return { ok: false, reason: "missing_scope" };
  if (!isIsoDate(determination.dateReceived))
    return { ok: false, reason: "invalid_date_received" };
  if (determination.activityDecisions.length === 0)
    return { ok: false, reason: "no_activity_decisions" };
  const activities = new Set<string>();
  for (const decision of determination.activityDecisions) {
    if (!COUNSEL_ACTIVITIES.includes(decision.activity))
      return { ok: false, reason: "unknown_activity" };
    if (activities.has(decision.activity))
      return { ok: false, reason: "duplicate_activity" };
    activities.add(decision.activity);
    if (
      decision.status === "APPROVED_WITH_CONDITIONS" &&
      decision.conditions.length === 0
    )
      return { ok: false, reason: "conditional_without_conditions" };
    if (decision.effectiveDate && !isIsoDate(decision.effectiveDate))
      return { ok: false, reason: "invalid_activity_effective_date" };
    if (decision.expiryDate && !isIsoDate(decision.expiryDate))
      return { ok: false, reason: "invalid_activity_expiry_date" };
  }
  if (determination.effectiveDate && !isIsoDate(determination.effectiveDate))
    return { ok: false, reason: "invalid_effective_date" };
  if (determination.expiryDate && !isIsoDate(determination.expiryDate))
    return { ok: false, reason: "invalid_expiry_date" };
  if (
    determination.effectiveDate &&
    determination.expiryDate &&
    Date.parse(determination.expiryDate) <=
      Date.parse(determination.effectiveDate)
  )
    return { ok: false, reason: "expiry_not_after_effective" };
  if (
    determination.decisionDocumentHash &&
    !isHash(determination.decisionDocumentHash)
  )
    return { ok: false, reason: "invalid_decision_document_hash" };

  if (determination.status === VERIFIED) {
    if (!counsel || counsel.verificationStatus !== "VERIFIED")
      return { ok: false, reason: "counsel_identity_not_verified" };
    if (!counsel.verificationEvidenceRef?.trim())
      return { ok: false, reason: "counsel_verification_evidence_missing" };
    if (determination.evidenceRefs.length === 0)
      return { ok: false, reason: "determination_evidence_missing" };
    if (!determination.decisionDocumentRef?.trim())
      return { ok: false, reason: "decision_document_missing" };
    if (!determination.dateIssued || !isIsoDate(determination.dateIssued))
      return { ok: false, reason: "date_issued_missing" };
    if (!determination.recordedBy.trim())
      return { ok: false, reason: "missing_recorded_by" };
  }
  return { ok: true };
}

/**
 * Append-only counsel determination repository. Records are immutable; status
 * changes, supersession and revocation are append-only audit events.
 */
export class CounselDeterminationRepository {
  private readonly professionals = new Map<string, CounselProfessional>();
  private readonly determinations = new Map<string, CounselDetermination>();
  private readonly order: string[] = [];
  private readonly statuses = new Map<string, CounselDeterminationStatus>();
  private readonly revoked = new Set<string>();
  private readonly supersededBy = new Map<string, string>();
  private readonly events: CounselAuditEvent[] = [];

  registerCounsel(
    counsel: CounselProfessional,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    if (!counsel.id.trim()) throw new Error("missing_counsel_id");
    if (!counsel.name.trim()) throw new Error("missing_counsel_name");
    if (this.professionals.has(counsel.id))
      throw new Error("duplicate_counsel_id");
    this.professionals.set(counsel.id, {
      ...counsel,
      verificationEvidenceRef: counsel.verificationEvidenceRef ?? null,
      verifiedBy: counsel.verifiedBy ?? null,
      verifiedAt: counsel.verifiedAt ?? null,
    });
    return this.appendEvent({
      determinationId: null,
      counselId: counsel.id,
      action: "COUNSEL_REGISTERED",
      previousStatus: null,
      newStatus: null,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: counsel.verificationEvidenceRef ?? null,
    });
  }

  record(
    determination: CounselDetermination,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    if (this.determinations.has(determination.id))
      throw new Error("duplicate_determination_id");
    const counsel = this.professionals.get(determination.counselId);
    const validation = validateDetermination(determination, counsel);
    if (!validation.ok) throw new Error(validation.reason);
    if (!actor.trim()) throw new Error("missing_actor");
    if (!reason.trim()) throw new Error("missing_reason");

    if (determination.supersedesId) {
      const previous = this.determinations.get(determination.supersedesId);
      if (!previous) throw new Error("superseded_determination_not_found");
      if (previous.sourceId !== determination.sourceId)
        throw new Error("superseded_source_mismatch");
    }

    this.determinations.set(determination.id, {
      ...determination,
      documentIds: [...determination.documentIds],
      activityDecisions: determination.activityDecisions.map((decision) => ({
        ...decision,
        conditions: [...decision.conditions],
        limitations: [...decision.limitations],
        permittedUsers: [...decision.permittedUsers],
      })),
      evidenceRefs: [...determination.evidenceRefs],
    });
    this.order.push(determination.id);
    this.statuses.set(determination.id, determination.status);

    if (determination.supersedesId)
      this.markSuperseded(
        determination.supersedesId,
        determination.id,
        actor,
        reason,
        changedAt,
      );

    return this.appendEvent({
      determinationId: determination.id,
      counselId: determination.counselId,
      action: "DETERMINATION_RECORDED",
      previousStatus: null,
      newStatus: determination.status,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: determination.evidenceRefs[0] ?? null,
    });
  }

  statusOf(id: string): CounselDeterminationStatus | null {
    const determination = this.determinations.get(id);
    if (!determination) return null;
    if (this.revoked.has(id)) return "REVOKED";
    if (this.supersededBy.has(id)) return "SUPERSEDED";
    return this.statuses.get(id) ?? determination.status;
  }

  transition(
    id: string,
    newStatus: CounselDeterminationStatus,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    const determination = this.determinations.get(id);
    if (!determination) throw new Error("determination_not_found");
    const current = this.statusOf(id)!;
    if (current === "REVOKED" || current === "SUPERSEDED")
      throw new Error("terminal_status");
    if (newStatus === "SUPERSEDED")
      throw new Error("use_explicit_supersession");
    if (newStatus === VERIFIED) {
      const validation = validateDetermination(
        { ...determination, status: newStatus },
        this.professionals.get(determination.counselId),
      );
      if (!validation.ok) throw new Error(validation.reason);
    }
    this.statuses.set(id, newStatus);
    if (newStatus === "REVOKED") this.revoked.add(id);
    return this.appendEvent({
      determinationId: id,
      counselId: determination.counselId,
      action: newStatus === "REVOKED" ? "REVOKED" : "STATUS_CHANGED",
      previousStatus: current,
      newStatus,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: null,
    });
  }

  revoke(
    id: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    return this.transition(id, "REVOKED", actor, reason, changedAt);
  }

  supersede(
    oldId: string,
    newId: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    const old = this.determinations.get(oldId);
    const next = this.determinations.get(newId);
    if (!old || !next) throw new Error("determination_not_found");
    if (old.sourceId !== next.sourceId) throw new Error("source_mismatch");
    if (this.statusOf(oldId) === "REVOKED")
      throw new Error("cannot_supersede_revoked");
    return this.markSuperseded(oldId, newId, actor, reason, changedAt);
  }

  private markSuperseded(
    oldId: string,
    newId: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): CounselAuditEvent {
    this.supersededBy.set(oldId, newId);
    return this.appendEvent({
      determinationId: oldId,
      counselId: this.determinations.get(oldId)?.counselId ?? null,
      action: "SUPERSEDED",
      previousStatus: this.statuses.get(oldId) ?? null,
      newStatus: "SUPERSEDED",
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: null,
    });
  }

  active(sourceId: string): CounselDetermination[] {
    return this.order
      .map((id) => this.determinations.get(id)!)
      .filter(
        (determination) =>
          determination.sourceId === sourceId &&
          this.statusOf(determination.id) === VERIFIED,
      )
      .map((determination) => ({
        ...determination,
        documentIds: [...determination.documentIds],
        activityDecisions: determination.activityDecisions.map((decision) => ({
          ...decision,
          conditions: [...decision.conditions],
          limitations: [...decision.limitations],
          permittedUsers: [...decision.permittedUsers],
        })),
        evidenceRefs: [...determination.evidenceRefs],
      }));
  }

  history(): CounselDetermination[] {
    return this.order.map((id) => {
      const determination = this.determinations.get(id)!;
      return {
        ...determination,
        documentIds: [...determination.documentIds],
        activityDecisions: determination.activityDecisions.map((decision) => ({
          ...decision,
          conditions: [...decision.conditions],
          limitations: [...decision.limitations],
          permittedUsers: [...decision.permittedUsers],
        })),
        evidenceRefs: [...determination.evidenceRefs],
      };
    });
  }

  auditTrail(): CounselAuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  project(
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
    const active = this.active(sourceId);
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
    const scoped = {
      ...base,
      determinationId: determination.id,
      determinationStatus: this.statusOf(determination.id),
      activityStatus: decision.status,
    };

    if (this.statusOf(determination.id) !== VERIFIED)
      return {
        ...scoped,
        allowed: false,
        reason: "determination_not_verified",
      };
    if (determination.evidenceRefs.length === 0)
      return {
        ...scoped,
        allowed: false,
        reason: "determination_evidence_missing",
      };
    if (!APPROVED_STATUSES.includes(decision.status))
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

  /** Project one counsel activity into the Gate 4 decision model, if mapped. */
  toGate4Decision(
    determinationId: string,
    activity: CounselActivity,
  ): DecisionInput | null {
    const determination = this.determinations.get(determinationId);
    if (!determination || this.statusOf(determinationId) !== VERIFIED)
      return null;
    const mapped = GATE4_ACTIVITY[activity];
    if (!mapped) return null;
    const decision = determination.activityDecisions.find(
      (item) => item.activity === activity,
    );
    if (!decision) return null;
    const counsel = this.professionals.get(determination.counselId);
    if (!counsel || counsel.verificationStatus !== "VERIFIED") return null;
    return {
      sourceId: determination.sourceId,
      activity: mapped,
      status:
        decision.status === "APPROVED"
          ? "AUTHORIZED"
          : decision.status === "APPROVED_WITH_CONDITIONS"
            ? "AUTHORIZED_WITH_CONDITIONS"
            : decision.status === "RESTRICTED"
              ? "RESTRICTED"
              : decision.status === "PROHIBITED"
                ? "PROHIBITED"
                : "REVIEW_REQUIRED",
      basis: "COUNSEL_DETERMINATION",
      evidenceRef:
        decision.evidenceRef ?? determination.evidenceRefs[0] ?? null,
      evidenceLocation: determination.decisionDocumentRef,
      counselDecisionRef: determination.id,
      reviewer: counsel.name,
      decisionDate: determination.dateIssued,
      conditions: decision.conditions,
      expiresAt: decision.expiryDate ?? determination.expiryDate,
      notes: determination.scope,
    };
  }

  private appendEvent(event: Omit<CounselAuditEvent, "id">): CounselAuditEvent {
    if (!event.actor.trim()) throw new Error("missing_actor");
    if (!event.reason.trim()) throw new Error("missing_reason");
    if (!isIsoDate(event.changedAt)) throw new Error("invalid_changed_at");
    const recorded: CounselAuditEvent = {
      ...event,
      id: `counsel_audit_${this.events.length + 1}`,
    };
    this.events.push(recorded);
    return { ...recorded };
  }
}

export interface ProjectionSyncOptions {
  actor: string;
  reason: string;
  now?: string;
  documentId?: string | null;
  satisfiedConditions?: readonly string[];
  changedAt?: string;
}

/**
 * Project verified counsel decisions into the Gate 4 enforcement registry.
 * Allowed activities append/refresh an authorization decision. A previously
 * authorized activity that no longer has a usable determination is overridden
 * with PROHIBITED so revocation, supersession, expiry and conflicts cannot leave
 * stale authorization in force. Unmapped Gate 5 activities are not projected.
 */
export function syncToAuthorizationRegistry(
  repository: CounselDeterminationRepository,
  registry: ActivityAuthorizationRegistry,
  sourceId: string,
  activities: readonly CounselActivity[],
  options: ProjectionSyncOptions,
): void {
  for (const activity of activities) {
    const mapped = GATE4_ACTIVITY[activity];
    if (!mapped) continue;
    const projection = repository.project(sourceId, activity, {
      now: options.now,
      documentId: options.documentId,
      satisfiedConditions: options.satisfiedConditions,
    });
    const latest = registry.latest(sourceId, mapped);
    if (projection.allowed && projection.determinationId) {
      const decision = repository.toGate4Decision(
        projection.determinationId,
        activity,
      );
      if (!decision) continue;
      if (
        latest?.status === "AUTHORIZED" &&
        latest.counselDecisionRef === decision.counselDecisionRef &&
        latest.expiresAt === decision.expiresAt
      )
        continue;
      if (
        latest?.status === "AUTHORIZED_WITH_CONDITIONS" &&
        latest.counselDecisionRef === decision.counselDecisionRef &&
        latest.expiresAt === decision.expiresAt
      )
        continue;
      registry.record(
        decision,
        options.actor,
        options.reason,
        "registry_sync",
        options.changedAt,
      );
      continue;
    }

    // Conditions unmet are already enforced by the conditional decision itself;
    // appending a prohibition would lose the distinction between a condition and
    // a prohibition.
    if (projection.reason.startsWith("conditions_unmet:")) continue;
    if (!latest) continue;
    if (
      latest.status === "PROHIBITED" &&
      latest.notes === `enforcement_override:${projection.reason}`
    )
      continue;
    if (
      latest.status !== "AUTHORIZED" &&
      latest.status !== "AUTHORIZED_WITH_CONDITIONS" &&
      latest.status !== "RESTRICTED"
    )
      continue;
    registry.record(
      {
        sourceId,
        activity: mapped,
        status: "PROHIBITED",
        basis: "NONE",
        evidenceRef: null,
        evidenceLocation: null,
        counselDecisionRef: null,
        reviewer: null,
        decisionDate: null,
        conditions: [],
        expiresAt: null,
        notes: `enforcement_override:${projection.reason}`,
      },
      options.actor,
      `projection no longer permits ${activity}: ${projection.reason}`,
      "registry_sync",
      options.changedAt,
    );
  }
}

// @phli/legal-ingestion — activity-specific source authorization
// Gate 4. See docs/gates/gate-4/02_ACTIVITY_AUTHORIZATION_MATRIX.md
//
// The Gate 1/2 source-level authorization gate is deliberately coarse: one state
// per source. Gate 4 separates permissions per activity and fails closed. A
// source approved for viewing is not thereby approved for ingestion, storage,
// indexing, embedding, AI analysis, display or redistribution.
//
// Owner risk acceptance is a distinct basis from a counsel determination. A
// decision recorded on the owner basis can never be represented as counsel
// authorization.

export const ACTIVITIES = [
  "viewing",
  "downloading",
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "ocr",
  "search_indexing",
  "embedding_generation",
  "ai_assisted_analysis",
  "citation_display",
  "quotation",
  "redistribution",
  "commercial_use",
  "retention",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

export type ActivityStatus =
  | "UNKNOWN"
  | "NOT_REVIEWED"
  | "REVIEW_REQUIRED"
  | "AUTHORIZED"
  | "AUTHORIZED_WITH_CONDITIONS"
  | "RESTRICTED"
  | "PROHIBITED";

export type AuthorizationBasis =
  | "COUNSEL_DETERMINATION"
  | "OWNER_RISK_ACCEPTANCE"
  | "SYNTHETIC_FIXTURE"
  | "NONE";

export interface ActivityDecision {
  id: string;
  sourceId: string;
  activity: Activity;
  status: ActivityStatus;
  basis: AuthorizationBasis;
  evidenceRef: string | null;
  evidenceLocation: string | null;
  counselDecisionRef: string | null;
  reviewer: string | null;
  decisionDate: string | null;
  conditions: string[];
  expiresAt: string | null;
  notes: string | null;
}

export interface AuthorizationAuditRecord {
  id: string;
  sourceId: string;
  activity: Activity;
  previousStatus: ActivityStatus | null;
  newStatus: ActivityStatus;
  basis: AuthorizationBasis;
  actor: string;
  actorRole: string | null;
  changedAt: string;
  decisionRef: string;
  evidenceRef: string | null;
  conditions: string[];
  reason: string;
}

export interface ActivityCheck {
  allowed: boolean;
  sourceId: string;
  activity: Activity;
  status: ActivityStatus;
  reason: string;
  decision: ActivityDecision | null;
}

export interface CheckOptions {
  /** ISO timestamp used for expiry checks. Defaults to the current time. */
  now?: string;
  /** Conditions the caller has satisfied for a conditional decision. */
  satisfiedConditions?: readonly string[];
  /** Accepted decision bases. Defaults to all bases; strict ingestion uses counsel only. */
  allowedBases?: readonly AuthorizationBasis[];
}

export interface DecisionInput {
  sourceId: string;
  activity: Activity;
  status: ActivityStatus;
  basis: AuthorizationBasis;
  evidenceRef?: string | null;
  evidenceLocation?: string | null;
  counselDecisionRef?: string | null;
  reviewer?: string | null;
  decisionDate?: string | null;
  conditions?: readonly string[];
  expiresAt?: string | null;
  notes?: string | null;
}

const AUTHORIZED_STATUSES: readonly ActivityStatus[] = [
  "AUTHORIZED",
  "AUTHORIZED_WITH_CONDITIONS",
];

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function normaliseDecision(
  input: DecisionInput,
  sequence: number,
): ActivityDecision {
  const conditions = [...(input.conditions ?? [])];
  const decision: ActivityDecision = {
    id: `auth_${input.sourceId}_${input.activity}_${sequence}`,
    sourceId: input.sourceId,
    activity: input.activity,
    status: input.status,
    basis: input.basis,
    evidenceRef: input.evidenceRef ?? null,
    evidenceLocation: input.evidenceLocation ?? null,
    counselDecisionRef: input.counselDecisionRef ?? null,
    reviewer: input.reviewer ?? null,
    decisionDate: input.decisionDate ?? null,
    conditions,
    expiresAt: input.expiresAt ?? null,
    notes: input.notes ?? null,
  };
  return decision;
}

export interface DecisionValidation {
  ok: boolean;
  reason?: string;
}

/** Validate before recording. AUTHORIZED cannot be created from silence. */
export function validateDecision(
  decision: ActivityDecision,
): DecisionValidation {
  if (!decision.sourceId.trim()) return { ok: false, reason: "missing_source" };
  if (!ACTIVITIES.includes(decision.activity))
    return { ok: false, reason: "unknown_activity" };
  if (
    AUTHORIZED_STATUSES.includes(decision.status) ||
    decision.status === "RESTRICTED"
  ) {
    if (decision.basis === "NONE")
      return { ok: false, reason: "missing_authorization_basis" };
    if (!decision.evidenceRef?.trim())
      return { ok: false, reason: "authorization_evidence_missing" };
    if (!decision.reviewer?.trim())
      return { ok: false, reason: "authorization_reviewer_missing" };
    if (!decision.decisionDate?.trim())
      return { ok: false, reason: "authorization_date_missing" };
  }
  if (
    decision.status === "AUTHORIZED" ||
    decision.status === "AUTHORIZED_WITH_CONDITIONS"
  ) {
    if (
      decision.basis === "COUNSEL_DETERMINATION" &&
      !decision.counselDecisionRef?.trim()
    )
      return { ok: false, reason: "counsel_decision_reference_missing" };
  }
  if (
    decision.status === "AUTHORIZED_WITH_CONDITIONS" &&
    decision.conditions.length === 0
  )
    return {
      ok: false,
      reason: "conditional_authorization_without_conditions",
    };
  if (decision.expiresAt && !isIsoDate(decision.expiresAt))
    return { ok: false, reason: "invalid_expiry" };
  if (decision.decisionDate && !isIsoDate(decision.decisionDate))
    return { ok: false, reason: "invalid_decision_date" };
  return { ok: true };
}

/**
 * Append-only authorization registry. Recording a later decision supersedes the
 * previous status for future checks but never removes the earlier row or audit
 * event.
 */
export class ActivityAuthorizationRegistry {
  private readonly decisions: ActivityDecision[] = [];
  private readonly audit: AuthorizationAuditRecord[] = [];
  private readonly counters = new Map<string, number>();

  record(
    input: DecisionInput,
    actor: string,
    reason: string,
    actorRole: string | null = null,
    changedAt?: string,
  ): AuthorizationAuditRecord {
    const key = `${input.sourceId}:${input.activity}`;
    const sequence = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, sequence);
    const decision = normaliseDecision(input, sequence);
    const validation = validateDecision(decision);
    if (!validation.ok) throw new Error(validation.reason);
    if (!actor.trim()) throw new Error("missing_actor");
    if (!reason.trim()) throw new Error("missing_reason");
    const at = changedAt ?? new Date().toISOString();
    if (!isIsoDate(at)) throw new Error("invalid_changed_at");

    const previous = this.latest(decision.sourceId, decision.activity);
    this.decisions.push(decision);
    const event: AuthorizationAuditRecord = {
      id: `audit_${decision.id}_${this.audit.length + 1}`,
      sourceId: decision.sourceId,
      activity: decision.activity,
      previousStatus: previous?.status ?? null,
      newStatus: decision.status,
      basis: decision.basis,
      actor,
      actorRole,
      changedAt: at,
      decisionRef: decision.id,
      evidenceRef: decision.evidenceRef,
      conditions: [...decision.conditions],
      reason,
    };
    this.audit.push(event);
    return { ...event, conditions: [...event.conditions] };
  }

  latest(sourceId: string, activity: Activity): ActivityDecision | null {
    for (let i = this.decisions.length - 1; i >= 0; i -= 1) {
      const decision = this.decisions[i]!;
      if (decision.sourceId === sourceId && decision.activity === activity)
        return decision;
    }
    return null;
  }

  history(sourceId?: string, activity?: Activity): ActivityDecision[] {
    return this.decisions
      .filter(
        (decision) =>
          (sourceId === undefined || decision.sourceId === sourceId) &&
          (activity === undefined || decision.activity === activity),
      )
      .map((decision) => ({
        ...decision,
        conditions: [...decision.conditions],
      }));
  }

  auditTrail(sourceId?: string): AuthorizationAuditRecord[] {
    return this.audit
      .filter((event) => sourceId === undefined || event.sourceId === sourceId)
      .map((event) => ({ ...event, conditions: [...event.conditions] }));
  }

  check(
    sourceId: string,
    activity: Activity,
    options: CheckOptions = {},
  ): ActivityCheck {
    const decision = this.latest(sourceId, activity);
    const base = { sourceId, activity, decision };
    if (!decision)
      return {
        ...base,
        allowed: false,
        status: "UNKNOWN",
        reason: "no_decision_recorded",
      };

    const allowedBases = options.allowedBases ?? [
      "COUNSEL_DETERMINATION",
      "OWNER_RISK_ACCEPTANCE",
      "SYNTHETIC_FIXTURE",
    ];
    if (!allowedBases.includes(decision.basis))
      return {
        ...base,
        allowed: false,
        status: decision.status,
        reason: `basis_not_accepted:${decision.basis}`,
      };

    if (decision.expiresAt) {
      const now = options.now ?? new Date().toISOString();
      if (Date.parse(now) >= Date.parse(decision.expiresAt))
        return {
          ...base,
          allowed: false,
          status: decision.status,
          reason: "authorization_expired",
        };
    }

    if (decision.status === "AUTHORIZED")
      return {
        ...base,
        allowed: true,
        status: decision.status,
        reason: "authorized",
      };

    if (decision.status === "AUTHORIZED_WITH_CONDITIONS") {
      const satisfied = new Set(options.satisfiedConditions ?? []);
      const unmet = decision.conditions.filter(
        (condition) => !satisfied.has(condition),
      );
      return {
        ...base,
        allowed: unmet.length === 0,
        status: decision.status,
        reason:
          unmet.length === 0
            ? "authorized_with_conditions_satisfied"
            : `conditions_unmet:${unmet.join("|")}`,
      };
    }

    return {
      ...base,
      allowed: false,
      status: decision.status,
      reason:
        decision.status === "PROHIBITED"
          ? "prohibited"
          : decision.status === "RESTRICTED"
            ? "restricted"
            : decision.status === "REVIEW_REQUIRED"
              ? "review_required"
              : "not_authorized",
    };
  }
}

export type ReadinessStatus =
  | "NOT_ASSESSED"
  | "BLOCKED_AUTHORIZATION"
  | "BLOCKED_AUTHENTICITY"
  | "BLOCKED_LEGAL_DATES"
  | "BLOCKED_SOURCE_EVIDENCE"
  | "CONDITIONALLY_READY"
  | "READY_FOR_CONTROLLED_INGESTION";

export interface ReadinessSignals {
  authorizationChecks: readonly ActivityCheck[];
  authenticity: {
    independentCorroboration:
      | "VERIFIED"
      | "SECOND_SOURCE_UNVERIFIED"
      | "CONFLICT"
      | "NOT_ASSESSED";
  };
  legalDates: {
    requiredFields: readonly string[];
    verifiedFields: readonly string[];
  };
}

export interface ReadinessAssessment {
  status: ReadinessStatus;
  blockers: string[];
}

/** Fail-closed readiness assessment. Every blocker must be cleared. */
export function assessCorpusReadiness(
  signals: ReadinessSignals,
): ReadinessAssessment {
  if (signals.authorizationChecks.length === 0)
    return { status: "NOT_ASSESSED", blockers: ["no_authorization_checks"] };

  const denied = signals.authorizationChecks.filter((check) => !check.allowed);
  if (denied.length > 0)
    return {
      status: "BLOCKED_AUTHORIZATION",
      blockers: denied.map((check) => `${check.activity}:${check.reason}`),
    };

  if (signals.authenticity.independentCorroboration === "NOT_ASSESSED")
    return {
      status: "BLOCKED_SOURCE_EVIDENCE",
      blockers: ["independent_corroboration:NOT_ASSESSED"],
    };

  if (signals.authenticity.independentCorroboration !== "VERIFIED")
    return {
      status: "BLOCKED_AUTHENTICITY",
      blockers: [
        `independent_corroboration:${signals.authenticity.independentCorroboration}`,
      ],
    };

  const missingDates = signals.legalDates.requiredFields.filter(
    (field) => !signals.legalDates.verifiedFields.includes(field),
  );
  if (missingDates.length > 0)
    return {
      status: "BLOCKED_LEGAL_DATES",
      blockers: missingDates.map((field) => `date_unverified:${field}`),
    };

  const conditional = signals.authorizationChecks.some(
    (check) => check.status === "AUTHORIZED_WITH_CONDITIONS",
  );
  return conditional
    ? { status: "CONDITIONALLY_READY", blockers: [] }
    : { status: "READY_FOR_CONTROLLED_INGESTION", blockers: [] };
}

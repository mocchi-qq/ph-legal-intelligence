// @phli/legal-ingestion — durable-capable counsel registry contract
// Gate 7. See docs/gates/gate-7/02_REPOSITORY_CONTRACT.md and 07_…
//
// Two adapters implement one contract:
//   * InMemoryCounselRegistry — deterministic adapter for isolated tests;
//   * D1CounselRegistry       — durable adapter (counsel-d1-store.ts).
// Authorization projection is not part of either adapter: it is one pure
// function (`projectFromState`) fed by `loadState`. No SQL contains legal logic.

import type {
  AuthorizationAuditEventType,
  AuthorizationAuditInput,
  AuthorizationAuditService,
} from "./authorization-audit";
import type {
  CounselActivity,
  CounselAuditEvent,
  CounselDetermination,
  CounselDeterminationRepository,
  CounselDeterminationStatus,
  CounselProfessional,
  CounselProjection,
} from "./counsel-determinations";
import {
  auditEventTypeFor,
  type CounselRegistryState,
  projectFromState,
} from "./counsel-projection";
import type { EvidenceLookup } from "./evidence";
import { resolveEvidenceStatuses } from "./evidence";

export type RegistryMode = "in-memory" | "d1";

export interface RecordDeterminationOptions {
  /** Stable operation identifier used to detect retries. */
  operationId?: string;
  correlationId?: string | null;
  changedAt?: string;
}

export interface RecordDeterminationResult {
  status: "RECORDED" | "ALREADY_COMMITTED";
  audit: CounselAuditEvent;
}

/**
 * The repository contract. Reads return domain objects; `loadState` is the only
 * input to authorization projection.
 */
export interface CounselRegistry {
  readonly mode: RegistryMode;
  registerProfessional(
    professional: CounselProfessional,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent>;
  recordDetermination(
    determination: CounselDetermination,
    actor: string,
    reason: string,
    options?: RecordDeterminationOptions,
  ): Promise<RecordDeterminationResult>;
  statusOf(id: string): Promise<CounselDeterminationStatus | null>;
  transition(
    id: string,
    newStatus: CounselDeterminationStatus,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent>;
  revoke(
    id: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent>;
  supersede(
    oldId: string,
    newId: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent>;
  getDetermination(id: string): Promise<CounselDetermination | null>;
  /** Source-wide determinations and determinations scoped to this document. */
  listByDocument(
    sourceId: string,
    documentId: string,
  ): Promise<CounselDetermination[]>;
  loadState(sourceId: string): Promise<CounselRegistryState>;
  auditTrail(determinationId?: string): Promise<CounselAuditEvent[]>;
}

function clone(determination: CounselDetermination): CounselDetermination {
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
}

export function determinationsEquivalent(
  a: CounselDetermination,
  b: CounselDetermination,
): boolean {
  const normalise = (value: CounselDetermination) =>
    JSON.stringify({
      ...value,
      activityDecisions: value.activityDecisions.map((decision) => ({
        ...decision,
        conditions: [...decision.conditions].sort(),
        limitations: [...decision.limitations].sort(),
        permittedUsers: [...decision.permittedUsers].sort(),
      })),
    });
  return normalise(a) === normalise(b);
}

/**
 * Test adapter over the Gate 5 in-memory repository. It deliberately has no
 * commit marker: the process is the durability boundary, so a recorded
 * determination is complete by construction.
 */
export class InMemoryCounselRegistry implements CounselRegistry {
  readonly mode = "in-memory" as const;

  constructor(private readonly repository: CounselDeterminationRepository) {}

  async registerProfessional(
    professional: CounselProfessional,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    return this.repository.registerCounsel(
      professional,
      actor,
      reason,
      changedAt,
    );
  }

  async recordDetermination(
    determination: CounselDetermination,
    actor: string,
    reason: string,
    _options: RecordDeterminationOptions = {},
  ): Promise<RecordDeterminationResult> {
    const existing = await this.getDetermination(determination.id);
    if (existing) {
      if (!determinationsEquivalent(existing, determination))
        throw new Error("duplicate_determination_id");
      const audit = this.repository
        .auditTrail()
        .filter(
          (event) =>
            event.determinationId === determination.id &&
            event.action === "DETERMINATION_RECORDED",
        )
        .at(-1);
      return {
        status: "ALREADY_COMMITTED",
        audit: audit ?? {
          id: "synthetic_replay",
          determinationId: determination.id,
          counselId: determination.counselId,
          action: "DETERMINATION_RECORDED",
          previousStatus: null,
          newStatus: determination.status,
          actor,
          changedAt: new Date().toISOString(),
          reason,
          evidenceRef: null,
        },
      };
    }
    const audit = this.repository.record(determination, actor, reason);
    return { status: "RECORDED", audit };
  }

  async statusOf(id: string): Promise<CounselDeterminationStatus | null> {
    return this.repository.statusOf(id);
  }

  async transition(
    id: string,
    newStatus: CounselDeterminationStatus,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    return this.repository.transition(id, newStatus, actor, reason, changedAt);
  }

  async revoke(
    id: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    return this.repository.revoke(id, actor, reason, changedAt);
  }

  async supersede(
    oldId: string,
    newId: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    return this.repository.supersede(oldId, newId, actor, reason, changedAt);
  }

  async getDetermination(id: string): Promise<CounselDetermination | null> {
    const found = this.repository
      .history()
      .find((determination) => determination.id === id);
    return found ? clone(found) : null;
  }

  async listByDocument(
    sourceId: string,
    documentId: string,
  ): Promise<CounselDetermination[]> {
    return this.repository
      .history()
      .filter(
        (determination) =>
          determination.sourceId === sourceId &&
          (determination.documentIds.length === 0 ||
            determination.documentIds.includes(documentId)),
      )
      .map(clone);
  }

  async loadState(sourceId: string): Promise<CounselRegistryState> {
    return this.repository.snapshot(sourceId);
  }

  async auditTrail(determinationId?: string): Promise<CounselAuditEvent[]> {
    const all = this.repository.auditTrail();
    return determinationId
      ? all.filter((event) => event.determinationId === determinationId)
      : all;
  }
}

export type AuthorizationRuntimeMode = "TEST_IN_MEMORY" | "PRODUCTION_D1";

export interface AuthorizationRequest {
  sourceId: string;
  activity: CounselActivity;
  /** The content operation this decision gates, e.g. "ingest". */
  operation: string;
  documentId?: string | null;
  now?: string;
  satisfiedConditions?: readonly string[];
  correlationId?: string | null;
}

export interface AuthorizationDecision extends CounselProjection {
  evaluatedAt: string;
  registryRevision: number | null;
  auditRecorded: boolean;
}

export interface CounselAuthorizationServiceOptions {
  runtimeMode: AuthorizationRuntimeMode;
  /**
   * Optional evidence store. When supplied, every reference a determination
   * relies on must be VERIFIED_FOR_RECORDING or the projection denies.
   */
  evidence?: EvidenceLookup;
}

/**
 * Explicit authorization boundary. Production mode refuses an in-memory
 * registry: there is no silent fallback, and registry failure denies.
 */
export class CounselAuthorizationService {
  private readonly registry: CounselRegistry;
  private readonly audit: AuthorizationAuditService;
  private readonly options: CounselAuthorizationServiceOptions;

  constructor(
    registry: CounselRegistry,
    audit: AuthorizationAuditService,
    options: CounselAuthorizationServiceOptions,
  ) {
    if (options.runtimeMode === "PRODUCTION_D1" && registry.mode !== "d1")
      throw new Error("production_requires_durable_registry");
    this.registry = registry;
    this.audit = audit;
    this.options = options;
  }

  async authorize(
    request: AuthorizationRequest,
  ): Promise<AuthorizationDecision> {
    const evaluatedAt = request.now ?? new Date().toISOString();
    let state: CounselRegistryState;
    try {
      state = await this.registry.loadState(request.sourceId);
    } catch {
      await this.recordAudit({
        eventType: "REGISTRY_UNAVAILABLE",
        outcome: "ERROR",
        sourceId: request.sourceId,
        documentId: request.documentId ?? null,
        activity: request.activity,
        operation: request.operation,
        reasonCode: "registry_unavailable",
        correlationId: request.correlationId ?? null,
        registryStatus: "UNAVAILABLE",
      });
      return {
        allowed: false,
        sourceId: request.sourceId,
        activity: request.activity,
        determinationId: null,
        determinationStatus: null,
        activityStatus: "NO_DECISION",
        reason: "registry_unavailable",
        evaluatedAt,
        registryRevision: null,
        auditRecorded: false,
      };
    }

    if (this.options.evidence) {
      const references = new Set<string>();
      for (const determination of state.determinations)
        for (const reference of determination.evidenceRefs)
          references.add(reference);
      state = {
        ...state,
        evidenceStatuses: await resolveEvidenceStatuses(
          [...references],
          this.options.evidence,
        ),
      };
    }

    const projection = projectFromState(
      state,
      request.sourceId,
      request.activity,
      {
        now: request.now,
        documentId: request.documentId ?? null,
        satisfiedConditions: request.satisfiedConditions,
      },
    );

    const eventType: AuthorizationAuditEventType =
      auditEventTypeFor(projection);
    const auditRecorded = await this.recordAudit({
      eventType,
      outcome: projection.allowed ? "GRANTED" : "DENIED",
      sourceId: request.sourceId,
      documentId: request.documentId ?? null,
      activity: request.activity,
      operation: request.operation,
      reasonCode: projection.reason,
      determinationId: projection.determinationId,
      correlationId: request.correlationId ?? null,
      registryStatus: projection.determinationStatus,
      context: {
        registryMode: this.registry.mode,
        revision: state.revision ?? null,
      },
    });

    if (!auditRecorded)
      return {
        ...projection,
        allowed: false,
        reason: "authorization_audit_unavailable",
        evaluatedAt,
        registryRevision: state.revision ?? null,
        auditRecorded: false,
      };

    return {
      ...projection,
      evaluatedAt,
      registryRevision: state.revision ?? null,
      auditRecorded: true,
    };
  }

  private async recordAudit(input: AuthorizationAuditInput): Promise<boolean> {
    try {
      await this.audit.recordAsync(input);
      return true;
    } catch {
      return false;
    }
  }
}

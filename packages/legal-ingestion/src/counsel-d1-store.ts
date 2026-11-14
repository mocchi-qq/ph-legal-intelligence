// @phli/legal-ingestion — D1 counsel registry adapter
// Gate 7. See docs/gates/gate-7/03_D1_ADAPTER_IMPLEMENTATION.md
//
// Uses the documented D1 prepared-statement + batch surface. Queries are always
// parameterized. Legal decision logic is not in SQL: this adapter reads rows and
// hands them to `projectFromState` through `loadState`.
//
// D1 batch atomicity is not verifiable on the development host, so writes never
// rely on it. A determination becomes visible only when a `counsel_registry_commits`
// row — the last statement of the write — exists AND its payload hash matches the
// stored rows. See migration 0008.

import type { AuthorizationAuditEvent } from "./authorization-audit";
import {
  type CounselActivityDecision,
  type CounselAuditEvent,
  type CounselDetermination,
  type CounselDeterminationStatus,
  type CounselProfessional,
  validateDetermination,
} from "./counsel-determinations";
import {
  type CounselRegistryState,
  registryPayloadFingerprint,
} from "./counsel-projection";
import {
  type CounselRegistry,
  determinationsEquivalent,
  type RecordDeterminationOptions,
  type RecordDeterminationResult,
} from "./counsel-registry";
import type { D1DatabaseLike, D1Result } from "./d1-types";
import { sha256 } from "./store";

interface ProfessionalRow {
  id: string;
  name: string;
  firm: string | null;
  jurisdiction: string;
  capacity: string;
  verification_status: CounselProfessional["verificationStatus"];
  verification_evidence_ref: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

interface DeterminationRow {
  id: string;
  source_id: string;
  document_scope_json: string;
  counsel_id: string;
  date_received: string;
  date_issued: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  status: CounselDeterminationStatus;
  scope: string;
  evidence_refs_json: string;
  decision_document_ref: string | null;
  decision_document_hash: string | null;
  recorded_by: string;
  supersedes_id: string | null;
  notes: string | null;
}

interface ActivityRow {
  id: string;
  determination_id: string;
  activity: CounselActivityDecision["activity"];
  status: CounselActivityDecision["status"];
  scope: string | null;
  conditions_json: string | null;
  limitations_json: string | null;
  permitted_users_json: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  evidence_ref: string | null;
}

interface AuditRow {
  id: string;
  determination_id: string | null;
  counsel_id: string | null;
  action: CounselAuditEvent["action"] | "STATUS_CHANGED";
  previous_status: CounselDeterminationStatus | null;
  new_status: CounselDeterminationStatus | null;
  actor: string;
  changed_at: string;
  reason: string;
  evidence_ref: string | null;
}

interface CommitRow {
  determination_id: string;
  source_id: string;
  operation_id: string;
  payload_hash: string;
  committed_at: string;
}

interface AuthorizationAuditRow {
  id: string;
  event_type: AuthorizationAuditEvent["eventType"];
  outcome: AuthorizationAuditEvent["outcome"];
  occurred_at: string;
  source_id: string;
  document_id: string | null;
  activity: string;
  operation: string;
  reason_code: string;
  determination_id: string | null;
  correlation_id: string | null;
  registry_status: string | null;
  context_json: string;
}

const EMPTY: D1Result<never> = { results: [], success: true };

function jsonArray(raw: string | null): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

let idCounter = 0;

/** UUIDv4 where available; crypto-random suffix otherwise (never Math.random alone). */
function uniqueId(prefix: string): string {
  const cryptoApi = globalThis.crypto as
    | {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint32Array) => Uint32Array;
      }
    | undefined;
  if (typeof cryptoApi?.randomUUID === "function")
    return `${prefix}_${cryptoApi.randomUUID()}`;
  idCounter += 1;
  let random = "";
  if (typeof cryptoApi?.getRandomValues === "function") {
    const values = cryptoApi.getRandomValues(new Uint32Array(2));
    random = `${values[0]?.toString(16) ?? ""}${values[1]?.toString(16) ?? ""}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${random}`;
}

function auditId(): string {
  return uniqueId("counsel_audit");
}

function operationId(): string {
  return uniqueId("counsel_op");
}

/** Fold append-only audit events into the effective status. */
function effectiveStatus(
  base: CounselDeterminationStatus,
  events: readonly AuditRow[],
): CounselDeterminationStatus {
  let status = base;
  for (const event of events) {
    if (event.action === "REVOKED") return "REVOKED";
    if (event.action === "SUPERSEDED") status = "SUPERSEDED";
    else if (
      event.action === "STATUS_CHANGED" &&
      event.new_status &&
      status !== "SUPERSEDED"
    )
      status = event.new_status;
  }
  return status;
}

function toDetermination(
  row: DeterminationRow,
  activities: readonly ActivityRow[],
): CounselDetermination {
  return {
    id: row.id,
    sourceId: row.source_id,
    documentIds: jsonArray(row.document_scope_json),
    counselId: row.counsel_id,
    dateReceived: row.date_received,
    dateIssued: row.date_issued,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    status: row.status,
    scope: row.scope,
    activityDecisions: activities.map((activity) => ({
      activity: activity.activity,
      status: activity.status,
      scope: activity.scope,
      conditions: jsonArray(activity.conditions_json),
      limitations: jsonArray(activity.limitations_json),
      permittedUsers: jsonArray(activity.permitted_users_json),
      effectiveDate: activity.effective_date,
      expiryDate: activity.expiry_date,
      evidenceRef: activity.evidence_ref,
    })),
    evidenceRefs: jsonArray(row.evidence_refs_json),
    decisionDocumentRef: row.decision_document_ref,
    decisionDocumentHash: row.decision_document_hash,
    recordedBy: row.recorded_by,
    supersedesId: row.supersedes_id,
    notes: row.notes,
  };
}

function toAuditEvent(row: AuditRow): CounselAuditEvent {
  return {
    id: row.id,
    determinationId: row.determination_id,
    counselId: row.counsel_id,
    action: row.action === "STATUS_CHANGED" ? "STATUS_CHANGED" : row.action,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actor: row.actor,
    changedAt: row.changed_at,
    reason: row.reason,
    evidenceRef: row.evidence_ref,
  };
}

export class D1CounselRegistry implements CounselRegistry {
  readonly mode = "d1" as const;

  constructor(private readonly db: D1DatabaseLike) {}

  async registerProfessional(
    professional: CounselProfessional,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    if (!professional.id.trim()) throw new Error("missing_counsel_id");
    if (!professional.name.trim()) throw new Error("missing_counsel_name");
    if (!actor.trim()) throw new Error("missing_actor");
    if (!reason.trim()) throw new Error("missing_reason");
    if (professional.verificationStatus === "VERIFIED") {
      if (
        !professional.verificationEvidenceRef?.trim() ||
        !professional.verifiedBy?.trim() ||
        !professional.verifiedAt?.trim()
      )
        throw new Error("counsel_verification_incomplete");
    }
    if (await this.getProfessional(professional.id))
      throw new Error("duplicate_counsel_id");
    const event: CounselAuditEvent = {
      id: auditId(),
      determinationId: null,
      counselId: professional.id,
      action: "COUNSEL_REGISTERED",
      previousStatus: null,
      newStatus: null,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: professional.verificationEvidenceRef ?? null,
    };
    await this.batch([
      this.db
        .prepare(
          `INSERT INTO counsel_professionals
            (id, name, firm, jurisdiction, capacity, verification_status,
             verification_evidence_ref, verified_by, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          professional.id,
          professional.name,
          professional.firm,
          professional.jurisdiction,
          professional.capacity,
          professional.verificationStatus,
          professional.verificationEvidenceRef,
          professional.verifiedBy,
          professional.verifiedAt,
        ),
      this.auditStatement(event),
    ]);
    return event;
  }

  async getProfessional(id: string): Promise<CounselProfessional | null> {
    const row = await this.db
      .prepare("SELECT * FROM counsel_professionals WHERE id = ?")
      .bind(id)
      .first<ProfessionalRow>();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      firm: row.firm,
      jurisdiction: row.jurisdiction,
      capacity: row.capacity,
      verificationStatus: row.verification_status,
      verificationEvidenceRef: row.verification_evidence_ref,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at,
    };
  }

  async recordDetermination(
    determination: CounselDetermination,
    actor: string,
    reason: string,
    options: RecordDeterminationOptions = {},
  ): Promise<RecordDeterminationResult> {
    if (!actor.trim()) throw new Error("missing_actor");
    if (!reason.trim()) throw new Error("missing_reason");
    const counsel = await this.getProfessional(determination.counselId);
    const validation = validateDetermination(
      determination,
      counsel ?? undefined,
    );
    if (!validation.ok) throw new Error(validation.reason);

    const existingRow = await this.db
      .prepare("SELECT id FROM counsel_determinations WHERE id = ?")
      .bind(determination.id)
      .first<{ id: string }>();
    if (existingRow) {
      const commit = await this.getCommit(determination.id);
      if (!commit) throw new Error("incomplete_record_exists");
      const existing = await this.getDetermination(determination.id);
      if (
        !existing ||
        !determinationsEquivalent(existing, determination) ||
        commit.payload_hash !== this.fingerprint(existing)
      )
        throw new Error("duplicate_determination_id");
      const recorded = await this.findRecordedAudit(determination.id);
      return {
        status: "ALREADY_COMMITTED",
        audit: recorded ?? {
          id: "already_committed",
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

    // Supersession declared at record time is written in the same batch, before
    // the commit marker, so the replacement and the retirement commit together.
    let supersession: CounselAuditEvent | null = null;
    if (determination.supersedesId) {
      const previous = await this.getDetermination(determination.supersedesId);
      if (!previous) throw new Error("superseded_determination_not_found");
      if (previous.sourceId !== determination.sourceId)
        throw new Error("superseded_source_mismatch");
      const previousStatus = await this.statusOf(determination.supersedesId);
      if (previousStatus === "REVOKED")
        throw new Error("cannot_supersede_revoked");
      if (previousStatus === "SUPERSEDED")
        throw new Error("already_superseded");
      supersession = {
        id: auditId(),
        determinationId: determination.supersedesId,
        counselId: previous.counselId,
        action: "SUPERSEDED",
        previousStatus,
        newStatus: "SUPERSEDED",
        actor,
        changedAt: options.changedAt ?? new Date().toISOString(),
        reason,
        evidenceRef: null,
      };
    }

    const audit: CounselAuditEvent = {
      id: auditId(),
      determinationId: determination.id,
      counselId: determination.counselId,
      action: "DETERMINATION_RECORDED",
      previousStatus: null,
      newStatus: determination.status,
      actor,
      changedAt: options.changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: determination.evidenceRefs[0] ?? null,
    };

    const statements = [
      this.db
        .prepare(
          `INSERT INTO counsel_determinations
            (id, source_id, document_scope_json, counsel_id, date_received,
             date_issued, effective_date, expiry_date, status, scope,
             evidence_refs_json, decision_document_ref, decision_document_hash,
             recorded_by, supersedes_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          determination.id,
          determination.sourceId,
          JSON.stringify(determination.documentIds),
          determination.counselId,
          determination.dateReceived,
          determination.dateIssued,
          determination.effectiveDate,
          determination.expiryDate,
          determination.status,
          determination.scope,
          JSON.stringify(determination.evidenceRefs),
          determination.decisionDocumentRef,
          determination.decisionDocumentHash,
          determination.recordedBy,
          determination.supersedesId,
          determination.notes,
        ),
      ...determination.activityDecisions.map((activity) =>
        this.db
          .prepare(
            `INSERT INTO counsel_activity_decisions
              (id, determination_id, activity, status, scope, conditions_json,
               limitations_json, permitted_users_json, effective_date,
               expiry_date, evidence_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `act_${determination.id}_${activity.activity}`,
            determination.id,
            activity.activity,
            activity.status,
            activity.scope,
            JSON.stringify(activity.conditions),
            JSON.stringify(activity.limitations),
            JSON.stringify(activity.permittedUsers),
            activity.effectiveDate,
            activity.expiryDate,
            activity.evidenceRef,
          ),
      ),
      this.auditStatement(audit),
      ...(supersession ? [this.auditStatement(supersession)] : []),
      // Commit marker MUST be last. It is the only record projection trusts.
      this.db
        .prepare(
          `INSERT INTO counsel_registry_commits
            (determination_id, source_id, operation_id, payload_hash, committed_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          determination.id,
          determination.sourceId,
          options.operationId ?? operationId(),
          this.fingerprint(determination),
          options.changedAt ?? new Date().toISOString(),
        ),
    ];

    try {
      await this.batch(statements);
    } catch (error) {
      throw new Error(this.classify(error));
    }
    return { status: "RECORDED", audit };
  }

  async getDetermination(id: string): Promise<CounselDetermination | null> {
    const row = await this.db
      .prepare("SELECT * FROM counsel_determinations WHERE id = ?")
      .bind(id)
      .first<DeterminationRow>();
    if (!row) return null;
    const activities = await this.db
      .prepare(
        "SELECT * FROM counsel_activity_decisions WHERE determination_id = ? ORDER BY activity",
      )
      .bind(id)
      .all<ActivityRow>();
    const determination = toDetermination(row, activities.results ?? []);
    const commit = await this.getCommit(id);
    if (!commit) return null;
    if (commit.source_id !== determination.sourceId) return null;
    if (commit.payload_hash !== this.fingerprint(determination)) return null;
    return determination;
  }

  async statusOf(id: string): Promise<CounselDeterminationStatus | null> {
    const determination = await this.getDetermination(id);
    if (!determination) return null;
    const events = await this.db
      .prepare(
        "SELECT * FROM counsel_audit_events WHERE determination_id = ? ORDER BY changed_at, rowid",
      )
      .bind(id)
      .all<AuditRow>();
    return effectiveStatus(determination.status, events.results ?? []);
  }

  async transition(
    id: string,
    newStatus: CounselDeterminationStatus,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    if (newStatus === "REVOKED")
      return this.revoke(id, actor, reason, changedAt);
    if (newStatus === "SUPERSEDED")
      throw new Error("use_explicit_supersession");
    const determination = await this.getDetermination(id);
    if (!determination) throw new Error("determination_not_found");
    const current = await this.statusOf(id);
    if (current === "REVOKED" || current === "SUPERSEDED")
      throw new Error("terminal_status");
    if (newStatus === "VERIFIED_FOR_RECORDING") {
      const counsel = await this.getProfessional(determination.counselId);
      const validation = validateDetermination(
        { ...determination, status: newStatus },
        counsel ?? undefined,
      );
      if (!validation.ok) throw new Error(validation.reason);
    }
    const event: CounselAuditEvent = {
      id: auditId(),
      determinationId: id,
      counselId: determination.counselId,
      action: "STATUS_CHANGED",
      previousStatus: current,
      newStatus,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: null,
    };
    try {
      await this.auditStatement(event).run();
    } catch (error) {
      throw new Error(this.classify(error));
    }
    return event;
  }

  async revoke(
    id: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    return this.appendTerminalEvent(id, "REVOKED", actor, reason, changedAt);
  }

  async supersede(
    oldId: string,
    newId: string,
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    const old = await this.getDetermination(oldId);
    const next = await this.getDetermination(newId);
    if (!old || !next) throw new Error("determination_not_found");
    if (old.sourceId !== next.sourceId) throw new Error("source_mismatch");
    return this.appendTerminalEvent(
      oldId,
      "SUPERSEDED",
      actor,
      reason,
      changedAt,
    );
  }

  private async appendTerminalEvent(
    id: string,
    action: "REVOKED" | "SUPERSEDED",
    actor: string,
    reason: string,
    changedAt?: string,
  ): Promise<CounselAuditEvent> {
    if (!actor.trim()) throw new Error("missing_actor");
    if (!reason.trim()) throw new Error("missing_reason");
    const determination = await this.getDetermination(id);
    if (!determination) throw new Error("determination_not_found");
    const current = await this.statusOf(id);
    if (current === "REVOKED")
      throw new Error(
        action === "REVOKED" ? "already_revoked" : "cannot_supersede_revoked",
      );
    if (current === "SUPERSEDED") throw new Error("already_superseded");
    // A concurrent caller may be inserting the other terminal action right now.
    // The single-terminal unique index is the real guard; this gives a domain
    // error instead of a raw constraint failure in the common case.
    const terminal = await this.db
      .prepare(
        "SELECT action FROM counsel_audit_events WHERE determination_id = ? AND action IN ('REVOKED', 'SUPERSEDED')",
      )
      .bind(id)
      .all<{ action: string }>();
    const hasRevoked = (terminal.results ?? []).some(
      (row) => row.action === "REVOKED",
    );
    const hasSuperseded = (terminal.results ?? []).some(
      (row) => row.action === "SUPERSEDED",
    );
    if (action === "REVOKED" && hasSuperseded)
      throw new Error("cannot_revoke_superseded");
    if (action === "SUPERSEDED" && hasRevoked)
      throw new Error("cannot_supersede_revoked");
    const event: CounselAuditEvent = {
      id: auditId(),
      determinationId: id,
      counselId: determination.counselId,
      action,
      previousStatus: current,
      newStatus: action,
      actor,
      changedAt: changedAt ?? new Date().toISOString(),
      reason,
      evidenceRef: null,
    };
    try {
      await this.auditStatement(event).run();
    } catch (error) {
      throw new Error(this.classify(error));
    }
    return event;
  }

  async listByDocument(
    sourceId: string,
    documentId: string,
  ): Promise<CounselDetermination[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM counsel_determinations
          WHERE source_id = ?
            AND (document_scope_json = '[]'
                 OR EXISTS (
                   SELECT 1 FROM json_each(counsel_determinations.document_scope_json)
                   WHERE json_each.value = ?
                 ))
          ORDER BY rowid`,
      )
      .bind(sourceId, documentId)
      .all<DeterminationRow>();
    const out: CounselDetermination[] = [];
    for (const row of rows.results ?? []) {
      const determination = await this.getDetermination(row.id);
      if (determination) out.push(determination);
    }
    return out;
  }

  /**
   * Rows from a failed write that never got a commit marker. They are inert for
   * authorization and cannot be deleted (append-only). Recovery is to record the
   * determination again under a new id; a retry of the same id is refused.
   */
  async listIncompleteDeterminations(sourceId: string): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT d.id AS id
           FROM counsel_determinations d
           LEFT JOIN counsel_registry_commits c
             ON c.determination_id = d.id
          WHERE d.source_id = ?
            AND c.determination_id IS NULL
          ORDER BY d.rowid`,
      )
      .bind(sourceId)
      .all<{ id: string }>();
    return (result.results ?? []).map((row) => row.id);
  }

  async loadState(sourceId: string): Promise<CounselRegistryState> {
    // Professionals are global (not source-scoped); the table is small and every
    // determination references one. This is a bounded, documented full read.
    const professionals = await this.db
      .prepare("SELECT * FROM counsel_professionals")
      .all<ProfessionalRow>();
    const rows = await this.db
      .prepare(
        "SELECT * FROM counsel_determinations WHERE source_id = ? ORDER BY rowid",
      )
      .bind(sourceId)
      .all<DeterminationRow>();
    const ids = (rows.results ?? []).map((row) => row.id);
    const activities = ids.length
      ? await this.db
          .prepare(
            `SELECT * FROM counsel_activity_decisions
              WHERE determination_id IN (${placeholders(ids.length)})
              ORDER BY determination_id, activity`,
          )
          .bind(...ids)
          .all<ActivityRow>()
      : EMPTY;
    const commits = ids.length
      ? await this.db
          .prepare(
            `SELECT * FROM counsel_registry_commits
              WHERE determination_id IN (${placeholders(ids.length)})`,
          )
          .bind(...ids)
          .all<CommitRow>()
      : EMPTY;
    const auditRows = ids.length
      ? await this.db
          .prepare(
            `SELECT * FROM counsel_audit_events
              WHERE determination_id IN (${placeholders(ids.length)})
              ORDER BY changed_at, rowid`,
          )
          .bind(...ids)
          .all<AuditRow>()
      : EMPTY;

    const commitById = new Map(
      (commits.results ?? []).map((commit) => [
        commit.determination_id,
        commit,
      ]),
    );
    const activitiesById = new Map<string, ActivityRow[]>();
    for (const activity of activities.results ?? []) {
      const list = activitiesById.get(activity.determination_id) ?? [];
      list.push(activity);
      activitiesById.set(activity.determination_id, list);
    }
    const auditById = new Map<string, AuditRow[]>();
    for (const event of auditRows.results ?? []) {
      if (!event.determination_id) continue;
      const list = auditById.get(event.determination_id) ?? [];
      list.push(event);
      auditById.set(event.determination_id, list);
    }

    const determinations: CounselDetermination[] = [];
    const statuses = new Map<string, CounselDeterminationStatus>();
    for (const row of rows.results ?? []) {
      const determination = toDetermination(
        row,
        activitiesById.get(row.id) ?? [],
      );
      const commit = commitById.get(row.id);
      // Fail closed: no marker, foreign marker, or a payload that no longer
      // matches is not an authorization input.
      if (!commit) continue;
      if (commit.source_id !== determination.sourceId) continue;
      if (commit.payload_hash !== this.fingerprint(determination)) continue;
      determinations.push(determination);
      statuses.set(
        row.id,
        effectiveStatus(row.status, auditById.get(row.id) ?? []),
      );
    }

    return {
      professionals: new Map(
        (professionals.results ?? []).map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            firm: row.firm,
            jurisdiction: row.jurisdiction,
            capacity: row.capacity,
            verificationStatus: row.verification_status,
            verificationEvidenceRef: row.verification_evidence_ref,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
          } satisfies CounselProfessional,
        ]),
      ),
      determinations,
      statuses,
      revision: determinations.length + (auditRows.results?.length ?? 0),
    };
  }

  /**
   * Bounded read. Without a determination filter this is capped at 1000 rows so
   * an unfiltered call cannot load an unbounded table. Callers that need full
   * history must page by determination or by time.
   */
  async auditTrail(
    determinationId?: string,
    limit = 1000,
  ): Promise<CounselAuditEvent[]> {
    const capped = Math.max(1, Math.min(limit, 1000));
    const statement = determinationId
      ? this.db
          .prepare(
            "SELECT * FROM counsel_audit_events WHERE determination_id = ? ORDER BY changed_at, rowid LIMIT ?",
          )
          .bind(determinationId, capped)
      : this.db
          .prepare(
            "SELECT * FROM counsel_audit_events ORDER BY changed_at, rowid LIMIT ?",
          )
          .bind(capped);
    const result = await statement.all<AuditRow>();
    return (result.results ?? []).map(toAuditEvent);
  }

  async appendAuthorizationAudit(
    event: AuthorizationAuditEvent,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO authorization_audit_events
          (id, event_type, outcome, occurred_at, source_id, document_id,
           activity, operation, reason_code, determination_id, correlation_id,
           registry_status, context_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        event.id,
        event.eventType,
        event.outcome,
        event.occurredAt,
        event.sourceId,
        event.documentId,
        event.activity,
        event.operation,
        event.reasonCode,
        event.determinationId,
        event.correlationId,
        event.registryStatus,
        JSON.stringify(event.context),
      )
      .run();
  }

  async listAuthorizationAudit(
    sourceId?: string,
  ): Promise<AuthorizationAuditEvent[]> {
    const statement = sourceId
      ? this.db
          .prepare(
            "SELECT * FROM authorization_audit_events WHERE source_id = ? ORDER BY occurred_at, rowid",
          )
          .bind(sourceId)
      : this.db.prepare(
          "SELECT * FROM authorization_audit_events ORDER BY occurred_at, rowid",
        );
    const result = await statement.all<AuthorizationAuditRow>();
    return (result.results ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      outcome: row.outcome,
      occurredAt: row.occurred_at,
      sourceId: row.source_id,
      documentId: row.document_id,
      activity: row.activity,
      operation: row.operation,
      reasonCode: row.reason_code,
      determinationId: row.determination_id,
      correlationId: row.correlation_id,
      registryStatus: row.registry_status,
      context: JSON.parse(
        row.context_json,
      ) as AuthorizationAuditEvent["context"],
    }));
  }

  private async getCommit(id: string): Promise<CommitRow | null> {
    return this.db
      .prepare(
        "SELECT * FROM counsel_registry_commits WHERE determination_id = ?",
      )
      .bind(id)
      .first<CommitRow>();
  }

  private async findRecordedAudit(
    determinationId: string,
  ): Promise<CounselAuditEvent | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM counsel_audit_events WHERE determination_id = ? AND action = 'DETERMINATION_RECORDED' ORDER BY changed_at, rowid LIMIT 1",
      )
      .bind(determinationId)
      .first<AuditRow>();
    return row ? toAuditEvent(row) : null;
  }

  private fingerprint(determination: CounselDetermination): string {
    return sha256(
      registryPayloadFingerprint(
        determination,
        determination.activityDecisions,
      ),
    );
  }

  private auditStatement(event: CounselAuditEvent) {
    return this.db
      .prepare(
        `INSERT INTO counsel_audit_events
          (id, determination_id, counsel_id, action, previous_status,
           new_status, actor, changed_at, reason, evidence_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        event.id,
        event.determinationId,
        event.counselId,
        event.action,
        event.previousStatus,
        event.newStatus,
        event.actor,
        event.changedAt,
        event.reason,
        event.evidenceRef,
      );
  }

  private async batch(
    statements: ReturnType<D1DatabaseLike["prepare"]>[],
  ): Promise<unknown[]> {
    return this.db.batch(statements);
  }

  /** Map storage errors to stable domain reasons. */
  private classify(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (
      lower.includes("unique constraint") ||
      lower.includes("unique constraint failed")
    ) {
      if (message.includes("counsel_registry_commits"))
        return "duplicate_operation_id";
      if (message.includes("counsel_activity_decisions"))
        return "duplicate_activity_decision";
      if (message.includes("ux_counsel_audit"))
        return "duplicate_terminal_event";
      return "duplicate_determination_id";
    }
    if (message.includes("FOREIGN KEY") || lower.includes("foreign key"))
      return "foreign_key_violation";
    if (message.includes("append-only")) return "append_only_violation";
    if (
      lower.includes("check constraint") ||
      lower.includes("constraint failed")
    )
      return "constraint_violation";
    if (message.includes("invalid_counsel"))
      return "invalid_counsel_determination";
    return message;
  }
}

/** Backwards-compatible alias for the Gate 7 draft adapter name. */
export { D1CounselRegistry as D1CounselStore };

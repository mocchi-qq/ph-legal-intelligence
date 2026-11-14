// @phli/legal-ingestion — centralized authorization audit
// Gate 7. See docs/gates/gate-7/06_CENTRAL_AUDIT_DESIGN.md
//
// Every implemented authorization path reports here. Records hold decision
// metadata only: no document text, no extracted content, no counsel opinion, no
// credentials. Audit is a record of a decision, never a source of authorization.
//
// Two execution shapes exist because the content paths are synchronous:
//   * sync sinks  — the event is written before the caller proceeds;
//   * async sinks — only usable from `recordAsync`; a sync caller fails closed.
// An audit write that cannot be completed denies the operation. It can never turn
// a denial into an approval.

import type { D1DatabaseLike } from "./d1-types";

export type AuthorizationAuditOutcome = "GRANTED" | "DENIED" | "ERROR";

export type AuthorizationAuditEventType =
  | "AUTHORIZATION_REQUESTED"
  | "AUTHORIZATION_GRANTED"
  | "AUTHORIZATION_DENIED"
  | "PROJECTION_REJECTED"
  | "EVIDENCE_UNAVAILABLE"
  | "CONDITION_UNMET"
  | "DECISION_EXPIRED"
  | "DECISION_REVOKED"
  | "DECISION_SUPERSEDED"
  | "CONFLICT_DETECTED"
  | "REGISTRY_UNAVAILABLE"
  | "OPERATION_ABORTED"
  | "RETRY_DENIED";

export type AuthorizationAuditContextValue = string | number | boolean | null;

export interface AuthorizationAuditEvent {
  id: string;
  eventType: AuthorizationAuditEventType;
  outcome: AuthorizationAuditOutcome;
  occurredAt: string;
  sourceId: string;
  documentId: string | null;
  activity: string;
  operation: string;
  reasonCode: string;
  determinationId: string | null;
  correlationId: string | null;
  registryStatus: string | null;
  context: Record<string, AuthorizationAuditContextValue>;
}

export interface AuthorizationAuditInput {
  eventType: AuthorizationAuditEventType;
  outcome: AuthorizationAuditOutcome;
  sourceId: string;
  documentId?: string | null;
  activity: string;
  operation: string;
  reasonCode: string;
  determinationId?: string | null;
  correlationId?: string | null;
  registryStatus?: string | null;
  context?: Record<string, AuthorizationAuditContextValue>;
}

/** Raised when an audit record cannot be persisted. Callers must deny. */
export class AuthorizationAuditUnavailableError extends Error {
  constructor(message = "authorization_audit_unavailable") {
    super(message);
    this.name = "AuthorizationAuditUnavailableError";
  }
}

export interface AuthorizationAuditSink {
  /** `sync` completes inside `record`; `async` requires `recordAsync`. */
  readonly kind?: "sync" | "async";
  append(event: AuthorizationAuditEvent): void | Promise<void>;
}

export class InMemoryAuthorizationAuditSink implements AuthorizationAuditSink {
  readonly kind = "sync" as const;
  private readonly events: AuthorizationAuditEvent[] = [];

  append(event: AuthorizationAuditEvent): void {
    this.events.push({ ...event, context: { ...event.context } });
  }

  list(): AuthorizationAuditEvent[] {
    return this.events.map((event) => ({
      ...event,
      context: { ...event.context },
    }));
  }
}

/** Durable sink. Requires an awaited `recordAsync`; never usable from a sync path. */
export class D1AuthorizationAuditSink implements AuthorizationAuditSink {
  readonly kind = "async" as const;

  constructor(private readonly db: D1DatabaseLike) {}

  async append(event: AuthorizationAuditEvent): Promise<void> {
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
}

/** Context keys that must never carry document or credential material. */
const FORBIDDEN_CONTEXT_KEYS = new Set([
  "content",
  "text",
  "body",
  "html",
  "excerpt",
  "opinion",
  "secret",
  "token",
  "password",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "advice",
  "counsel_note",
  "legal_opinion",
  "document_summary",
  "summary",
  "privileged",
]);

/** Substrings that mark a key as document/credential bearing regardless of prefix. */
const FORBIDDEN_CONTEXT_FRAGMENTS = [
  "opinion",
  "advice",
  "privilege",
  "confidential",
  "excerpt",
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "cookie",
  "content",
  "summary",
];

const MAX_CONTEXT_STRING = 512;
const MAX_CONTEXT_KEY = 64;

function assertSafeContext(
  context: Record<string, AuthorizationAuditContextValue>,
): void {
  for (const [key, value] of Object.entries(context)) {
    const lowered = key.toLowerCase();
    if (
      key.length > MAX_CONTEXT_KEY ||
      FORBIDDEN_CONTEXT_KEYS.has(lowered) ||
      FORBIDDEN_CONTEXT_FRAGMENTS.some((fragment) => lowered.includes(fragment))
    )
      throw new AuthorizationAuditUnavailableError(
        `forbidden_audit_context:${key}`,
      );
    if (
      typeof value === "string" &&
      (value.length > MAX_CONTEXT_STRING ||
        /(?:^|\s)(?:SECTION|ARTICLE|RULE|CLAUSE|PARAGRAPH)\s+[\dIVXLC]/i.test(
          value,
        ))
    )
      throw new AuthorizationAuditUnavailableError("unsafe_audit_context");
  }
}

let fallbackCounter = 0;

function defaultId(): string {
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (typeof cryptoApi?.randomUUID === "function")
    return `auth_audit_${cryptoApi.randomUUID()}`;
  fallbackCounter += 1;
  let random = "";
  const getRandomValues = (
    globalThis.crypto as { getRandomValues?: (a: Uint32Array) => Uint32Array }
  )?.getRandomValues;
  if (typeof getRandomValues === "function") {
    const values = getRandomValues(new Uint32Array(2));
    random = `${values[0]?.toString(16) ?? ""}${values[1]?.toString(16) ?? ""}`;
  }
  return `auth_audit_${Date.now().toString(36)}_${fallbackCounter.toString(36)}_${random}`;
}

export interface AuthorizationAuditServiceOptions {
  /** Deterministic IDs for tests. Production uses UUIDv4. */
  idFactory?: () => string;
  now?: () => string;
}

export class AuthorizationAuditService {
  private readonly sink: AuthorizationAuditSink;
  private readonly idFactory: () => string;
  private readonly now: () => string;

  constructor(
    sink: AuthorizationAuditSink,
    options: AuthorizationAuditServiceOptions = {},
  ) {
    this.sink = sink;
    this.idFactory = options.idFactory ?? defaultId;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  get isAsync(): boolean {
    return this.sink.kind === "async";
  }

  /**
   * Synchronous record. Throws if the sink is asynchronous or the append fails,
   * so a synchronous content path can never proceed with an unrecorded decision.
   */
  record(input: AuthorizationAuditInput, at?: string): AuthorizationAuditEvent {
    if (this.sink.kind === "async")
      throw new AuthorizationAuditUnavailableError(
        "async_audit_sink_requires_record_async",
      );
    const event = this.build(input, at);
    const result = this.sink.append(event);
    if (isThenable(result)) {
      // Never leave an unobserved rejection behind, then deny.
      void Promise.resolve(result).catch(() => undefined);
      throw new AuthorizationAuditUnavailableError(
        "async_audit_sink_requires_record_async",
      );
    }
    return event;
  }

  /** Awaitable record for async entry points. Throws on any persistence failure. */
  async recordAsync(
    input: AuthorizationAuditInput,
    at?: string,
  ): Promise<AuthorizationAuditEvent> {
    const event = this.build(input, at);
    try {
      await this.sink.append(event);
    } catch (error) {
      throw error instanceof AuthorizationAuditUnavailableError
        ? error
        : new AuthorizationAuditUnavailableError(
            error instanceof Error ? error.message : undefined,
          );
    }
    return event;
  }

  private build(
    input: AuthorizationAuditInput,
    at?: string,
  ): AuthorizationAuditEvent {
    if (!input.sourceId.trim())
      throw new AuthorizationAuditUnavailableError("missing_audit_source");
    if (!input.activity.trim() || !input.operation.trim())
      throw new AuthorizationAuditUnavailableError("missing_audit_operation");
    const context = { ...(input.context ?? {}) };
    assertSafeContext(context);
    return {
      id: this.idFactory(),
      eventType: input.eventType,
      outcome: input.outcome,
      occurredAt: at ?? this.now(),
      sourceId: input.sourceId,
      documentId: input.documentId ?? null,
      activity: input.activity,
      operation: input.operation,
      reasonCode: input.reasonCode,
      determinationId: input.determinationId ?? null,
      correlationId: input.correlationId ?? null,
      registryStatus: input.registryStatus ?? null,
      context,
    };
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === "function"
  );
}

export interface AuditContext {
  service?: AuthorizationAuditService;
  correlationId?: string;
}

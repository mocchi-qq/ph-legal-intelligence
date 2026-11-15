// @phli/legal-ingestion — D1 authority ledger adapter
// Gate 10. See migrations/d1/0009_authority_core.sql
//
// Append-only writer/reader for the authority core: provision identities,
// provision version mappings, effect assertions, effect evidence and effect
// reviews. There are deliberately no update or delete methods — corrections and
// supersession are new rows, and migration 0009's triggers abort any rewrite.
//
// Queries are always parameterized. Legal decision logic is not in SQL: the
// snapshot is designed to be passed to `projectAuthorityState` by the caller.
//
// The local SQLite shim is supplementary evidence only; this is not D1 runtime
// validation.

import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "@phli/legal-schema";
import type {
  AuthorityDocumentView,
  AuthorityProvisionView,
  AuthoritySnapshot,
  AuthorityVersionView,
} from "./authority-ledger";
import type { D1DatabaseLike } from "./d1-types";

interface DocumentRow {
  id: string;
  document_type: string;
  title: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  effective_from: string | null;
  effective_to: string | null;
}

interface ProvisionRow {
  id: string;
  document_id: string;
  version_id: string;
  label: string;
  text: string;
}

interface ProvisionIdentityRow {
  id: string;
  document_id: string;
  provision_type: string;
  canonical_label: string;
  created_at: string;
}

interface ProvisionMappingRow {
  id: string;
  provision_identity_id: string;
  provision_version_id: string;
  document_version_id: string;
  mapping_type: ProvisionVersionMapping["mappingType"];
  rationale: string;
  review_status: ProvisionVersionMapping["reviewStatus"];
  created_at: string;
}

interface AssertionRow {
  id: string;
  effect_type: EffectAssertion["effectType"];
  source_document_id: string;
  source_version_id: string | null;
  source_provision_id: string | null;
  target_document_id: string;
  target_provision_identity_id: string | null;
  target_version_id: string | null;
  scope: string;
  claimed_date: string | null;
  claimed_effective_date: string | null;
  evidence_id: string;
  source_locator: string | null;
  assertion_origin: string;
  recorded_at: string;
  recorded_by: string;
  state: EffectAssertion["state"];
  supersedes_assertion_id: string | null;
  conflict_group_id: string | null;
}

interface EvidenceRow {
  id: string;
  assertion_id: string;
  document_version_id: string | null;
  provision_version_id: string | null;
  artifact_id: string | null;
  content_hash: string | null;
  passage: string | null;
  locator: string | null;
  evidence_date: string | null;
  classification: EffectEvidence["classification"];
  availability: EffectEvidence["availability"];
  checked_at: string | null;
}

interface ReviewRow {
  id: string;
  assertion_id: string;
  outcome: LegalEffectReview["outcome"];
  reviewer_id: string;
  reviewer_capacity: string;
  decision_date: string;
  scope: string;
  proposition_reviewed: string;
  conditions_json: string;
  evidence_refs_json: string;
  notes: string | null;
  supersedes_review_id: string | null;
  status: LegalEffectReview["status"];
  recorded_at: string;
}

/** Tables the adapter writes; `exists` refuses anything else. */
const AUTHORITY_TABLES: ReadonlySet<string> = new Set([
  "provision_identities",
  "provision_version_mappings",
  "legal_effect_assertions",
  "legal_effect_evidence",
  "legal_effect_reviews",
]);

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Split a bind list so each `IN (...)` stays inside SQLite's limit. */
function chunk<T>(items: T[], size = 90): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Parse a JSON array column; malformed or non-array payloads yield []. */
function jsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toAssertion(row: AssertionRow): EffectAssertion {
  return {
    id: row.id,
    effectType: row.effect_type,
    sourceDocumentId: row.source_document_id,
    sourceVersionId: row.source_version_id,
    sourceProvisionId: row.source_provision_id,
    targetDocumentId: row.target_document_id,
    targetProvisionIdentityId: row.target_provision_identity_id,
    targetVersionId: row.target_version_id,
    scope: row.scope,
    claimedDate: row.claimed_date,
    claimedEffectiveDate: row.claimed_effective_date,
    evidenceId: row.evidence_id,
    sourceLocator: row.source_locator,
    assertionOrigin: row.assertion_origin,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    state: row.state,
    supersedesAssertionId: row.supersedes_assertion_id,
    conflictGroupId: row.conflict_group_id,
  };
}

function toEvidence(row: EvidenceRow): EffectEvidence {
  return {
    id: row.id,
    assertionId: row.assertion_id,
    documentVersionId: row.document_version_id,
    provisionVersionId: row.provision_version_id,
    artifactId: row.artifact_id,
    contentHash: row.content_hash,
    passage: row.passage,
    locator: row.locator,
    evidenceDate: row.evidence_date,
    classification: row.classification,
    availability: row.availability,
    checkedAt: row.checked_at,
  };
}

function toReview(row: ReviewRow): LegalEffectReview {
  return {
    id: row.id,
    assertionId: row.assertion_id,
    outcome: row.outcome,
    reviewerId: row.reviewer_id,
    reviewerCapacity: row.reviewer_capacity,
    decisionDate: row.decision_date,
    scope: row.scope,
    propositionReviewed: row.proposition_reviewed,
    conditions: jsonArray(row.conditions_json),
    evidenceRefs: jsonArray(row.evidence_refs_json),
    notes: row.notes,
    supersedesReviewId: row.supersedes_review_id,
    status: row.status,
    recordedAt: row.recorded_at,
  };
}

export class D1AuthorityStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async recordProvisionIdentity(p: ProvisionIdentity): Promise<void> {
    if (await this.exists("provision_identities", p.id)) {
      throw new Error("duplicate_authority_record");
    }
    try {
      await this.db
        .prepare(
          `INSERT INTO provision_identities
            (id, document_id, provision_type, canonical_label, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          p.id,
          p.documentId,
          p.provisionType,
          p.canonicalLabel,
          p.createdAt,
        )
        .run();
    } catch (error) {
      this.fail(error);
    }
  }

  async recordProvisionMapping(m: ProvisionVersionMapping): Promise<void> {
    if (await this.exists("provision_version_mappings", m.id)) {
      throw new Error("duplicate_authority_record");
    }
    try {
      await this.db
        .prepare(
          `INSERT INTO provision_version_mappings
            (id, provision_identity_id, provision_version_id, document_version_id,
             mapping_type, rationale, review_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          m.id,
          m.provisionIdentityId,
          m.provisionVersionId,
          m.documentVersionId,
          m.mappingType,
          m.rationale,
          m.reviewStatus,
          m.createdAt,
        )
        .run();
    } catch (error) {
      this.fail(error);
    }
  }

  async recordAssertion(a: EffectAssertion): Promise<void> {
    // A duplicate id would otherwise be rejected by 0009's no-replace trigger
    // (which raises "append-only"); check first so the domain reason is the
    // duplicate. The trigger stays in place as defence.
    if (await this.exists("legal_effect_assertions", a.id)) {
      throw new Error("duplicate_authority_record");
    }
    try {
      await this.db
        .prepare(
          `INSERT INTO legal_effect_assertions
            (id, effect_type, source_document_id, source_version_id,
             source_provision_id, target_document_id,
             target_provision_identity_id, target_version_id, scope,
             claimed_date, claimed_effective_date, evidence_id, source_locator,
             assertion_origin, recorded_at, recorded_by, state,
             supersedes_assertion_id, conflict_group_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          a.id,
          a.effectType,
          a.sourceDocumentId,
          a.sourceVersionId,
          a.sourceProvisionId,
          a.targetDocumentId,
          a.targetProvisionIdentityId,
          a.targetVersionId,
          a.scope,
          a.claimedDate,
          a.claimedEffectiveDate,
          a.evidenceId,
          a.sourceLocator,
          a.assertionOrigin,
          a.recordedAt,
          a.recordedBy,
          a.state,
          a.supersedesAssertionId,
          a.conflictGroupId,
        )
        .run();
    } catch (error) {
      this.fail(error);
    }
  }

  async recordEvidence(e: EffectEvidence): Promise<void> {
    if (await this.exists("legal_effect_evidence", e.id)) {
      throw new Error("duplicate_authority_record");
    }
    try {
      await this.db
        .prepare(
          `INSERT INTO legal_effect_evidence
            (id, assertion_id, document_version_id, provision_version_id,
             artifact_id, content_hash, passage, locator, evidence_date,
             classification, availability, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          e.id,
          e.assertionId,
          e.documentVersionId,
          e.provisionVersionId,
          e.artifactId,
          e.contentHash,
          e.passage,
          e.locator,
          e.evidenceDate,
          e.classification,
          e.availability,
          e.checkedAt,
        )
        .run();
    } catch (error) {
      this.fail(error);
    }
  }

  async recordReview(r: LegalEffectReview): Promise<void> {
    if (await this.exists("legal_effect_reviews", r.id)) {
      throw new Error("duplicate_authority_record");
    }
    try {
      await this.db
        .prepare(
          `INSERT INTO legal_effect_reviews
            (id, assertion_id, outcome, reviewer_id, reviewer_capacity,
             decision_date, scope, proposition_reviewed, conditions_json,
             evidence_refs_json, notes, supersedes_review_id, status,
             recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          r.id,
          r.assertionId,
          r.outcome,
          r.reviewerId,
          r.reviewerCapacity,
          r.decisionDate,
          r.scope,
          r.propositionReviewed,
          JSON.stringify(r.conditions),
          JSON.stringify(r.evidenceRefs),
          r.notes,
          r.supersedesReviewId,
          r.status,
          r.recordedAt,
        )
        .run();
    } catch (error) {
      this.fail(error);
    }
  }

  async getAssertion(id: string): Promise<EffectAssertion | null> {
    const row = await this.db
      .prepare("SELECT * FROM legal_effect_assertions WHERE id = ?")
      .bind(id)
      .first<AssertionRow>();
    return row ? toAssertion(row) : null;
  }

  async listAssertionsFor(
    targetDocumentId: string,
  ): Promise<EffectAssertion[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM legal_effect_assertions
          WHERE target_document_id = ?
          ORDER BY claimed_effective_date, id`,
      )
      .bind(targetDocumentId)
      .all<AssertionRow>();
    return (result.results ?? []).map(toAssertion);
  }

  async listEvidence(assertionId: string): Promise<EffectEvidence[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM legal_effect_evidence
          WHERE assertion_id = ?
          ORDER BY id`,
      )
      .bind(assertionId)
      .all<EvidenceRow>();
    return (result.results ?? []).map(toEvidence);
  }

  async listReviews(assertionId: string): Promise<LegalEffectReview[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM legal_effect_reviews
          WHERE assertion_id = ?
          ORDER BY decision_date, id`,
      )
      .bind(assertionId)
      .all<ReviewRow>();
    return (result.results ?? []).map(toReview);
  }

  async loadStateFor(documentId: string): Promise<AuthoritySnapshot> {
    const docRow = await this.db
      .prepare("SELECT * FROM legal_documents WHERE id = ?")
      .bind(documentId)
      .first<DocumentRow>();
    if (!docRow) {
      return {
        documents: [],
        versions: [],
        provisions: [],
        provisionIdentities: [],
        provisionMappings: [],
        assertions: [],
        evidence: [],
        reviews: [],
      };
    }

    const documents: AuthorityDocumentView[] = [
      {
        id: docRow.id,
        documentType: docRow.document_type,
        title: docRow.title,
      },
    ];

    const versionResult = await this.db
      .prepare(
        "SELECT * FROM document_versions WHERE document_id = ? ORDER BY id",
      )
      .bind(documentId)
      .all<VersionRow>();
    const versions: AuthorityVersionView[] = (versionResult.results ?? []).map(
      (row) => ({
        id: row.id,
        documentId: row.document_id,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
      }),
    );

    const provisionResult = await this.db
      .prepare(
        "SELECT * FROM legal_provisions WHERE document_id = ? ORDER BY ordinal, id",
      )
      .bind(documentId)
      .all<ProvisionRow>();
    const provisions: AuthorityProvisionView[] = (
      provisionResult.results ?? []
    ).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      versionId: row.version_id,
      label: row.label,
      text: row.text,
    }));

    const identityResult = await this.db
      .prepare(
        "SELECT * FROM provision_identities WHERE document_id = ? ORDER BY id",
      )
      .bind(documentId)
      .all<ProvisionIdentityRow>();
    const provisionIdentities: ProvisionIdentity[] = (
      identityResult.results ?? []
    ).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      provisionType: row.provision_type,
      canonicalLabel: row.canonical_label,
      createdAt: row.created_at,
    }));

    const versionIds = versions.map((version) => version.id);
    const mappingRows: ProvisionMappingRow[] = [];
    for (const ids of chunk(versionIds)) {
      const mappingResult = await this.db
        .prepare(
          `SELECT * FROM provision_version_mappings
            WHERE document_version_id IN (${placeholders(ids.length)})
            ORDER BY id`,
        )
        .bind(...ids)
        .all<ProvisionMappingRow>();
      mappingRows.push(...(mappingResult.results ?? []));
    }
    const provisionMappings: ProvisionVersionMapping[] = mappingRows.map(
      (row) => ({
        id: row.id,
        provisionIdentityId: row.provision_identity_id,
        provisionVersionId: row.provision_version_id,
        documentVersionId: row.document_version_id,
        mappingType: row.mapping_type,
        rationale: row.rationale,
        reviewStatus: row.review_status,
        createdAt: row.created_at,
      }),
    );

    const assertions = await this.listAssertionsFor(documentId);
    const assertionIds = assertions.map((assertion) => assertion.id).sort();

    // A later assertion can target a different document and still supersede one
    // of ours. Load those rows too, so the projection can see that the
    // in-scope assertion is superseded. Evidence and reviews for these
    // out-of-scope rows are not needed.
    const superseding: AssertionRow[] = [];
    for (const ids of chunk(assertionIds)) {
      const supersedingResult = await this.db
        .prepare(
          `SELECT * FROM legal_effect_assertions
            WHERE supersedes_assertion_id IN (${placeholders(ids.length)})
            ORDER BY claimed_effective_date, id`,
        )
        .bind(...ids)
        .all<AssertionRow>();
      superseding.push(...(supersedingResult.results ?? []));
    }
    const seenAssertionIds = new Set(assertionIds);
    for (const row of superseding) {
      if (seenAssertionIds.has(row.id)) continue;
      seenAssertionIds.add(row.id);
      assertions.push(toAssertion(row));
    }

    const evidence: EffectEvidence[] = [];
    const reviews: LegalEffectReview[] = [];
    for (const ids of chunk(assertionIds)) {
      const evidenceResult = await this.db
        .prepare(
          `SELECT * FROM legal_effect_evidence
            WHERE assertion_id IN (${placeholders(ids.length)})
            ORDER BY id`,
        )
        .bind(...ids)
        .all<EvidenceRow>();
      evidence.push(...(evidenceResult.results ?? []).map(toEvidence));

      const reviewResult = await this.db
        .prepare(
          `SELECT * FROM legal_effect_reviews
            WHERE assertion_id IN (${placeholders(ids.length)})
            ORDER BY decision_date, id`,
        )
        .bind(...ids)
        .all<ReviewRow>();
      reviews.push(...(reviewResult.results ?? []).map(toReview));
    }

    return {
      documents,
      versions,
      provisions,
      provisionIdentities,
      provisionMappings,
      assertions,
      evidence,
      reviews,
    };
  }

  /** True when `id` already exists in one of the whitelisted tables. */
  private async exists(table: string, id: string): Promise<boolean> {
    if (!AUTHORITY_TABLES.has(table)) {
      throw new Error(`unknown_authority_table: ${table}`);
    }
    const row = await this.db
      .prepare(`SELECT 1 AS n FROM ${table} WHERE id = ?`)
      .bind(id)
      .first<{ n: number }>();
    return row !== null;
  }

  /** Map storage errors to stable domain reasons. */
  private fail(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("append-only"))
      throw new Error("append_only_violation");
    if (message.includes("UNIQUE constraint"))
      throw new Error("duplicate_authority_record");
    if (message.includes("FOREIGN KEY") || message.includes("foreign key"))
      throw new Error("unknown_reference");
    if (message.includes("CHECK constraint") || message.includes("NOT NULL"))
      throw new Error("invalid_authority_record");
    throw error instanceof Error ? error : new Error(message);
  }
}

// @phli/legal-ingestion — bounded one-artifact ingestion pipeline
// Gate 1. See docs/gates/gate-1/04_INGESTION_REPORT.md
//
// Invariants:
//   - Original artifact bytes are preserved before any parsing.
//   - Nothing non-synthetic is accepted unless its source is explicitly authorized.
//   - Re-running the same artifact never creates a second document or version.
//   - A failed run leaves the corpus unchanged (transactional draft state).
//   - Relationships are only applied from explicit assertions carrying evidence.

import type {
  DocumentChunk,
  DocumentRelationship,
  DocumentVersion,
  LegalDocument,
  LegalProvision,
  SourceManifestation,
} from "@phli/legal-schema";
import type { AuthorizationBasis } from "./authorization";
import type { AuthorizationAuditInput } from "./authorization-audit";
import { extractText, segmentChunks, segmentProvisions } from "./extract";
import { type CorpusStore, sha256 } from "./store";
import type {
  ArtifactInput,
  CorpusState,
  IngestOptions,
  IngestOutcome,
} from "./types";

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/html",
  "application/xhtml+xml",
]);

/**
 * Gate 19: a fixture must name a source that cannot be fetched. `synthetic://` is
 * the explicit form; a host under the RFC 2606 reserved `.invalid` TLD is the
 * other, because acquisition refuses non-HTTP schemes and the end-to-end
 * rehearsals must exercise the acquisition stage too. Neither resolves.
 */
function isSyntheticLocator(url: string): boolean {
  if (url.startsWith("synthetic://")) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "invalid" || host.endsWith(".invalid");
  } catch {
    return false;
  }
}

/**
 * Activities that cannot be skipped by this ingestion path. If ALLOWED_MIME is
 * ever expanded to PDF/images, add `ocr` here before enabling that MIME.
 */
const REQUIRED_INGEST_ACTIVITIES = [
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
] as const;
function id(prefix: string, value: string): string {
  return `${prefix}_${sha256(value).slice(0, 16)}`;
}

function addRun(
  state: CorpusState,
  artifact: ArtifactInput,
  options: IngestOptions,
  status: "SUCCEEDED" | "DUPLICATE" | "FAILED" | "IDENTITY_AMBIGUOUS",
  contentHash: string,
  extra: Partial<{
    documentId: string;
    versionId: string;
    manifestId: string;
    reason: string;
    authorizationDecisionRef: string | null;
    authorizationDecisionRefs: string[] | null;
    authorizationBasisDetail:
      | "COUNSEL_DETERMINATION"
      | "OWNER_RISK_ACCEPTANCE"
      | "SYNTHETIC_FIXTURE"
      | null;
  }> = {},
): string {
  const runId = id(
    "run",
    `${contentHash}:${artifact.sourceId}:${state.runs.length + 1}`,
  );
  const now = options.now?.() ?? new Date().toISOString();
  // Gate 19: a synthetic artifact is checked like any other, so it is a strict
  // run too; only the basis accepted for it differs.
  const strictContext =
    artifact.synthetic === true ||
    options.enforceActivityAuthorization === true;
  const strictBasis =
    extra.authorizationBasisDetail === "SYNTHETIC_FIXTURE"
      ? "synthetic_fixture"
      : strictContext && (status === "SUCCEEDED" || status === "DUPLICATE")
        ? "source_authorization"
        : undefined;
  state.runs.push({
    id: runId,
    inputContentHash: contentHash,
    sourceId: artifact.sourceId,
    pipelineVersion: options.pipelineVersion,
    extractorVersion: options.extractorVersion,
    normalizerVersion: options.normalizerVersion,
    status,
    documentId: extra.documentId ?? null,
    versionId: extra.versionId ?? null,
    manifestId: extra.manifestId ?? null,
    failureReason: extra.reason ?? null,
    startedAt: now,
    finishedAt: now,
    authorizationBasis: strictContext
      ? strictBasis
      : (options.authorizedSourceIds ?? []).includes(artifact.sourceId)
        ? "source_authorization"
        : options.ownerAuthorization
          ? "owner_authorization"
          : undefined,
    // Gate 19: a run reports the decisions that were actually consulted. The
    // artifact's own `synthetic` flag no longer writes a basis, a reference or
    // an empty reference list into the audit record.
    authorizationDecisionRef: extra.authorizationDecisionRef ?? null,
    authorizationDecisionRefs: extra.authorizationDecisionRefs ?? null,
    authorizationBasisDetail: extra.authorizationBasisDetail ?? null,
  });
  return runId;
}

function outcome(
  status: "SUCCEEDED" | "DUPLICATE" | "FAILED" | "IDENTITY_AMBIGUOUS",
  runId: string,
  contentHash: string,
  extra: Partial<IngestOutcome> = {},
): IngestOutcome {
  return {
    status,
    runId,
    contentHash,
    chunkCount: 0,
    provisionCount: 0,
    duplicate: status === "DUPLICATE",
    ...extra,
  };
}

/**
 * Ingest one artifact. Derived records are written only on success; every
 * attempt (including failure, duplicate and ambiguity) records an audit run.
 */
export function ingestArtifact(
  store: CorpusStore,
  artifact: ArtifactInput,
  options: IngestOptions,
): IngestOutcome {
  const draft = structuredClone(store.state);
  const now = options.now?.() ?? new Date().toISOString();
  const contentText =
    typeof artifact.content === "string"
      ? artifact.content
      : Buffer.from(artifact.content).toString("utf8");
  const contentHash = sha256(artifact.content);
  const authorized = new Set(options.authorizedSourceIds ?? []);

  const fail = (reason: string): IngestOutcome => {
    const runId = addRun(draft, artifact, options, "FAILED", contentHash, {
      reason,
    });
    store.state = draft;
    store.save();
    return outcome("FAILED", runId, contentHash, { reason });
  };

  const audit = options.authorizationAudit;
  const recordAudit = (input: AuthorizationAuditInput): boolean => {
    if (!audit) return true;
    try {
      audit.record(input);
      return true;
    } catch {
      return false;
    }
  };

  // 1. Authorization guard — the absolute Gate 1 stop condition, in code.
  // In Gate 4 strict mode the activity registry is the authority. The legacy
  // coarse gate is not silently available: it requires an explicit opt-in.
  const synthetic = artifact.synthetic === true;
  // Gate 19: a synthetic artifact never skips the gate. It runs the same four
  // activity checks; `synthetic` only narrows the accepted basis to
  // SYNTHETIC_FIXTURE, so a fixture cannot borrow a counsel decision and a real
  // document cannot borrow the fixture basis.
  const strictActivityMode =
    synthetic || options.enforceActivityAuthorization === true;
  // Defence in depth: a synthetic flag alone must not bypass the guard.
  if (synthetic && !isSyntheticLocator(artifact.sourceUrl)) {
    return fail("synthetic_flag_without_synthetic_locator");
  }
  // Gate 19: the locator is a claim about provenance, and the two fields must
  // agree. A real artifact naming a synthetic locator is contradictory, not a
  // fixture that forgot its flag.
  if (!synthetic && artifact.sourceUrl.startsWith("synthetic://")) {
    return fail("synthetic_locator_without_synthetic_flag");
  }
  // Gate 19: the fixture basis is not a legal basis. A caller that asks a real
  // artifact to accept it is refused even when strict mode is off, so the
  // request cannot sit in an options object waiting for a later strict run.
  if (
    !synthetic &&
    (options.acceptedAuthorizationBases ?? []).includes("SYNTHETIC_FIXTURE")
  ) {
    return fail("synthetic_fixture_basis_not_allowed");
  }
  if (!synthetic && !strictActivityMode) {
    if (options.allowLegacySourceGate !== true)
      return fail("activity_authorization_required");
    if (
      !authorized.has(artifact.sourceId) &&
      !options.ownerAuthorization?.reference
    )
      return fail("source_not_authorized");
  }

  // 1b. Gate 4 activity-specific gate. When strict enforcement is requested,
  // every activity this path performs must be independently authorized. The
  // default accepts counsel determinations only; owner risk acceptance cannot
  // be silently substituted.
  const strictDecisionRefs: string[] = [];
  let strictBasisDetail:
    | "COUNSEL_DETERMINATION"
    | "OWNER_RISK_ACCEPTANCE"
    | "SYNTHETIC_FIXTURE"
    | null = null;
  if (strictActivityMode) {
    const registry = options.activityAuthorization;
    if (!registry) {
      if (
        !recordAudit({
          eventType: "REGISTRY_UNAVAILABLE",
          outcome: "ERROR",
          sourceId: artifact.sourceId,
          documentId: artifact.artifactId,
          activity: "temporary_processing",
          operation: "ingest",
          reasonCode: "activity_authorization_registry_missing",
        })
      )
        return fail("authorization_audit_unavailable");
      return fail("activity_authorization_registry_missing");
    }
    // A synthetic fixture has no counsel to ask: the only basis that can
    // authorize one is a recorded SYNTHETIC_FIXTURE decision. A real artifact
    // accepts counsel determinations by default and cannot opt into the fixture basis.
    const acceptedBases: readonly AuthorizationBasis[] = synthetic
      ? ["SYNTHETIC_FIXTURE"]
      : (options.acceptedAuthorizationBases ?? ["COUNSEL_DETERMINATION"]);
    for (const activity of REQUIRED_INGEST_ACTIVITIES) {
      const check = registry.check(artifact.sourceId, activity, {
        now: options.authorizationNow,
        satisfiedConditions: options.satisfiedAuthorizationConditions,
        allowedBases: acceptedBases,
      });
      if (!check.allowed) {
        if (
          !recordAudit({
            eventType:
              check.status === "PROHIBITED"
                ? "AUTHORIZATION_DENIED"
                : "PROJECTION_REJECTED",
            outcome: "DENIED",
            sourceId: artifact.sourceId,
            documentId: artifact.artifactId,
            activity,
            operation: "ingest",
            reasonCode: check.reason,
            determinationId: check.decision?.id ?? null,
            registryStatus: check.status,
          })
        )
          return fail("authorization_audit_unavailable");
        return fail(`activity_not_authorized:${activity}:${check.reason}`);
      }
      if (
        !recordAudit({
          eventType: "AUTHORIZATION_GRANTED",
          outcome: "GRANTED",
          sourceId: artifact.sourceId,
          documentId: artifact.artifactId,
          activity,
          operation: "ingest",
          reasonCode: check.reason,
          determinationId: check.decision?.id ?? null,
          registryStatus: check.status,
        })
      )
        return fail("authorization_audit_unavailable");
      if (check.decision?.id) strictDecisionRefs.push(check.decision.id);
      if (!strictBasisDetail) {
        const basis = check.decision?.basis;
        strictBasisDetail =
          basis === "COUNSEL_DETERMINATION" ||
          basis === "OWNER_RISK_ACCEPTANCE" ||
          basis === "SYNTHETIC_FIXTURE"
            ? basis
            : null;
      }
    }
  }
  if (ALLOWED_MIME.has(artifact.mimeType) === false)
    return fail(`unsupported_mime:${artifact.mimeType}`);
  if (contentText.trim().length === 0) return fail("empty_artifact");
  if (!artifact.identityKey || artifact.identityKey.trim().length === 0)
    return fail("missing_identity_key");

  // 2. Identity resolution runs before duplicate detection: an explicit key that
  //    collides with a different document type is ambiguous, not a duplicate.
  const docId = id("doc", artifact.identityKey);
  const existingDoc = draft.documents.find(
    (d) => d.identityKey === artifact.identityKey,
  );
  if (existingDoc && existingDoc.documentType !== artifact.documentType) {
    const runId = addRun(
      draft,
      artifact,
      options,
      "IDENTITY_AMBIGUOUS",
      contentHash,
      {
        documentId: existingDoc.id,
        reason: `type_conflict:${existingDoc.documentType}!=${artifact.documentType}`,
      },
    );
    store.state = draft;
    store.save();
    return outcome("IDENTITY_AMBIGUOUS", runId, contentHash, {
      documentId: existingDoc.id,
      reason: "type_conflict",
    });
  }

  // 3. Duplicate manifestation: same bytes from the same source.
  const existingManifest = draft.manifestations.find(
    (m) => m.sourceId === artifact.sourceId && m.contentHash === contentHash,
  );
  if (existingManifest) {
    const doc = draft.documents.find(
      (d) => d.id === existingManifest.documentId,
    );
    const version = draft.versions.find(
      (v) => v.documentId === doc?.id && v.isCurrent,
    );
    const runId = addRun(draft, artifact, options, "DUPLICATE", contentHash, {
      documentId: doc?.id,
      versionId: version?.id,
      manifestId: existingManifest.id,
      reason: "identical_bytes_from_same_source",
    });
    store.state = draft;
    store.save();
    return outcome("DUPLICATE", runId, contentHash, {
      documentId: doc?.id,
      versionId: version?.id,
      manifestId: existingManifest.id,
    });
  }

  // 4. Extraction. Empty extraction never publishes.
  const extracted = extractText(contentText, artifact.mimeType);
  if (extracted.warnings.includes("empty_extraction")) {
    return fail("empty_extraction");
  }

  const versionHash = sha256(extracted.normalizedText);
  const nowIso = now;

  // 5. Same document, same normalized text => duplicate, no new version.
  if (existingDoc) {
    const current = draft.versions.find(
      (v) => v.documentId === existingDoc.id && v.isCurrent,
    );
    if (current && current.contentHash === versionHash) {
      const runId = addRun(draft, artifact, options, "DUPLICATE", contentHash, {
        documentId: existingDoc.id,
        versionId: current.id,
        reason: "identical_normalized_text",
      });
      store.state = draft;
      store.save();
      return outcome("DUPLICATE", runId, contentHash, {
        documentId: existingDoc.id,
        versionId: current.id,
      });
    }
  }

  // 6. Preserve the original artifact before writing derived records.
  const preserved = store.preserve(
    artifact.content,
    artifact.mimeType,
    contentHash,
  );

  // 7. Document.
  const document: LegalDocument = existingDoc ?? {
    id: docId,
    documentType: artifact.documentType as LegalDocument["documentType"],
    title: artifact.title,
    citationText: artifact.officialNumber ?? artifact.docketNumber ?? null,
    docketNumber: artifact.docketNumber ?? null,
    issuingBody: artifact.issuingBody ?? null,
    jurisdiction: artifact.jurisdiction ?? "PH",
    promulgationDate: artifact.promulgationDate ?? null,
    approvalDate: artifact.approvalDate ?? null,
    publicationDate: artifact.publicationDate ?? null,
    effectivityDate: artifact.effectivityDate ?? null,
    legalStatus: (artifact.legalStatus ??
      "UNKNOWN") as LegalDocument["legalStatus"],
    verificationStatus: (artifact.synthetic
      ? "PENDING_REVIEW"
      : "UNVERIFIED") as LegalDocument["verificationStatus"],
    authorityLevel: (artifact.authorityLevel ??
      "unofficial") as LegalDocument["authorityLevel"],
    sourceId: artifact.sourceId,
    identityKey: artifact.identityKey,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  if (!existingDoc) draft.documents.push(document);
  else document.updatedAt = nowIso;

  // 8. Manifestation.
  const manifest: SourceManifestation = {
    id: id("man", `${contentHash}:${artifact.sourceId}`),
    documentId: document.id,
    sourceId: artifact.sourceId,
    sourceUrl: artifact.sourceUrl,
    sourceType: artifact.sourceId,
    authorityLevel: (artifact.authorityLevel ??
      "unofficial") as SourceManifestation["authorityLevel"],
    acquisitionStatus: "Pending" as SourceManifestation["acquisitionStatus"],
    mimeType: artifact.mimeType,
    fileSizeBytes: Buffer.byteLength(contentText, "utf8"),
    storageKey: preserved.key,
    contentHash,
    isPrimary: true,
    retrievedAt: artifact.retrievedAt,
    retrievedBy: "gate1-pipeline",
    retrievalStatus: "ok",
    createdAt: nowIso,
  };
  draft.manifestations.push(manifest);

  // 9. Version — append-only.
  const priorVersions = draft.versions.filter(
    (v) => v.documentId === document.id,
  );
  const versionNumber = priorVersions.length + 1;
  const effectiveFrom =
    artifact.effectivityDate ??
    artifact.promulgationDate ??
    artifact.approvalDate ??
    null;
  if (priorVersions.length > 0) {
    const current = priorVersions.find((v) => v.isCurrent);
    if (current) {
      current.isCurrent = false;
      if (effectiveFrom) current.effectiveTo = effectiveFrom;
    }
  }
  const version: DocumentVersion = {
    id: id("ver", `${document.id}:${versionNumber}:${versionHash}`),
    documentId: document.id,
    versionNumber,
    versionLabel: versionNumber === 1 ? "original" : `version ${versionNumber}`,
    contentHash: versionHash,
    effectiveFrom,
    effectiveTo: null,
    isCurrent: true,
    changeSummary:
      versionNumber === 1 ? "initial ingestion" : "content changed at source",
    createdAt: nowIso,
  };
  draft.versions.push(version);

  // 10. Provisions.
  const provisionSeeds = segmentProvisions(
    extracted.normalizedText,
    artifact.documentType,
  );
  const provisions: LegalProvision[] = provisionSeeds.map((seed) => ({
    id: id("prov", `${version.id}:${seed.ordinal}`),
    documentId: document.id,
    versionId: version.id,
    provisionType: seed.provisionType as LegalProvision["provisionType"],
    label: seed.label,
    heading: null,
    text: seed.text,
    ordinal: seed.ordinal,
    parentProvisionId: null,
    // Provisions start in force; relationships change this. A document-level
    // PARTIALLY_AMENDED status must not make every provision look amended.
    legalStatus: "IN_FORCE" as LegalProvision["legalStatus"],
    effectiveFrom,
    effectiveTo: null,
    amendedByDocumentId: null,
    createdAt: nowIso,
  }));
  draft.provisions.push(...provisions);

  // 11. Chunks.
  const chunkSeeds = segmentChunks(provisionSeeds);
  const chunks: DocumentChunk[] = chunkSeeds.map((seed) => {
    const provision = provisions.find(
      (p) => p.ordinal === seed.provisionOrdinal,
    );
    return {
      id: id("chunk", `${version.id}:${seed.chunkIndex}`),
      documentId: document.id,
      versionId: version.id,
      provisionId: provision?.id ?? null,
      chunkKind: seed.chunkKind as DocumentChunk["chunkKind"],
      chunkIndex: seed.chunkIndex,
      content: seed.content,
      tokenCount: Math.ceil(seed.content.length / 4),
      charStart: seed.charStart,
      charEnd: seed.charEnd,
      pageNumber: null,
      embeddingId: null,
      createdAt: nowIso,
    };
  });
  draft.chunks.push(...chunks);

  // 12. Relationships — explicit assertions only.
  for (const assertion of artifact.relationships ?? []) {
    const target = draft.documents.find(
      (d) => d.identityKey === assertion.toIdentityKey,
    );
    if (!target) {
      draft.pendingRelationships.push({
        fromDocumentId: document.id,
        toIdentityKey: assertion.toIdentityKey,
        type: assertion.type,
        scope: assertion.scope,
        effectiveDate: assertion.effectiveDate,
        evidencePassage: assertion.evidencePassage,
      });
      continue;
    }
    applyRelationship(draft, document.id, target, assertion, nowIso);
  }

  // 13. Resolve any pending relationships that now have a target.
  const stillPending: CorpusState["pendingRelationships"] = [];
  for (const pending of draft.pendingRelationships) {
    const target = draft.documents.find(
      (d) => d.identityKey === pending.toIdentityKey,
    );
    if (!target) {
      stillPending.push(pending);
      continue;
    }
    applyRelationship(
      draft,
      pending.fromDocumentId,
      target,
      {
        toIdentityKey: pending.toIdentityKey,
        type: pending.type,
        scope: pending.scope,
        effectiveDate: pending.effectiveDate,
        evidencePassage: pending.evidencePassage,
      },
      nowIso,
    );
  }
  draft.pendingRelationships = stillPending;

  // 14. Success.
  const runId = addRun(draft, artifact, options, "SUCCEEDED", contentHash, {
    documentId: document.id,
    versionId: version.id,
    manifestId: manifest.id,
    authorizationDecisionRef: strictDecisionRefs[0] ?? null,
    authorizationDecisionRefs: strictDecisionRefs,
    authorizationBasisDetail: strictBasisDetail,
  });
  store.state = draft;
  store.save();

  return outcome("SUCCEEDED", runId, contentHash, {
    documentId: document.id,
    versionId: version.id,
    manifestId: manifest.id,
    chunkCount: chunks.length,
    provisionCount: provisions.length,
  });
}

function applyRelationship(
  state: CorpusState,
  fromDocumentId: string,
  target: LegalDocument,
  assertion: {
    toIdentityKey?: string;
    type: string;
    scope?: string;
    effectiveDate?: string;
    evidencePassage?: string;
  },
  nowIso: string,
): void {
  const relationshipId = id(
    "rel",
    `${fromDocumentId}:${target.id}:${assertion.type}:${assertion.scope ?? ""}`,
  );
  if (state.relationships.some((r) => r.id === relationshipId)) return;

  const verified = Boolean(assertion.evidencePassage);
  const relationship: DocumentRelationship = {
    id: relationshipId,
    fromDocumentId,
    toDocumentId: target.id,
    relationshipType:
      assertion.type as DocumentRelationship["relationshipType"],
    scope: assertion.scope ?? null,
    effectiveDate: assertion.effectiveDate ?? null,
    evidencePassage: assertion.evidencePassage ?? null,
    verificationStatus: (verified
      ? "VERIFIED"
      : "UNVERIFIED") as DocumentRelationship["verificationStatus"],
    notes: verified
      ? "asserted by source artifact with quoted evidence"
      : "no evidence passage; not applied to legal status",
    createdAt: nowIso,
  };
  state.relationships.push(relationship);

  // Legal-status mutation only from an evidenced relationship.
  if (!verified) return;

  const scope = assertion.scope?.trim();
  if (scope) {
    const currentVersion = state.versions.find(
      (v) => v.documentId === target.id && v.isCurrent,
    );
    const provision = state.provisions.find(
      (p) =>
        p.documentId === target.id &&
        p.versionId === currentVersion?.id &&
        p.label.trim().toLowerCase() === scope.toLowerCase(),
    );
    if (!provision) return;
    if (
      assertion.type === "REPEALS" ||
      assertion.type === "PARTIALLY_REPEALS"
    ) {
      provision.legalStatus = "REPEALED" as LegalProvision["legalStatus"];
    } else if (
      assertion.type === "AMENDS" ||
      assertion.type === "PARTIALLY_AMENDS" ||
      assertion.type === "MODIFIES"
    ) {
      provision.legalStatus = "AMENDED" as LegalProvision["legalStatus"];
    } else {
      return;
    }
    provision.amendedByDocumentId = fromDocumentId;
    // Only a repeal ends a provision. An amendment replaces its text; the
    // provision remains in force from the amendment's effective date.
    if (
      assertion.type === "REPEALS" ||
      assertion.type === "PARTIALLY_REPEALS"
    ) {
      provision.effectiveTo = assertion.effectiveDate ?? provision.effectiveTo;
    }
    target.legalStatus = "PARTIALLY_AMENDED" as LegalDocument["legalStatus"];
  } else {
    if (assertion.type === "REPEALS") {
      target.legalStatus = "REPEALED" as LegalDocument["legalStatus"];
      target.repealDate = assertion.effectiveDate ?? target.repealDate ?? null;
    } else if (
      assertion.type === "PARTIALLY_REPEALS" ||
      assertion.type === "AMENDS" ||
      assertion.type === "PARTIALLY_AMENDS"
    ) {
      target.legalStatus = "PARTIALLY_AMENDED" as LegalDocument["legalStatus"];
    } else if (assertion.type === "SUPERSEDES") {
      target.legalStatus = "SUPERSEDED" as LegalDocument["legalStatus"];
    }
  }
}

export type { CorpusState };

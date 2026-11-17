// Gate 16 — effect-claim intake: corpus bytes to ledger records.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type {
  CorpusState,
  EffectClaimInput,
  EffectClaimRecords,
  EffectClaimResult,
} from "../../packages/legal-ingestion/src/index";
import {
  D1AuthorityStore,
  deriveEvidenceId,
  deriveProvisionIdentityId,
  deriveProvisionMappingId,
  normalizeLabel,
  recordEffectClaim,
} from "../../packages/legal-ingestion/src/index";
import type {
  DocumentVersion,
  EffectEvidence,
  LegalDocument,
} from "../../packages/legal-schema/src/index";
import {
  AuthorityLevel,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const SOURCE_HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TARGET_HASH =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CREATED_AT = "2026-01-01T00:00:00Z";

const SOURCE_CHUNK_ONE =
  "Section 1. The synthetic source provision is amended by the synthetic target.";
const SOURCE_CHUNK_TWO =
  "Section 2. This synthetic chunk carries unrelated text for the fixture.";
const TARGET_CHUNK = "Section 2. The synthetic target provision.";

function document(id: string, title: string): LegalDocument {
  return {
    id,
    documentType: DocumentType.REPUBLIC_ACT,
    title,
    legalStatus: LegalStatus.IN_FORCE,
    verificationStatus: VerificationStatus.VERIFIED,
    authorityLevel: AuthorityLevel.OFFICIAL_PRIMARY,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function version(
  id: string,
  documentId: string,
  contentHash: string,
): DocumentVersion {
  return {
    id,
    documentId,
    versionNumber: 1,
    contentHash,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    isCurrent: true,
    createdAt: CREATED_AT,
  };
}

/**
 * Two documents, one version each, one provision each on the target side, and
 * two chunks on the source version (three chunks in all, so the source version
 * is not a single-chunk document unless a test says so).
 */
function buildCorpus(): CorpusState {
  return {
    documents: [
      document("doc-source", "Synthetic Source Act"),
      document("doc-target", "Synthetic Target Act"),
    ],
    versions: [
      version("ver-source-1", "doc-source", SOURCE_HASH),
      version("ver-target-1", "doc-target", TARGET_HASH),
    ],
    manifestations: [],
    provisions: [
      {
        id: "prov-source-1",
        documentId: "doc-source",
        versionId: "ver-source-1",
        provisionType: "SECTION",
        label: "Section 1",
        text: "The synthetic source provision.",
        ordinal: 1,
        legalStatus: LegalStatus.IN_FORCE,
        createdAt: CREATED_AT,
      },
      {
        id: "prov-target-2",
        documentId: "doc-target",
        versionId: "ver-target-1",
        provisionType: "SECTION",
        label: "Section 2",
        text: "The synthetic target provision.",
        ordinal: 2,
        legalStatus: LegalStatus.IN_FORCE,
        createdAt: CREATED_AT,
      },
    ],
    chunks: [
      {
        id: "chunk-source-1",
        documentId: "doc-source",
        versionId: "ver-source-1",
        provisionId: "prov-source-1",
        chunkKind: "provision",
        chunkIndex: 0,
        content: SOURCE_CHUNK_ONE,
        createdAt: CREATED_AT,
      },
      {
        id: "chunk-source-2",
        documentId: "doc-source",
        versionId: "ver-source-1",
        provisionId: "prov-source-1",
        chunkKind: "provision",
        chunkIndex: 1,
        content: SOURCE_CHUNK_TWO,
        createdAt: CREATED_AT,
      },
      {
        id: "chunk-target-1",
        documentId: "doc-target",
        versionId: "ver-target-1",
        provisionId: "prov-target-2",
        chunkKind: "provision",
        chunkIndex: 0,
        content: TARGET_CHUNK,
        createdAt: CREATED_AT,
      },
    ],
    relationships: [],
    runs: [],
    pendingRelationships: [],
  };
}

function baseInput(): EffectClaimInput {
  return {
    effectType: "PARTIAL_AMENDMENT",
    scope: "Section 2",
    source: {
      documentId: "doc-source",
      versionId: "ver-source-1",
      provisionId: "prov-source-1",
      locator: "Section 1",
    },
    target: { documentId: "doc-target", provisionLabel: "Section 2" },
    claimedDate: "2026-06-15",
    claimedEffectiveDate: "2026-07-01",
    evidence: { chunkId: "chunk-source-1", charStart: 10, charEnd: 40 },
    analyst: { id: "analyst-1", recordedAt: "2026-06-16T00:00:00Z" },
  };
}

function recordsOf(result: EffectClaimResult): EffectClaimRecords {
  if (!result.ok) throw new Error(`unexpected refusal: ${result.reason}`);
  return result.records;
}

/** A refusal returns exactly the reason and carries no records. */
function expectRefusal(result: EffectClaimResult, reason: string): void {
  expect(result).toEqual({ ok: false, reason });
}

function chunkContent(corpus: CorpusState, chunkId: string): string {
  const chunk = corpus.chunks.find((c) => c.id === chunkId);
  if (chunk === undefined) throw new Error(`fixture missing ${chunkId}`);
  return chunk.content;
}

/**
 * Re-derive the evidence id the way the intake does: the evidence facts are
 * hashed with the assertion id the claim already derived and that the finished
 * evidence row carries. See `EVIDENCE_ID_PLACEHOLDER` in effect-intake.ts.
 */
function evidenceIdOf(evidence: EffectEvidence): string {
  return deriveEvidenceId(evidence);
}

describe("recordEffectClaim — happy path", () => {
  it("builds an assertion and evidence pinned to the chunk span", () => {
    const corpus = buildCorpus();
    const { assertion, evidence, provisionIdentity, provisionMapping } =
      recordsOf(recordEffectClaim(corpus, baseInput()));

    expect(assertion.state).toBe("UNREVIEWED");
    expect(assertion.assertionOrigin).toBe("ANALYST_INTAKE");
    expect(assertion.recordedBy).toBe("analyst-1");
    expect(assertion.recordedAt).toBe("2026-06-16T00:00:00Z");
    expect(assertion.effectType).toBe("PARTIAL_AMENDMENT");
    expect(assertion.scope).toBe("Section 2");
    expect(assertion.sourceDocumentId).toBe("doc-source");
    expect(assertion.sourceVersionId).toBe("ver-source-1");
    expect(assertion.sourceProvisionId).toBe("prov-source-1");
    expect(assertion.targetDocumentId).toBe("doc-target");
    expect(assertion.targetVersionId).toBe("ver-target-1");
    expect(assertion.claimedDate).toBe("2026-06-15");
    expect(assertion.claimedEffectiveDate).toBe("2026-07-01");
    expect(assertion.sourceLocator).toBe("Section 1");
    expect(assertion.supersedesAssertionId).toBeNull();
    expect(assertion.conflictGroupId).toBeNull();

    expect(evidence.assertionId).toBe(assertion.id);
    expect(assertion.evidenceId).toBe(evidence.id);
    expect(evidence.passage).toBe(
      chunkContent(corpus, "chunk-source-1").slice(10, 40),
    );
    expect(evidence.contentHash).toBe(SOURCE_HASH);
    expect(evidence.documentVersionId).toBe("ver-source-1");
    expect(evidence.provisionVersionId).toBe("prov-source-1");
    expect(evidence.artifactId).toBeNull();
    expect(evidence.locator).toBe("Section 1");
    expect(evidence.evidenceDate).toBe("2026-06-15");
    expect(evidence.classification).toBe("UNKNOWN");
    expect(evidence.availability).toBe("AVAILABLE");
    expect(evidence.checkedAt).toBeNull();

    // The assertion id is derived before the evidence id exists, with the
    // assertion's `evidenceId` set to a fixed placeholder, so the finished row
    // does not re-derive its own id from its stored fields. What holds instead:
    // the id is reproducible from the same input, and any changed identity field
    // changes it.
    const again = recordsOf(recordEffectClaim(corpus, baseInput()));
    expect(again.assertion.id).toBe(assertion.id);
    expect(again.evidence.id).toBe(evidence.id);

    const changedFields: Array<(input: EffectClaimInput) => void> = [
      (input) => {
        input.effectType = "EFFECTIVITY";
      },
      (input) => {
        input.scope = "Section 3";
      },
      (input) => {
        input.claimedDate = "2026-06-14";
      },
      (input) => {
        input.claimedEffectiveDate = "2026-07-02";
      },
      (input) => {
        input.source.locator = "Section 1(a)";
      },
      (input) => {
        input.supersedesAssertionId = "lea_previous";
      },
    ];
    for (const mutate of changedFields) {
      const changed = baseInput();
      mutate(changed);
      expect(
        recordsOf(recordEffectClaim(corpus, changed)).assertion.id,
      ).not.toBe(assertion.id);
    }

    expect(evidence.id).toBe(evidenceIdOf(evidence));

    expect(provisionIdentity).not.toBeNull();
    expect(provisionMapping).not.toBeNull();
    if (provisionIdentity === null || provisionMapping === null) return;

    expect(provisionIdentity.documentId).toBe("doc-target");
    expect(provisionIdentity.provisionType).toBe("SECTION");
    expect(provisionIdentity.canonicalLabel).toBe("Section 2");
    expect(provisionIdentity.createdAt).toBe("2026-06-16T00:00:00Z");
    expect(provisionIdentity.id).toBe(
      deriveProvisionIdentityId(provisionIdentity),
    );

    expect(provisionMapping.provisionIdentityId).toBe(provisionIdentity.id);
    expect(provisionMapping.provisionVersionId).toBe("prov-target-2");
    expect(provisionMapping.documentVersionId).toBe("ver-target-1");
    expect(provisionMapping.mappingType).toBe("SAME");
    expect(provisionMapping.reviewStatus).toBe("UNREVIEWED");
    expect(provisionMapping.rationale).toContain("Section 2");
    expect(provisionMapping.createdAt).toBe("2026-06-16T00:00:00Z");
    expect(provisionMapping.id).toBe(
      deriveProvisionMappingId(provisionMapping),
    );

    expect(assertion.targetProvisionIdentityId).toBe(provisionIdentity.id);
  });

  it("records no provision identity or mapping when no label is named", () => {
    const corpus = buildCorpus();
    const input = baseInput();
    input.target = { documentId: "doc-target" };

    const { assertion, provisionIdentity, provisionMapping } = recordsOf(
      recordEffectClaim(corpus, input),
    );

    expect(assertion.targetProvisionIdentityId).toBeNull();
    expect(provisionIdentity).toBeNull();
    expect(provisionMapping).toBeNull();
  });

  it("defaults the span to the whole chunk", () => {
    const corpus = buildCorpus();
    const input = baseInput();
    input.evidence = { chunkId: "chunk-source-1" };

    const { evidence } = recordsOf(recordEffectClaim(corpus, input));

    expect(evidence.passage).toBe(SOURCE_CHUNK_ONE);
  });

  it("falls back to a chunk locator when none is given", () => {
    const corpus = buildCorpus();
    const input = baseInput();
    input.source = {
      documentId: "doc-source",
      versionId: "ver-source-1",
      provisionId: "prov-source-1",
    };

    const { assertion, evidence } = recordsOf(recordEffectClaim(corpus, input));

    expect(evidence.locator).toBe("chunk:chunk-source-1");
    expect(assertion.sourceLocator).toBe("chunk:chunk-source-1");
  });

  it("matches a normalised label and stores the canonical label as written", () => {
    const corpus = buildCorpus();
    const input = baseInput();
    input.target = { documentId: "doc-target", provisionLabel: "Sec. 2" };

    const { provisionIdentity } = recordsOf(recordEffectClaim(corpus, input));

    expect(provisionIdentity?.canonicalLabel).toBe("Section 2");
  });

  it("matches through the shared normaliser, and keeps subdivisions distinct", () => {
    const corpus = buildCorpus();
    const stored = corpus.provisions.find((p) => p.id === "prov-target-2");
    if (stored === undefined) throw new Error("fixture missing prov-target-2");
    stored.label = "Section 2(a)";

    // What the shared normaliser actually does with the two spellings.
    expect(normalizeLabel("Sec. 2(a)")).toBe("SEC.2_A");
    expect(normalizeLabel("Section 2A")).toBe("SECTION2A");

    // Same key, written differently: it matches, and the stored label is kept.
    const spelled = baseInput();
    spelled.target = {
      documentId: "doc-target",
      provisionLabel: "Sec. 2(a)",
    };
    const { provisionIdentity } = recordsOf(recordEffectClaim(corpus, spelled));
    expect(provisionIdentity?.canonicalLabel).toBe("Section 2(a)");

    // A different key is a refusal, not a looser match on the same number.
    const subdivision = baseInput();
    subdivision.target = {
      documentId: "doc-target",
      provisionLabel: "Section 2A",
    };
    expectRefusal(
      recordEffectClaim(corpus, subdivision),
      "unknown_target_provision",
    );
  });
});

describe("recordEffectClaim — determinism", () => {
  it("returns identical ids for the same claim recorded twice", () => {
    const first = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    const second = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));

    expect(second.assertion.id).toBe(first.assertion.id);
    expect(second.evidence.id).toBe(first.evidence.id);
    expect(second.assertion.evidenceId).toBe(first.assertion.evidenceId);
    expect(second.records).toEqual(first.records);
  });
});

describe("recordEffectClaim — invariants", () => {
  it("leaves the corpus unchanged", () => {
    const corpus = buildCorpus();
    const before = structuredClone(corpus);

    recordsOf(recordEffectClaim(corpus, baseInput()));

    expect(corpus).toEqual(before);
  });

  it("returns no review record", () => {
    const records = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));

    expect(Object.keys(records).sort()).toEqual([
      "assertion",
      "evidence",
      "provisionIdentity",
      "provisionMapping",
    ]);
  });
});

describe("recordEffectClaim — refusals", () => {
  it("refuses an unknown source document", () => {
    const input = baseInput();
    input.source = { documentId: "doc-missing", versionId: "ver-source-1" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "unknown_source_document",
    );
  });

  it("refuses an unknown source version", () => {
    const input = baseInput();
    input.source = { documentId: "doc-source", versionId: "ver-missing" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "unknown_source_version",
    );
  });

  it("refuses a version that belongs to another document", () => {
    const input = baseInput();
    input.source = { documentId: "doc-source", versionId: "ver-target-1" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "version_not_of_document",
    );
  });

  it("refuses a source version whose content hash is not 64 hex characters", () => {
    for (const bad of ["abc", "g".repeat(64), SOURCE_HASH.slice(1)]) {
      const corpus = buildCorpus();
      const source = corpus.versions.find((v) => v.id === "ver-source-1");
      if (source === undefined) throw new Error("fixture missing ver-source-1");
      source.contentHash = bad;
      expectRefusal(
        recordEffectClaim(corpus, baseInput()),
        "invalid_content_hash",
      );
    }
  });

  it("refuses an unknown target document", () => {
    const input = baseInput();
    input.target = { documentId: "doc-missing" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "unknown_target_document",
    );
  });

  it("refuses an unknown evidence chunk", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-missing" };
    expectRefusal(recordEffectClaim(buildCorpus(), input), "unknown_chunk");
  });

  it("refuses a chunk from another document", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-target-1" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_not_of_source",
    );
  });

  it("refuses a source provision the cited chunk does not carry", () => {
    const input = baseInput();
    input.source.provisionId = "prov-source-2";
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_provision_mismatch",
    );
  });

  it("accepts a cited source provision when the chunk carries none", () => {
    // An unsegmented chunk has nothing to contradict, so the claim is accepted
    // rather than being matched by assumption.
    const corpus = buildCorpus();
    const chunk = corpus.chunks.find((c) => c.id === "chunk-source-1");
    if (chunk === undefined) throw new Error("fixture missing chunk-source-1");
    chunk.provisionId = null;

    const { assertion, evidence } = recordsOf(
      recordEffectClaim(corpus, baseInput()),
    );

    expect(assertion.sourceProvisionId).toBe("prov-source-1");
    expect(evidence.provisionVersionId).toBe("prov-source-1");
  });

  it("refuses a span outside the chunk", () => {
    const input = baseInput();
    input.evidence = {
      chunkId: "chunk-source-1",
      charStart: 10,
      charEnd: 5000,
    };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });

  it("refuses an effect type outside the vocabulary", () => {
    const input = baseInput();
    input.effectType = "ASSASSINATION" as never;
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "invalid_effect_type",
    );
  });

  it("refuses a missing scope", () => {
    const input = baseInput();
    input.scope = "   ";
    expectRefusal(recordEffectClaim(buildCorpus(), input), "missing_scope");
  });

  it("refuses a missing analyst id", () => {
    const input = baseInput();
    input.analyst = { id: "", recordedAt: "2026-06-16T00:00:00Z" };
    expectRefusal(recordEffectClaim(buildCorpus(), input), "missing_analyst");
  });

  it("refuses an invalid recording instant", () => {
    const input = baseInput();
    input.analyst = { id: "analyst-1", recordedAt: "yesterday" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "invalid_recorded_at",
    );
  });

  it("refuses a claim date that is not a real ISO date", () => {
    const input = baseInput();
    input.claimedDate = "2026-13-45";
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "invalid_claim_date",
    );
  });

  it("refuses a provision label the target does not carry", () => {
    const input = baseInput();
    input.target = { documentId: "doc-target", provisionLabel: "Section 99" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "unknown_target_provision",
    );
  });

  it("refuses a target label that more than one provision normalises to", () => {
    // "Section 2" and "2" fold to the same key, so a document holding both
    // cannot say which one the analyst meant. It is refused, not resolved by
    // whichever provision sorts first.
    const corpus = buildCorpus();
    corpus.provisions.push({
      id: "prov-target-2-plain",
      documentId: "doc-target",
      versionId: "ver-target-1",
      provisionType: "SECTION",
      label: "2",
      text: "A duplicated synthetic target provision, labelled without a prefix.",
      ordinal: 3,
      legalStatus: LegalStatus.IN_FORCE,
      createdAt: CREATED_AT,
    });

    const input = baseInput();
    input.target = { documentId: "doc-target", provisionLabel: "Section 2" };
    expectRefusal(
      recordEffectClaim(corpus, input),
      "ambiguous_target_provision",
    );
  });

  it("matches a target label only in the target's current version", () => {
    // The superseded version carries a label the current version dropped. It
    // used to bind while the assertion named the current version; it no longer
    // resolves at all.
    const corpus = buildCorpus();
    corpus.versions.push({
      id: "ver-target-0",
      documentId: "doc-target",
      versionNumber: 0,
      contentHash: TARGET_HASH,
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-12-31",
      isCurrent: false,
      createdAt: CREATED_AT,
    });
    corpus.provisions.push({
      id: "prov-target-9-old",
      documentId: "doc-target",
      versionId: "ver-target-0",
      provisionType: "SECTION",
      label: "Section 9",
      text: "The superseded synthetic target provision.",
      ordinal: 9,
      legalStatus: LegalStatus.REPEALED,
      createdAt: CREATED_AT,
    });

    const stale = baseInput();
    stale.target = { documentId: "doc-target", provisionLabel: "Section 9" };
    expectRefusal(recordEffectClaim(corpus, stale), "unknown_target_provision");

    // The current version's own label still binds inside that version.
    const current = baseInput();
    current.target = { documentId: "doc-target", provisionLabel: "Section 2" };
    const { assertion, provisionMapping } = recordsOf(
      recordEffectClaim(corpus, current),
    );
    expect(assertion.targetVersionId).toBe("ver-target-1");
    expect(provisionMapping?.documentVersionId).toBe("ver-target-1");
  });

  it("falls back to all of the target's versions when none is current", () => {
    const corpus = buildCorpus();
    corpus.versions = corpus.versions.map((v) => ({ ...v, isCurrent: false }));
    corpus.versions.push({
      id: "ver-target-0",
      documentId: "doc-target",
      versionNumber: 0,
      contentHash: TARGET_HASH,
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-12-31",
      isCurrent: false,
      createdAt: CREATED_AT,
    });
    corpus.provisions.push({
      id: "prov-target-9-old",
      documentId: "doc-target",
      versionId: "ver-target-0",
      provisionType: "SECTION",
      label: "Section 9",
      text: "The superseded synthetic target provision.",
      ordinal: 9,
      legalStatus: LegalStatus.REPEALED,
      createdAt: CREATED_AT,
    });

    const input = baseInput();
    input.target = { documentId: "doc-target", provisionLabel: "Section 9" };
    const { assertion, provisionMapping } = recordsOf(
      recordEffectClaim(corpus, input),
    );

    // No version is in force, so none is named, and the only match resolves.
    expect(assertion.targetVersionId).toBeNull();
    expect(provisionMapping?.documentVersionId).toBe("ver-target-0");
  });
});

describe("recordEffectClaim — runtime junk fails closed", () => {
  it("refuses a null input", () => {
    expectRefusal(
      recordEffectClaim(buildCorpus(), null as never),
      "unknown_source_document",
    );
  });

  it("refuses a non-object input", () => {
    expectRefusal(
      recordEffectClaim(buildCorpus(), {} as never),
      "unknown_source_document",
    );
  });

  it("refuses a non-string source document id", () => {
    const input = baseInput() as unknown as Record<string, unknown>;
    input.source = { documentId: 42, versionId: "ver-source-1" };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input as never),
      "unknown_source_document",
    );
  });

  it("refuses a blank chunk id", () => {
    const input = baseInput();
    input.evidence = { chunkId: "  " };
    expectRefusal(recordEffectClaim(buildCorpus(), input), "unknown_chunk");
  });

  it("refuses a NaN span", () => {
    const input = baseInput();
    input.evidence = {
      chunkId: "chunk-source-1",
      charStart: Number.NaN,
      charEnd: 40,
    };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });

  it("refuses an inverted span", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-source-1", charStart: 40, charEnd: 10 };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });

  it("refuses a span beyond the chunk length", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-source-1", charStart: 0, charEnd: 999 };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });

  it("refuses a half-supplied span", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-source-1", charStart: 10 };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });

  it("refuses an empty span", () => {
    const input = baseInput();
    input.evidence = { chunkId: "chunk-source-1", charStart: 10, charEnd: 10 };
    expectRefusal(
      recordEffectClaim(buildCorpus(), input),
      "chunk_span_invalid",
    );
  });
});

describe("recordEffectClaim — warnings", () => {
  it("warns when the target is the source", () => {
    const input = baseInput();
    input.target = { documentId: "doc-source" };

    const result = recordEffectClaim(buildCorpus(), input);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.warnings : []).toContain("target_is_source");
  });

  it("warns when the claimed date postdates the claimed effective date", () => {
    const input = baseInput();
    input.claimedDate = "2026-08-01";

    const result = recordEffectClaim(buildCorpus(), input);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.warnings : []).toContain(
      "claimed_date_after_effective",
    );
  });

  it("warns when the evidence chunk is the whole version", () => {
    const corpus = buildCorpus();
    corpus.chunks = corpus.chunks.filter((c) => c.id === "chunk-source-1");

    const result = recordEffectClaim(corpus, baseInput());

    expect(result.ok).toBe(true);
    expect(result.ok ? result.warnings : []).toEqual([
      "evidence_chunk_covers_whole_document",
    ]);
  });

  it("returns warnings sorted", () => {
    const input = baseInput();
    input.target = { documentId: "doc-source" };
    input.claimedDate = "2026-08-01";

    const result = recordEffectClaim(buildCorpus(), input);

    expect(result.ok ? result.warnings : []).toEqual([
      "claimed_date_after_effective",
      "target_is_source",
    ]);
  });
});

describe("recordEffectClaim — replay through the D1 write path", () => {
  function seeded(): { db: SqliteD1Database; store: D1AuthorityStore } {
    const db = new SqliteD1Database();
    db.applyMigrations();
    db.db.exec(`
      INSERT INTO legal_documents
        (id, document_type, title, legal_status, verification_status,
         authority_level)
      VALUES
        ('doc-source', 'REPUBLIC_ACT', 'Synthetic Source Act', 'UNKNOWN',
         'UNVERIFIED', 'official_primary'),
        ('doc-target', 'REPUBLIC_ACT', 'Synthetic Target Act', 'UNKNOWN',
         'UNVERIFIED', 'official_primary');

      INSERT INTO document_versions
        (id, document_id, version_number, content_hash, is_current,
         effective_from)
      VALUES
        ('ver-source-1', 'doc-source', 1, '${SOURCE_HASH}', 1, '2026-01-01'),
        ('ver-target-1', 'doc-target', 1, '${TARGET_HASH}', 1, '2026-01-01');

      INSERT INTO legal_provisions
        (id, document_id, version_id, provision_type, label, text, ordinal,
         legal_status)
      VALUES
        ('prov-source-1', 'doc-source', 'ver-source-1', 'SECTION', 'Section 1',
         'The synthetic source provision.', 1, 'UNKNOWN'),
        ('prov-target-2', 'doc-target', 'ver-target-1', 'SECTION', 'Section 2',
         'The synthetic target provision.', 2, 'UNKNOWN');
    `);
    return { db, store: new D1AuthorityStore(db) };
  }

  it("rejects a re-recorded assertion and evidence as duplicates", async () => {
    const { db, store } = seeded();
    const records = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));

    if (records.provisionIdentity !== null) {
      await store.recordProvisionIdentity(records.provisionIdentity);
    }
    if (records.provisionMapping !== null) {
      await store.recordProvisionMapping(records.provisionMapping);
    }
    await store.recordAssertion(records.assertion);
    await store.recordEvidence(records.evidence);

    await expect(store.recordAssertion(records.assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );
    await expect(store.recordEvidence(records.evidence)).rejects.toThrow(
      "duplicate_authority_record",
    );

    // A replay derives the same ids from a rebuilt corpus, so it lands as the
    // same duplicate rather than forking history.
    const replay = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    expect(replay.assertion.id).toBe(records.assertion.id);
    expect(replay.evidence.id).toBe(records.evidence.id);
    await expect(store.recordAssertion(replay.assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );
    await expect(store.recordEvidence(replay.evidence)).rejects.toThrow(
      "duplicate_authority_record",
    );

    db.close();
  });

  /** Write one claim's records in ledger order: identity, mapping, then claim. */
  async function writeNewClaim(
    store: D1AuthorityStore,
    records: EffectClaimRecords,
  ): Promise<void> {
    if (records.provisionIdentity !== null) {
      await store.recordProvisionIdentity(records.provisionIdentity);
    }
    if (records.provisionMapping !== null) {
      await store.recordProvisionMapping(records.provisionMapping);
    }
    await store.recordAssertion(records.assertion);
    await store.recordEvidence(records.evidence);
  }

  it("records two claims over the same passage when their effect types differ", async () => {
    const { db, store } = seeded();
    const amendment = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    const effectivityInput = baseInput();
    effectivityInput.effectType = "EFFECTIVITY";
    const effectivity = recordsOf(
      recordEffectClaim(buildCorpus(), effectivityInput),
    );

    // One passage, one span, two different claims.
    expect(effectivity.evidence.passage).toBe(amendment.evidence.passage);
    expect(effectivity.evidence.locator).toBe(amendment.evidence.locator);
    expect(effectivity.assertion.id).not.toBe(amendment.assertion.id);
    expect(effectivity.evidence.id).not.toBe(amendment.evidence.id);

    // The provision identity and mapping are the same edge for both claims.
    if (amendment.provisionIdentity !== null) {
      await store.recordProvisionIdentity(amendment.provisionIdentity);
    }
    if (amendment.provisionMapping !== null) {
      await store.recordProvisionMapping(amendment.provisionMapping);
    }
    await store.recordAssertion(amendment.assertion);
    await store.recordEvidence(amendment.evidence);

    // The second claim over the same bytes is a record of its own, not a
    // duplicate: evidence ids are unique per claim.
    await expect(
      store.recordAssertion(effectivity.assertion),
    ).resolves.toBeUndefined();
    await expect(
      store.recordEvidence(effectivity.evidence),
    ).resolves.toBeUndefined();

    db.close();
  });

  it("keeps the same claim's ids stable and rejects the second write", async () => {
    const { db, store } = seeded();
    const first = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    const second = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));

    expect(second.assertion.id).toBe(first.assertion.id);
    expect(second.evidence.id).toBe(first.evidence.id);

    await writeNewClaim(store, first);

    await expect(store.recordAssertion(second.assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );
    await expect(store.recordEvidence(second.evidence)).rejects.toThrow(
      "duplicate_authority_record",
    );

    db.close();
  });

  it("collapses claims that differ only in evidence to one assertion id", async () => {
    const { db, store } = seeded();
    const first = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    const widerInput = baseInput();
    widerInput.evidence = {
      chunkId: "chunk-source-1",
      charStart: 0,
      charEnd: 60,
    };
    const wider = recordsOf(recordEffectClaim(buildCorpus(), widerInput));

    // The claim fields are identical and the assertion id hashes them, not the
    // evidence facts, so the claim is one record. The evidence is a property of
    // it and carries its own id.
    expect(wider.assertion.id).toBe(first.assertion.id);
    expect(wider.evidence.id).not.toBe(first.evidence.id);

    await writeNewClaim(store, first);

    await expect(store.recordAssertion(wider.assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );
    await expect(store.recordEvidence(wider.evidence)).resolves.toBeUndefined();

    db.close();
  });

  it("binds every evidence row of one claim to that claim's assertion id", async () => {
    // Two reads of the same claim, from different spans. The assertion is one
    // record; each reading is its own evidence row, and both bind to it. This is
    // the evidence-with-something-to-bind-to case, written out.
    const { db, store } = seeded();
    const first = recordsOf(recordEffectClaim(buildCorpus(), baseInput()));
    const widerInput = baseInput();
    widerInput.evidence = {
      chunkId: "chunk-source-1",
      charStart: 0,
      charEnd: 60,
    };
    const wider = recordsOf(recordEffectClaim(buildCorpus(), widerInput));

    expect(wider.assertion.id).toBe(first.assertion.id);
    expect(wider.evidence.id).not.toBe(first.evidence.id);
    expect(wider.evidence.passage).not.toBe(first.evidence.passage);

    await writeNewClaim(store, first);

    // The claim is already on file, so the second assertion write is refused;
    // the second evidence row is new and is accepted.
    await expect(store.recordAssertion(wider.assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );
    await expect(store.recordEvidence(wider.evidence)).resolves.toBeUndefined();

    const stored = await store.listEvidence(first.assertion.id);
    expect(stored.map((evidence) => evidence.id)).toEqual(
      [first.evidence.id, wider.evidence.id].sort(),
    );
    for (const evidence of stored) {
      expect(evidence.assertionId).toBe(first.assertion.id);
    }
    expect(await store.getAssertion(first.assertion.id)).toEqual(
      first.assertion,
    );

    db.close();
  });
});

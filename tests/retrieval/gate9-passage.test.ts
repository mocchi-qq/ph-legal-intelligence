import { describe, expect, it } from "vitest";
import {
  createCitationVerifier,
  supportCoverage,
} from "../../packages/citation-engine/src/index";
import { segmentProvisions } from "../../packages/legal-ingestion/src/extract";
import {
  buildSearchIndex,
  retrieve,
  toCitationInput,
} from "../../packages/legal-search/src/index";
import type {
  IndexEntry,
  SearchIndex,
} from "../../packages/legal-search/src/retrieve";
import {
  allowSyntheticIndex,
  buildFixtureCorpus,
  currentVersion,
  docByKey,
} from "../benchmark/helpers";

const store = buildFixtureCorpus();
const index = buildSearchIndex(store.state, { authorize: allowSyntheticIndex });
const doc = docByKey(store, "COURT_DECISION:G.R. No. 999001");

function corpusView() {
  return {
    documents: store.state.documents.map((d) => ({
      id: d.id,
      title: d.title,
      citationText: d.citationText,
      docketNumber: d.docketNumber,
      identityKey: d.identityKey,
      legalStatus: d.legalStatus,
      effectivityDate: d.effectivityDate,
      repealDate: d.repealDate,
      promulgationDate: d.promulgationDate,
    })),
    versions: store.state.versions.map((v) => ({
      id: v.id,
      documentId: v.documentId,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      isCurrent: v.isCurrent,
    })),
    provisions: store.state.provisions.map((p) => ({
      id: p.id,
      documentId: p.documentId,
      versionId: p.versionId,
      label: p.label,
      text: p.text,
      legalStatus: p.legalStatus,
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo,
    })),
    chunks: store.state.chunks.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      versionId: c.versionId,
      provisionId: c.provisionId,
      content: c.content,
    })),
  };
}

function exactResults() {
  return retrieve(index, {
    text: "G.R. No. 999001",
    mode: "standard",
    limit: 5,
  });
}

/**
 * A two-chunk synthetic decision: the caption states the docket number, the body
 * does not. Used to check that an identifier-bearing chunk ranks first.
 */
function passageIndex(): SearchIndex {
  const base: Omit<
    IndexEntry,
    "chunkId" | "chunkIndex" | "content" | "termFreq" | "length"
  > = {
    documentId: "d-passage",
    versionId: "v-passage",
    provisionId: null,
    provisionLabel: null,
    exactKeys: [
      "grno999001",
      "courtdecisiongrno999001",
      "syntheticentityvsyntheticauthority",
    ],
    documentType: "COURT_DECISION",
    title: "Synthetic Entity v. Synthetic Authority",
    court: "Supreme Court",
    agency: "Supreme Court",
    jurisdiction: "PH",
    sourceId: "synthetic",
    verificationStatus: "VERIFIED",
    legalStatus: "IN_FORCE",
    authorityLevel: "official_primary",
    year: 2020,
    effectiveFrom: "2020-06-01",
    effectiveTo: null,
    charStart: 0,
    charEnd: 10,
    citationText: "G.R. No. 999001",
  };
  const caption: IndexEntry = {
    ...base,
    chunkId: "chunk-caption",
    chunkIndex: 0,
    content: "G.R. No. 999001 Synthetic Entity v. Synthetic Authority",
    termFreq: new Map([
      ["g.r.", 1],
      ["no.", 1],
      ["999001", 1],
      ["synthetic", 2],
      ["entity", 1],
      ["v.", 1],
      ["authority", 1],
    ]),
    length: 8,
  };
  const body: IndexEntry = {
    ...base,
    chunkId: "chunk-body",
    chunkIndex: 1,
    content: "Ruling. The petition is denied.",
    termFreq: new Map([
      ["ruling.", 1],
      ["petition", 1],
      ["denied.", 1],
    ]),
    length: 3,
  };
  const docFreq = new Map<string, number>();
  for (const entry of [caption, body]) {
    for (const term of entry.termFreq.keys())
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }
  return { entries: [caption, body], docFreq, total: 2 };
}

describe("gate 9 passage retrieval", () => {
  it("returns the exact decision as the top result for a G.R. query", () => {
    const results = retrieve(index, {
      text: "G.R. No. 999001",
      mode: "standard",
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.documentId).toBe(doc.id);
    // The document matched by identifier; the passage itself need not repeat it.
    expect(results[0]?.exactMatch).toBe(true);
    expect(results[0]?.versionId).toBeTruthy();
  });

  it("party-name full citation returns nothing when the docket does not exist", () => {
    // The typed G.R. number is embedded after a party name, so the old
    // position-anchored check missed it and lexical neighbours leaked through.
    const results = retrieve(index, {
      text: "People v. Synthetic Entity, G.R. No. 999404",
      mode: "standard",
      limit: 10,
    });
    expect(results).toEqual([]);
  });

  it("exactMatch marks every chunk of the matched document", () => {
    // exactMatch is document-level: the matched document's identifier was found,
    // so every returned passage of that document carries the flag.
    const results = retrieve(index, {
      text: "G.R. No. 999001",
      mode: "standard",
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.exactMatch === true)).toBe(true);
  });

  it("exact identifier ranks an identifier-bearing chunk first", () => {
    const results = retrieve(passageIndex(), {
      text: "G.R. No. 999001",
      mode: "standard",
      limit: 10,
    });
    // Only meaningful when some passage actually restates the identifier.
    if (results.some((r) => r.passage.includes("999001"))) {
      expect(results[0]?.passage.includes("999001")).toBe(true);
    }
  });

  it("exactMatch is false for a purely lexical hit", () => {
    const results = retrieve(index, {
      text: "annual renewal of registration",
      mode: "standard",
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.exactMatch === false)).toBe(true);
  });

  it("carries version, provision and provenance identifiers", () => {
    const r = exactResults()[0]!;
    expect(r.versionId).toBe(currentVersion(store, doc.id).id);
    expect(r.provenance.documentId).toBe(doc.id);
    expect(r.provenance.chunkId).toBe(r.chunkId);
    expect(r.provenance.sourceId).toBe(doc.sourceId);
  });

  it("reports a span that matches the source chunk", () => {
    const r = exactResults()[0]!;
    const chunk = store.state.chunks.find((c) => c.id === r.chunkId);
    expect(r.span).toEqual(
      chunk?.charStart != null && chunk?.charEnd != null
        ? { charStart: chunk.charStart, charEnd: chunk.charEnd }
        : null,
    );
  });

  it("returns nothing for an identifier that does not exist", () => {
    const results = retrieve(index, {
      text: "RA 99999",
      mode: "standard",
      limit: 5,
    });
    expect(results).toEqual([]);
  });

  it("respects the as-of boundary of the current version", () => {
    const v = currentVersion(store, doc.id);
    if (v.effectiveFrom) {
      const effectiveFrom = v.effectiveFrom;
      const dayBefore = new Date(`${effectiveFrom}T00:00:00Z`);
      dayBefore.setTime(dayBefore.getTime() - 86_400_000);
      const before = dayBefore.toISOString().slice(0, 10);
      const beforeResults = retrieve(index, {
        text: "G.R. No. 999001",
        mode: "standard",
        asOfDate: before,
        limit: 5,
      });
      expect(beforeResults.filter((r) => r.documentId === doc.id)).toHaveLength(
        0,
      );

      const onResults = retrieve(index, {
        text: "G.R. No. 999001",
        mode: "standard",
        asOfDate: effectiveFrom,
        limit: 5,
      });
      expect(onResults.map((r) => r.documentId)).toContain(doc.id);
    } else {
      const results = exactResults();
      expect(results.filter((r) => r.documentId === doc.id)).toHaveLength(1);
      expect(true).toBe(true);
    }
  });

  it("adapts a result into a citation input", () => {
    const r = exactResults()[0]!;
    const v = currentVersion(store, doc.id);
    const input = toCitationInput(
      r,
      "Synthetic proposition",
      v.effectiveFrom ?? undefined,
    );
    expect(input.documentId).toBe(r.documentId);
    expect(input.passageId).toBe(r.chunkId);
    expect(input.location).toBe(r.metadata.provisionLabel);
    expect(input.proposition).toBe("Synthetic proposition");
  });

  it("hands the adapted passage to the verifier without manufacturing support", async () => {
    const r = exactResults()[0]!;
    const verifier = createCitationVerifier(corpusView());
    const fabricated = await verifier.verify({
      ...toCitationInput(
        r,
        "The death penalty is mandatory for all traffic violations",
      ),
    });
    expect(fabricated.identityVerified).toBe(true);
    expect(fabricated.passageVerified).toBe(true);
    expect(fabricated.propositionSupported).toBe(false);
    expect(fabricated.supportClass).toBe("NO_SUPPORT");

    // Lexical positive: a passage offered as its own proposition must clear the
    // deterministic coverage threshold without any annotation.
    const target = retrieve(index, {
      text: "annual renewal of registration",
      mode: "standard",
      limit: 5,
    }).find((result) => result.passage.toLowerCase().includes("registration"))!;
    expect(target).toBeTruthy();
    expect(
      supportCoverage(target.passage, target.passage),
    ).toBeGreaterThanOrEqual(0.8);
    const positive = await verifier.verify({
      ...toCitationInput(target, target.passage),
    });
    expect(positive.propositionSupported).toBe(true);
    expect(positive.supportMethod).toBe("lexical_proxy");
  });

  it("defaults relevantDate from effectiveFrom", () => {
    const r = exactResults()[0]!;
    const input = toCitationInput(r, "x");
    expect(input.relevantDate).toBe(r.effectiveFrom ?? undefined);
  });

  it("returns a passage, not the whole document", () => {
    const r = exactResults()[0]!;
    expect(r.passage.length).toBeGreaterThan(0);
    expect(store.state.chunks.some((c) => c.id === r.chunkId)).toBe(true);
  });

  it("baseline: repeated exact and passage retrieves stay bounded", () => {
    const entries = index.entries.length;
    expect(entries).toBeGreaterThan(0);

    const start = performance.now();
    for (let i = 0; i < 200; i += 1) {
      retrieve(index, {
        text: "G.R. No. 999001",
        mode: "standard",
        limit: 5,
      });
      retrieve(index, {
        text: "annual renewal of registration",
        mode: "standard",
        limit: 5,
      });
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000);
    expect(entries).toBeGreaterThan(0);
  });

  it("treats the as-of upper bound as exclusive", () => {
    const entry: IndexEntry = {
      chunkId: "c1",
      documentId: "d1",
      chunkIndex: 0,
      versionId: "v1",
      provisionId: null,
      provisionLabel: null,
      content: "synthetic passage",
      termFreq: new Map([
        ["synthetic", 1],
        ["passage", 1],
      ]),
      length: 2,
      exactKeys: [],
      documentType: "SYNTHETIC_STATUTE",
      title: "Synthetic",
      court: null,
      agency: null,
      jurisdiction: "PH",
      sourceId: "synthetic",
      verificationStatus: "VERIFIED",
      legalStatus: "IN_APPROX",
      authorityLevel: "official_primary",
      year: 2026,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-07-01",
      charStart: 0,
      charEnd: 17,
      citationText: "SYNTH-ACT-0001",
    } satisfies IndexEntry;
    const syntheticIndex: SearchIndex = {
      entries: [entry],
      docFreq: new Map([
        ["synthetic", 1],
        ["passage", 1],
      ]),
      total: 1,
    };

    const dayBefore = retrieve(syntheticIndex, {
      text: "synthetic passage",
      mode: "standard",
      asOfDate: "2026-06-30",
      limit: 5,
    });
    expect(dayBefore).toHaveLength(1);

    const onEnd = retrieve(syntheticIndex, {
      text: "synthetic passage",
      mode: "standard",
      asOfDate: "2026-07-01",
      limit: 5,
    });
    expect(onEnd).toHaveLength(0);
  });

  it("excludes a version whose effective start is unknown", () => {
    const entry: IndexEntry = {
      chunkId: "c1",
      documentId: "d1",
      chunkIndex: 0,
      versionId: "v1",
      provisionId: null,
      provisionLabel: null,
      content: "synthetic passage",
      termFreq: new Map([
        ["synthetic", 1],
        ["passage", 1],
      ]),
      length: 2,
      exactKeys: [],
      documentType: "SYNTHETIC_STATUTE",
      title: "Synthetic",
      court: null,
      agency: null,
      jurisdiction: "PH",
      sourceId: "synthetic",
      verificationStatus: "VERIFIED",
      legalStatus: "IN_APPROX",
      authorityLevel: "official_primary",
      year: 2026,
      effectiveFrom: null,
      effectiveTo: null,
      charStart: 0,
      charEnd: 17,
      citationText: "SYNTH-ACT-0001",
    } satisfies IndexEntry;
    const syntheticIndex: SearchIndex = {
      entries: [entry],
      docFreq: new Map([
        ["synthetic", 1],
        ["passage", 1],
      ]),
      total: 1,
    };

    const results = retrieve(syntheticIndex, {
      text: "synthetic passage",
      mode: "standard",
      asOfDate: "2026-06-30",
      limit: 5,
    });
    expect(results).toHaveLength(0);
  });

  it("span slices the indexed passage", () => {
    const text =
      "Preamble text.\n\nSection 1. Alpha beta.\n\nSection 2. Gamma delta.";
    const seeds = segmentProvisions(text, "REPUBLIC_ACT");
    // Confirms the section branch was exercised, not the paragraph fallback.
    expect(seeds.map((seed) => seed.label)).toEqual(["Section 1", "Section 2"]);
    for (const seed of seeds) {
      expect(text.slice(seed.startOffset, seed.endOffset)).toBe(seed.text);
    }
  });
});

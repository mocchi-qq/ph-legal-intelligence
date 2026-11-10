import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractPdfText,
  inspectPdf,
  pdfToolsAvailable,
} from "../../packages/document-parser/src/index";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
import { makeTestPdf } from "../helpers/pdf";
import { buildFixtureCorpus } from "./helpers";

const root = process.cwd();
const gate1Path = join(root, "docs/gates/gate-1/08_benchmark-results.json");
const GATE1_SHA256 =
  "7fca3b67a347f634f6b88d274804d5d17662d6ea837c425f5f55a83030bfb0a5";

describe("Gate 2 — benchmark separation and blockers", () => {
  it("has not altered the Gate 1 synthetic benchmark results", () => {
    const bytes = readFileSync(gate1Path);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).toBe(GATE1_SHA256);
    const gate1 = JSON.parse(bytes.toString("utf8"));
    expect(gate1.corpus.synthetic).toBe(true);
    expect(gate1.corpus.documents).toBe(8);
    expect(gate1.corpus.versions).toBe(9);
  });

  it("keeps exact identifiers exact-only on the synthetic regression corpus", () => {
    const store = buildFixtureCorpus();
    const index = buildSearchIndex(store.state);
    const missing = retrieve(index, {
      text: "G.R. No. 000000",
      mode: "standard",
      limit: 10,
    });
    expect(missing).toHaveLength(0);
    const found = retrieve(index, {
      text: "G.R. No. 999001",
      mode: "standard",
      limit: 10,
    });
    const firstDoc = store.state.documents.find(
      (d) => d.id === found[0]?.documentId,
    );
    expect(firstDoc?.identityKey).toBe("COURT_DECISION:G.R. No. 999001");
  });

  it("measures PDF extraction on a synthetic PDF and labels it synthetic", () => {
    const pdf = makeTestPdf([
      "Synthetic Instrument for parser testing only",
      "Section 1. A synthetic duty applies to covered entities.",
      "Section 2. A synthetic remedy is available.",
    ]);
    const tools = pdfToolsAvailable();
    const inspection = inspectPdf(pdf);
    const extraction = extractPdfText(pdf);

    const record = {
      synthetic: true,
      note: "Synthetic PDF, not a legal document.",
      tools,
      inspection: {
        status: inspection.status,
        pageCount: inspection.pageCount,
      },
      extraction: {
        status: extraction.status,
        method: extraction.method,
        characters: extraction.text.length,
        flags: extraction.flags,
      },
    };
    expect(record.synthetic).toBe(true);
    if (extraction.status !== "UNAVAILABLE") {
      expect(extraction.text).toContain("synthetic duty applies");
      expect(extraction.pageCount).toBe(1);
    }

    const realCorpus = {
      status: "BLOCKED",
      documents: 0,
      reason: "no source authorization and no Philippine counsel sign-off",
      authorized_sources: 0,
      metrics: null,
      note: "Not attempted. Public accessibility is not treated as permission.",
    };

    const results = {
      generated_at: "2026-11-10",
      synthetic_regression: {
        reference: "docs/gates/gate-1/08_benchmark-results.json",
        sha256: GATE1_SHA256,
        status: "PRESERVED",
        note: "Gate 1 results are unchanged and are not merged with real-corpus results.",
      },
      pdf_extraction: record,
      real_corpus: realCorpus,
      semantic_retrieval: {
        status: "NOT_IMPLEMENTED",
        note: "No embedding model has been selected, downloaded or evaluated.",
        metrics: null,
      },
      reranking: { status: "NOT_IMPLEMENTED", metrics: null },
      ocr: {
        status: "UNAVAILABLE",
        reason: "no OCR engine installed on this host (tesseract missing)",
        pages_processed: 0,
      },
    };

    writeFileSync(
      join(root, "docs/gates/gate-2/benchmark-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
    writeFileSync(
      join(root, "docs/gates/gate-2/REAL_CORPUS_MANIFEST.json"),
      `${JSON.stringify(
        {
          generated_at: "2026-11-10",
          status: "BLOCKED",
          reason:
            "No source is authorized and no Philippine counsel sign-off exists. No real legal document was acquired.",
          authorized_source_count: 0,
          documents: [],
          acquisition_attempts: 0,
        },
        null,
        2,
      )}\n`,
    );

    expect(realCorpus.documents).toBe(0);
  });
});

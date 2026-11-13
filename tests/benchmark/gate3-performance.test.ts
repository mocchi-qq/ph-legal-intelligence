import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
import { buildPilotCorpus, pilotAvailable } from "./pilot-corpus";

const allowSyntheticIndex = () => ({
  allowed: true,
  reason: "synthetic_pilot_fixture",
});

const PILOT_FILES = [
  "ra12232.html",
  "ra10931.html",
  "ra12326.html",
  "ra12325.html",
];

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

describe.skipIf(!pilotAvailable())(
  "Gate 3 — performance and resources (4-document pilot)",
  () => {
    it("measures ingestion, indexing, query latency, storage and memory", () => {
      const before = process.memoryUsage();
      const t0 = performance.now();
      const store = buildPilotCorpus();
      const ingestMs = performance.now() - t0;

      const t1 = performance.now();
      const index = buildSearchIndex(store.state, {
        authorize: allowSyntheticIndex,
      });
      const indexMs = performance.now() - t1;

      const gold = JSON.parse(
        readFileSync(
          join(process.cwd(), "docs/gates/gate-3/retrieval-gold-set.json"),
          "utf8",
        ),
      ) as { queries: Array<{ text: string }> };

      const latencies: number[] = [];
      for (let round = 0; round < 20; round++) {
        for (const query of gold.queries) {
          const start = performance.now();
          retrieve(index, { text: query.text, mode: "standard", limit: 10 });
          latencies.push(performance.now() - start);
        }
      }

      const after = process.memoryUsage();
      const pilotBytes = PILOT_FILES.reduce(
        (sum, file) =>
          sum + statSync(join(process.cwd(), "legal-data/pilot", file)).size,
        0,
      );

      const results = {
        generated_at: "2026-11-10",
        dataset: "owner-authorized pilot, 4 official RA pages",
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          available_memory_mb: 2329,
          gpu: false,
          ocr_engine: "absent",
        },
        corpus: {
          documents: store.state.documents.length,
          versions: store.state.versions.length,
          provisions: store.state.provisions.length,
          chunks: store.state.chunks.length,
          source_bytes: pilotBytes,
        },
        timings_ms: {
          ingest_4_documents: Number(ingestMs.toFixed(2)),
          index_build: Number(indexMs.toFixed(2)),
          query_p50: Number(percentile(latencies, 50).toFixed(3)),
          query_p95: Number(percentile(latencies, 95).toFixed(3)),
          query_p99: Number(percentile(latencies, 99).toFixed(3)),
          queries_measured: latencies.length,
        },
        memory_mb: {
          rss_before: Number((before.rss / 1_048_576).toFixed(1)),
          rss_after: Number((after.rss / 1_048_576).toFixed(1)),
          rss_delta: Number(((after.rss - before.rss) / 1_048_576).toFixed(1)),
          heap_used_after: Number((after.heapUsed / 1_048_576).toFixed(1)),
        },
        not_measured: [
          "OCR time (no engine)",
          "PDF extraction at scale (only a synthetic one-page PDF was timed separately)",
          "Concurrent users and network acquisition throughput",
          "Embedding generation (not implemented)",
        ],
        limitations: [
          "Four documents; timings are indicative, not production capacity.",
          "Single warm process; no cold-start measurement.",
          "Host is an ARM/PRoot environment with ~2.3 GB available memory.",
        ],
      };
      // Timings are machine- and load-dependent; keep the recorded run stable.
      if (process.env.PH_WRITE_GATE3_EVIDENCE === "1") {
        writeFileSync(
          join(process.cwd(), "docs/gates/gate-3/performance-results.json"),
          `${JSON.stringify(results, null, 2)}\n`,
        );
      }

      expect(store.state.documents.length).toBe(4);
      expect(indexMs).toBeLessThan(5000);
      expect(percentile(latencies, 95)).toBeLessThan(100);
      expect(results.memory_mb.rss_delta).toBeLessThan(300);
    });
  },
);

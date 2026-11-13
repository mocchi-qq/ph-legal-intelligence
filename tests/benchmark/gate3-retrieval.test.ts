import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

interface GoldQuery {
  id: string;
  category: string;
  text: string;
  expected: string[];
  note?: string;
}

describe.skipIf(!pilotAvailable())(
  "Gate 3 — real-corpus retrieval evaluation (owner pilot)",
  () => {
    it("evaluates the pre-declared gold set and writes measured results", () => {
      const store = buildPilotCorpus();
      const index = buildSearchIndex(store.state, {
        authorize: allowSyntheticIndex,
      });
      const gold = JSON.parse(
        readFileSync(
          join(process.cwd(), "docs/gates/gate-3/retrieval-gold-set.json"),
          "utf8",
        ),
      ) as {
        queries: GoldQuery[];
        thresholds_declared_before_run: Record<string, unknown>;
      };

      const keyOf = (documentId: string) =>
        store.state.documents.find((d) => d.id === documentId)?.identityKey ??
        "unknown";

      const detail = gold.queries.map((query) => {
        const results = retrieve(index, {
          text: query.text,
          mode: "standard",
          limit: 10,
        });
        const keys = results.map((result) => keyOf(result.documentId));
        const unique = [...new Set(keys)];
        const rank = query.expected.length
          ? Math.min(
              ...query.expected.map((key) =>
                keys.indexOf(key) >= 0
                  ? keys.indexOf(key) + 1
                  : Number.POSITIVE_INFINITY,
              ),
            )
          : Number.POSITIVE_INFINITY;
        const top1 = unique[0] ?? null;
        const top5 = unique.slice(0, 5);
        const top10 = unique;
        const relevantTop5 = top5.filter((key) =>
          query.expected.includes(key),
        ).length;
        return {
          id: query.id,
          category: query.category,
          expected: query.expected,
          returned: unique,
          top_score: results[0]?.score ?? 0,
          lexical_score: results[0]?.scores?.lexical ?? 0,
          top1,
          hit_at_1:
            query.expected.length > 0 &&
            query.expected.every((key) => top1 === key),
          hit_at_5: query.expected.every((key) => top5.includes(key)),
          hit_at_10: query.expected.every((key) => top10.includes(key)),
          mrr: Number.isFinite(rank) ? 1 / rank : 0,
          precision_at_5: top5.length > 0 ? relevantTop5 / top5.length : 0,
          empty_correct: query.expected.length === 0 && results.length === 0,
          note: query.note,
        };
      });

      const positives = detail.filter((row) => row.expected.length > 0);
      const negatives = detail.filter((row) => row.expected.length === 0);
      const exactCategories = new Set([
        "exact",
        "exact_alias",
        "negative_exact",
        "negative_transposed",
      ]);
      const exactRows = detail.filter((row) =>
        exactCategories.has(row.category),
      );
      const exactCorrect = exactRows.filter((row) =>
        row.expected.length ? row.hit_at_1 : row.empty_correct,
      ).length;

      const metrics = {
        documents: store.state.documents.length,
        provisions: store.state.provisions.length,
        queries: detail.length,
        exact: {
          correct: exactCorrect,
          total: exactRows.length,
          accuracy: exactCorrect / exactRows.length,
        },
        positive: {
          count: positives.length,
          recall_at_1:
            positives.filter((row) => row.hit_at_1).length / positives.length,
          recall_at_5:
            positives.filter((row) => row.hit_at_5).length / positives.length,
          recall_at_10:
            positives.filter((row) => row.hit_at_10).length / positives.length,
          mrr:
            positives.reduce((sum, row) => sum + row.mrr, 0) / positives.length,
          precision_at_5:
            positives.reduce((sum, row) => sum + row.precision_at_5, 0) /
            positives.length,
        },
        negative: {
          count: negatives.length,
          empty_correct: negatives.filter((row) => row.empty_correct).length,
          accuracy:
            negatives.filter((row) => row.empty_correct).length /
            negatives.length,
        },
        multilingual_gap: {
          query: "Q-FIL-01",
          returned_results:
            detail.find((row) => row.id === "Q-FIL-01")?.returned.length ??
            null,
          supported: false,
          note: "English-only lexical retrieval. Empty result is expected and is not multilingual support.",
        },
      };

      const results = {
        generated_at: "2026-11-10",
        dataset: "owner-authorized pilot (4 official RA pages)",
        authorization_basis: "owner_authorization",
        counsel_signoff: false,
        thresholds: gold.thresholds_declared_before_run,
        metrics,
        detail,
        limitations: [
          "Four documents only; metrics are integration checks, not general retrieval accuracy.",
          "No semantic retrieval, no reranking.",
          "No confidence intervals; sample too small.",
          "Filipino queries are unsupported and return empty.",
        ],
      };
      // Committed evidence is stable; regenerate explicitly when the evaluation changes.
      if (process.env.PH_WRITE_GATE3_EVIDENCE === "1") {
        writeFileSync(
          join(process.cwd(), "docs/gates/gate-3/retrieval-results.json"),
          `${JSON.stringify(results, null, 2)}\n`,
        );
      }

      expect(metrics.exact.accuracy).toBe(1);
      expect(metrics.positive.recall_at_5).toBeGreaterThanOrEqual(0.8);
      expect(metrics.negative.accuracy).toBe(1);
      expect(metrics.multilingual_gap.supported).toBe(false);
    });
  },
);

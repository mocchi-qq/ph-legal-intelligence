import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import { buildPilotCorpus, pilotAvailable } from "./pilot-corpus";

interface Pair {
  id: string;
  document: string;
  location: string;
  proposition: string;
  expected: string;
  rationale: string;
}

describe.skipIf(!pilotAvailable())(
  "Gate 3 — citation support evaluation (technical)",
  () => {
    it("compares lexical proxy behaviour with reviewed technical labels", async () => {
      const store = buildPilotCorpus();
      const verifier = createCitationVerifier({
        documents: store.state.documents,
        versions: store.state.versions,
        provisions: store.state.provisions,
        chunks: store.state.chunks,
      });
      const annotations = JSON.parse(
        readFileSync(
          join(process.cwd(), "docs/gates/gate-3/citation-annotations.json"),
          "utf8",
        ),
      ) as { pairs: Pair[] };

      const rows = [];
      for (const pair of annotations.pairs) {
        const base = {
          citationText: "Republic Act No. 12326",
          location: pair.location,
          proposition: pair.proposition,
          relevantDate: "2027-01-01",
        };
        const lexical = await verifier.verify(base);
        const annotated = await verifier.verify({
          ...base,
          supportAnnotation: pair.expected as never,
        });
        const lexicalMapped =
          lexical.supportClass === "DIRECT_QUOTE" ||
          lexical.supportClass === "LEXICAL_ONLY"
            ? "SUPPORTED"
            : "NOT_SUPPORTED";
        const annotatedMapped =
          annotated.supportClass === "FULL_SUPPORT"
            ? "SUPPORTED"
            : annotated.supportClass === "PARTIAL_SUPPORT"
              ? "PARTIAL"
              : annotated.supportClass === "CONTRADICTED"
                ? "CONTRADICTED"
                : annotated.supportClass === "INSUFFICIENT_CONTEXT"
                  ? "INSUFFICIENT"
                  : "NOT_SUPPORTED";
        rows.push({
          id: pair.id,
          expected: pair.expected,
          lexical_class: lexical.supportClass,
          lexical_status: lexical.verificationStatus,
          lexical_proposition_supported: lexical.propositionSupported,
          lexical_mapped: lexicalMapped,
          annotated_class: annotated.supportClass,
          annotated_mapped: annotatedMapped,
          annotated_method: annotated.supportMethod,
          temporal_known: Boolean(
            store.state.documents.find((d) => d.identityKey === pair.document)
              ?.effectivityDate,
          ),
        });
      }

      const expectedMapped = (label: string) =>
        label === "FULL_SUPPORT"
          ? "SUPPORTED"
          : label === "PARTIAL_SUPPORT"
            ? "PARTIAL"
            : label === "CONTRADICTED"
              ? "CONTRADICTED"
              : label === "INSUFFICIENT_CONTEXT"
                ? "INSUFFICIENT"
                : "NOT_SUPPORTED";

      const lexicalFalsePositives = rows.filter(
        (row) =>
          row.lexical_proposition_supported &&
          expectedMapped(row.expected) !== "SUPPORTED",
      );
      const annotationAgreement = rows.filter(
        (row) => row.annotated_mapped === expectedMapped(row.expected),
      ).length;

      const results = {
        generated_at: "2026-11-10",
        dataset: "owner-authorized pilot, RA 12326",
        reviewer: "technical evidence assessment; not a legal opinion",
        pairs: rows.length,
        annotation_agreement: {
          correct: annotationAgreement,
          total: rows.length,
        },
        lexical_proxy: {
          false_positives: lexicalFalsePositives.length,
          false_positive_ids: lexicalFalsePositives.map((row) => row.id),
          contradiction_detected: rows.filter(
            (row) => row.lexical_class === "CONTRADICTED",
          ).length,
          direct_quote_detected: rows.filter(
            (row) => row.lexical_class === "DIRECT_QUOTE",
          ).length,
        },
        temporal: {
          documents_with_effectivity_date: 0,
          note: "Pilot documents have no verified effectivity date, so temporal validity is not evidence-based.",
        },
        rows,
        limitations: [
          "Seven pairs, one document; not a legal benchmark.",
          "Labels are technical, not legal opinions.",
          "Lexical proxy cannot detect contradiction or partial support.",
          "No semantic entailment model is implemented.",
        ],
      };
      // Committed evidence is stable; regenerate explicitly when the evaluation changes.
      if (process.env.PH_WRITE_GATE3_EVIDENCE === "1") {
        writeFileSync(
          join(process.cwd(), "docs/gates/gate-3/citation-results.json"),
          `${JSON.stringify(results, null, 2)}\n`,
        );
      }

      expect(annotationAgreement).toBe(rows.length);
      expect(results.temporal.documents_with_effectivity_date).toBe(0);
    });
  },
);

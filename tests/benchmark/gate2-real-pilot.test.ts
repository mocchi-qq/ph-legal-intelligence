import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  buildAcquisitionRecord,
  CorpusStore,
  extractText,
  fetchLegalDocument,
  ingestArtifact,
  parseLegalIdentifier,
} from "../../packages/legal-ingestion/src/index";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";

const LIVE = process.env.PH_LIVE_PILOT === "1";
const root = process.cwd();
const OPTS = {
  pipelineVersion: "gate2-pilot.1",
  extractorVersion: "extract.2",
  normalizerVersion: "norm.2",
  allowLegacySourceGate: true,
  ownerAuthorization: {
    reference: "docs/gates/gate-2/01A_OWNER_AUTHORIZATION.md",
    scope: "four Republic Act pages, internal evaluation only",
    authorizedBy: "project owner",
    date: "2026-11-10",
  },
};

const DOCS = [
  {
    id: "ra12232",
    number: "12232",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/99551",
  },
  {
    id: "ra10931",
    number: "10931",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/78458",
  },
  {
    id: "ra12326",
    number: "12326",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/103013",
  },
  {
    id: "ra12325",
    number: "12325",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/102493",
  },
];

describe.skipIf(!LIVE)(
  "Gate 2 — live owner-authorized pilot (4 official RA pages)",
  () => {
    it("acquires, preserves, parses and evaluates four official documents", async () => {
      const store = CorpusStore.memory();
      const pilotDir = join(root, "legal-data/pilot");
      mkdirSync(pilotDir, { recursive: true });
      const manifest: unknown[] = [];
      const fullText = new Map<string, string>();

      for (const [index, doc] of DOCS.entries()) {
        if (index > 0)
          await new Promise((resolve) => setTimeout(resolve, 1500));
        const fetched = await fetchLegalDocument(doc.url);
        expect(fetched.status, `${doc.id}: ${fetched.reason ?? ""}`).toBe("OK");
        const bytes = fetched.bytes!;
        writeFileSync(join(pilotDir, `${doc.id}.html`), bytes);

        const acquisition = buildAcquisitionRecord({
          artifactId: doc.id,
          sourceId: "sc_elibrary",
          sourceUrl: doc.url,
          officialTitle: `Republic Act No. ${doc.number}`,
          legalIdentifier: `Republic Act No. ${doc.number}`,
          documentType: "REPUBLIC_ACT",
          retrievedAt: "2026-11-10T00:00:00Z",
          originalFilename: `${doc.id}.html`,
          mimeType: fetched.contentType ?? "text/html",
          bytes,
          acquisitionMethod: "owner_authorized_bounded_pilot",
          authorization: { sourceId: "sc_elibrary", state: "UNKNOWN" },
          synthetic: false,
        });
        expect(acquisition.ok, acquisition.ok ? "" : acquisition.reason).toBe(
          false,
        );

        const html = new TextDecoder().decode(bytes);
        const extracted = extractText(html, fetched.contentType ?? "text/html");
        expect(extracted.normalizedText.length).toBeGreaterThan(2000);
        fullText.set(`REPUBLIC_ACT:${doc.number}`, extracted.normalizedText);
        const parsed = parseLegalIdentifier(
          extracted.normalizedText.slice(0, 4000),
        );
        expect(parsed?.number).toBe(doc.number);

        const ingested = ingestArtifact(
          store,
          {
            artifactId: doc.id,
            sourceId: "sc_elibrary",
            sourceUrl: doc.url,
            mimeType: fetched.contentType ?? "text/html",
            retrievedAt: "2026-11-10T00:00:00Z",
            synthetic: false,
            content: bytes,
            documentType: "REPUBLIC_ACT",
            identityKey: `REPUBLIC_ACT:${doc.number}`,
            title: `Republic Act No. ${doc.number}`,
            officialNumber: `Republic Act No. ${doc.number}`,
            issuingBody: "Congress of the Philippines",
            jurisdiction: "PH",
            legalStatus: "UNKNOWN",
            authorityLevel: "official_primary",
          },
          OPTS,
        );
        expect(ingested.status, ingested.reason ?? "").toBe("SUCCEEDED");

        manifest.push({
          internal_document_id: doc.id,
          identity_key: `REPUBLIC_ACT:${doc.number}`,
          source_id: "sc_elibrary",
          source_url: fetched.finalUrl,
          http_status: fetched.httpStatus,
          content_type: fetched.contentType,
          bytes: bytes.length,
          sha256: fetched.sha256,
          redirects: fetched.redirects,
          extracted_characters: extracted.normalizedText.length,
          extraction_flags: extracted.warnings,
          parsed_identifier: parsed?.normalized,
          authorization_basis: "owner_authorization",
          authorization_reference: OPTS.ownerAuthorization.reference,
          source_status: "UNKNOWN",
          note: "Original stored under git-ignored legal-data/pilot/. Not redistributed.",
        });
      }

      const relationships: unknown[] = [];
      for (const [amending, target] of [
        ["REPUBLIC_ACT:12326", "REPUBLIC_ACT:12232"],
        ["REPUBLIC_ACT:12325", "REPUBLIC_ACT:10931"],
      ] as const) {
        const amendingDoc = store.state.documents.find(
          (d) => d.identityKey === amending,
        )!;
        void amendingDoc;
        const text = fullText.get(amending) ?? "";
        const number = target.split(":")[1]!;
        const match = text.match(
          new RegExp(
            `(?:SECTION|SEC\\.)\\s*\\d+\\.?[\\s\\S]{0,80}${number}[\\s\\S]{0,320}?amended`,
            "i",
          ),
        );
        const evidence = match?.[0]?.trim();
        const result = ingestArtifact(
          store,
          {
            artifactId: `${amending}-rel`,
            sourceId: "sc_elibrary",
            sourceUrl: `synthetic://pilot-rel/${amending}`,
            mimeType: "text/plain",
            retrievedAt: "2026-11-10T00:00:00Z",
            synthetic: true,
            content: `Synthetic relationship carrier for ${amending}. ${evidence ?? "no evidence found"}`,
            documentType: "LEGAL_REFERENCE",
            identityKey: `PILOT_REL:${amending}`,
            title: `Pilot relationship carrier ${amending}`,
            relationships: evidence
              ? [
                  {
                    toIdentityKey: target,
                    type: "PARTIALLY_AMENDS",
                    evidencePassage: evidence,
                  },
                ]
              : [],
          },
          OPTS,
        );
        expect(result.status).toBe("SUCCEEDED");
        relationships.push({
          from: amending,
          to: target,
          evidence: evidence ?? null,
          applied: Boolean(evidence),
        });
      }

      const index = buildSearchIndex(store.state);
      const docKey = (documentId: string) =>
        store.state.documents.find((d) => d.id === documentId)?.identityKey ??
        "unknown";
      const exact = retrieve(index, {
        text: "Republic Act No. 12326",
        mode: "standard",
        limit: 5,
      });
      const missing = retrieve(index, {
        text: "Republic Act No. 99999",
        mode: "standard",
        limit: 5,
      });
      const natural = retrieve(index, {
        text: "term of office of barangay officials five years",
        mode: "standard",
        limit: 5,
      });
      expect(docKey(exact[0]!.documentId)).toBe("REPUBLIC_ACT:12326");
      expect(missing).toHaveLength(0);
      expect(natural.length).toBeGreaterThan(0);

      const ra12326 = store.state.documents.find(
        (d) => d.identityKey === "REPUBLIC_ACT:12326",
      )!;
      const provision =
        store.state.provisions.find(
          (p) => p.documentId === ra12326.id && /term of office/i.test(p.text),
        ) ?? store.state.provisions.find((p) => p.documentId === ra12326.id);
      expect(provision).toBeTruthy();
      const verifier = createCitationVerifier({
        documents: store.state.documents,
        versions: store.state.versions,
        provisions: store.state.provisions,
        chunks: store.state.chunks,
      });
      const citation = await verifier.verify({
        citationText: "Republic Act No. 12326",
        location: provision!.label,
        proposition: provision!.text.split(/(?<=[.])\s/)[0]!.slice(0, 300),
        relevantDate: "2027-01-01",
      });

      const results = {
        generated_at: "2026-11-10",
        authorization: {
          basis: "owner_authorization",
          reference: OPTS.ownerAuthorization.reference,
          counsel_signoff: false,
          source_status: "UNKNOWN",
        },
        documents: manifest,
        relationships,
        retrieval: {
          exact_identifier: { passed: 1, total: 1 },
          nonexistent_identifier_empty: missing.length === 0,
          natural_language_returned: natural.length,
        },
        citation: {
          status: citation.verificationStatus,
          identity: citation.identityVerified,
          location: citation.passageVerified,
          support: citation.propositionSupported,
          temporal: citation.temporalValidity,
          support_class: citation.supportClass,
          support_method: citation.supportMethod,
        },
        corpus: {
          real_documents: 4,
          synthetic_relationship_carriers: 2,
          total_records: store.state.documents.length,
          versions: store.state.versions.length,
          provisions: store.state.provisions.length,
          chunks: store.state.chunks.length,
          ingestion_runs: store.state.runs.length,
        },
        limitations: [
          "Four documents only; not a corpus benchmark.",
          "Source reuse status remains UNKNOWN; owner risk acceptance only.",
          "No OCR; HTML pages, not scanned PDFs.",
          "No semantic retrieval or reranking.",
        ],
      };
      writeFileSync(
        join(root, "docs/gates/gate-2/PILOT_RESULTS.json"),
        `${JSON.stringify(results, null, 2)}\n`,
      );
      writeFileSync(
        join(root, "docs/gates/gate-2/PILOT_MANIFEST.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );

      expect(citation.identityVerified).toBe(true);
      expect(citation.passageVerified).toBe(true);
    }, 120_000);
  },
);

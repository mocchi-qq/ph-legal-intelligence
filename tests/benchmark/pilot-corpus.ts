import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CorpusStore,
  extractText,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";

const PILOT = [
  {
    id: "ra12232",
    number: "12232",
    file: "legal-data/pilot/ra12232.html",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/99551",
  },
  {
    id: "ra10931",
    number: "10931",
    file: "legal-data/pilot/ra10931.html",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/78458",
  },
  {
    id: "ra12326",
    number: "12326",
    file: "legal-data/pilot/ra12326.html",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/103013",
  },
  {
    id: "ra12325",
    number: "12325",
    file: "legal-data/pilot/ra12325.html",
    url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/102493",
  },
];

export function pilotAvailable(): boolean {
  return PILOT.every((doc) => existsSync(join(process.cwd(), doc.file)));
}

/** Build a corpus from the owner-authorized local pilot snapshots. */
export function buildPilotCorpus(): CorpusStore {
  const store = CorpusStore.memory();
  for (const doc of PILOT) {
    const html = readFileSync(join(process.cwd(), doc.file), "utf8");
    const extracted = extractText(html, "text/html");
    const result = ingestArtifact(
      store,
      {
        artifactId: doc.id,
        sourceId: "sc_elibrary",
        sourceUrl: doc.url,
        mimeType: "text/html",
        retrievedAt: "2026-11-10T00:00:00Z",
        synthetic: false,
        content: html,
        documentType: "REPUBLIC_ACT",
        identityKey: `REPUBLIC_ACT:${doc.number}`,
        title: `Republic Act No. ${doc.number}`,
        officialNumber: `Republic Act No. ${doc.number}`,
        issuingBody: "Congress of the Philippines",
        jurisdiction: "PH",
        legalStatus: "UNKNOWN",
        authorityLevel: "official_primary",
      },
      {
        pipelineVersion: "gate3.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
        ownerAuthorization: {
          reference: "docs/gates/gate-2/01A_OWNER_AUTHORIZATION.md",
          scope: "four Republic Act pages, internal evaluation only",
          authorizedBy: "project owner",
          date: "2026-11-10",
        },
      },
    );
    if (result.status !== "SUCCEEDED") {
      throw new Error(
        `pilot ingest failed for ${doc.id}: ${result.status} ${result.reason ?? ""}`,
      );
    }
    void extracted;
  }
  return store;
}

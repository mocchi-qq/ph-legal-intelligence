import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ArtifactInput,
  CorpusStore,
  type DocumentActivityAuthorization,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";

const OPTS = {
  pipelineVersion: "gate1.0.0",
  extractorVersion: "extract.1",
  normalizerVersion: "norm.1",
  now: () => "2026-11-10T00:00:00Z",
};

export interface FixtureManifest {
  synthetic: true;
  fixtures: ArtifactInput[];
}

/**
 * Test-only fixture: reports `AUTHORIZED` for every request without consulting
 * a registry, so a benchmark can never fail on authorization. Behaviour under a
 * real registry adapter — denials, activity mismatches and the per-document
 * record of what was refused — is exercised in
 * `tests/retrieval/gate14-index-authorization.test.ts`.
 */
export const allowSyntheticIndex: DocumentActivityAuthorization = ({
  documentId,
  activity,
  role,
}) => ({
  documentId,
  activity,
  role,
  decision: "AUTHORIZED",
  sourceId: null,
  status: null,
  reason: "synthetic_test_fixture",
  decisionRef: null,
});

export function loadFixtures(): FixtureManifest {
  const path = join(
    process.cwd(),
    "legal-data/benchmark/synthetic-fixtures/manifest.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as FixtureManifest;
}

/** Ingest the synthetic fixtures in manifest order. */
export function buildFixtureCorpus(): CorpusStore {
  const store = CorpusStore.memory();
  for (const fixture of loadFixtures().fixtures) {
    ingestArtifact(store, fixture, OPTS);
  }
  return store;
}

export function docByKey(store: CorpusStore, identityKey: string) {
  const doc = store.state.documents.find((d) => d.identityKey === identityKey);
  if (!doc) throw new Error(`fixture document not found: ${identityKey}`);
  return doc;
}

export function currentVersion(store: CorpusStore, documentId: string) {
  const version = store.state.versions.find(
    (v) => v.documentId === documentId && v.isCurrent,
  );
  if (!version) throw new Error(`no current version for ${documentId}`);
  return version;
}

export function provision(
  store: CorpusStore,
  documentId: string,
  label: string,
  versionId?: string,
) {
  const version = versionId ?? currentVersion(store, documentId).id;
  const found = store.state.provisions.find(
    (p) =>
      p.documentId === documentId &&
      p.versionId === version &&
      p.label === label,
  );
  if (!found) throw new Error(`provision ${label} not found in ${documentId}`);
  return found;
}

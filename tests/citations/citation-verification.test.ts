import { describe, expect, it } from "vitest";
import type { CitationInput } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  buildFixtureCorpus,
  currentVersion,
  docByKey,
  provision,
} from "../benchmark/helpers";

const store = buildFixtureCorpus();
const verifier = createCitationVerifier({
  documents: store.state.documents,
  versions: store.state.versions,
  provisions: store.state.provisions,
  chunks: store.state.chunks,
});

const RA1001 = docByKey(store, "REPUBLIC_ACT:1001");
const V2 = currentVersion(store, RA1001.id);

function cite(overrides: Partial<CitationInput>): CitationInput {
  return {
    citationText: "Synthetic Republic Act No. 1001",
    proposition:
      "A covered entity must register with the synthetic authority and renew its registration every year.",
    location: "Section 2",
    relevantDate: "2021-01-01",
    ...overrides,
  };
}

describe("Gate 1 — citation verification", () => {
  it("verifies identity, location, support and temporal status separately", async () => {
    const result = await verifier.verify(cite({}));
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(true);
    expect(result.propositionSupported).toBe(true);
    expect(result.temporalValidity).toBe(true);
    expect(result.verificationStatus).toBe("VERIFIED");
    expect(result.states).toContain("VERIFIED_IDENTITY");
    expect(result.states).toContain("VERIFIED_LOCATION");
    expect(result.states).toContain("VERIFIED_SUPPORT");
    expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("fails identity for a nonexistent docket number", async () => {
    const result = await verifier.verify(
      cite({ citationText: "G.R. No. 000000" }),
    );
    expect(result.identityVerified).toBe(false);
    expect(result.verificationStatus).toBe("FAILED");
    expect(result.states).toContain("INVALID");
  });

  it("fails location for a section that does not exist", async () => {
    const result = await verifier.verify(cite({ location: "Section 99" }));
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(false);
    expect(result.verificationStatus).toBe("PARTIALLY_VERIFIED");
  });

  it("fails support when the passage discusses a different obligation", async () => {
    const result = await verifier.verify(
      cite({
        location: "Section 1",
        proposition:
          "A covered entity must pay a synthetic administrative penalty.",
      }),
    );
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(true);
    expect(result.propositionSupported).toBe(false);
    expect(result.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(result.layerResults.SUPPORT.notes).toContain(
      "not semantic entailment",
    );
  });

  it("fails support when an old proposition is cited against amended text", async () => {
    const result = await verifier.verify(
      cite({
        proposition:
          "A covered entity must register before it begins operations.",
        relevantDate: "2021-01-01",
      }),
    );
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(true);
    expect(result.propositionSupported).toBe(false);
  });

  it("fails temporal validity for a provision repealed before the relevant date", async () => {
    const result = await verifier.verify(
      cite({
        location: "Section 4",
        proposition:
          "A violation of Section 2 is subject to a synthetic administrative penalty.",
        relevantDate: "2022-01-01",
      }),
    );
    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.verificationStatus).toBe("PARTIALLY_VERIFIED");
  });

  it("passes temporal validity before the repeal took effect", async () => {
    const result = await verifier.verify(
      cite({
        location: "Section 4",
        proposition:
          "A violation of Section 2 is subject to a synthetic administrative penalty.",
        relevantDate: "2020-06-01",
      }),
    );
    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
  });

  it("fails temporal validity when no relevant date is supplied", async () => {
    const result = await verifier.verify(cite({ relevantDate: undefined }));
    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.verificationStatus).toBe("PARTIALLY_VERIFIED");
  });

  it("finds the provision on the version in force at the relevant date", async () => {
    const v1 = store.state.versions.find(
      (v) => v.documentId === RA1001.id && v.versionNumber === 1,
    )!;
    const oldSection2 = provision(store, RA1001.id, "Section 2", v1.id);
    const result = await verifier.verify(
      cite({
        passageId: store.state.chunks.find(
          (c) => c.provisionId === oldSection2.id,
        )?.id,
        relevantDate: "2019-06-01",
      }),
    );
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(true);
    // The 2019 text required registration before operations, so it supports that proposition.
    expect(result.propositionSupported).toBe(false); // proposition asserted is the 2021 text
  });

  it("marks an unverified relationship's legal status as not established", () => {
    // Section 3 was never amended or repealed.
    expect(provision(store, RA1001.id, "Section 3", V2.id).legalStatus).toBe(
      "IN_FORCE",
    );
  });
});

import { describe, expect, it } from "vitest";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";

const corpus = {
  documents: [
    {
      id: "doc-1",
      title: "Synthetic Instrument No. 1",
      citationText: "Synthetic Instrument No. 1",
      legalStatus: "IN_FORCE",
      effectivityDate: "2020-01-01",
    },
  ],
  versions: [
    {
      id: "v1",
      documentId: "doc-1",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      isCurrent: true,
    },
  ],
  provisions: [
    {
      id: "p1",
      documentId: "doc-1",
      versionId: "v1",
      label: "Section 1",
      text: "A covered entity must register with the synthetic authority before it begins operations.",
      legalStatus: "IN_FORCE",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
    },
  ],
  chunks: [],
};

const verifier = createCitationVerifier(corpus);
const base = {
  citationText: "Synthetic Instrument No. 1",
  location: "Section 1",
  relevantDate: "2024-01-01",
};

describe("Gate 2 — citation support classes", () => {
  it("classifies a verbatim quotation as DIRECT_QUOTE", async () => {
    const result = await verifier.verify({
      ...base,
      proposition:
        "A covered entity must register with the synthetic authority before it begins operations.",
    });
    expect(result.supportClass).toBe("DIRECT_QUOTE");
    expect(result.propositionSupported).toBe(true);
    expect(result.supportMethod).toBe("lexical_proxy");
  });

  it("classifies high lexical overlap that is not a quotation as LEXICAL_ONLY", async () => {
    const result = await verifier.verify({
      ...base,
      proposition:
        "Registration with the synthetic authority is required before a covered entity begins operations.",
    });
    expect(["LEXICAL_ONLY", "NO_SUPPORT"]).toContain(result.supportClass);
    expect(result.supportMethod).toBe("lexical_proxy");
  });

  it("classifies an unsupported proposition as NO_SUPPORT", async () => {
    const result = await verifier.verify({
      ...base,
      proposition:
        "A covered entity must pay a quarterly dividend to shareholders.",
    });
    expect(result.supportClass).toBe("NO_SUPPORT");
    expect(result.propositionSupported).toBe(false);
  });

  it("classifies missing passage context as INSUFFICIENT_CONTEXT", async () => {
    const result = await verifier.verify({
      ...base,
      location: "Section 99",
      proposition: "A covered entity must register.",
    });
    expect(result.supportClass).toBe("INSUFFICIENT_CONTEXT");
    expect(result.propositionSupported).toBe(false);
  });

  it("uses a reviewed FULL_SUPPORT label without pretending it is lexical", async () => {
    const result = await verifier.verify({
      ...base,
      proposition: "Registration is mandatory before operations.",
      supportAnnotation: "FULL_SUPPORT",
    });
    expect(result.supportClass).toBe("FULL_SUPPORT");
    expect(result.propositionSupported).toBe(true);
    expect(result.supportMethod).toBe("technical_annotation");
    expect(result.layerResults.SUPPORT.notes).toContain("not legal validation");
  });

  it("carries a reviewed CONTRADICTED label and fails support", async () => {
    const result = await verifier.verify({
      ...base,
      proposition: "A covered entity need not register.",
      supportAnnotation: "CONTRADICTED",
    });
    expect(result.supportClass).toBe("CONTRADICTED");
    expect(result.propositionSupported).toBe(false);
    expect(result.supportMethod).toBe("technical_annotation");
  });

  it("does not upgrade PARTIAL_SUPPORT to supported", async () => {
    const result = await verifier.verify({
      ...base,
      proposition: "Registration is optional.",
      supportAnnotation: "PARTIAL_SUPPORT",
    });
    expect(result.supportClass).toBe("PARTIAL_SUPPORT");
    expect(result.propositionSupported).toBe(false);
  });
});

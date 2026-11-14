import { describe, expect, it } from "vitest";
import type {
  CitationCorpusView,
  CitationInput,
  CorpusVersionView,
} from "../../packages/citation-engine/src/index";
import {
  createCitationVerifier,
  normalizeProvisionLabel,
} from "../../packages/citation-engine/src/index";

const PROPOSITION =
  "A covered entity must register with the synthetic authority.";

function version(overrides: Partial<CorpusVersionView>): CorpusVersionView {
  return {
    id: "v1",
    documentId: "doc-1",
    effectiveFrom: "2019-01-01",
    effectiveTo: null,
    isCurrent: true,
    ...overrides,
  };
}

function cite(overrides: Partial<CitationInput>): CitationInput {
  return {
    citationText: "Synthetic Instrument No. 1",
    proposition: PROPOSITION,
    location: "Section 1",
    relevantDate: "2024-01-01",
    ...overrides,
  };
}

describe("citation verifier integrity", () => {
  it("fails identity when two documents share the cited identifier", async () => {
    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
        {
          id: "doc-2",
          title: "Duplicate Synthetic Instrument",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
      ],
      versions: [version({ documentId: "doc-1" })],
      provisions: [],
      chunks: [],
    };
    const result = await createCitationVerifier(corpus).verify(cite({}));
    expect(result.identityVerified).toBe(false);
    expect(result.layerResults.IDENTITY.evidence).toContain("ambiguous");
    expect(result.layerResults.IDENTITY.notes).toContain("ambiguous");
    expect(result.states).toContain("INVALID");
  });

  it("fails location when the cited passage chunk belongs to another document", async () => {
    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
        {
          id: "doc-2",
          title: "Other Synthetic Instrument",
          citationText: "Synthetic Instrument No. 2",
          legalStatus: "IN_FORCE",
        },
      ],
      versions: [version({})],
      provisions: [],
      chunks: [
        {
          id: "chunk-other",
          documentId: "doc-2",
          content: PROPOSITION,
        },
      ],
    };
    const result = await createCitationVerifier(corpus).verify(
      cite({ passageId: "chunk-other", location: undefined }),
    );
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(false);
    expect(result.layerResults.LOCATION.evidence).toBe(
      "passage_document_mismatch",
    );
  });

  it("fails location when no version covers the relevant date", async () => {
    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
      ],
      versions: [
        version({
          effectiveFrom: "2019-01-01",
          effectiveTo: "2020-01-01",
          isCurrent: false,
        }),
      ],
      provisions: [
        {
          id: "prov-1",
          documentId: "doc-1",
          versionId: "v1",
          label: "Section 1",
          text: PROPOSITION,
          legalStatus: "IN_FORCE",
          effectiveFrom: "2019-01-01",
          effectiveTo: "2020-01-01",
        },
      ],
      chunks: [],
    };
    const result = await createCitationVerifier(corpus).verify(
      cite({ relevantDate: "2024-01-01" }),
    );
    expect(result.passageVerified).toBe(false);
    expect(result.layerResults.LOCATION.evidence).toBe("no_version_in_force");
  });

  it("fails location when overlapping versions cover the relevant date", async () => {
    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
      ],
      versions: [
        version({ id: "v1", effectiveFrom: "2023-01-01", effectiveTo: null }),
        version({
          id: "v2",
          effectiveFrom: "2024-01-01",
          effectiveTo: null,
          isCurrent: false,
        }),
      ],
      provisions: [
        {
          id: "prov-1",
          documentId: "doc-1",
          versionId: "v1",
          label: "Section 1",
          text: PROPOSITION,
          legalStatus: "IN_FORCE",
          effectiveFrom: "2023-01-01",
          effectiveTo: null,
        },
      ],
      chunks: [],
    };
    const result = await createCitationVerifier(corpus).verify(
      cite({ relevantDate: "2024-06-01" }),
    );
    expect(result.passageVerified).toBe(false);
    expect(result.layerResults.LOCATION.evidence).toBe("overlapping_versions");
  });

  it("fails temporal validity when a repealed document has no repeal date", async () => {
    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "REPEALED",
          effectivityDate: "2019-01-01",
        },
      ],
      versions: [version({})],
      provisions: [
        {
          id: "prov-1",
          documentId: "doc-1",
          versionId: "v1",
          label: "Section 1",
          text: PROPOSITION,
          legalStatus: "IN_FORCE",
          effectiveFrom: "2019-01-01",
          effectiveTo: null,
        },
      ],
      chunks: [],
    };
    const result = await createCitationVerifier(corpus).verify(
      cite({ relevantDate: "2024-01-01" }),
    );
    expect(result.temporalValidity).toBe(false);
    expect(result.layerResults.TEMPORAL_VALIDITY.evidence).toBe(
      "end_date_unknown",
    );
  });

  it("matches a Section 2 citation to a provision labelled 2", async () => {
    expect(normalizeProvisionLabel("Section 2")).toBe("2");
    expect(normalizeProvisionLabel("Sec. 2")).toBe("2");
    expect(normalizeProvisionLabel("2")).toBe("2");
    expect(normalizeProvisionLabel("Section 2(a)")).not.toBe(
      normalizeProvisionLabel("Section 2A"),
    );

    const corpus: CitationCorpusView = {
      documents: [
        {
          id: "doc-1",
          title: "Synthetic Instrument No. 1",
          citationText: "Synthetic Instrument No. 1",
          legalStatus: "IN_FORCE",
        },
      ],
      versions: [version({})],
      provisions: [
        {
          id: "prov-2",
          documentId: "doc-1",
          versionId: "v1",
          label: "2",
          text: PROPOSITION,
          legalStatus: "IN_FORCE",
          effectiveFrom: "2019-01-01",
          effectiveTo: null,
        },
      ],
      chunks: [],
    };
    const result = await createCitationVerifier(corpus).verify(
      cite({ location: "Section 2", relevantDate: "2024-01-01" }),
    );
    expect(result.passageVerified).toBe(true);
    expect(result.layerResults.LOCATION.evidence).toContain("2");
  });
});

// Gate 10 — citation verifier wired to the reviewed authority projection.
// All fixtures are synthetic. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type {
  AuthorityStatusView,
  CitationCorpusView,
  CitationInput,
} from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";

const corpus: CitationCorpusView = {
  documents: [
    {
      id: "d1",
      title: "Synthetic Act One",
      citationText: "SYNTH-ACT-0001",
      legalStatus: "UNKNOWN",
    },
  ],
  versions: [
    {
      id: "v1",
      documentId: "d1",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      isCurrent: true,
    },
  ],
  provisions: [
    {
      id: "p1",
      documentId: "d1",
      versionId: "v1",
      label: "Section 2",
      text: "Synthetic passage about registration.",
      legalStatus: "UNKNOWN",
    },
  ],
  chunks: [
    {
      id: "c1",
      documentId: "d1",
      versionId: "v1",
      provisionId: "p1",
      content: "Synthetic passage about registration.",
    },
  ],
};

/** Same document, but terminal status with no end date recorded. */
const legacyRepealedCorpus: CitationCorpusView = {
  ...corpus,
  documents: [
    {
      id: "d1",
      title: "Synthetic Act One",
      citationText: "SYNTH-ACT-0001",
      legalStatus: "REPEALED",
      repealDate: null,
    },
  ],
};

function citation(overrides: Partial<CitationInput> = {}): CitationInput {
  return {
    citationText: "SYNTH-ACT-0001",
    documentId: "d1",
    passageId: "c1",
    proposition: "Synthetic passage about registration",
    relevantDate: "2026-06-01",
    ...overrides,
  };
}

function status(overrides: Partial<AuthorityStatusView>): AuthorityStatusView {
  return {
    outcome: "DETERMINED_WITH_REVIEWED_EVIDENCE",
    state: "IN_FORCE",
    explanation: "reviewed",
    abstained: false,
    ...overrides,
  };
}

interface MatrixCase {
  name: string;
  view: AuthorityStatusView;
  passes: boolean;
}

const MATRIX: MatrixCase[] = [
  {
    name: "determined / IN_FORCE / not abstained",
    view: status({}),
    passes: true,
  },
  {
    name: "determined / AMENDED",
    view: status({ state: "AMENDED" }),
    passes: true,
  },
  {
    name: "partially determined / UNKNOWN",
    view: status({ outcome: "PARTIALLY_DETERMINED", state: "UNKNOWN" }),
    passes: false,
  },
  {
    name: "unknown / UNKNOWN",
    view: status({ outcome: "UNKNOWN", state: "UNKNOWN" }),
    passes: false,
  },
  {
    name: "conflicted / UNKNOWN",
    view: status({ outcome: "CONFLICTED", state: "UNKNOWN" }),
    passes: false,
  },
  {
    name: "insufficient evidence / UNKNOWN",
    view: status({ outcome: "INSUFFICIENT_EVIDENCE", state: "UNKNOWN" }),
    passes: false,
  },
  {
    name: "unauthorized / UNKNOWN",
    view: status({ outcome: "UNAUTHORIZED", state: "UNKNOWN" }),
    passes: false,
  },
  {
    name: "determined / REPEALED",
    view: status({ state: "REPEALED" }),
    passes: false,
  },
  {
    name: "determined / NOT_YET_EFFECTIVE",
    view: status({ state: "NOT_YET_EFFECTIVE" }),
    passes: false,
  },
  {
    name: "determined / IN_FORCE but the version does not cover the date",
    view: status({ missing: ["VERSION_NOT_IN_EFFECT"] }),
    passes: false,
  },
  {
    name: "determined / IN_FORCE but the projection abstained",
    view: status({ abstained: true }),
    passes: false,
  },
];

describe("Gate 10 — authority projection drives temporal validity", () => {
  it.each(MATRIX)("$name → passes=$passes", async ({ view, passes }) => {
    const verifier = createCitationVerifier(corpus, {
      authority: async () => view,
    });

    const result = await verifier.verify(citation({}));

    expect(result.temporalValidity).toBe(passes);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe(view.outcome);
    expect(result.layerResults.TEMPORAL_VALIDITY.evidence).toContain(
      view.outcome,
    );
    if (passes) {
      expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
    } else {
      expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
    }
  });

  it("carries the projected version id and missing gaps through to the result", async () => {
    const verifier = createCitationVerifier(corpus, {
      authority: async () =>
        status({ versionId: "v1", missing: ["VERSION_NOT_IN_EFFECT"] }),
    });

    const result = await verifier.verify(citation({}));

    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.versionId).toBe("v1");
    expect(result.authorityStatus?.missing).toContain("VERSION_NOT_IN_EFFECT");
  });

  it("fails closed on legacy fields when a terminal status has no end date", async () => {
    const verifier = createCitationVerifier(legacyRepealedCorpus);

    const result = await verifier.verify(
      citation({ relevantDate: "2026-06-01" }),
    );

    // checkTemporal() refuses to evaluate a REPEALED document with no
    // repealDate, so the layer fails with `end_date_unknown` rather than
    // assuming the text was still in force.
    expect(result.temporalValidity).toBe(false);
    expect(result.layerResults.TEMPORAL_VALIDITY.evidence).toBe(
      "end_date_unknown",
    );
    expect(result.temporalSource).toBe("legacy_fields");
    expect(result.authorityStatus).toBeNull();
  });

  it("falls back to the legacy fields when no authority lookup is supplied", async () => {
    const verifier = createCitationVerifier(corpus);

    const result = await verifier.verify(citation({}));

    expect(result.temporalSource).toBe("legacy_fields");
    expect(result.authorityStatus).toBeNull();
  });
});

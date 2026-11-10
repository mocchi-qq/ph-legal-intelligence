import { describe, expect, it } from "vitest";
import {
  parseLegalIdentifier,
  parseStatutoryOutline,
  resolveIdentity,
} from "../../packages/legal-ingestion/src/index";

describe("Gate 2 — legal identifier parsing", () => {
  it("parses Republic Act variants", () => {
    expect(parseLegalIdentifier("Republic Act No. 10173")?.normalized).toBe(
      "REPUBLIC_ACT:10173",
    );
    expect(parseLegalIdentifier("R.A. No. 10173")?.normalized).toBe(
      "REPUBLIC_ACT:10173",
    );
  });

  it("parses executive orders, presidential decrees and administrative orders", () => {
    expect(parseLegalIdentifier("Executive Order No. 101")?.normalized).toBe(
      "EXECUTIVE_ORDER:101",
    );
    expect(parseLegalIdentifier("E.O. No. 101")?.normalized).toBe(
      "EXECUTIVE_ORDER:101",
    );
    expect(
      parseLegalIdentifier("Presidential Decree No. 442")?.normalized,
    ).toBe("PRESIDENTIAL_DECREE:442");
    expect(
      parseLegalIdentifier("Administrative Order No. 35")?.normalized,
    ).toBe("ADMINISTRATIVE_ORDER:35");
  });

  it("parses G.R. and A.M. numbers", () => {
    expect(parseLegalIdentifier("G.R. No. 999001")?.normalized).toBe(
      "GR:999001",
    );
    expect(
      parseLegalIdentifier("G.R. No. 999001, January 1, 2020")?.number,
    ).toBe("999001");
    expect(parseLegalIdentifier("A.M. No. 25-11-28-SC")?.normalized).toBe(
      "AM:25-11-28-SC",
    );
  });

  it("does not treat an ordinary word followed by a number as a G.R. number", () => {
    expect(parseLegalIdentifier("Gr 100")).toBeNull();
    expect(parseLegalIdentifier("G.R. No. 100")).not.toBeNull();
  });

  it("returns null when no legal identifier is present", () => {
    expect(
      parseLegalIdentifier("Synthetic Entity v. Synthetic Authority"),
    ).toBeNull();
  });

  it("resolves an exact identifier", () => {
    const parsed = parseLegalIdentifier("G.R. No. 999001")!;
    const resolution = resolveIdentity(parsed, [
      {
        identityKey: "COURT_DECISION:G.R. No. 999001",
        issuingBody: "Supreme Court",
      },
      {
        identityKey: "COURT_DECISION:G.R. No. 999002",
        issuingBody: "Supreme Court",
      },
    ]);
    expect(resolution.status).toBe("MATCH");
  });

  it("never resolves a nonexistent G.R. number to a neighbour", () => {
    const parsed = parseLegalIdentifier("G.R. No. 999009")!;
    const resolution = resolveIdentity(parsed, [
      { identityKey: "COURT_DECISION:G.R. No. 999001" },
      { identityKey: "COURT_DECISION:G.R. No. 999002" },
    ]);
    expect(resolution.status).toBe("NO_MATCH");
  });

  it("treats the same number from different issuing authorities as ambiguous unless the authority is supplied", () => {
    const parsed = parseLegalIdentifier("G.R. No. 777")!;
    const candidates = [
      {
        identityKey: "COURT_DECISION:G.R. No. 777",
        issuingBody: "Court of Appeals",
      },
      {
        identityKey: "COURT_DECISION:G.R. No. 777",
        issuingBody: "Supreme Court",
      },
    ];
    expect(resolveIdentity(parsed, candidates).status).toBe("AMBIGUOUS");
    const withAuthority = resolveIdentity(parsed, candidates, "Supreme Court");
    expect(withAuthority.status).toBe("MATCH");
  });

  it("does not merge similar titles", () => {
    const parsed = parseLegalIdentifier("Republic Act No. 1001")!;
    const resolution = resolveIdentity(parsed, [
      { identityKey: "REPUBLIC_ACT:1001", documentType: "REPUBLIC_ACT" },
      { identityKey: "REPUBLIC_ACT:2001", documentType: "REPUBLIC_ACT" },
    ]);
    expect(resolution.status).toBe("MATCH");
    expect(
      resolution.status === "MATCH" && resolution.candidate.identityKey,
    ).toBe("REPUBLIC_ACT:1001");
  });

  it("parses a statutory outline without inventing labels", () => {
    const outline = parseStatutoryOutline(
      [
        "ARTICLE I",
        "Section 1. First duty.",
        "Section 2. Second duty.",
        "Rule 3. Procedural rule.",
      ].join("\n"),
    );
    expect(outline.map((unit) => unit.label)).toEqual([
      "ARTICLE I",
      "Section 1",
      "Section 2",
      "Rule 3",
    ]);
    expect(outline[1]!.text).toBe("First duty.");
  });
});

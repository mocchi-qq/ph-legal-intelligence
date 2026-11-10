import { describe, expect, it } from "vitest";
import {
  AcquisitionStatus,
  AuthorityLevel,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "../../packages/legal-schema/src/index";

describe("@phli/legal-schema taxonomy exports", () => {
  it("exports DocumentType with the full document taxonomy", () => {
    expect(DocumentType).toBeDefined();
    expect(Object.values(DocumentType)).toEqual([
      "CONSTITUTION",
      "STATUTE",
      "REPUBLIC_ACT",
      "COMMONWEALTH_ACT",
      "PRESIDENTIAL_DECREE",
      "BATAS_PAMBANSA",
      "EXECUTIVE_ORDER",
      "ADMINISTRATIVE_ORDER",
      "COURT_DECISION",
      "SIGNED_RESOLUTION",
      "COURT_RULE",
      "COURT_CIRCULAR",
      "AGENCY_REGULATION",
      "ADMINISTRATIVE_DECISION",
      "TREATY",
      "LOCAL_ORDINANCE",
      "LEGAL_REFERENCE",
    ]);
  });

  it("exports LegalStatus with all lifecycle values", () => {
    expect(LegalStatus).toBeDefined();
    expect(Object.values(LegalStatus)).toEqual([
      "UNKNOWN",
      "IN_FORCE",
      "PARTIALLY_AMENDED",
      "AMENDED",
      "REPEALED",
      "SUPERSEDED",
      "EXPIRED",
      "NOT_YET_EFFECTIVE",
      "UNDER_REVIEW",
    ]);
  });

  it("exports VerificationStatus with all verification values", () => {
    expect(VerificationStatus).toBeDefined();
    expect(Object.values(VerificationStatus)).toEqual([
      "UNVERIFIED",
      "PENDING_REVIEW",
      "VERIFIED",
      "CONFLICT_DETECTED",
      "DEFECTIVE_EXTRACTION",
    ]);
  });

  it("exports AuthorityLevel with lowercase values", () => {
    expect(AuthorityLevel).toBeDefined();
    expect(Object.values(AuthorityLevel)).toEqual([
      "official_primary",
      "official_secondary",
      "unofficial",
    ]);
  });

  it("exports AcquisitionStatus with the source-acquisition values", () => {
    expect(AcquisitionStatus).toBeDefined();
    expect(Object.values(AcquisitionStatus)).toEqual([
      "Approved",
      "Restricted",
      "Manual",
      "Pending",
      "Rejected",
    ]);
  });

  it("resolves individual enum members to their exact values", () => {
    expect(DocumentType.COURT_DECISION).toBe("COURT_DECISION");
    expect(LegalStatus.IN_FORCE).toBe("IN_FORCE");
    expect(VerificationStatus.VERIFIED).toBe("VERIFIED");
    expect(AuthorityLevel.OFFICIAL_PRIMARY).toBe("official_primary");
    expect(AcquisitionStatus.APPROVED).toBe("Approved");
  });
});

import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "@phli/legal-schema";

export interface AuthorityDocumentView {
  id: string;
  documentType: string;
  title: string;
}

export interface AuthorityVersionView {
  id: string;
  documentId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface AuthorityProvisionView {
  id: string;
  documentId: string;
  versionId: string;
  label: string;
  text: string;
}

export interface AuthoritySnapshot {
  documents: AuthorityDocumentView[];
  versions: AuthorityVersionView[];
  provisions: AuthorityProvisionView[];
  provisionIdentities: ProvisionIdentity[];
  provisionMappings: ProvisionVersionMapping[];
  assertions: EffectAssertion[];
  evidence: EffectEvidence[];
  reviews: LegalEffectReview[];
}

const isDate = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined) return false;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + "T00:00:00Z"))
  );
};

const isDateTime = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined) return false;
  return Number.isFinite(Date.parse(v));
};

const atLeastOne = (v: unknown): v is string => {
  return typeof v === "string" && v.trim().length > 0;
};

const copy = <T>(v: T): T => structuredClone(v);

export class AuthorityLedger {
  private documents = new Map<string, AuthorityDocumentView>();
  private versions = new Map<string, AuthorityVersionView>();
  private provisions = new Map<string, AuthorityProvisionView>();
  private identities = new Map<string, ProvisionIdentity>();
  private mappings = new Map<string, ProvisionVersionMapping>();
  private assertions = new Map<string, EffectAssertion>();
  private evidence = new Map<string, EffectEvidence>();
  private reviews = new Map<string, LegalEffectReview>();

  addDocument(doc: AuthorityDocumentView): void {
    if (!atLeastOne(doc.id)) throw "missing_document_id";
    if (this.documents.has(doc.id)) throw "duplicate_document_id";
    this.documents.set(doc.id, copy(doc));
  }

  addVersion(v: AuthorityVersionView): void {
    if (!atLeastOne(v.id)) throw "missing_version_id";
    if (this.versions.has(v.id)) throw "duplicate_version_id";
    if (!this.documents.has(v.documentId)) throw "unknown_document";
    if (v.effectiveFrom !== null && !isDate(v.effectiveFrom))
      throw "invalid_version_date";
    if (v.effectiveTo !== null && !isDate(v.effectiveTo))
      throw "invalid_version_date";
    this.versions.set(v.id, copy(v));
  }

  addProvision(p: AuthorityProvisionView): void {
    if (!atLeastOne(p.id)) throw "missing_provision_id";
    if (this.provisions.has(p.id)) throw "duplicate_provision_id";
    if (!this.versions.has(p.versionId)) throw "unknown_version";
    if (!this.documents.has(p.documentId)) throw "unknown_document";
    this.provisions.set(p.id, copy(p));
  }

  addProvisionIdentity(p: ProvisionIdentity): void {
    if (!atLeastOne(p.id)) throw "missing_provision_identity_id";
    if (this.identities.has(p.id)) throw "duplicate_provision_identity";
    if (!this.documents.has(p.documentId)) throw "unknown_document";
    if (!atLeastOne(p.canonicalLabel)) throw "missing_canonical_label";
    if (!isDateTime(p.createdAt)) throw "invalid_created_at";
    this.identities.set(p.id, copy(p));
  }

  addProvisionMapping(m: ProvisionVersionMapping): void {
    if (!atLeastOne(m.id)) throw "missing_provision_mapping_id";
    if (this.mappings.has(m.id)) throw "duplicate_provision_mapping";
    if (!this.identities.has(m.provisionIdentityId))
      throw "unknown_provision_identity";
    const prov = this.provisions.get(m.provisionVersionId);
    if (!prov) throw "unknown_provision";
    if (prov.versionId !== m.documentVersionId)
      throw "provision_version_mismatch";
    if (!this.versions.has(m.documentVersionId)) throw "unknown_version";
    if (!atLeastOne(m.rationale)) throw "missing_rationale";
    const pairKey = `${m.provisionIdentityId}|${m.provisionVersionId}`;
    for (const existing of this.mappings.values()) {
      if (
        `${existing.provisionIdentityId}|${existing.provisionVersionId}` ===
        pairKey
      ) {
        throw "duplicate_provision_mapping_pair";
      }
    }
    this.mappings.set(m.id, copy(m));
  }

  addAssertion(a: EffectAssertion): void {
    if (!atLeastOne(a.id)) throw "missing_assertion_id";
    if (this.assertions.has(a.id)) throw "duplicate_assertion_id";
    if (!this.documents.has(a.sourceDocumentId)) throw "unknown_document";
    if (!this.documents.has(a.targetDocumentId)) throw "unknown_document";
    if (a.targetProvisionIdentityId !== null) {
      const pi = this.identities.get(a.targetProvisionIdentityId);
      if (!pi) throw "unknown_provision_identity";
      if (pi.documentId !== a.targetDocumentId)
        throw "provision_identity_document_mismatch";
    }
    if (a.targetVersionId !== null) {
      const v = this.versions.get(a.targetVersionId);
      if (!v) throw "unknown_version";
      if (v.documentId !== a.targetDocumentId)
        throw "target_version_document_mismatch";
    }
    if (a.sourceVersionId !== null) {
      const v = this.versions.get(a.sourceVersionId);
      if (!v) throw "unknown_version";
      if (v.documentId !== a.sourceDocumentId)
        throw "source_version_document_mismatch";
    }
    if (!atLeastOne(a.scope)) throw "missing_scope";
    if (!atLeastOne(a.evidenceId)) throw "missing_evidence_ref";
    if (!atLeastOne(a.assertionOrigin)) throw "missing_assertion_origin";
    if (!atLeastOne(a.recordedBy)) throw "missing_recorded_by";
    if (a.claimedEffectiveDate !== null && !isDate(a.claimedEffectiveDate))
      throw "invalid_assertion_date";
    if (!isDateTime(a.recordedAt)) throw "invalid_recorded_at";
    if (a.supersedesAssertionId !== null) {
      if (a.supersedesAssertionId === a.id)
        throw "unknown_superseded_assertion";
      if (!this.assertions.has(a.supersedesAssertionId))
        throw "unknown_superseded_assertion";
    }
    this.assertions.set(a.id, copy(a));
  }

  addEvidence(e: EffectEvidence): void {
    if (!atLeastOne(e.id)) throw "missing_evidence_id";
    if (this.evidence.has(e.id)) throw "duplicate_evidence_id";
    if (!this.assertions.has(e.assertionId)) throw "unknown_assertion";
    if (e.documentVersionId !== null && !this.versions.has(e.documentVersionId))
      throw "unknown_version";
    if (e.provisionVersionId !== null) {
      const p = this.provisions.get(e.provisionVersionId);
      if (!p) throw "unknown_provision";
      if (e.documentVersionId !== null && p.versionId !== e.documentVersionId)
        throw "evidence_version_mismatch";
    }
    if (e.contentHash !== null && !/^[a-f0-9]{64}$/i.test(e.contentHash))
      throw "invalid_evidence_hash";
    if (e.checkedAt !== null && !isDateTime(e.checkedAt))
      throw "invalid_checked_at";
    if (e.evidenceDate !== null && !isDate(e.evidenceDate))
      throw "invalid_evidence_date";
    this.evidence.set(e.id, copy(e));
  }

  addReview(r: LegalEffectReview): void {
    if (!atLeastOne(r.id)) throw "missing_review_id";
    if (this.reviews.has(r.id)) throw "duplicate_review_id";
    if (!this.assertions.has(r.assertionId)) throw "unknown_assertion";
    if (!atLeastOne(r.reviewerId)) throw "missing_reviewer";
    if (!atLeastOne(r.reviewerCapacity)) throw "missing_reviewer_capacity";
    if (!atLeastOne(r.scope)) throw "missing_review_scope";
    if (!atLeastOne(r.propositionReviewed)) throw "missing_proposition";
    if (!isDate(r.decisionDate)) throw "invalid_decision_date";
    if (!isDateTime(r.recordedAt)) throw "invalid_recorded_at";
    if (
      r.outcome === "CONFIRMED_WITH_CONDITIONS" &&
      (!r.conditions || r.conditions.length === 0)
    ) {
      throw "conditions_required";
    }
    const dupKey = `${r.assertionId}|${r.reviewerId}|${r.decisionDate}|${r.propositionReviewed}|${r.outcome}`;
    for (const existing of this.reviews.values()) {
      if (
        `${existing.assertionId}|${existing.reviewerId}|${existing.decisionDate}|${existing.propositionReviewed}|${existing.outcome}` ===
        dupKey
      ) {
        throw "duplicate_review";
      }
    }
    if (r.supersedesReviewId !== null) {
      if (!this.reviews.has(r.supersedesReviewId))
        throw "unknown_superseded_review";
    }
    for (const evidenceRef of r.evidenceRefs) {
      const evidence = this.evidence.get(evidenceRef);
      if (evidence === undefined) throw "unknown_evidence_ref";
      if (evidence.assertionId !== r.assertionId)
        throw "evidence_assertion_mismatch";
    }
    const validStatuses = new Set(["ACTIVE", "SUPERSEDED", "REVOKED"]);
    if (!validStatuses.has(r.status)) throw "invalid_review_status";
    this.reviews.set(r.id, copy(r));
  }

  getDocument(id: string): AuthorityDocumentView | null {
    const v = this.documents.get(id);
    return v ? copy(v) : null;
  }

  getVersion(id: string): AuthorityVersionView | null {
    const v = this.versions.get(id);
    return v ? copy(v) : null;
  }

  getProvision(id: string): AuthorityProvisionView | null {
    const v = this.provisions.get(id);
    return v ? copy(v) : null;
  }

  getAssertion(id: string): EffectAssertion | null {
    const v = this.assertions.get(id);
    return v ? copy(v) : null;
  }

  getEvidence(id: string): EffectEvidence | null {
    const v = this.evidence.get(id);
    return v ? copy(v) : null;
  }

  getReview(id: string): LegalEffectReview | null {
    const v = this.reviews.get(id);
    return v ? copy(v) : null;
  }

  listAssertionsFor(
    targetDocumentId: string,
    targetProvisionIdentityId?: string | null,
  ): EffectAssertion[] {
    const results: EffectAssertion[] = [];
    for (const a of this.assertions.values()) {
      if (a.targetDocumentId !== targetDocumentId) continue;
      if (targetProvisionIdentityId !== undefined) {
        const pid =
          (a as EffectAssertion & { targetProvisionIdentityId?: string | null })
            .targetProvisionIdentityId ?? null;
        if (pid !== targetProvisionIdentityId) continue;
      }
      results.push(copy(a));
    }
    results.sort((a, b) => {
      const ad = a.claimedEffectiveDate;
      const bd = b.claimedEffectiveDate;
      if (ad === null && bd === null) return a.id.localeCompare(b.id);
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad.localeCompare(bd) || a.id.localeCompare(b.id);
    });
    return results;
  }

  listEvidenceForAssertion(assertionId: string): EffectEvidence[] {
    const results: EffectEvidence[] = [];
    for (const e of this.evidence.values()) {
      if (e.assertionId === assertionId) results.push(copy(e));
    }
    return results;
  }

  listReviewsForAssertion(assertionId: string): LegalEffectReview[] {
    const results: LegalEffectReview[] = [];
    for (const r of this.reviews.values()) {
      if (r.assertionId === assertionId) results.push(copy(r));
    }
    results.sort(
      (a, b) =>
        a.decisionDate.localeCompare(b.decisionDate) ||
        a.id.localeCompare(b.id),
    );
    return results;
  }

  activeReviewsForAssertion(assertionId: string): LegalEffectReview[] {
    const active: LegalEffectReview[] = [];
    const supersededIds = new Set<string>();
    for (const r of this.reviews.values()) {
      if (r.assertionId !== assertionId) continue;
      if (r.supersedesReviewId !== null && r.status !== "SUPERSEDED") {
        supersededIds.add(r.supersedesReviewId);
      }
    }
    for (const r of this.reviews.values()) {
      if (r.assertionId !== assertionId) continue;
      if (r.status === "ACTIVE" && !supersededIds.has(r.id)) {
        active.push(copy(r));
      }
    }
    active.sort(
      (a, b) =>
        a.decisionDate.localeCompare(b.decisionDate) ||
        a.id.localeCompare(b.id),
    );
    return active;
  }

  snapshot(): AuthoritySnapshot {
    return {
      documents: Array.from(this.documents.values()).map(copy),
      versions: Array.from(this.versions.values()).map(copy),
      provisions: Array.from(this.provisions.values()).map(copy),
      provisionIdentities: Array.from(this.identities.values()).map(copy),
      provisionMappings: Array.from(this.mappings.values()).map(copy),
      assertions: Array.from(this.assertions.values()).map(copy),
      evidence: Array.from(this.evidence.values()).map(copy),
      reviews: Array.from(this.reviews.values()).map(copy),
    };
  }
}

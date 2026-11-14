# 02 — Domain Model

**Date:** 2026-11-14
**Status:** design plus synthetic implementation (see `11` for evidence level).

## 1. Three independent planes

The model separates three questions that must never collapse into one status field.

| Plane                                    | Question                                                                                                | Owner                                           | Stored as                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| **A. Source authorization**              | May the platform perform activity X with source/document Y?                                             | Authorization registry + counsel determinations | Gate 4/5/7 records, untouched                                           |
| **B. Document identity and provenance**  | What instrument is this, which artifact/version does this record represent, and where did it come from? | Ingestion + registry                            | `legal_documents`, `source_manifestations`, `document_versions`, hashes |
| **C. Legal effects and authority state** | What legal effect has been asserted, on what evidence, and has a qualified reviewer confirmed it?       | Effects ledger + reviews                        | New Gate 8 tables/types                                                 |

An authentic document can be unauthorized for processing. An authorized document
can have unknown legal effect. A reviewed effect can exist for content that may not
be reproduced. The model must represent all three simultaneously.

**Hard rule:** `AuthorizationDecisionRef` is an opaque pointer to a Plane A record.
It is never an input to a legal-effect conclusion, and a legal-effect review never
grants reuse.

## 2. Entities

### Plane B — identity and provenance (existing, extended)

| Entity                    | Meaning                                                  | Key invariant                                          |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `LegalDocument`           | Logical instrument, independent of any file              | ID stable across titles/URLs                           |
| `SourceManifestation`     | One retrieval of one artifact from one source            | Hash is byte identity, not authenticity                |
| `DocumentVersion`         | Immutable text version of the instrument                 | Never overwritten; corrections create versions         |
| `LegalProvision`          | Provision text within one version                        | Version-scoped                                         |
| `ProvisionIdentity`       | Logical provision across versions                        | Exists only where continuity is asserted               |
| `ProvisionVersionMapping` | Link between logical provision and a version's provision | Mapping type is explicit, including `UNCERTAIN`/`NONE` |

### Plane C — effects

| Entity                | Meaning                                                                 | Key invariant                                                 |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `EffectAssertion`     | A claimed legal effect from a source instrument on a target             | Immutable; no review implied by existence                     |
| `EffectEvidence`      | Evidence supporting one assertion                                       | Availability is explicit; unavailable ⇒ fail closed           |
| `LegalEffectReview`   | A qualified reviewer's decision on one assertion                        | Immutable; names reviewer, capacity, date, scope, proposition |
| `AuthorityProjection` | Deterministic result of applying assertions/reviews/evidence to a query | Explainable; abstains rather than guessing                    |

## 3. Effect assertion vs legal determination

```
EffectAssertion   "SYNTH-ACT-0002 s.3 says it amends SYNTH-ACT-0001 s.2"
      │
      ├── EffectEvidence (source locator, hash, availability, class)
      │
      └── LegalEffectReview (reviewer, capacity, date, scope, outcome)
                 │
                 └── AuthorityProjection (state as of date, or UNKNOWN)
```

An assertion can exist with no review. A review cannot exist without an assertion.
A projection cannot treat an unreviewed assertion as confirmed.

## 4. Review outcomes

| Outcome                     | Meaning                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `CONFIRMED`                 | The reviewer confirms the asserted effect within the stated scope |
| `CONFIRMED_WITH_CONDITIONS` | Confirmed only subject to recorded conditions                     |
| `REJECTED`                  | The assertion is not accepted                                     |
| `INCONCLUSIVE`              | The evidence does not settle it                                   |
| `CONFLICTED`                | The reviewer records an unresolved conflict                       |

Every review records **what proposition was reviewed**, not a blanket status. There
is no generic `COUNSEL_CONFIRMED` flag.

## 5. Authority states and query outcomes

**States:** `UNKNOWN`, `IN_FORCE`, `NOT_YET_EFFECTIVE`, `AMENDED`,
`PARTIALLY_AMENDED`, `REPEALED`, `PARTIALLY_REPEALED`, `SUSPENDED`,
`INVALIDATED`, `REINSTATED`, `CONSOLIDATED`, `RENUMBERED`.

**Query outcomes:** `DETERMINED_WITH_REVIEWED_EVIDENCE`, `PARTIALLY_DETERMINED`,
`UNKNOWN`, `CONFLICTED`, `INSUFFICIENT_EVIDENCE`, `UNAUTHORIZED`.

A projection carries: outcome, state, as-of date, assertion IDs, review IDs,
evidence IDs, conflicts, missing information, explanation, abstention flag, and
authorization status.

## 6. Invariants

1. Assertions and reviews are immutable; supersession is a new row pointing at the
   old one.
2. A review must reference an existing assertion and a non-empty scope and
   proposition.
3. `CONFIRMED_WITH_CONDITIONS` must carry at least one condition.
4. Evidence availability `UNAVAILABLE` or `NOT_RECEIVED` prevents a confirmed
   projection.
5. Two active reviews with different outcomes produce `CONFLICTED`; the system
   does not pick one.
6. A missing effective date prevents a definitive as-of result.
7. A provision mapping is only `REVIEWED` with a rationale; text or number
   similarity never sets it.
8. Authorization denial overrides any legal-effect state with `UNAUTHORIZED`.
9. Projection never writes; it is a pure function over a ledger snapshot.
10. No status is inferred from "latest retrieved version".

## 7. What the model refuses to do

- Decide that an Act is in force because it is the newest file.
- Decide that a section was repealed because an amending text mentions it.
- Treat a court decision's mention of a provision as invalidation.
- Treat a hash match as legal authenticity.
- Treat a counsel storage permission as a legal-effect review.
- Merge two similar instruments or provisions without a recorded decision.
- Fill an unknown date with the retrieval date.

## 8. Integration boundaries

- **Authorization:** projection accepts an optional `authorization` callback; denial
  returns `UNAUTHORIZED`. The ledger never calls the counsel registry to infer
  legal effect.
- **Citation verification:** only layer 4 (temporal/authority) consumes the
  projection; layers 1–3 remain independent.
- **Search:** retrieval returns IDs and temporal context; authority state is a
  separate field, never baked into a relevance score.
- **Audit:** new records are append-only; no update/delete triggers.

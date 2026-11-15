# 06 — Source, Target and Evidence Policy

**Rule:** every document a projection depends on is authorized, separately, for
the activity the projection performs. None inherits another's authorization.

## 1. Roles and what each one gates

| Role       | Documents                                        | Question asked                                                       | Consequence of non-`AUTHORIZED`                                                             |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `TARGET`   | `request.documentId`                             | may this instrument be presented for this activity?                  | the whole projection abstains or is refused                                                 |
| `SOURCE`   | every candidate `assertion.sourceDocumentId`     | may the instrument that claims the effect be used for this activity? | that assertion is excluded and recorded; other sources may still decide                     |
| `EVIDENCE` | the document behind `evidence.documentVersionId` | may the document the evidence came from be used for this activity?   | that evidence cannot ground a determination; the projection becomes `INSUFFICIENT_EVIDENCE` |

Role is provenance only. Authorization is a property of
`(documentId, activity)`; the same pair resolves identically whichever role asks,
and the per-call memo relies on that.

## 2. Target

Resolved first, for `request.activity`. Gate 12 semantics are preserved:

| Decision       | Projection                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `AUTHORIZED`   | continue                                                                   |
| `UNAUTHORIZED` | outcome `UNAUTHORIZED`, missing `NOT_AUTHORIZED`, abstained **false**      |
| `NOT_CHECKED`  | outcome `UNKNOWN`, missing `AUTHORIZATION_NOT_CHECKED`, abstained **true** |

An authorized target does not authorize a source, and an authorized source does not
authorize the target. Each is resolved independently.

## 3. Effect-assertion sources

Every candidate assertion is resolved for the **same activity** the projection is
performing — not for the activity the assertion "feels like". A source authorized
for `viewing` cannot contribute to a `citation_display` projection.

Excluded assertions are recorded:

- `SOURCE_NOT_AUTHORIZED:<assertionId>` — a decision exists and denies;
- `SOURCE_AUTHORIZATION_NOT_CHECKED:<assertionId>` — nobody has decided.

Those codes are carried in `missing` on **every** projection returned after gating,
including a successful one, so a determination states what it was built from and
what it excluded. If nothing survives, the result is `UNKNOWN`, abstained, with all
the codes.

## 4. Evidence documents

Evidence is not itself an authorization decision, and a citation to evidence is not
evidence of authorization. When the projection uses an evidence record to ground a
determination and that record carries a `documentVersionId` that resolves through
`snapshot.versions` to a document, that document is resolved for the same activity
with role `EVIDENCE`.

- Already checked (the target or one of the effect sources) → no second check.
- Not authorized → `EVIDENCE_NOT_AUTHORIZED:<evidenceId>` or
  `EVIDENCE_AUTHORIZATION_NOT_CHECKED:<evidenceId>`, and the projection returns
  `INSUFFICIENT_EVIDENCE` with state `UNKNOWN` and abstained, because its evidence
  base is not usable.
- `documentVersionId` null, or the version is not in the snapshot → no evidence
  check and no code. The projection does not invent a document it cannot name; that
  case is covered by the existing evidence-availability rules.

## 5. Multiple sources

- Each `(documentId, activity)` pair is resolved independently and memoised per
  call.
- One authorized source never authorizes another; two sources with the same
  `sourceId` do share a decision, because that is the registry's key, and the memo
  makes it explicit rather than accidental.
- Authorized sources can still produce a determination while unauthorized ones are
  excluded — the projection reports an **incomplete** basis rather than a
  fabricated complete one: the determination is real, and `missing` names exactly
  what was left out.
- Conflicting reviews among the surviving sources still yield `CONFLICTED`; the
  conflicting set is not silently reduced by exclusion.

## 6. Order of operations

1. validate the request: exactly one authorization input, then a canonical
   activity, then a real as-of date — no resolver is called for a request that
   fails any of these;
2. resolve the target;
3. load candidates, compute supersession, filter by target and provision;
4. resolve each candidate's source, exclude and record;
5. gather active reviews for the survivors;
6. resolve evidence documents for the evidence actually used;
7. project the outcome from what remains.

Gating happens before review interpretation so an unauthorized source can never
influence a conflict determination, and after supersession so an unauthorized
superseder still removes what it supersedes (see
`07_SUPERSESSION_AND_RESOLUTION_ORDER.md`).

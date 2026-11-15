# 07 — Supersession and Resolution Order

**Rule:** an unauthorized superseding assertion must still suppress what it
supersedes. Otherwise a stale effect silently returns to force and the projection
asserts a legal position the ledger no longer holds.

## 1. The sequence

```
 1. validate the request
      exactly one authorization input
      activity present and canonical
      as-of date real (no resolver called if not)
 2. resolve TARGET   (documentId, activity)
 3. collect candidate assertions
 4. compute supersession over the WHOLE snapshot
 5. filter candidates: not superseded, target matches, provision matches
 6. resolve SOURCE   (sourceDocumentId, activity) for each candidate
 7. exclude non-authorized candidates, recording SOURCE_* codes
 8. gather active reviews for survivors
 9. resolve EVIDENCE (evidence document, activity)
10. project the outcome from survivors only
```

Steps 4 and 5 happen before 6 and 7 on purpose.

## 2. Why supersession precedes authorization

Supersession is a statement about the ledger: assertion _B_ replaces assertion _A_.
Whether _B_ may be _used_ is a separate question. If authorization were resolved
first, an unauthorized _B_ would vanish, _A_ would look live again, and the
projection would restore a position that the ledger itself has retired. That is
worse than abstaining: it produces a confident wrong answer.

Gate 12 established this ordering for document-level authorization and tested it.
Gate 13 keeps it and extends it to activity-specific authorization, so a superseder
authorized for the wrong activity is equally unable to resurrect its predecessor.

## 3. Outcomes the ordering can produce

| Situation                                         | Result                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| superseder authorized, superseded excluded        | normal determination from the superseder                                                                                                    |
| superseder unauthorized, superseded still present | both out: the superseded one by supersession, the superseder by authorization → `UNKNOWN`, abstained, `SOURCE_*` code naming the superseder |
| superseder `NOT_CHECKED`, superseded present      | same, with `SOURCE_AUTHORIZATION_NOT_CHECKED:<superseder>`                                                                                  |
| supersession chain A ← B ← C, C unauthorized      | A and B are both superseded, C is excluded → `UNKNOWN`                                                                                      |
| cycle A supersedes B, B supersedes A              | both are flagged superseded by the existing algorithm → no candidates survive → `UNKNOWN`                                                   |

Every row above is a refusal, never a determination. That is the intended failure
mode: the system says it cannot tell rather than guessing which of two documents it
may not read is authoritative.

## 4. What is not attempted

- **No repair.** The projection does not "pick the best available superseder" or
  fall back to the superseded assertion if the superseder is unauthorized.
- **No partial chain reconstruction.** A chain broken by an unauthorized link yields
  no determination, not a shorter chain.
- **No cycle resolution.** A supersession cycle is treated as nothing being live,
  which the existing algorithm already does by marking every referenced id
  superseded.
- **No write.** Supersession is read, never created, by the projection.

## 5. Determinism

- candidates are sorted by the existing `compareAssertions`, so the same snapshot
  and activity always produce the same candidate order;
- authorization resolutions are memoised per `(documentId, activity)` within the
  call, so a resolver that is not a pure function cannot authorize one assertion
  from a source and refuse another;
- `authorizationChecks` is sorted, so the trace is stable for a given input.

# DECISION — Gate 19

**Date:** 2026-11-19
**Baseline:** the tree carrying Gate 18 (`1a61e2c`, since merged into the research line)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

**Artifact data can no longer switch the activity gate off.** Before this gate,
`pipeline.ts` skipped all four activity checks for an artifact flagged
`synthetic: true`, guarded only by a `synthetic://` URL the caller also supplied. A
fixture now runs the same four checks, and `synthetic` only selects the accepted basis:

| Artifact | Accepted basis                    | Registry                                       |
| -------- | --------------------------------- | ---------------------------------------------- |
| real     | `COUNSEL_DETERMINATION` (default) | required unless the legacy gate was opted into |
| fixture  | `SYNTHETIC_FIXTURE` only          | required, always                               |

Neither class can borrow the other's basis, and a real artifact that asks for the
fixture basis is refused outright rather than at check time.

**The run record stopped claiming decisions it never consulted.** `addRun` derived
`synthetic_fixture` / `synthetic_fixture` / `[]` from the artifact's flag. It now
records only what the checks produced: four decision references on success, `null`
when nothing was consulted. An empty list no longer means both "checked, nothing
found" and "nothing was checked".

**The locator and the flag have to agree.** `synthetic: true` needs a non-fetchable
locator (`synthetic://`, or a host under the RFC 2606 `.invalid` TLD so the
acquisition stage can be rehearsed); `synthetic: false` naming a `synthetic://` URL is
refused as contradictory.

## 2. Evidence

| Check                    | Result                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Full suite               | **838 tests — 829 pass, 0 failures, 9 skipped**                                            |
| Gate 19 tests            | 12 refusals and the success path                                                           |
| Build                    | exit 0                                                                                     |
| Biome                    | exit 0 on every changed file, 0 errors                                                     |
| Independent review       | 1 pass, 8 findings: 1 wrong (rejected with line numbers), 3 rejected with reasons, 4 fixed |
| Production files changed | 2 (`pipeline.ts`, `types.ts`)                                                              |
| Migrations               | none                                                                                       |

The refusals proved: no registry; one of four decisions missing; a counsel decision
for a fixture; a fixture decision for a real artifact; the fixture basis in a real
artifact's options; a synthetic flag with a fetchable locator; a `synthetic://` locator
on a real artifact. The success path records `synthetic_fixture` / `SYNTHETIC_FIXTURE`
and four references, and audits four grants.

## 3. Why ACCEPTED WITH LIMITATIONS

1. **`SYNTHETIC_FIXTURE` is still caller-declared.** The gate now refuses it for real
   artifacts and counsel for fixtures, but nothing can verify that content really is a
   fixture. That is why the basis authorizes ingestion only and no legal conclusion
   rests on it.
2. **The generic registry does not restrict which activity a fixture decision may
   cover.** The synthetic end-to-end chains need fixture decisions for
   `citation_display` to rehearse the whole path; production `citation_display`
   authorization comes from counsel determinations through a different store.
3. **Four end-to-end chains changed shape.** They were `synthetic: false` with fixture
   decisions precisely because the checks only ran on that path. They are now honest
   fixtures, and Gate 15's acquisition stage passes the fixture basis through its own
   option. One Gate 4 test was rewritten because its premise was the removed
   exemption.
4. **No remote D1, no workerd** (Gate 7), **no read-time authorization** (B-3).

## 4. On the review

The CRITICAL was wrong: the activity checks run before identity resolution and the
duplicate/manifest checks, so those early outcomes are downstream of the gate. It is
recorded as rejected with line numbers. Two other findings proposed changes that were
no-ops or reintroduced the empty-list ambiguity; they were rejected rather than
applied.

The two findings that mattered were about a _real_ artifact being authorized by the
fixture basis in the Gate 15 rehearsal and about the locator contradiction. Both are
closed, and the first one is why the chains were reflagged as fixtures.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Operating note

This gate was built while other sessions were writing to the same checkout: the
research board replaced `KANBAN.md`, `authority-projection.ts` was rewritten and
restored by another session twice, and an uncommitted Gate 19 edit to `pipeline.ts`
was reverted once before being restored. The gate ledger therefore lives in
`docs/gates/gate-19/`, and the commit stages only the files this gate owns. A future
gate should run in its own worktree rather than sharing this checkout.

## 7. Next action

**Backlog B-3: read-time authorization for retrieval.** Holding an index is still
sufficient to search it, and Gate 18's reader returns whatever the database holds.
Every remaining blocker to corpus readiness is legal — one counsel determination for
one source covering `downloading`, `temporary_processing`, `text_extraction` and
`search_indexing`, and one bounded sample — but B-3 is the last engineering gap on the
read path.

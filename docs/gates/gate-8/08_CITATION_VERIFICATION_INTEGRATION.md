# 08 — Citation Verification Integration (Contract Only)

**Date:** 2026-11-14
**Status:** **NOT IMPLEMENTED.** This document specifies the intended wiring; the
existing verifier has not been changed to consume the effects ledger. `11` and
`14` record this as the largest functional gap.

## 1. What exists

`packages/citation-engine` already implements four layers:

1. identity (document exists);
2. location (provision/chunk exists);
3. support (deterministic lexical proxy — explicitly **not** entailment);
4. temporal validity (reads the document's `effectivityDate` / `repealDate` and
   the provision's `legalStatus`).

Gate 8 added an authority projection (`projectAuthorityState`) that can answer
layer 4 from assertions, reviews and evidence. It is **not** connected to the
verifier in this gate.

## 2. Intended contract (not yet wired)

When integration is implemented, `verify()` would accept an injected projection
callback and layer 4 would call it for the resolved document and relevant date.

| Projection outcome                                       | Layer 4                                     |
| -------------------------------------------------------- | ------------------------------------------- |
| `DETERMINED_WITH_REVIEWED_EVIDENCE` and in force on date | pass                                        |
| any other outcome                                        | fail, with the outcome/explanation recorded |

The verifier's `CitationVerificationResult` would gain optional fields
(`authorityProjection`, `resolution`). **These fields do not exist today.**

## 3. Why it is not wired in this gate

- `citation-engine` is a standalone package; importing `legal-ingestion` would
  create a dependency cycle and expand the blast radius.
- The effects ledger has no real data; wiring it now would replace a working
  (if limited) temporal check with an always-`UNKNOWN` one.
- The correct integration belongs with Gate 9's passage-level retrieval, where
  the version and span are known.

## 4. Non-negotiable invariants for the future integration

1. Layers remain separate; passing identity does not imply support or authority.
2. A citation is never labelled "current" when layer 4 abstains.
3. A counsel storage permission never passes layer 4.
4. A hash match never passes layer 4.
5. Text similarity never upgrades support.
6. An unreviewed assertion never produces a temporal state.

## 5. Current limitation statement

Until integration is implemented, a citation verification result reflects only
the verifier's existing temporal fields. It does **not** reflect the effects
ledger, and the gate makes no claim that it does.

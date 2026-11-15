# 14 — Limitations

**Nothing here is closed by this gate.** Every item is a known boundary, stated so
that no reader mistakes the gate's verdict for a broader claim.

## 1. Authorization

1. **No activity cell is authorized.** All 350 cells remain `UNKNOWN`. Gate 13
   proves the mechanism refuses everything that is not authorized; the mechanism
   has never been exercised against a real decision.
2. **A caller can still assert a decision.** `authorizationAssertion` is accepted,
   scoped to one activity, and labelled `caller_asserted` with null registry
   identity. The library cannot verify a claim it was handed. A deployment that
   needs registry verification must construct the lookup with
   `documentActivityAuthorization`; nothing enforces that choice at runtime.
3. **The document → source mapping is injected and trusted.** `sourceOfDocument` is
   supplied by the caller. A wrong mapping yields a wrong (possibly authorized)
   answer that this layer cannot detect. `AuthorityDocumentView` still does not
   carry `source_id`.
4. **Five of fourteen activities have a runtime enforcement point**
   (`downloading`, `temporary_processing`, `persistent_storage`,
   `text_extraction`, `search_indexing`), plus `citation_display` added here. The
   other eight exist in the vocabulary and are refused, not enforced: a projection
   for `embedding_generation` is gated exactly like any other, which means it is
   denied unless a decision exists, not that embeddings work.
5. **`buildSearchIndex` still takes a caller-supplied `authorize` callback** that
   need not consult the registry (`legal-search/src/retrieve.ts:231`). An index can
   therefore be built on an assertion. Pre-existing, deliberately not rewritten.
6. **Two counsel activities have no enforceable path**
   (`temporary_local_storage`, `substantial_reproduction`). A determination about
   them cannot be turned into a projection decision, and no alias pretends
   otherwise.
7. **No authentication, tenancy or user entitlement.** The library has no notion of
   who is asking. Tenant isolation is specified, not implemented.

## 2. Verification and storage

8. **D1 is shim-validated only.** No remote D1 and no workerd run; the Gate 7
   binding-level limitation stands. The end-to-end tests use the SQLite shim.
9. **No migration was added**, because the activity matrix already stores what this
   gate needs. Nothing here has been exercised against a real D1 binding.
10. **`authorizationChecks` is not persisted.** Registry decision changes are
    durably audited; per-projection checks are in-memory and lost with the result.
11. **Idempotence and the D1 store remain as Gate 11 left them**: id-based, not
    concurrency-safe.

## 3. Legal substance

12. **No real Philippine legal document** was acquired, read, extracted, indexed or
    processed. Every fixture is synthetic.
13. **Zero counsel determinations.** No counsel record, determination or
    authorization cell was created or altered by this gate.
14. **No legal effect is asserted.** Authorization is not legal correctness, and a
    passed projection is not legal advice.
15. **Support verification is still a lexical proxy**, not entailment.

## 4. Process

16. **Two intermittent failures were observed once each** (`core.test.ts`
    calendar-date case; `gate13-contract.test.ts` memo-as-of case), both on the
    first run after a concurrent file write, both green in isolation and in every
    later run. Recorded, not explained; no cause established.
17. **The projection's validation order changed** (exactly-one input → activity →
    as-of) to match the documentation. It is a behaviour change for a request that
    is wrong in two ways at once: the reported code can differ from Gate 12's.
18. **Reviewer B called `projectUnchecked()` tautological.** It is retained
    deliberately: it is the regression net for the Gate 12 invariant that
    `NOT_CHECKED` never determines. It is not removed to satisfy a style
    preference.

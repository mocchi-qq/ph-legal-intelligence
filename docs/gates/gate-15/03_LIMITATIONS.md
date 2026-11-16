# 03 — Limitations

1. **Ingestion does not write the authority ledger.** The chain's final step is
   verified against a ledger seeded separately. Automatically deriving legal-effect
   assertions from an ingested artifact would be a design error — the claim that one
   instrument amended another is an analysis finding recorded by a person — so the
   separation is deliberate. What is missing is the _analysis_ step's own recorded
   contract and test, not an integration call.
2. **`artifact.synthetic === true` skips all four ingestion activity checks.** The
   `synthetic://` locator guard is a URL prefix, so a caller controlling the artifact
   can bypass by setting both. The audit records `authorizationDecisionRefs: []`
   alongside basis `SYNTHETIC_FIXTURE`, so a reader can see no check occurred, but
   the label alone does not distinguish "checked synthetic" from "exempt synthetic".
   Backlog card opened; not fixed here.
3. **`retrieve` performs no activity check.** The index enforces `search_indexing` at
   build time; a holder of the index can search everything in it, and
   `citation_display` is enforced only when a citation is verified afterwards. A
   read-time gate needs an identity model — who is asking, for whom — that this
   library does not have.
4. **The missing-input refusal is split across two layers.** `createAuthorityStatusLookup`
   throws at construction, so the machine-readable `AUTHORIZATION_INPUT_MISSING`
   abstention is only reachable by calling the projection directly. Both are
   fail-closed.
5. **Acquisition is the manifest gate, not a transport.** The rehearsal does not
   exercise a network fetch, by design; the transport path is covered by its own
   guard tests.
6. **D1 remains the SQLite shim.** No remote D1, no workerd run.
7. **Nothing here is evidence of legal correctness.** Every identifier is fictional;
   the reviewed effect is synthetic; 0 counsel determinations exist and all 350
   authorization cells remain `UNKNOWN`.
8. **This rehearsal is not a corpus-readiness package.** It would additionally need
   an analysis-step contract, a read-time authorization design, closure of the
   synthetic bypass, a real D1 contract test and an audit-trail check.

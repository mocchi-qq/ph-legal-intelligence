# 04 — Limitations

1. **Read time is ungated.** `retrieve` does not consult authorization. An index
   enforces `search_indexing` when it is built and nothing when it is searched, so a
   caller holding an index can read every entry in it. A read-time gate needs an
   identity model — who is asking, on whose behalf — which this library does not
   have. Stated on `SearchIndex` and `buildSearchIndex` themselves, not only here.
2. **A resolver is trusted to answer truthfully.** The library now verifies that an
   answer names the document and activity it was asked about; it cannot verify that
   the registry or comparison behind that answer is correct.
3. **No authorization cell is authorized.** All 350 remain `UNKNOWN`. Every gate in
   this sequence has proved refusal; none has proved permission, because no counsel
   determination exists.
4. **Eight of fourteen activities have no runtime enforcement point.** Indexing
   (`search_indexing`) and verification (`citation_display`) are now gated; the
   remaining eight exist in the vocabulary and are refused, not enforced.
5. **A document with no chunks is not evaluated** and therefore never appears in
   `excludedDocuments`. It cannot enter the index either, so the omission changes
   nothing observable — but it means "every document" in the report is literally
   "every document with content".
6. **`allowSyntheticIndex` bypasses the registry** in benchmark and retrieval tests
   by design; the registry path is covered by the Gate 14 tests instead.
7. **`authorizeIndexing` checks three activities**, so a caller wrapping it as an
   index authorization makes three registry calls per document. Intentional — an
   index implies processing and extraction — and now documented.
8. **D1 remains shim-validated**; no remote D1 or workerd run.
9. **No real corpus, no counsel record, no deployment.** Four pilot documents remain
   `BLOCKED_AUTHORIZATION`.

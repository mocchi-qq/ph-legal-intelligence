# 04 — Ingestion Registry Integration

**Question:** does authority projection now use the same activity registry the
ingestion pipeline uses?

**Answer:** yes, through one adapter and no second list.

## 1. One source of truth

| Concern                    | Owner                                  | Used by projection                                     |
| -------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Activity vocabulary (14)   | `ACTIVITIES` in `authorization.ts`     | imported, validated by `isCanonicalActivity`           |
| Activity status vocabulary | `ActivityStatus` in `authorization.ts` | passed through into `DocumentActivityDecision.status`  |
| Decisions                  | `ActivityAuthorizationRegistry`        | `registry.check(sourceId, activity, options)`          |
| Conditions, expiry, basis  | registry `check`                       | `now`, `satisfiedConditions`, `allowedBases` forwarded |
| Policy mapping             | none new                               | projection requires one activity per request           |

The projection holds no activity list of its own. `isCanonicalActivity` is a
membership test over the imported constant, so adding a fifteenth activity to
`ACTIVITIES` automatically becomes acceptable at the projection boundary; it does
**not** automatically become enforced anywhere, because enforcement is a call site,
not a vocabulary entry.

## 2. Document → source resolution

The registry keys decisions by `sourceId`; the projection keys by `documentId`.
`createRegistryAuthorization` takes `sourceOfDocument`, an injected function:

```ts
createRegistryAuthorization({
  registry,
  sourceOfDocument: (documentId) => sourceIdOrNull,
  now,
  satisfiedConditions,
  allowedBases,
});
```

- Ingested state already carries the mapping (`legal_documents.source_id`, and
  `CorpusState` documents know their source), so the function is a lookup, not an
  inference.
- If it returns `null` the decision is `NOT_CHECKED` /
  `no_source_for_document`. A document whose provenance is unknown is never
  authorized by default.
- If it throws, the decision is `NOT_CHECKED` / `source_lookup_failed`.

The mapping being injected rather than derived inside the module is deliberate:
`AuthorityDocumentView` (`authority-ledger.ts:9`) has `id`, `documentType`,
`title` and no source, and Gate 13 does not change the ledger's shape. When a
snapshot loader can supply `source_id`, the same adapter works without change.

## 3. Activity symmetry with ingestion

| Path                           | Activity                                                                           | Mechanism                                  |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `acquisition.ts`               | `downloading`                                                                      | `registry.check(sourceId, "downloading")`  |
| `pipeline.ts`                  | `temporary_processing`, `persistent_storage`, `text_extraction`, `search_indexing` | `REQUIRED_INGEST_ACTIVITIES`, each checked |
| authority projection (Gate 13) | caller-supplied, `citation_display` in every verification path                     | `documentActivityAuthorization` adapter    |

Same registry, same status vocabulary, same expiry and condition handling. There is
no projection-specific copy of any of it.

## 4. What is deliberately unchanged

`buildSearchIndex` still accepts an arbitrary `authorize` callback returning
`{ allowed }` (`legal-search/src/retrieve.ts:231`). That callback is not required
to consult the registry, so a caller can build an index on its own assertion. This
is a pre-existing gate with weaker semantics than the pipeline's; Gate 13 does not
rewrite it, and the limitation is recorded in `14_LIMITATIONS.md` rather than
papered over. Wiring it to the registry is a candidate for the next gate, and it is
not needed for the authority projection to be activity-correct.

## 5. Validation boundary

The adapter validates:

- the document id is a non-empty string;
- the activity is one of the 14;
- the role is one of the three.

It does not validate that the registry itself is populated correctly, that the
source mapping is truthful, or that the counsel basis behind a decision is genuine.
Those are the registry's and counsel's responsibilities respectively; this gate
verifies that the projection asks the right question and fails closed when it
cannot get an answer.

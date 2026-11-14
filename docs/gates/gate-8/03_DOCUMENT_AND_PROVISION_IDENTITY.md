# 03 — Document and Provision Identity

**Date:** 2026-11-14
**Status:** design + synthetic implementation.

## 1. Identity layers

```
Source artifact (bytes, URL, hash)
        │  may map to
        ▼
Document identity (logical instrument)
        │  has
        ▼
Document version (immutable text)
        │  contains
        ▼
Provision version (text at a structural location)
        │  may map to
        ▼
Provision identity (logical provision across versions)
```

A hash identifies bytes. A URL identifies a location. Neither identifies a legal
instrument. A version identifies text at a time. A provision identity is a claim of
continuity, which is why it needs a mapping record.

## 2. Document identity rules (existing model, preserved)

`LegalDocument.id` is the stable internal key. `identityKey` is the exact
kind+number key used for deduplication. Existing parsing covers RA, EO, PD, AO,
MC, G.R. and A.M. numbers. Gate 8 does not replace this.

Added rules:

1. **Aliases are explicit.** Titles, short titles and citation variants are stored
   as aliases, not used to merge documents by similarity.
2. **Mirrors do not create instruments.** Two source artifacts with the same
   identity key map to one document; two different keys never merge silently.
3. **Ambiguity abstains.** If two documents share an identifier, resolution
   returns `MULTIPLE_CANDIDATES`, not a best guess.
4. **Conflicts are recorded.** A conflicting identity key or issuing body is an
   auditable record, not an overwrite.
5. **No vector similarity.** Embedding similarity may assist a human reviewer; it
   never establishes identity.

## 3. Provision identity model

`ProvisionIdentity` = logical provision of one document (e.g. "s.2").
`ProvisionVersionMapping` = the edge to a version-specific `LegalProvision`,
with one of:

| Mapping      | Meaning                                                | Example                       |
| ------------ | ------------------------------------------------------ | ----------------------------- |
| `SAME`       | continuity asserted, same text or editorial correction | s.2 in v1 and v2              |
| `RENUMBERED` | continuity asserted, label changed                     | s.2 → s.3                     |
| `SPLIT`      | one provision becomes two                              | s.4 → s.4(a), s.4(b)          |
| `MERGED`     | two become one                                         | s.5 + s.6 → s.5               |
| `DELETED`    | provision removed, no successor                        | s.7 removed                   |
| `NEW`        | provision inserted, no predecessor                     | s.7A                          |
| `UNCERTAIN`  | possible continuity, not reviewed                      | renumbering with changed text |
| `NONE`       | no relationship established                            | unrelated sections            |

Only `SAME`, `RENUMBERED`, `SPLIT`, `MERGED`, `DELETED` and `NEW` may be marked
`REVIEWED`, and only with a rationale and reviewer record. `UNCERTAIN` is the
default when evidence is insufficient.

## 4. What is never inferred

- Same section number ≠ same provision.
- Same text ≠ same legal identity (a re-enacted provision can be a new one).
- Different text ≠ wholly new provision (an amendment preserves identity).
- A heading change ≠ renumbering.
- A court's reference to "section 2" ≠ the section in the version the court meant.

## 5. Resolution outputs

Document and provision resolution returns a status, not just a match:

`EXACT`, `ALIAS`, `MULTIPLE_CANDIDATES`, `PARTIAL`, `NO_MATCH`, `INVALID_FORMAT`,
`UNSUPPORTED_TYPE`, `UNCERTAIN`.

Each result preserves the original citation text, normalized form, matched IDs,
and resolution provenance.

## 6. Synthetic fixture coverage

The fixture set must exercise: stable identity across two versions; two artifacts
for one instrument; ambiguous identity; renumbering; split; merge; deletion; new
insertion; uncertain mapping; and a `NONE` relationship. All identifiers are
fictional (`SYNTH-*`) and carry a non-authoritative notice.

## 7. Acceptance

- An exact key resolves to one document; a duplicate key returns
  `MULTIPLE_CANDIDATES`.
- A mirror artifact does not create a second document.
- A renumbered provision resolves only through a reviewed mapping.
- An unreviewed mapping cannot be used to assert amendment continuity.
- No identity decision is made by text or vector similarity.

# 12 — Security and Integrity Review

**Date:** 2026-11-14
**Status:** threat model and control design; results are recorded in `11` and
`13`, not assumed here.

## 1. Threat model (synthetic scope)

| #   | Threat                                   | Control                                                                                        | Negative test            |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| S1  | Unauthorized processing of a source      | Projection takes an authorization check; denial → `UNAUTHORIZED`; ledger never bypasses Gate 4 | F-AU-01                  |
| S2  | Cross-document effect confusion          | Explicit source/target document IDs + FKs; no title matching                                   | wrong-target fixture     |
| S3  | Cross-version citation confusion         | Version ID on evidence and mappings; resolution returns version                                | version-mismatch fixture |
| S4  | Incorrect provision merge                | Mapping type must be explicit; `UNCERTAIN` default; no similarity merge                        | F-PR-07/09               |
| S5  | Unreviewed effect projected as confirmed | Projection requires active review + available evidence                                         | F-EF-01                  |
| S6  | Missing evidence treated as valid        | `UNAVAILABLE`/`NOT_RECEIVED` → `INSUFFICIENT_EVIDENCE`                                         | F-EF-10/11               |
| S7  | Conflicting assertions silently resolved | Conflict outcome; all IDs returned                                                             | F-EF-07                  |
| S8  | Inconsistent date arithmetic             | Shared ISO date parser; boundary tests; no local timezone                                      | F-VT-01/04               |
| S9  | Mutable history                          | Append-only triggers on 0009 tables; no update/delete                                          | trigger tests            |
| S10 | Audit tampering                          | Triggers + append-only reviews; no mutation API                                                | trigger tests            |
| S11 | Duplicate assertions/reviews             | PK + service duplicate checks                                                                  | F-EF-16                  |
| S12 | Replay/idempotency                       | Deterministic IDs in fixtures; duplicate rejection; no side effects in projection              | duplicate tests          |
| S13 | Broken FKs                               | FK enforcement in shim/migration; negative insert tests                                        | FK tests                 |
| S14 | Unbounded traversal                      | Query APIs bound by target + date; no recursive graph walk                                     | large fixture            |
| S15 | Unauthorized metadata exposure           | Projection returns IDs/explanations only; no passage text unless already authorized            | authorization test       |
| S16 | Review used to grant reuse               | Separate types/tables; no authorization columns; docs + tests                                  | type/API assertion       |
| S17 | Authorization used as legal review       | Projection ignores `AuthorizationDecisionRef` except for the authorization gate                | F-AU-01                  |

## 2. Fail-closed rules

- Any unknown required input → `UNKNOWN`/`INSUFFICIENT_EVIDENCE`, never a default.
- Any conflicting reviewed outcome → `CONFLICTED`.
- Any authorization denial → `UNAUTHORIZED`.
- Any evidence unavailability → `INSUFFICIENT_EVIDENCE`.
- Any missing mapping → `MAPPING_UNCERTAIN`, not merged text.

## 3. Audit

Security-relevant records: assertion creation, review creation, review
supersession/revocation, provision mapping, citation resolution, projection
outcome (optional).

The ledger is append-only. The D1 audit pattern from Gate 7 (commit marker for
multi-record writes) is reused if a multi-record write is introduced; otherwise
each record is a single insert.

## 4. What this gate does not secure

- Real corpus access (no real corpus exists here).
- Production authentication/tenancy (not in scope).
- Reuse/display rights (Plane A; unchanged).
- Model/AI security (no model in this gate).
- Remote D1 binding-level behaviour (Gate 7 limitation remains).

## 5. Review requirement

Reviewer B must verify the actual schema and code, not this document. Reviewer A
must verify that no type or projection path turns an assertion into a legal
conclusion. Reviewer C must verify citation resolution cannot silently promote
ambiguity.

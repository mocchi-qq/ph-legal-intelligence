# 08 — Content Provenance and Operations

**Research date:** 2026-11-14

## 1. Five artefacts that must never be conflated

| Artefact                 | Example                                          | Authority                                    | Reuse                                             |
| ------------------------ | ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| Original source document | SC E-Library decision page; Official Gazette PDF | official primary (subject to verification)   | governed by source terms; `UNKNOWN` until cleared |
| Publisher reproduction   | Westlaw's copy of a statute                      | reproduction of primary law                  | licensed                                          |
| Consolidated version     | legislation.gov.uk revised text                  | official consolidation, explicitly "revised" | OGL with exceptions                               |
| Editorial annotation     | headnotes, KeyCite flags, Practical Law notes    | publisher opinion                            | licensed, copyrighted                             |
| AI summary/answer        | CoCounsel/Vincent/Anycase output                 | machine-generated, unverified unless checked | platform terms                                    |

The project's Gate 1 model already separates source manifestation, document
version and extracted text. This research adds a required **authority class** on
every stored artefact, so an AI summary can never be retrieved as if it were
primary law.

## 2. Content operations observed

| Operation               | Best-documented example                                   | What is public                              | What is not                   |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------- | ----------------------------- |
| Acquisition             | CourtListener (bulk/APIs), EUR-Lex (OJ)                   | source and update cadence                   | partner contracts             |
| Canonical identity      | legislation.gov.uk `IdURI` per Act/section                | stable URIs                                 | internal registry             |
| Versioning              | legislation.gov.uk dated versions                         | full version list                           | editorial workflow            |
| Amendment linking       | legislation.gov.uk effects                                | affected/affecting provisions, commencement | how conflicts are adjudicated |
| Duplicate handling      | not publicly documented anywhere                          | —                                           | `U`                           |
| Metadata extraction     | partially via APIs                                        | field names                                 | pipeline                      |
| OCR                     | not publicly documented                                   | —                                           | `U`                           |
| QA / editorial review   | Practical Law (650+ editors), KeyCite/Shepard's           | headcount claims                            | process                       |
| Correction / withdrawal | legislation.gov.uk unapplied effects; version replacement | visible                                     | policy                        |
| Provenance exposure     | CourtListener source links; legislation.gov.uk IDs        | strong                                      | publisher platforms: partial  |
| Licensing               | OGL (UK), EU reuse decision, CourtListener terms          | public                                      | publisher contracts           |

## 3. Stable identifiers

- **legislation.gov.uk**: `IdURI` and per-section URIs, with dated version URIs
  (`/ukpga/2010/15/2026-10-30`). This is the strongest public example of a
  citation-stable legal identifier scheme (S08).
- **EUR-Lex**: ELI (European Legislation Identifier) is the analogous EU scheme;
  the ELI pages were not accessible in this pass, so implementation details are
  `U` (S15).
- **CourtListener**: stable opinion URLs and API IDs, plus a citation lookup
  service (S07).
- **Philippines**: no stable public provision identifier was observed on the
  E-Library; citations are textual (G.R. No., RA No., section numbers).

**Implication.** The project must mint its own stable provision IDs, while
preserving the official textual citation as the user-facing key. A citation
parser plus a canonical internal ID is the minimum.

## 4. Corrections and changed sources

The project already assumes sources can change. The international pattern is:

1. never overwrite the prior record;
2. add a new version with a reason and a timestamp;
3. keep the old version retrievable;
4. surface the change to users who cited it.

legislation.gov.uk does this with version replacement chains and effects;
CourtListener keeps the original opinion and adds subsequent history. Neither
silently rewrites. This matches the project's append-only audit design.

## 5. Withdrawal and takedown

No platform publicly documents a general takedown process in the pages reviewed.
The project must define one because:

- a source may revoke permission;
- a document may be sealed or corrected;
- a court may withdraw a decision.

The safe design is: stop serving the content, retain the audit record and the
hash, and mark dependent citations as `SOURCE_WITHDRAWN`. Do not delete history
silently. This is an engineering policy to be reviewed by counsel.

## 6. What not to copy

- **Do not copy acquisition practices.** A competitor's ability to scrape or
  license a source says nothing about the project's rights. The authorization
  matrix governs.
- **Do not copy consolidation without the effects layer.** A clean "current"
  text with no effects is less honest than legislation.gov.uk.
- **Do not copy editorial annotations as data.** Headnotes and citator flags are
  copyrighted editorial work.
- **Do not treat a free portal as a reuse licence.** LawPhil's own AUP disclaims
  accuracy and does not grant reuse (S12); the E-Library displays no reuse terms
  (S10).

## 7. Provenance the product should expose per document

- source institution and URL;
- retrieval timestamp and HTTP status;
- content hash of the bytes actually received;
- authority class (official primary / reproduction / consolidation / annotation /
  AI summary);
- version and effective dates;
- extraction method and version;
- review status and reviewer (when editorial);
- known gaps (missing pages, OCR confidence, unapplied effects).

This is more provenance than most publishers expose. It is cheap to store and it
is the basis of defensible citations.

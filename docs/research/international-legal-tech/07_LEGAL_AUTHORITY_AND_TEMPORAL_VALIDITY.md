# 07 — Legal Authority and Temporal Validity

**Research date:** 2026-11-14

## 1. The core problem

A document can be **authentic** and **no longer represent the law in force**.
Legal research tools fail in two opposite ways:

- showing an old version as if current;
- showing a consolidated text as if it were the enacted text.

The international evidence shows that the mature answer is not "the current
version" — it is **version + effects + provenance**, exposed together.

## 2. Six dates that must never be conflated

| Date                 | Question it answers                    | Where it comes from                          |
| -------------------- | -------------------------------------- | -------------------------------------------- |
| Publication date     | When was the text made public?         | Official Gazette / journal                   |
| Enactment date       | When was the instrument made?          | The instrument itself                        |
| Effectivity date     | When did it start having legal force?  | The instrument, or a commencement instrument |
| Amendment date       | When was this text changed?            | Amending instrument / effects record         |
| Retrieval date       | When did the platform fetch it?        | Platform log                                 |
| Database update date | When did the platform's record change? | Platform metadata                            |

A product that collapses these into one "last updated" field is already
misleading. The project's Gate 1 schema separates document, version, identity and
ingestion run; this research supports keeping that separation and exposing it.

## 3. How platforms represent authority state

| Mechanism                     | Best example              | What it actually proves                                      | What it does not                             |
| ----------------------------- | ------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Point-in-time version         | legislation.gov.uk (S08)  | the text as revised at a stated date                         | that the text was in force for every purpose |
| Version comparison            | Westlaw (S01)             | what changed between two versions                            | why it changed                               |
| Effects metadata              | legislation.gov.uk (S08)  | which instrument affected which provision, with commencement | that the effect is legally correct           |
| Unapplied/prospective effects | legislation.gov.uk (S08)  | the service knows it has not applied something               | that the user will notice                    |
| Status buckets                | Singapore SSO (S14)       | current / repealed-spent / uncommenced                       | amendment history within "current"           |
| Citator treatment             | Westlaw, Lexis (S01, S02) | editorial judgement on subsequent treatment                  | correctness of the judgement                 |
| Citation graph                | CourtListener (S07)       | who cited whom                                               | whether the citation is positive or negative |
| "Last updated"                | most platforms            | when the record changed                                      | legal effectivity                            |

### The most important verified fact in this dossier

The UK's official revised statute database, on the Equality Act 2010, contains
effects such as:

- an amendment **not applied to legislation.gov.uk**, with a note explaining the
  affecting instrument was revoked;
- a repeal that "comes into force at the end of 2030 unless an order under
  s. 105(2) specifies a later time";
- prospective effects and savings with commencement authorities.

(S08; the specific effects were observed in the Equality Act 2010 XML on
2026-11-14, beyond the generic fields listed in the register entry.)

So even a government-run consolidated text distinguishes **text as revised** from
**effects as recorded**, and admits when it has not applied an effect. A private
platform that shows a clean "current" label without this layer is less honest
than the official UK service.

## 4. Status vocabulary the product needs

At minimum, and as separate fields rather than one enum:

- `instrument_status`: enacted / amended / partially amended / repealed /
  partially repealed / spent / suspended / invalidated / reinstated;
- `version_status`: as-enacted / as-amended (dated) / consolidated / draft;
- `effect_status`: applied / unapplied / prospective / commenced / not commenced;
- `authority_status`: official primary / official secondary / publisher
  reproduction / editorial annotation / AI summary;
- `verification_status`: unverified / identity-verified / text-verified /
  support-verified / temporal-verified.

`implied repeal` and `judicial invalidation` cannot be derived from text alone.
They require a legal determination and must be recorded editorially, with a
source and a reviewer, or shown as `UNKNOWN`.

## 5. What the Philippine platform can adopt

| Pattern                                             | Adopt?              | Notes                                                                |
| --------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| Point-in-time versions per provision                | Yes                 | Requires versioned text + effective dates; Gate 1 schema supports it |
| Effects ledger (amendment/repeal edges)             | Yes                 | Already modelled as relationship types; needs commencement metadata  |
| Explicit `unapplied` / `prospective` states         | Yes                 | Cheap honesty; prevents overclaiming                                 |
| Status buckets (`current`/`repealed`/`uncommenced`) | Yes                 | Singapore's model maps well to PH statutes                           |
| Stable provision identifiers                        | Yes                 | Needed for citations and diffs                                       |
| Editorial treatment labels                          | Only with reviewers | Do not automate "overruled"                                          |
| Consolidated text labelled as consolidation         | Yes, if labelled    | Never present as the enacted text                                    |

## 6. What requires independent Philippine legal validation

These are legal questions, not engineering questions. They must go to counsel and
must not be inferred from foreign systems:

1. Which publication event starts effectivity for each instrument type.
2. How to treat instruments published only in print or only on a website.
3. How to represent partial invalidation by the Supreme Court.
4. How to treat implied repeal and inconsistent later statutes.
5. How to represent suspension, reinstatement and transitional provisions.
6. Whether a "consolidated" text has any official status.
7. How to cite a provision that has been renumbered.

Until counsel answers, the product must expose these as `UNKNOWN` / `REVIEW
REQUIRED`, not guess. This is exactly the discipline Gates 4–7 already enforce
for authorization; it applies equally to legal status.

## 7. Temporal query semantics

The product should answer, and distinguish:

- "What did the text say on date D?" (version as-of D)
- "What was in force on date D?" (effectivity + amendments + repeals)
- "What is the current consolidated text?" (with consolidation label)
- "What changed between D1 and D2?" (diff, with amending instruments)
- "Which decisions applied the version in force on D?" (citation + temporal join)

A single `current_text` field cannot answer any of these correctly.

## 8. Verdict on competitor claims

No platform's "current" label is legally authoritative by itself. Westlaw/Lexis
add editorial judgement; legislation.gov.uk adds effects metadata and admits
unapplied effects; SSO separates status buckets. The Philippine product should
copy the **structure of the disclosure**, not any platform's conclusion about
what the law is.

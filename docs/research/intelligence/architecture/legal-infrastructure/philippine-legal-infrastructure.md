# A — Philippine Legal Information Infrastructure

**Domain:** A (Philippine legal information infrastructure)
**Research date:** 2026-11-18
**Status:** synthesized
**Source register:** `docs/research/intelligence/source-register.md` (PH-01, PH-02, IT-01; plus S10–S14 from the international dossier)

## 1. What exists (verified)

| Resource | Operator | What it provides | Verified limitations |
|----------|----------|------------------|----------------------|
| Supreme Court E-Library | Supreme Court of the Philippines Library Services | SC decisions 1996–2026, Philippine Reports e-books, Republic Acts, Presidential Decrees, Executive Orders, Administrative Orders, Memorandum Circulars/Orders, Rules of Court, constitutions, treaties, National Administrative Register | **No citator or API observed** (checked 2026-11-18). Monthly index has missing/unlinked months — e.g. 2026 May, Sep–Nov appear as plain text without links; 2024 Mar; 2023 May/Aug/Sep; 2022 May; 2021 May; 2020 May; 2019 May; 2018 May; 2017 May; 2016 May; 2015 May; 2014 May; 2013 May; 2012 May. No consolidated statute versions with amendment/repeal edges. No public reuse licence displayed. NPC registration certificate displayed on site. |
| Official Gazette | Office of the President (PCO) | Official journal: RAs, EOs, proclamations, AOs, MCs/MOs, master list, constitutions | **HTTP 403 on homepage** at 2026-11-18 (access blocked). Publication-oriented, not a research system; no citation graph or versioning observed previously. Public-domain statement noted earlier. |
| LawPhil | Arellano Law Foundation | Secondary compilation of Philippine jurisprudence and statutes | Explicit accuracy disclaimer ("informational only; verify independently; no legal advice"). **No citator or API.** Grants no reuse licence. AsianLII mirror noted. |
| Supreme Court (main) | SC Judiciary | SC decisions with G.R. numbers and promulgation dates; court locator | Live; decisions page observed. |
| Anycase.ai | Anycase Technologies Inc. | PH legal AI research/workspace; claims "verified Philippine legal authorities and full-text sources"; drafting; IPOPHL and COA issuances added Sept 2026; NPC-registered (per its help centre) | **Vendor claims only.** 14,000+ users and "14 hours saved" are unverified company claims. Corpus count historically inconsistent (140k vs 160k). **No citator.** |
| BatasDB | BatasDB | AI-powered Philippine legal research ("asks a question, AI answers from the library", citations shown) | Vendor claims; no independent evaluation found. |
| Digest AI | (Philippine legal AI) | Mentioned in Oxford Tech & Justice piece alongside Anycase as tools in use in the PH | Vendor/secondary; no detail verified. |

## 2. Verified structural gaps (Philippine)

1. **No public citator.** No Philippine service was found that records positive/negative treatment of jurisprudence at scale. Anycase, BatasDB, and Digest AI do not claim a citator.
2. **No stable provision identifiers or public API.** Neither the E-Library nor the Gazette exposes one (observed). The E-Library offers individual case citation but no stable provision-level ID scheme.
3. **No consolidated statute book with effects.** Statutes are published, not maintained as versioned texts with amendment/repear/commencement edges.
4. **Incomplete and uneven digitisation is visible.** The E-Library monthly index omits/unlinks multiple months across years (May recurs across many years; 2026 May, Sep–Nov as of 2026-11-18).
5. **Free does not mean reusable.** LawPhil disclaims accuracy and grants no reuse; the E-Library displays no reuse terms; the Gazette was inaccessible (403) at last check. Public availability is not permission.
6. **No verified Philippine retrieval/evaluation benchmark.** No public recall/precision figures for any PH platform.

## 3. What this means for the project

- The underserved local job (from the existing dossier): "Show me the authority, in the version that applied, with the passage that supports the proposition, and tell me what you could not verify." No Philippine product does this.
- The project's existing Gates 1–7 infrastructure (identity, versioning, citation verification, authorization, audit) maps directly onto the verified PH gaps.
- Because no PH source displays a reuse licence and counsel determinations are 0, **no real PH legal text may enter the pipeline**. All work on PH material remains on synthetic fixtures until a counsel determination exists.

## 4. Evidence quality

- SC E-Library monthly-index gaps: VERIFIED FACT (direct observation of the live page, 2026-11-18).
- Official Gazette 403: VERIFIED FACT (access failure recorded).
- No citator/API: VERIFIED as absence-of-observation on the pages checked; absence of evidence is not proof of absence (recorded as observed gap, not proof).
- Anycase/BatasDB/Digest AI claims: COMPANY CLAIM / VENDOR; not independently corroborated.

## 5. Open questions

- Does any Philippine official source offer a machine-readable data licence or API? (Owner + counsel.)
- What are the effectivity/publication rules per instrument type? (Counsel.)
- What is OCR quality on the oldest scanned Philippine decisions? (Engineering; not sampled.)
- Is the E-Library's missing-month pattern a display bug or a genuine gap? (Unresolved; direct observation only.)

# 14 — Commercial Models

**Research date:** 2026-11-14
**Rule:** only publicly verified prices are stated. Everything else is
`UNDISCLOSED`. No revenue projection or market-size figure is invented.

## 1. Verified public pricing

| Product    | Model     | Public price (verified 2026-11-14)             | Source |
| ---------- | --------- | ---------------------------------------------- | ------ |
| Anycase.ai | Free tier | ₱0, 15 credits                                 | S13    |
| Anycase.ai | Pro       | from ₱999/month, or ₱799/month billed yearly   | S13    |
| Anycase.ai | Education | ₱599/month, or ₱499/month billed yearly (.edu) | S13    |

That is the **only** Philippine legal-research price verified in this research.

## 2. Undisclosed pricing

| Product             | Model                               | Price                                                          |
| ------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Westlaw             | subscription / plan tiers           | `UNDISCLOSED` (plan pages exist; figures not re-verified here) |
| Lexis+ with Protégé | custom quote                        | `UNDISCLOSED` (S02)                                            |
| Vincent by Clio     | quote / trial                       | `UNDISCLOSED` (S03)                                            |
| Bloomberg Law       | flat "one platform, one price"      | `UNDISCLOSED` (S04)                                            |
| Harvey              | enterprise                          | `UNDISCLOSED` (S05)                                            |
| CoCounsel Legal     | plans                               | `UNDISCLOSED` (S06)                                            |
| CourtListener       | free + membership + commercial data | membership/commercial terms `UNDISCLOSED`                      |
| legislation.gov.uk  | free (OGL)                          | £0                                                             |
| SSO                 | free                                | S$0                                                            |

The repository's earlier competitor note contained specific USD figures for
Westlaw/Lexis/vLex. Those were **not** re-verified in this pass and must not be
treated as current. This dossier deliberately omits them.

## 3. Model comparison

| Model                     | Used by                         | Fits PH?         | Notes                                               |
| ------------------------- | ------------------------------- | ---------------- | --------------------------------------------------- |
| Individual subscription   | Anycase, publishers             | Yes              | Price-sensitive; Anycase anchors ~₱1k/month         |
| Student/education         | Anycase, publishers             | Yes              | Requires .edu verification; low ARPU, good adoption |
| Firm licensing (per seat) | publishers                      | Yes, small firms | Seat minimums are a barrier                         |
| Enterprise contract       | Harvey, publishers              | Limited          | Few PH buyers at enterprise scale                   |
| Institutional/university  | publishers, CanLII-style        | Yes              | Libraries, law schools, government                  |
| Usage-based AI credits    | Anycase (credits)               | Yes              | Aligns cost with inference; can punish research     |
| Free public search        | official portals, CourtListener | Yes              | Commodity; not a revenue line                       |
| Freemium                  | Anycase                         | Yes              | 15 credits is a trial, not a business               |
| API licensing             | CourtListener, publishers       | Later            | Requires stable verifier + terms                    |
| Analytics add-on          | Bloomberg/vLex                  | Defer            | Privacy/ethics risk in PH                           |

## 4. Hypothetical PH model — pending R0 interviews (not a decision)

**Hypothesis, not forecast.** The tiers below are a starting design for R0
interviews; none is decided.

1. **Free public layer:** search + official text + provenance. Builds trust and
   SEO; does not cannibalise the paid value.
2. **Professional subscription:** verification workspace — as-of queries, effects,
   passage-level citations, alerts. Priced near the local anchor (Anycase ~₱999/mo)
   but justified by verification, not chat volume.
3. **Institutional licence:** law schools, government legal offices, firms —
   seats + API/report access.
4. **Verification API (later):** metered, with strict terms; no bulk
   redistribution.

**Do not** charge per AI query for core research. It discourages the careful,
citation-heavy behaviour the product is selling.

## 5. Cost drivers (qualitative)

| Driver                           | Why it matters                                                  |
| -------------------------------- | --------------------------------------------------------------- |
| Source acquisition/authorization | legal review per source; highest fixed cost                     |
| Editorial review                 | treatment labels and effectivity decisions need named reviewers |
| Ingestion/OCR                    | older/scanned documents are expensive                           |
| Inference                        | AI answers; variable, can be capped                             |
| Evaluation                       | citation benchmarks must be maintained                          |
| Support                          | legal users need responsiveness                                 |
| Liability cover                  | editorial/treatment claims increase exposure                    |

## 6. Willingness to pay (hypotheses to test)

- Small-firm litigators may pay for **citator/verification** more than for chat.
- Students will pay only a low price; institutions will pay for seats.
- Government may pay for **provenance/audit**, not for AI.
- Firms may pay for **API/report** if it reduces citation-checking time.

None of these is verified. They require interviews and a pricing test before any
public commitment.

## 7. What the evidence forbids

- Quoting competitor prices as current without re-verification.
- Claiming a market size without a source.
- Projecting revenue from Anycase's claimed user count.
- Assuming free official portals make paid research impossible (CourtListener and
  CanLII show free access coexists with paid services).

## 8. Commercial conclusion

The only verified local price anchor is ~₱1,000/month for AI research. A
verification-first product can sit at or above that anchor only if it demonstrably
reduces citation risk. That is a product claim to be tested, not assumed.

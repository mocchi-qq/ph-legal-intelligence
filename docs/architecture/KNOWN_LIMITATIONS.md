# Known Limitations — Philippine Legal Intelligence Platform

Research gaps documented from dossier Section 22. Each gap has a status field indicating current state of resolution.

| Research Gap | Status | Notes |
|---|---|---|
| **E-Library bulk acquisition** | In Progress | Bulk dataset licensing negotiations ongoing with Commission on Higher Education. No public API available; screen-scraping prototype in development. Coverage: 2020-present statutes and court decisions. Priority: High (foundational legal corpus). |
| **LawPhil bulk acquisition** | In Progress | LawPhil Project (lawphil.net) content available via permissioned access. Bulk download API not public; individual case PDF retrieval operational. Coverage: 1901-present. Priority: High. |
| **Official Gazette coverage** | Partial | Official Gazette (gov.ph) coverage limited to published presidential issuances. Not all agency issuances are gazetted. Coverage: ~60% of expected administrative law materials. Priority: Medium (supplemented by agency source connectors). |
| **Agency source connectors** | Planned | No connectors built yet for key agencies (DepEd, DOH, DPWH, DOJ). Requires API access or file imports. Prioritized by practice-area demand. Priority: Medium-term. |
| **Local ordinance coverage** | Limited | Selected city/municipal ordinances available via local government websites. No standardized schema across PH localities. Coverage: <15% of jurisdictions. Priority: Medium (data normalization required). |
| **Historical law versions** | Not Started | No infrastructure for tracking law version history, amendments, or repeal chains. Requires schema extension to `LegalStatus` and temporal model. Priority: Medium (supports good law analysis). |
| **Case treatment data** | Not Started | No data on whether cases are "good law", "overruled", "distinguished", or "followed". Requires integration with treatment metadata from citators (Shepardization equivalent). Priority: High (critical for legal research accuracy). |
| **Multilingual retrieval** | Not Started | Filipino (Tagalog) and English retrieval not balanced. Existing search optimized for English query patterns. Priority: Medium (supports broader access). |
| **AI model selection** | In Progress | Model gateway interfaces defined (packages/model-gateway). Provider-specific routing not yet implemented for all desired models (OpenAI, Anthropic, local PH-optimized models). Priority: Medium. |
| **OCR quality** | Not Started | No OCR pipeline for scanned Philippine legal documents. Would require integration with Tesseract or commercial OCR, with validation against born-digital texts. Priority: Low (depends on scanned document acquisition). |
| **Cloudflare cost** | Watching | Vectorize, Queues, and R2 usage monitoring in progress. Cost model not yet finalized for production scale. Priority: Medium (affects deployment feasibility). |
| **Legal service boundaries** | Not Started | No explicit model for delineating legal advice vs. legal information. Requires policy documentation and UI/UX guardrails. Priority: High (compliance & ethics). |
| **Privacy implementation** | Not Started | No data minimization, consent, or retention policy implemented for user data. Requires privacy-by-design review across all data flows. Priority: High (legal requirement). |
| **Copyright/licensing** | Not Started | Bulk acquisition copyright status unclear for many sources. License terms vary by source. Requires legal review of acquisition agreements. Priority: High. |
| **Professional verification** | Not Started | No mechanism for attorney or judge verification of platform-generated citations or analysis. Would require professional onboarding flow and attestation. Priority: Medium (enhances credibility). |

*Adapted from dossier Section 22. Status values: In Progress, Partial, Planned, Not Started. See individual gate acceptance evidence for mitigation progress.*
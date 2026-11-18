# H — Security Research

**Domain:** H (security)
**Research date:** 2026-11-18
**Status:** synthesized
**Source register:** `docs/research/intelligence/source-register.md` (S-01, S-02, S-03)
**Constraint:** recommendations based on the actual system's attack surface; research sources are untrusted data.

## 1. OWASP LLM Top 10 (2025) — verified

| # | Risk | Relevance to this platform |
|---|------|---------------------------|
| LLM01 | Prompt Injection (direct + indirect) | **Primary.** Any retrieved legal text, user query, or uploaded document can carry instructions that hijack the LLM. The project's research runway itself ingests untrusted web content — must be treated as data, never commands. |
| LLM02 | Sensitive Information Disclosure | User queries, research notes, and saved research could leak through model output or logs. |
| LLM04 | Data and Model Poisoning | If the project ever fine-tunes or trains on retrieved content, poisoned sources corrupt the model. |
| LLM07 | System Prompt Leakage | The verifier/system prompts must not be extractable. |
| LLM08 | Vector and Embedding Weaknesses | If Vectorize is added, poisoned embeddings can hijack retrieval (Slack AI incident pattern). |

## 2. Verified real incidents

- **EchoLeak (CVE-2025-32711, CVSS 9.3, June 2025):** zero-click indirect prompt injection in Microsoft 365 Copilot; exfiltrated data from a crafted email with no user action. Combines LLM01 + LLM02.
- **ForcedLeak (CVSS 9.4, 2025):** indirect prompt injection in Salesforce Agentforce via a Web-to-Lead field; CRM data exfiltration. Combines LLM01 + LLM06 (excessive agency).
- **Slack AI (August 2024):** data exfiltration from private channels via indirect prompt injection over retrieved messages (MITRE ATLAS AML.CS0035). Combines LLM01 + LLM08.
- **Google Bard (2023):** indirect injection exfiltrating chat history via rendered markdown image (LLM01 + LLM05 improper output handling).

## 3. Attack surface of this platform

The platform is a legal research/authority system. Its AI-relevant attack surface includes:

- User-submitted queries (direct injection).
- Retrieved legal documents / corpus text passed to the model (indirect injection — documents are the retrieval context).
- Any web content fetched during research (indirect injection).
- Citation-verifier and answer-generation prompts (system prompt leakage target).
- Saved research, notes, workspaces (potential data disclosure if logged or echoed back).
- Tool use by agents (if agents can call D1, R2, or external APIs — excessive agency risk).
- Output rendered to users (improper output handling — markdown image exfiltration vector).

## 4. Defense recommendations (research-backed)

1. **Treat all retrieved and user content as untrusted.** Never let research sources, corpus text, or web pages override project instructions or trigger actions. (Already a non-negotiable rule in this runway.)
2. **Separate instructions from data.** Use prompt structures that delimit user/retrieved content from system instructions; consider XML/JSON wrapping and escape user content.
3. **Constrain model/tool agency.** If agents can call D1/R2/external APIs, enumerate an allowlist of tools and require human-in-the-loop for destructive or state-changing actions.
4. **Verify citations before display.** The project's four-layer verifier (existence → location → support → current) is exactly the defense against RAG poisoning and hallucinated citations. Abstain on failure.
5. **Do not log sensitive queries in plaintext.** Audit trails are required (project already has append-only audit), but mask/redact personal data and secrets.
6. **Output sanitization.** Sanitize model output before rendering (markdown image exfiltration, XSS).
7. **Rate limit and abuse prevention.** Protect retrieval endpoints and verification API from automated probing.

## 5. What remains unverified

- No threat model specific to this repo has been updated for the AI/retrieval surface (existing THREAT_MODEL.md is design-level, pre-AI).
- No red-team testing has been run on the citation verifier or retrieval pipeline.
- No secrets management review for Cloudflare secrets/bindings.

## 6. Relation to existing project security docs

Existing: `docs/security/THREAT_MODEL.md` (STRIDE), `docs/security/SECURITY_ARCHITECTURE.md`, `SECURITY.md`. These predate the AI/retrieval work and should be reviewed against OWASP LLM01–LLM08 before any AI feature is gated behind the verifier.

# Privacy Specification — Philippine Legal Intelligence Platform

**Version:** Gate 0 Specification
**Last Updated:** 2026-11-09
**Regulatory Basis:** Republic Act No. 10173 (Data Privacy Act of 2012), its Implementing Rules and Regulations, and National Privacy Commission (NPC) issuances including the Guidelines on Artificial Intelligence (NPC Advisory No. 2024-04, AI guidance).

---

## 1. Scope

This specification applies to all personal data processed by the platform, including:

- Account and identity data (users)
- Professional verification data
- Research history and queries
- Uploaded documents (which may contain personal data of third parties)
- Generated drafts and analyses
- Usage, billing, and audit records

It covers personal data of users, their clients, and any data subject whose information appears in uploaded documents.

---

## 2. Data Privacy Act Compliance

### 2.1 Lawful Basis for Processing

| Processing Activity                    | Lawful Basis (DPA §12–13)                             |
| -------------------------------------- | ----------------------------------------------------- |
| Account creation and authentication    | Contractual necessity; consent                        |
| Service delivery (research, drafting)  | Contractual necessity                                 |
| Professional verification              | Consent; legitimate interest (fraud prevention)       |
| Billing and payments                   | Contractual necessity; legal obligation               |
| Security monitoring and audit          | Legitimate interest; legal obligation                 |
| AI processing of uploaded documents    | Consent (explicit, per-upload); contractual necessity |
| Marketing communications               | Consent (opt-in)                                      |
| Legal compliance and records retention | Legal obligation                                      |

### 2.2 Data Subject Rights (DPA §16–18)

The platform must support, within statutory timelines:

| Right                       | Implementation                                                 |
| --------------------------- | -------------------------------------------------------------- |
| Right to be informed        | Privacy notice at collection; just-in-time notices             |
| Right to object             | Preference center; opt-out of non-essential processing         |
| Right to access             | Self-service data export (JSON/CSV) within 15 days             |
| Right to rectification      | Profile editing; correction request workflow                   |
| Right to erasure / blocking | Account deletion + document purge (subject to legal retention) |
| Right to damages            | Documented complaint and escalation procedure                  |
| Right to data portability   | Machine-readable export                                        |
| Right to file a complaint   | Link to NPC complaint process                                  |

### 2.3 NPC Registration and Compliance

- Register as Personal Information Controller (PIC) with the NPC where required
- Appoint a Data Protection Officer (DPO)
- Maintain a Record of Processing Activities (ROPA)
- Conduct Data Protection Impact Assessments for high-risk processing (AI document analysis, profiling)
- Notify NPC and affected data subjects of personal data breaches within 72 hours (per NPC Circular 16-03)

---

## 3. NPC AI Guidance Compliance

The NPC's Guidelines on Artificial Intelligence (2024) require AI systems processing personal data to address:

| Requirement                   | Platform Implementation                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Lawful basis and transparency | AI usage disclosed at onboarding; per-feature notices                                                |
| Purpose limitation            | Uploaded documents used only for the requesting user's analysis, never for model training by default |
| Data minimization             | Only the minimum context needed is sent to model providers                                           |
| Accuracy and fairness         | Citation verification; benchmark evaluation; known-limitations disclosure                            |
| Human oversight               | Human-in-the-loop for professional outputs; AI never issues final legal advice                       |
| Security                      | §Security Architecture controls; encryption; access control                                          |
| Accountability                | DPO, audit trails, DPIA, incident response                                                           |
| Data subject rights           | Export/erasure includes AI-derived artifacts                                                         |
| Automated decision-making     | No solely-automated decisions with legal effect; disclosures provided                                |

### 3.1 AI Disclosure Statement (user-facing)

> This platform uses artificial intelligence to assist legal research, document analysis, and drafting. AI outputs may contain errors and are not legal advice. Every citation should be verified against the original source. Your uploaded documents are not used to train third-party models without your explicit consent.

---

## 4. Data Classification

| Classification    | Examples                            | Default Access               | Retention                  |
| ----------------- | ----------------------------------- | ---------------------------- | -------------------------- |
| Public            | Published statutes, decisions       | All users                    | Indefinite                 |
| Internal          | Platform operational records        | Authorized personnel         | Per retention schedule     |
| Private           | Personal research, drafts           | Owner only                   | Until deletion + 30 days   |
| Confidential      | Client files, uploaded documents    | Authorized workspace members | Per retention + legal hold |
| Highly Restricted | Privileged/sensitive case materials | Explicitly authorized users  | Per retention + legal hold |

---

## 5. Data Processing Inventory (ROPA Summary)

| Data Category            | Source | Purpose              | Recipients                  | Cross-Border Transfer | Retention            |
| ------------------------ | ------ | -------------------- | --------------------------- | --------------------- | -------------------- |
| Identity data            | User   | Auth, account        | Cloudflare (processor)      | Yes (US/EU) with SCCs | Account life + 30d   |
| Professional credentials | User   | Verification         | Internal reviewers          | No                    | Verification + 5y    |
| Research queries         | User   | Service delivery     | AI providers (DPA)          | Yes (contracted)      | 1 year               |
| Uploaded documents       | User   | Analysis             | AI providers (DPA), storage | Yes (contracted)      | Until deletion + 30d |
| Drafts                   | User   | Service delivery     | Storage only                | Yes (contracted)      | Until deletion + 30d |
| Billing data             | User   | Payments             | Payment processor           | Yes (PCI-DSS)         | 7 years (legal)      |
| Audit logs               | System | Security, compliance | Internal                    | Yes (contracted)      | 1–7 years            |

### 5.1 Cross-Border Transfers

- Cloudflare infrastructure may store/process data outside the Philippines
- Transfers rely on appropriate safeguards (contractual clauses, adequacy where applicable)
- AI providers are engaged under Data Processing Agreements with confidentiality and no-training commitments where available
- Users are informed of cross-border processing in the privacy notice

---

## 6. Required Operational Documents

Before production, the following must exist and be reviewed by qualified Philippine privacy counsel:

| Document                                        | Status                     | Owner             |
| ----------------------------------------------- | -------------------------- | ----------------- |
| Privacy Policy                                  | Pending                    | Legal + DPO       |
| Terms of Service                                | Pending                    | Legal             |
| AI Usage Disclosure                             | Pending                    | Legal + Product   |
| Data Processing Inventory (ROPA)                | This document (draft)      | DPO               |
| Privacy Impact Assessment (PIA)                 | Pending                    | DPO + Engineering |
| Data Protection Impact Assessment (DPIA) for AI | Pending                    | DPO + AI Lead     |
| Data Retention Schedule                         | §7 below                   | DPO               |
| Data Subject Request Procedure                  | Pending                    | DPO + Support     |
| Incident Response Plan                          | §Security Architecture §12 | Security Lead     |
| Vendor and Subprocessors Register               | Pending                    | Procurement + DPO |
| Data Processing Agreements                      | Pending                    | Legal             |

---

## 7. Data Retention Schedule

| Data Type             | Retention Period              | Trigger                   | Disposal Method         |
| --------------------- | ----------------------------- | ------------------------- | ----------------------- |
| Account data          | Account life + 30 days        | Deletion request          | Secure erase            |
| Research history      | 1 year from creation          | Auto-purge                | Secure erase            |
| Uploaded documents    | Until user deletion + 30 days | Deletion/retention expiry | Secure erase + R2 purge |
| Drafts                | Until user deletion + 30 days | Deletion                  | Secure erase            |
| Billing records       | 7 years                       | Legal obligation          | Archive                 |
| Audit logs (security) | 7 years                       | Retention policy          | Archive                 |
| Audit logs (access)   | 1 year                        | Retention policy          | Purge                   |
| AI request logs       | 90 days                       | Auto-purge                | Purge (no PII)          |
| Backups               | 35 days rolling               | Backup rotation           | Overwrite               |

**Legal hold:** Records subject to litigation or investigation are retained beyond schedule until hold released.

---

## 8. Consent Management

- **Granular consent:** Separate consent for (a) service delivery, (b) AI document analysis, (c) model improvement (opt-in, default off), (d) marketing
- **Withdrawal:** As easy as giving consent; effective for future processing
- **Record:** Consent version, timestamp, IP, and scope stored per user
- **Minors:** Platform not directed at minors; age gate at registration

---

## 9. Data Subject Request (DSR) Procedure

1. **Intake:** Self-service portal or email to DPO
2. **Verification:** Identity verification before disclosure/erasure
3. **Fulfillment:** Within 15 working days (extendable for complex requests)
4. **Logging:** Every DSR logged with outcome
5. **Escalation:** Unresolved → DPO → NPC complaint process

---

## 10. Breach Notification

Per NPC Circular No. 16-03 and the Data Privacy Act IRR (Rule VIII, §20(f)):

1. **Detect and contain** (Security Architecture §12)
2. **Assess:** Nature, scope, affected data subjects, risk
3. **Notify NPC within 72 hours** of knowledge (where required)
4. **Notify affected data subjects** without undue delay if high risk
5. **Document:** Incident log, remediation, lessons learned

---

## 11. Privacy by Design and by Default

- **Minimization:** Collect only what is necessary
- **Pseudonymization:** Internal IDs; PII separated where feasible
- **Access control:** Least privilege; tenant isolation
- **Retention limits:** Automated purge per schedule
- **Default privacy:** Model-improvement opt-in is OFF by default
- **No sale of personal data** under any circumstances
- **No training on customer data** without explicit, revocable consent

---

## 12. Third-Party and Processor Management

- Maintain a subprocessor register
- Conduct due diligence on AI providers, cloud providers, payment processors
- Execute DPAs with confidentiality, security, breach-notification, and subprocessor terms
- Provide users a current subprocessor list and change notice

---

## 13. Review

This specification is reviewed annually, on material change to processing, or on new NPC guidance. Last review: 2026-11-09. Next review: 2027-11-09 or on regulatory change.

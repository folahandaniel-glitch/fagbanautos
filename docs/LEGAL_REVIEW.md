# Legal review: Terms and Conditions, Privacy Policy and related pages

Version 1.0, 5 October 2026. Pages reviewed: Terms and Conditions, Privacy Policy, Refund and Cancellation Policy, FAGDAN Installment Terms, Cookie Policy (source: `prisma/seed-data/legal.ts`; editable in Admin > Content).

> **Important.** This is a structured drafting review prepared with AI assistance, not legal advice. It has not been checked by a Nigerian-qualified lawyer. Statute names are cited so counsel can verify them; section numbers are deliberately omitted rather than guessed. **Do not treat any page as final until counsel has approved it and every `[SQUARE BRACKET]` has been completed.**

## 1. What was done

The original placeholders (two to three sentences each) were replaced with complete, structured pages that match how the platform actually works: server-verified payments, reservations, the 10% installment price with a 90% release rule, VAT handling, bank-transfer verification, imports, trade-ins and swaps, auto-care bookings, and the data the site really collects. Anything that depends on a business decision or a legal fact only FAGDAN or counsel can supply is left in square brackets.

## 2. Legal frameworks the drafts are built around (for counsel to confirm)

| Area | Instrument | How it shaped the draft |
|---|---|---|
| Data protection | Nigeria Data Protection Act 2023; NDPC General Application and Implementation Directive 2025 (effective 19 Sep 2025) | Controller identity, lawful bases, rights, transfers abroad, retention, breach notification, DPO contact, possible DCPMI registration |
| Consumer protection | Federal Competition and Consumer Protection Act 2018 (FCCPC) | Statutory rights preserved; no exclusion of liability that the law forbids; complaint route to FCCPC |
| Anti-money-laundering | Money Laundering (Prevention and Prohibition) Act 2022; SCUML (EFCC) designation of motor dealers | Identity and source-of-funds checks, right to delay or refuse, record keeping |
| Tax | Nigeria Tax Acts (VAT retained at 7.5% from 1 Jan 2026) | VAT shown and added by the server; stated as non-waivable |
| Company law | Companies and Allied Matters Act 2020 | Registered name, RC number and address placeholders on pages and documents |
| Disputes | Arbitration and Mediation Act 2023; state courts | Escalation, mediation, arbitration seat placeholder |
| Evidence | Evidence Act (electronic records) | Clause on electronic records and communications |
| Sale of goods | Applicable State sale-of-goods law | Contract formation, risk, title, description and quality |
| Motor vehicles | Motor vehicle registration and third-party insurance laws | Customer responsibilities after release |

## 3. Issue register (highest risk first)

| # | Risk | Issue | Where | Recommended action |
|---|---|---|---|---|
| 1 | High | **10% installment uplift** could be characterised as interest or a credit charge, bringing in consumer-credit or money-lending rules (including State money-lender licensing). The pages call it the "FAGDAN installment price" and say FAGDAN is not a lender, but labels do not decide the legal character. | Installment Terms cl. 1; Terms cl. 11 | Counsel to advise on structure (instalment sale vs credit), any licence, required disclosures, and whether the uplift must be presented differently. |
| 2 | High | **Title and recovery after release.** The draft says title passes on full payment and the customer must not sell or pledge before then, but enforceability of retention of title and any repossession on default depends on law and on proper security registration. Default remedies are bracketed. | Terms cl. 12; Installment Terms cl. 4, 6 | Counsel to draft the default, notice, recovery and refund process, and advise on security registration. |
| 3 | High | **Buyer VAT switch-off.** VAT is statutory and cannot be waived by agreement. The platform defaults to disabled and the Terms say so, but the admin can enable an opt-out. | Terms cl. 6 | Tax adviser to confirm any lawful exemption cases before the feature is ever enabled. |
| 4 | High | **AML/KYC.** Motor dealers are designated non-financial businesses. The Terms reserve the right to request identification and refuse transactions, but registration, a written AML policy, staff training and reporting are operational duties. | Terms cl. 9; Privacy cl. 3, 6 | Register with SCUML, adopt an AML/KYC procedure, confirm record-retention periods. |
| 5 | High | **NDPA compliance.** Need a named DPO or contact, a data-protection impact assessment for the platform, a register of processors with written contracts, a cross-border transfer assessment (hosting abroad), a breach runbook, and a decision on registering as a data controller of major importance. | Privacy cl. 1, 5, 8 | Appoint DPO, complete DPIA and processor contracts, assess NDPC registration and annual audit filing duties. |
| 6 | Medium | **Limitation of liability** to the amount paid may be unenforceable against consumers, particularly for defective vehicles or safety issues. | Terms cl. 20 | Counsel to confirm wording and carve-outs. |
| 7 | Medium | **Refund economics.** Reservation-deposit treatment, cancellation window for vehicles, restocking and no-show fees are business decisions currently bracketed. They must be reasonable and not unfair under consumer law. | Refund Policy cl. 2, 3, 6 | Owner to decide; counsel to review fairness. |
| 8 | Medium | **Imports.** Whether FAGDAN acts as agent or principal changes liability, customs responsibility and VAT. Draft requires a per-request written agreement. | Terms cl. 16 | Counsel to prepare a standard import/sourcing agreement. |
| 9 | Medium | **Used-vehicle "as described" and defects.** "Certified Used" is a marketing label; if FAGDAN offers a certification warranty, its scope must be written and consistent with listings. | Terms cl. 5 | Define certification criteria and warranty text; keep listings consistent. |
| 10 | Medium | **Stolen/encumbered vehicle risk** for trade-ins and swaps. Draft has a warranty of title by the customer. | Terms cl. 17 | Add ownership verification procedure and police/lien checks to operations. |
| 11 | Medium | **Retention periods** are given as placeholders or common practice, not verified against each statute. | Privacy cl. 6 | Counsel to confirm tax, AML and limitation-period retention. |
| 12 | Low | **Storage charges, collection deadlines** for service vehicles. | Terms cl. 15 | Decide fee and period; consider a lien clause if appropriate. |
| 13 | Low | **Demo content.** The site currently shows sample data labelled "Demo". Remove demo data and the demo banner before launch so that no listing misdescribes stock. | Terms cl. 5 | Operational. |
| 14 | Low | **Cookie consent mechanism.** Only essential cookies are set today, so no banner is needed, but one must be added if analytics or marketing cookies are introduced. | Cookie Policy | Re-review when adding analytics. |

## 4. Gaps in the drafts, by design

- Company details, RC number, TIN, DPO and contact emails are placeholders.
- Fee amounts, time windows and thresholds marked in brackets reflect business decisions not yet made.
- There is no separate acceptable-use, intellectual-property or accessibility statement beyond the short clauses in the Terms.
- The pages are in English only. Do not machine-translate legal text into Yoruba, Igbo or Hausa without legal review.

## 5. Checklist before publishing

- [ ] Counsel has approved all five pages; all brackets completed.
- [ ] Company legal name, RC number, address and TIN entered in Admin > Settings > General and on the pages.
- [ ] Contact and privacy emails are monitored.
- [ ] DPO appointed; DPIA and processor contracts complete; NDPC registration decision made.
- [ ] SCUML registration and AML/KYC procedure in place.
- [ ] Tax adviser has signed off the VAT treatment and the installment structure.
- [ ] Refund, cancellation and installment-default terms agreed by the owners.
- [ ] Demo data removed.

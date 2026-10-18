# RAM-01 non-operative agreement decision matrix

This is a product and engineering checklist for drafting standing supplier and researcher purchase agreements. It is not an offer, signed agreement, legal conclusion, or authorization for animal movement or payment. Counsel and the owner must approve the jurisdiction-specific text before a real pilot.

| Topic | Standing supplier agreement: decision to record | Researcher purchase terms: decision to record | Software evidence and linked Phase 0 decision |
| --- | --- | --- | --- |
| Parties and authority | Legal farm entity, site, authorized signatory, standing agreement version and effective dates | Legal institution, PI, procurement authority, approved receiving facility and protocol | Organization verification and membership; P0-03/P0-06 |
| Eligible animal | Pre-existing cull decision, source records, exclusions, treatment and welfare disclosures | Species, phenotype, diagnostics, stated uncertainty and allowed use | Cull event, case, vet review and research need; P0-01/P0-04 |
| Supplier price | Versioned standardized cull schedule and market ceiling, independent of buyer value | Buyer quote and service components, independently calculated | Supplier pricing policy and order snapshots; P0-07 |
| Title and risk | Exact event transferring title to RAM, rejection/withdrawal before that event and loss allocation | Exact event transferring title onward, receiving acceptance and loss allocation | Separate order, custody and receipt events; P0-02/P0-06 |
| Veterinary and movement | Who obtains exam, tests, certificates and source permissions | Who supplies protocol/facility evidence and receiving capability | Clearance, vet review, transport documents; P0-03/P0-05 |
| Custody and welfare | Care responsibility before pickup and during a rejected pickup | Care, quarantine and escalation after delivery or rejection | Transport events, receipt and incident records; P0-05/P0-10 |
| Withdrawal and exception | When supplier may withdraw and required evidence | Cancellation, substitution, rejection, replacement and refund conditions | Order/dispute transitions and append-only ledger; P0-06/P0-08 |
| Payment and taxes | Payee verification, payout timing, reversal and tax handling | Payment method, invoice, chargeback, refund and reconciliation | Payment profile, execution, settlement and ledger; P0-08 |
| Records and confidentiality | Source identity, restricted veterinary records, disclosure consent and retention | Permitted study, disclosure limits, confidential research results and feedback | Separate source record, disclosure policy and audit; P0-09 |
| Incident and termination | Suspicious harm, outbreak, recall, suspension and record preservation | Receiving exception, welfare escalation, dispute and termination | Operational incident, pilot gate and audit evidence; P0-10 |
| Insurance and dispute forum | Coverage, indemnity, notices and governing forum for each corridor | Coverage, institution-specific terms and forum compatibility | Owner/counsel decision record; P0-02/P0-06 |

## Version binding for software

A real order must reference the exact approved supplier agreement and buyer terms versions, effective dates and authorized signatories. The present data model does not yet prove those signatures or legal title transitions. Treat missing records as a pilot blocker; do not infer approval from an account registration, checkbox, demo session, CI result or merged PR.

Counsel must decide whether RAM's specific activity requires dealer, broker, reseller, animal-dealer, livestock-market or other status in every proposed corridor. The terms cannot be finalized from this matrix alone. Any reviewed term that changes a transaction boundary must be reflected in the state transitions, clearance gates, negative tests and operator training before deployment.

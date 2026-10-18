# RAM-01 Phase 0 pilot decision and compliance register

Status: ENGINEERING BASELINE; NOT legal, veterinary, regulatory, financial, or owner approval. This register clarifies implementation dependencies without enabling live-animal transactions.

## Pilot boundary
The development plan proposes one species (swine), 1-3 farm suppliers, 3-10 research programs, limited naturally occurring conditions, and preferably intrastate or pre-cleared transport corridors. These are planning assumptions, not activated jurisdictions, validated veterinary indications, or approved disease classes. Exclude reportable/high-risk communicable conditions unless authoritative review explicitly permits a specific route. No supplier is asked to change cull decisions or cause disease.

## Phase 0 decision ledger
Each row requires an accountable decision record with approver role, date, jurisdiction, rationale, source authority, expiry/review trigger and immutable evidence reference. Never auto-convert an empty approval field to true.

| ID | Decision | Owner/authority | Required evidence | Current status |
| --- | --- | --- | --- | --- |
| P0-01 | Pilot state(s), route(s), species and allowed phenotype/condition families | RAM owner plus veterinarian and relevant local counsel | Written dated corridor matrix with species/condition exclusions and movement rules | UNVERIFIED |
| P0-02 | Who holds legal title at each order/custody event and applicable dealer/broker licensing | Jurisdictional counsel and RAM owner | Reviewed transaction title timeline and regulatory rationale | UNVERIFIED |
| P0-03 | Research buyer animal-use protocol, institution authority, quarantine and receiving capability | Receiving institution and authorized research/veterinary officers | Valid protocol, facility and acceptance evidence | UNVERIFIED |
| P0-04 | Independent supplier cull decision, welfare, veterinary confirmation and no inducement to produce disease | Farm and RAM veterinary review | Evidence recorded before price/match disclosure | UNVERIFIED |
| P0-05 | Veterinary fitness, diagnostic quality, transport biosecurity and movement documents | Veterinarian and applicable transport regulator | Reviewed per-corridor checklist and exception escalation | UNVERIFIED |
| P0-06 | Standing supplier agreement, research buyer terms, indemnity, warranties, refunds and dispute jurisdiction | RAM owner and commercial/animal-law counsel | Signed or formally approved versioned terms and authority | UNVERIFIED |
| P0-07 | Supplier acquisition schedule and ceiling independent of buyer willingness-to-pay | RAM finance and owner | Versioned authorized species policy; testing that buyer price is excluded | UNVERIFIED |
| P0-08 | Payment provider settlement, payout ownership, chargeback/reversal and reconciliation | RAM finance and provider owner | Authenticated sandbox and later live operational receipts, not mocked invoices | UNVERIFIED |
| P0-09 | Private source identity, identifiable animal data retention, disclosure and NDA rules | RAM privacy/security and counsel | Data classification, authorized recipient matrix and retention/deletion procedures | UNVERIFIED |
| P0-10 | Incident, recall, loss, welfare escalation, outbreak stop and rollback governance | Operations, veterinarian and compliance lead | Signed playbooks, trained owners and verified drills | UNVERIFIED |

## Hard fail-closed transaction invariants
- Publishing a candidate requires permitted species and corridor, veterinary verification, source integrity, animal welfare and no disease inducement.
- An accepted buyer match does not authorize acquisition, transport or public disclosure. Only independently validated purchase authority, supplier agreement, compliance clearance and documented facility capacity can advance each stage.
- Buyer and supplier price paths remain separate. Acquisition must use the authorized standardized cull schedule capped by market ceiling and must not use research demand, phenotype rarity or buyer price.
- Transport and receiving need jurisdiction-specific documents, custody events and separate acceptance. Carrier delivery is not institution acceptance.
- Every compliance, notice, dispute, payment and title transition needs an attributable audit event, authorization, bounded state transition and replay/idempotency rules.
- Demo users, prototype fixtures, unverified institutional approvals or local CI cannot activate real animal movement or financial settlement.

## Engineering acceptance and handoff
1. Maintain versioned state transitions and role/resource access matrix; verify every prohibited transition, stale write, repeated webhook and revoked reviewer permission fails closed.
2. Preserve source/receiving confidentiality in researcher, carrier and supplier projections. Require separate licensed compliance access for exact farm location and identities.
3. Test synthetic happy, clearance-denial, expired hold, transport exception, receiving rejection/refund, payment retry and rollback paths. Link exact CI SHA and job URL; report unrun checks explicitly.
4. Require separately accountable veterinary, regulatory, finance and operational acceptance for each real corridor; record approval expiry and corrective action. A passing code test does not satisfy these gates.
5. Confirm deployed SHA, controlled identity, provider payments, monitored incidents, restore evidence, and authenticated live pilot acceptance before the system handles real animals.

Implementation references: docs/DEVELOPMENT_PLAN.md, docs/TRANSACTIONS.md, docs/PILOT.md, docs/LOGISTICS.md, docs/FINANCE.md. This register intentionally records open owner/expert decisions rather than fabricating approvals.

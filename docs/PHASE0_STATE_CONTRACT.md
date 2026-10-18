# RAM-01 canonical state and authority crosswalk

The executable transition sets are `lib/state-machines.ts` and `lib/workflows.ts`. This document binds product language to those sets and records external facts that a status alone cannot prove. It is a Phase 0 engineering specification, not pilot approval.

| Track | Happy path | Independent evidence before its next real-world action |
| --- | --- | --- |
| Animal candidate | DRAFT -> SUBMITTED -> PRE_SCREENED -> VET_PENDING -> VERIFIED -> MATCHABLE -> RESERVED -> SOLD_TO_RAM -> TRANSFERRED | Cull provenance, vet evidence, welfare, eligibility and restricted source review |
| Research need | DRAFT -> SUBMITTED -> VERIFIED -> ACTIVE -> MATCH_REVIEW -> SELECTED -> INSTITUTIONAL_CLEARANCE -> ORDERED -> IN_STUDY -> COMPLETED -> CLOSED | Research organization and protocol, receiving facility and use approval |
| Order | DRAFT -> CANDIDATE_HELD -> CHECKOUT_PENDING -> BUYER_COMMITTED -> ACQUISITION_COMMITTED -> CLEARANCE_PENDING -> READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED -> ACCEPTED -> SETTLED -> CLOSED | Buyer authority, independent supplier policy, seven clearance gates, custody, separate receiving inspection and ledger reconciliation |

## Non-equivalences

- `BUYER_COMMITTED` is a commercial event, not legal title transfer, supplier acquisition or pickup.
- `ACQUISITION_COMMITTED` is a financial commitment. P0-02 must fix the actual title event for each corridor.
- `READY_FOR_PICKUP` requires explicit clearance; a reserved candidate or accepted quote cannot cause physical movement.
- `IN_TRANSIT` and `DELIVERED` are custody/delivery facts. `ACCEPTED` requires a distinct institutional inspection.
- `SETTLED` requires balanced buyer/supplier obligations. `CLOSED` requires reconciliation; neither proves a research study completed.
- `QUARANTINED`, `SUSPENDED`, `CLEARANCE_FAILED`, `TRANSPORT_EXCEPTION`, `REJECTED_AT_RECEIPT` and `DISPUTED` require named exception ownership and an auditable reason.

## Transition review cases

For each boundary, test an authorized actor, wrong organization, revoked actor, stale state, duplicate request and missing evidence. Negative cases must preserve the prior state and append an appropriate audit or rejection record. Review the exact executable transition list after every schema or workflow change. External title, veterinary and corridor approvals remain open in `PHASE0_DECISION_REGISTER.md`.

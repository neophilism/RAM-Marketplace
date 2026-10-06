# RAM Marketplace architecture v0.2

## Governing product rule

The scientist marketplace is **animal-centered, not seller-centered**.

A farm is never rendered as a branded marketplace seller. Scientist-facing listings are projections of verified animal cases. Farm identity, exact address, owner information, veterinarian identity, payment information and other source-sensitive data live behind a separate authorization boundary.

## Commercial invariant

RAM deliberately separates the two sides of the transaction:

- Supplier acquisition price = the lower of the standardized cull schedule and configured market ceiling.
- Supplier price cannot increase because of diagnosis, severity, rarity, urgency, research demand, match score, buyer identity or buyer budget.
- Buyer pricing is calculated independently from research-model value and service components.
- The intended commercial event is researcher commitment -> supplier acquisition commitment -> clearance -> physical transfer.

Commercial commitment, legal title and physical custody are distinct concepts in the software so counsel can configure the legal title event without redesigning the product.

## Primary product surfaces

1. **Scientist marketplace** — create research requests, review explainable matches, compare candidates, request permitted information, reserve/buy and follow clearance.
2. **Supplier portal** — report bona-fide cull candidates, coordinate veterinary review, upload records, manage disclosure permissions and track sales/payouts.
3. **Veterinary workspace** — accept assignments, characterize phenotype, attach diagnostics, assess communicability and transport fitness, and escalate welfare/integrity concerns.
4. **Transport workspace** — receive minimum-necessary pickup/delivery data, record chain of custody, sanitation and incidents.
5. **RAM operations** — triage, matching, disclosure review, compliance, exceptions, logistics, finance and audit history.

## Canonical candidate lifecycle

Happy path:

`DRAFT -> SUBMITTED -> PRE_SCREENED -> VET_PENDING -> VERIFIED -> MATCHABLE -> RESERVED -> SOLD_TO_RAM -> TRANSFERRED`

Exception states are `WITHDRAWN`, `CULLED`, `EXPIRED`, `INELIGIBLE`, `QUARANTINED`, and `SUSPENDED`.

Transitions are enforced server-side in `lib/state-machines.ts`.

## Canonical order lifecycle

Happy path:

`DRAFT -> CANDIDATE_HELD -> CHECKOUT_PENDING -> BUYER_COMMITTED -> ACQUISITION_COMMITTED -> CLEARANCE_PENDING -> READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED -> ACCEPTED -> SETTLED -> CLOSED`

Failure/exception states include `EXPIRED`, `CLEARANCE_FAILED`, `SUPPLIER_WITHDRAWN`, `BUYER_CANCELLED`, `TRANSPORT_EXCEPTION`, `REJECTED_AT_RECEIPT`, and `DISPUTED`.

A blocking compliance finding prevents the transition to `READY_FOR_PICKUP`.

## Privacy architecture

### Research-facing projection

RAM animal ID, species, breed where approved, age/sex/weight, phenotype, diagnostics, generalized region, logistics feasibility, buyer price and authorized history.

### Restricted source record

Farm identity, exact location, owner identities, local veterinarian, contracts, supplier acquisition price, payment information, source documents and any field capable of indirectly identifying the farm.

### Indirect-identification controls

Sanitize filenames, document headers/letterheads, EXIF/GPS metadata, veterinary clinic identifiers, exact source-revealing dates, recognizable facility photographs/signage and free-text farm/company names.

## Disclosure workflow

`Scientist request -> RAM relevance review -> permission check -> supplier approval if required -> NDA/transaction gate if required -> scoped release -> audit event`

Requests must identify the desired fields and explain why they affect the research or purchasing decision.

## Matching v1

Hard filters execute before scoring: candidate status/time window, species/biological constraints, age/weight/sex, required phenotype evidence, exclusions, communicability/reportable-disease policy, movement corridor, receiving-facility capability, transport fitness, buyer approval, supplier standing and provenance integrity.

100-point ranking:

- Phenotype fit: 30
- Diagnostic confidence: 20
- Etiology fit: 15
- Comorbidity fit: 10
- Timing / availability: 10
- Logistics fit: 10
- Price fit: 5

Every score must preserve component values, reason strings, evidence and confidence flags. Missing critical data creates a task rather than an assumed value.

## Tenancy and authorization

The persistence model supports users with one or more organization memberships rather than a single global role. Membership roles map to product permissions in `lib/rbac.ts`. Authorization will combine role permissions with organization, facility, order relationship and assignment attributes.

## Implementation order

1. Auth + organizations + RBAC
2. Persisted animal submission
3. Research-needs workflow
4. Veterinary verification
5. Anonymous marketplace query layer
6. Disclosure authorization service
7. Matching engine
8. Reservation/quote/acquisition workflow
9. Compliance clearance + logistics
10. Payment/payout ledger
11. Audit/security hardening
12. End-to-end tests and pilot deployment

## Test policy

CI must protect the non-negotiable business rules, not just compile the UI. Current invariant tests cover supplier-price decoupling, canonical state transitions, the compliance hard gate, matching weights and baseline RBAC separation.

# RAM Marketplace architecture v0.3

## Governing product rule

The scientist marketplace is **animal-centered, not seller-centered**.

A farm is never rendered as a branded marketplace seller. Scientist-facing listings are projections of verified animal cases. Farm identity, exact address, owner information, veterinarian identity, supplier payment information and other source-sensitive data live behind a separate authorization boundary.

The persistence model reinforces that rule structurally: `AnimalCase` contains marketplace-eligible scientific information, while `AnimalSourceRecord` is a separate one-to-one restricted record containing the farm/site link and identifying source information. Scientist-facing services must not query or join `AnimalSourceRecord`.

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

## Research-need lifecycle

`DRAFT -> SUBMITTED -> VERIFIED -> ACTIVE -> MATCH_REVIEW -> SELECTED -> INSTITUTIONAL_CLEARANCE -> ORDERED -> IN_STUDY -> COMPLETED -> CLOSED`

Backward transitions are allowed only where defined in `lib/workflows.ts` for correction or re-selection.

## Privacy architecture

### Research-facing projection

RAM animal ID, species, breed where approved, age/sex/weight, phenotype, diagnostics, generalized region, logistics feasibility, buyer price and authorized history.

### Restricted source record

Farm/site identity, exact location, owner identities, local veterinarian, contracts, supplier acquisition price, payment information, source documents and any field capable of indirectly identifying the farm.

### Enforced query boundary

The scientist marketplace is built through `lib/server/marketplace.ts`, which projects server-only restricted records through `toMarketplaceListing()`. Automated tests fail if a forbidden source key appears in a marketplace record.

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

Users can hold one or more organization memberships rather than a single global role. Canonical membership roles and permissions live in `lib/rbac.ts`. Additional privacy capabilities prohibit research users from reading restricted source records and reserve source disclosure approval to authorized supplier/RAM roles.

Authorization will combine role permissions with organization, facility, order relationship and assignment attributes.

## Current transactional implementation

The application now persists candidate intake, veterinary verification, research needs, explainable matches, reservations, quote snapshots, buyer commitment, independent supplier acquisition commitment, compliance clearance, transport assignment, chain-of-custody events and delivery. PostgreSQL is the durable system of record; the in-process prototype store mirrors these workflows for local demonstrations without infrastructure.

The supplier-acquisition decision surface is intentionally blind to buyer identity and buyer price. Buyer-facing order projections are independently guarded from supplier economics and source identity. See `docs/TRANSACTIONS.md`.

## Implementation order

1. Authentication/session boundary
2. PostgreSQL migrations + durable repositories
3. Organization/membership onboarding
4. Persisted candidate submission
5. Persisted research-needs workflow
6. Veterinary verification persistence
7. Disclosure authorization service
8. Matching engine
9. Reservation/quote/acquisition workflow
10. Compliance clearance + logistics — implemented through delivery
11. Receiving acceptance + payment/payout ledger
12. Audit/security hardening
13. End-to-end tests and pilot deployment

## Test policy

CI protects non-negotiable business rules, not just UI compilation. Current tests cover supplier-price decoupling, canonical candidate/order transitions, the compliance hard gate, matching weights, baseline RBAC separation, restricted-source authorization and marketplace anonymization.

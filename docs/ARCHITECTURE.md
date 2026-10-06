# RAM Marketplace architecture v0.1

## Governing product rule

The scientist marketplace is **animal-centered, not seller-centered**.

A farm is never rendered as a branded marketplace seller. Scientist-facing listings are projections of verified animal cases. Farm identity, exact address, owner information, veterinarian identity, payment information and other source-sensitive data live behind a separate authorization boundary.

## Primary product surfaces

1. **Scientist marketplace** — browse anonymized cases, create research needs, request additional information, reserve models and advance through clearance.
2. **Farm portal** — report animals, coordinate veterinary review, upload diagnostics, define disclosure permissions, review requests and track cases/payments.
3. **RAM operations** — triage, verification, matching, disclosure review, compliance, contracting, logistics, payments and audit history.

## Canonical animal-case lifecycle

`DRAFT → SUBMITTED → TRIAGE → VET_REVIEW → DIAGNOSTICS → VERIFIED → AVAILABLE → RESERVED → RESEARCH_CLEARANCE → CONTRACTED → IN_TRANSIT → ACTIVE_STUDY → COMPLETED → CLOSED`

Transitions will be enforced server-side by a state machine rather than UI convention.

## Privacy architecture

### Research-facing projection
RAM animal ID, species, breed where approved, age/sex/weight, disease/phenotype, diagnostics, generalized region, logistics feasibility, price and authorized history.

### Restricted source record
Farm identity, exact location, owner identities, local veterinarian, contracts, payment information, source documents and any field capable of indirectly identifying the farm.

### Indirect-identification controls
Sanitize filenames, document headers/letterheads, EXIF/GPS metadata, veterinary clinic identifiers, exact source-revealing dates, recognizable facility photographs/signage and free-text farm/company names.

## Disclosure workflow

`Scientist request → RAM relevance review → permission check → farm approval if required → NDA/transaction gate if required → scoped release → audit event`

Requests must identify the desired fields and explain why they affect the research or purchasing decision.

## Matching v1

Hard exclusions precede scoring: species/size/demographics, disease/stage, welfare suitability, biosecurity/legal movement, institutional restrictions, protocol requirements and timing.

100-point ranking:
- Phenotype similarity: 30
- Etiology/pathology fit: 20
- Disease stage/severity: 15
- Diagnostic confidence: 10
- Exposure/comorbidities: 10
- Age/sex/body size: 5
- Logistics/time-to-study: 5
- Study/treatment fit: 5

These weights are configurable product hypotheses, not immutable scientific rules.

## Implementation order

1. Auth + organizations + RBAC
2. Persisted animal submission
3. Research-needs workflow
4. Veterinary verification
5. Anonymous marketplace query layer
6. Disclosure authorization service
7. Matching engine
8. Reservation/quote/contract workflow
9. Logistics and study monitoring
10. Payment/payout ledger
11. Audit/security hardening
12. End-to-end tests and pilot deployment

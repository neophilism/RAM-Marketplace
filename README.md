# RAM Marketplace

**A marketplace and operating platform for realistic animal models in biomedical research.**

RAM connects biomedical researchers with naturally occurring animal disease cases that can serve as valuable research models, while giving farms a practical additional market for animals they have independently decided to cull.

The platform is designed around a straightforward opportunity: an animal that would otherwise leave agricultural production may have substantial scientific value. RAM provides the infrastructure to identify that opportunity, characterize it properly, match it to legitimate research demand, and manage the transaction from initial submission through transport, payment, receiving, and final reconciliation.

## Why RAM

Many important human diseases also occur naturally in animals.

Those naturally occurring cases can offer researchers something that conventional laboratory models often cannot: complex disease biology developing in a real organism under ordinary biological conditions.

At the same time, farms routinely make normal herd-management decisions that result in animals being removed from production for health, productivity, age, reproductive, or other operational reasons.

RAM connects those two existing realities.

A participating farm gains an additional potential source of value from an animal it had already decided to remove. A research institution gains access to a scientifically characterized animal model that may be substantially more representative of the disease it wants to study.

RAM provides the marketplace, verification, privacy controls, matching, compliance, logistics, and transaction infrastructure necessary to make that exchange practical.

## For research organizations

RAM is designed to make high-value naturally occurring animal models searchable and usable as a serious research resource.

Researchers can:

- search available animals by research-relevant biological characteristics;
- submit structured research needs and receive ranked matches;
- review phenotype, diagnostics, disease characteristics, age, sex, weight, and other approved scientific information;
- see why a candidate matches a research request through explainable matching;
- request additional information when it is relevant to the research or purchasing decision;
- reserve suitable animals;
- coordinate institutional procurement and compliance;
- follow transportation and chain of custody;
- complete institutional receiving and acceptance; and
- manage replacements, credits, refunds, and other exceptions through a documented process.

The goal is to reduce the sourcing friction surrounding naturally occurring models while preserving the scientific information necessary to make informed research decisions.

## For farms and animal suppliers

RAM creates an additional commercial option for animals that have already been selected for removal from production.

A participating farm can:

- submit eligible animals through a private supplier portal;
- provide relevant health and production information;
- coordinate veterinary characterization;
- control disclosure of source-sensitive information;
- keep its identity out of the ordinary scientist-facing marketplace;
- track the status of submitted animals;
- receive clearly defined acquisition terms; and
- follow payment and transaction status through completion.

RAM does not present farms as branded marketplace sellers.

Researchers browse **animals and their scientific characteristics**, not farms. Farm identity, exact location, ownership information, payment information, and other commercially sensitive source details remain within a restricted data layer and are disclosed only when appropriate and authorized.

This allows farms to participate without unnecessarily turning their operations, identities, or customer relationships into public marketplace information.

## Independent farm decisions

RAM is intended to create value from ordinary agricultural decisions, not influence farms to create animals for research demand.

An animal must have been independently selected for culling or removal before its research value or a specific research buyer becomes part of the transaction.

That separation is important commercially as well as scientifically. It keeps normal farm decision-making separate from downstream research demand and allows RAM to function as a secondary market for animals that are already leaving production.

## How the marketplace works

A typical RAM transaction follows this path:

1. **Farm submission**  
   A supplier submits an animal that has already been selected for removal from production.

2. **RAM pre-screening**  
   RAM reviews the submission for basic eligibility and completeness.

3. **Veterinary characterization**  
   An authorized veterinarian reviews the case and documents relevant phenotype, diagnostics, health information, and transport considerations.

4. **Marketplace publication**  
   An eligible animal becomes available through an anonymized scientist-facing listing.

5. **Research matching**  
   RAM compares available animals with structured research needs.

6. **Researcher selection**  
   Researchers review suitable candidates and may reserve an animal.

7. **Institutional procurement**  
   The buyer institution confirms the transaction and applicable requirements.

8. **RAM acquisition and compliance**  
   Commercial terms, required documentation, and compliance gates are completed.

9. **Transportation**  
   An authorized logistics provider receives only the information necessary to perform the transport and records chain-of-custody events.

10. **Institutional receiving**  
    The receiving organization inspects and accepts the animal or documents a discrepancy.

11. **Financial completion**  
    Payments, payouts, reconciliation, and any necessary exception handling are completed through the RAM financial workflow.

## Privacy by design

Source privacy is part of the platform architecture rather than an informal policy.

Scientist-facing records contain research-relevant animal information.

Restricted source records contain information such as:

- farm identity;
- exact location;
- ownership information;
- supplier payment information;
- source contracts;
- identifying veterinary information; and
- other fields capable of unnecessarily identifying the source operation.

These data are maintained separately.

The marketplace therefore remains centered on the scientific value and characteristics of the animal rather than the identity of the farm supplying it.

## Explainable matching

RAM uses deterministic, explainable matching rather than an opaque recommendation system.

Candidates are first evaluated against hard eligibility requirements. Eligible animals are then ranked using factors such as:

- phenotype fit;
- diagnostic confidence;
- etiology;
- comorbidities;
- timing and availability;
- logistics feasibility; and
- price fit.

Each match retains its component scores, supporting evidence, confidence indicators, and reasons.

Missing important information is treated as something to investigate rather than something the system should simply assume.

## Veterinary and compliance workflow

Veterinary review and compliance are integrated directly into the transaction process.

The platform supports:

- veterinary case review;
- diagnostic documentation;
- transport-fitness assessment;
- communicability and movement considerations;
- institutional receiving requirements;
- compliance clearance before pickup;
- documented exceptions; and
- complete audit history.

A transaction cannot simply bypass required compliance steps because a buyer and seller are ready to proceed.

## Logistics and chain of custody

RAM includes a dedicated transportation workflow.

Authorized logistics providers receive a minimum-necessary transport packet rather than unrestricted access to commercial or source information.

The platform records:

- logistics assignment;
- pickup;
- custody transfer;
- sanitation attestations;
- in-transit status;
- transport exceptions; and
- delivery.

This gives research institutions and RAM operations a clear transaction history without unnecessarily exposing farm information.

## Financial infrastructure

RAM includes an append-only financial ledger and provider-neutral payment execution layer.

The platform supports:

- buyer collections;
- supplier payouts;
- buyer credits;
- refunds;
- partial payments;
- settlement;
- reconciliation; and
- exception handling.

External payment execution is separated from RAM's internal accounting record. A payment instruction is not considered completed merely because it was submitted to a payment provider.

Provider callbacks are authenticated, duplicate events are handled idempotently, and ambiguous payment submissions are surfaced for review instead of being blindly retried as new payments.

## Replacements, refunds, and exceptions

Real-world transactions do not always follow the happy path.

RAM includes formal workflows for:

- receiving rejection;
- disputes;
- replacements;
- buyer credits;
- refunds;
- transport exceptions;
- failed payments; and
- reconciliation.

Corrections are recorded as additional events rather than rewriting prior financial or operational history.

## Organization and access controls

RAM supports multiple organization types and role-specific workspaces, including:

- farms and suppliers;
- research organizations;
- veterinary organizations;
- logistics providers; and
- RAM operations.

Authorization is based on organization membership and role rather than a single global account type.

Production access supports external identity providers, verified email, MFA requirements, organization verification, membership suspension, and immediate revocation of operational access.

## Operational monitoring

RAM includes production-oriented monitoring for conditions requiring human attention, including:

- ambiguous payment submissions;
- stale payment processing;
- payment failures;
- transport exceptions;
- delayed pickups;
- unresolved disputes; and
- overdue organization verification.

Incidents are persisted, deduplicated, auditable, and capable of generating signed alerts to an external monitoring or paging system.

The platform also provides dedicated liveness and readiness endpoints for deployment infrastructure.

## Pilot and production readiness

The repository includes both automated and operational launch controls.

Automated verification covers areas including:

- application tests;
- privacy boundaries;
- role-based authorization;
- state-machine rules;
- matching;
- pricing separation;
- transaction workflows;
- PostgreSQL migrations;
- schema drift;
- backup/restore verification;
- identity lifecycle;
- payment execution;
- monitoring; and
- full multi-role end-to-end transactions.

The application also maintains explicit pilot gates for production matters that cannot responsibly be inferred from source code alone, including:

- production identity-provider validation;
- database migration verification;
- TLS and edge configuration;
- backup and recovery;
- monitoring and incident response; and
- live payment-provider validation.

## Current implementation

The current application includes:

- anonymous scientist-facing animal marketplace;
- private farm submission and case-management portal;
- structured research-need intake;
- veterinary verification workspace;
- explainable matching;
- reservation and procurement workflow;
- independent supplier acquisition workflow;
- compliance clearance;
- transportation and chain of custody;
- institutional receiving;
- payments and supplier payouts;
- settlement and reconciliation;
- dispute, replacement, credit, and refund handling;
- organization and membership management;
- production identity integration boundary;
- immutable audit history;
- operational monitoring and incident management;
- PostgreSQL persistence and migrations;
- backup/restore verification;
- production readiness controls; and
- full end-to-end workflow testing.

## Technology

RAM is currently built with:

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma

The application separates its domain rules from provider-specific infrastructure wherever practical. Identity, payment execution, monitoring, and deployment integrations are therefore designed around stable interfaces rather than a single required vendor.

## Running locally

Install dependencies:

```bash
npm install
```

Run the development application:

```bash
npm run dev
```

For PostgreSQL-backed development:

```bash
cp .env.example .env
# Configure DATABASE_URL and the required local environment settings.

npm install
npm run db:push
npm run dev
```

Production and pilot databases use the committed migration history rather than `db push`.

## Verification

Run the complete application verification suite with:

```bash
npm run check
```

The repository also contains PostgreSQL-backed integration and end-to-end testing for the complete multi-role transaction lifecycle.

## Documentation

Additional technical and operational documentation is available in:

- `docs/ARCHITECTURE.md` — system and domain architecture
- `docs/MATCHING.md` — matching model and scoring contract
- `docs/TRANSACTIONS.md` — commercial transaction workflow
- `docs/LOGISTICS.md` — transport and chain of custody
- `docs/RECEIVING.md` — institutional receiving
- `docs/FINANCE.md` — financial ledger and settlement
- `docs/DISPUTES.md` — replacements, credits, refunds, and disputes
- `docs/SECURITY.md` — application security model
- `docs/IDENTITY.md` — production identity and access control
- `docs/PAYMENTS.md` — payment execution
- `docs/MONITORING.md` — monitoring and incident response
- `docs/DATABASE.md` — migrations, backup, and recovery
- `docs/PILOT.md` — pilot-readiness requirements
- `docs/DEPLOYMENT.md` — deployment configuration
- `docs/LAUNCH.md` — staging rehearsal, pilot cutover, and rollback

## The RAM model

RAM is built around a simple commercial and scientific proposition:

**Farms may possess animals with research value that lies outside their agricultural value, and researchers may need realistic disease models that are difficult to obtain through conventional channels.**

RAM provides the infrastructure that allows those interests to meet efficiently.

For farms, that means another potential source of revenue from animals already leaving production.

For researchers, it means access to naturally occurring disease models supported by veterinary characterization, structured data, matching, compliance, logistics, and transaction management.

For both sides, RAM is intended to make a transaction that would otherwise be difficult to discover and coordinate into a practical, repeatable marketplace.

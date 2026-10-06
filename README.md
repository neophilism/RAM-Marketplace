# RAM Marketplace

Digital marketplace and operating system for Realistic Animal Models (RAM).

RAM connects verified, naturally occurring animal disease cases with biomedical research needs while protecting source-farm identity and enforcing permissioned disclosure.

## Core rules

- Scientists browse **animals, not farms**.
- Farm/source identity lives in a restricted data layer and is never joined into ordinary marketplace queries.
- Candidate animals must have been independently selected for culling before research demand or research value is known.
- Supplier acquisition pricing is independent of buyer value and research demand.
- Compliance is a hard transaction gate.

## Current build

The application now includes:

- anonymous scientist animal marketplace;
- private farm candidate submission and case management;
- cull-first provenance capture;
- structured researcher needs;
- veterinary verification workspace;
- RAM operations console;
- organization/membership RBAC;
- signed protected sessions;
- organization onboarding;
- PostgreSQL/Prisma 7 durable repositories;
- separate restricted `AnimalSourceRecord`;
- audited candidate and research-need creation;
- explainable deterministic matching with hard exclusions;
- reservation holds and buyer quote snapshots;
- separate buyer commitment and RAM acquisition commitment;
- species-based supplier acquisition policies blind to buyer value;
- compliance clearance hard gates before pickup;
- logistics assignment, minimum-necessary carrier packets and chain-of-custody events;
- pickup, in-transit, transport-exception and delivery workflow;
- buyer-side receiving inspection with acceptance / rejection at receipt;
- accepted orders advance the research need into the in-study phase;
- acquisition-time buyer receivable / supplier payable snapshots;
- append-only buyer-payment and supplier-payout ledger with partial payments;
- financial settlement and reconciliation through `SETTLED -> CLOSED`;
- automatic rejected-receipt disputes with RAM operations resolution;
- append-only buyer credits/refunds and replacement/refund unwind rules;
- buyer, finance, compliance, transport, receiving and dispute transaction workspaces;
- explicit same-origin mutation checks and request-size limits;
- durable throttling for anonymous onboarding/demo entry points;
- super-admin global audit explorer and append-only audit/ledger enforcement;
- production browser security headers;
- privacy, RBAC, state-machine, pricing, matching, transaction, cull-provenance, session and onboarding tests.

## Run locally

Prototype backend:

```bash
npm install
npm run dev
```

PostgreSQL backend:

```bash
cp .env.example .env
# configure DATABASE_URL and AUTH_SECRET
npm install
npm run db:push
npm run dev
```

See `docs/ARCHITECTURE.md` for domain architecture, `docs/MATCHING.md` for the matching contract, `docs/TRANSACTIONS.md` for the commercial/clearance contract, `docs/LOGISTICS.md` for transport custody, `docs/RECEIVING.md` for institutional intake, `docs/FINANCE.md` for the settlement ledger, `docs/DISPUTES.md` for rejected-receipt exceptions, `docs/SECURITY.md` for the application security contract, and `docs/DEPLOYMENT.md` for environment/deployment details.

## Verification

```bash
npm run check
```

CI validates the Prisma schema, runs business/privacy/security tests, typechecks, and performs a production Next.js build.

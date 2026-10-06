# RAM Marketplace

Digital marketplace and operating system for Realistic Animal Models (RAM).

RAM connects verified, naturally occurring animal disease cases with biomedical research needs while protecting source-farm identity and enforcing permissioned disclosure.

## Core rule

The scientist experience is an **animal marketplace, not a farm marketplace**. Farms are never presented as branded sellers. Scientist-facing data is an anonymized projection of the underlying case record; sensitive source information is released only through explicit permissions and transaction gates.

## Current prototype

- Scientist marketplace with realistic animal cards and filters.
- Animal detail page with disclosure state and additional-information request entry point.
- Private farm case dashboard and default disclosure controls.
- RAM operations dashboard.
- Canonical case lifecycle and matching weights.
- Initial PostgreSQL/Prisma schema separating farm/source data from marketplace case data.
- Architecture specification in `docs/ARCHITECTURE.md`.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For a production build check:

```bash
npm run typecheck
npm run build
```

## Development approach

Changes are developed on feature branches and merged through pull requests. The next implementation phase is authentication, organizations/RBAC, persisted animal submission, research needs, veterinary verification, and the enforced anonymous marketplace query boundary.

## Phase 2 foundation

The second build phase adds:

- organization membership roles and application capabilities;
- a separate restricted source-record data model;
- server-only marketplace projection with automated leak tests;
- farm animal-submission workflow with validation;
- structured research-needs workflow;
- veterinary verification workspace;
- server-side prototype transaction persistence;
- expanded CI including privacy/RBAC tests.

The prototype transaction store is intentionally temporary. The schema is PostgreSQL-ready; durable database wiring, migrations and production authentication follow once the deployment environment is provisioned.

- Farm intake now records the pre-existing cull decision date, planned cull date, cull reason and an independent-cull attestation so the platform preserves cull-first provenance.

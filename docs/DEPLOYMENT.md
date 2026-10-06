# RAM deployment foundation

## Required production configuration

RAM fails closed toward PostgreSQL in production. A deployment should set:

- `DATABASE_URL` — PostgreSQL connection string.
- `RAM_DATA_BACKEND=postgres`.
- `AUTH_SECRET` — long random secret used to sign HTTP-only session cookies.
- `RAM_PUBLIC_ONBOARDING_ENABLED=false` until the chosen external identity provider / email-verification path is connected.
- `RAM_DEMO_AUTH_ENABLED=false`.
- `RAM_MAX_MUTATION_BYTES=1048576` unless a different reviewed application limit is required.

Use `.env.example` for local configuration.

## Prisma 7

The project uses the Prisma 7 `prisma-client` generator with the PostgreSQL driver adapter. `npm install` runs `prisma generate` automatically.

Useful commands:

```bash
npm run prisma:validate
npm run prisma:generate
npm run db:push
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:migrate:drift
```

For a disposable development database, `db:push` is adequate. Production and pilot databases must use the committed migration history via `db:migrate:deploy`; `db:push` and `migrate reset` are not production deployment tools. See `docs/DATABASE.md`.

## Data backend

- Development without `DATABASE_URL`: RAM uses the in-process prototype backend.
- Development with `DATABASE_URL` or `RAM_DATA_BACKEND=postgres`: RAM uses PostgreSQL.
- Production: RAM defaults to PostgreSQL and throws if `DATABASE_URL` is missing.

This prevents a deployed production instance from silently falling back to ephemeral storage.

## Authentication boundary

RAM currently implements the application session boundary:

- HMAC-SHA256 signed session token.
- HTTP-only cookie.
- `SameSite=Strict`.
- `Secure` in production.
- 12-hour expiry.
- protected farm, research, veterinary, operations and account routes.
- API routes independently re-check authentication and RBAC close to the data operation.

The external identity proofing mechanism is deliberately deployment-configurable. Local development can use environment-gated demo identities. Production demo auth is off unless explicitly enabled.

## Request security

Unsafe `/api/*` requests pass explicit same-origin validation in addition to `SameSite=Strict` cookies. Cross-site Fetch Metadata is rejected, production fails closed when no usable same-origin source is available, and declared request bodies are capped by `RAM_MAX_MUTATION_BYTES`.

The platform/reverse proxy must separately enforce a hard request-body cap so chunked requests cannot bypass a `Content-Length`-based application check.

Public onboarding and demo sign-in use PostgreSQL-backed fixed-window throttles in deployed PostgreSQL mode. Production should also configure edge/WAF throttling.

Security headers are configured centrally in `next.config.ts`. HSTS is production-only.

See `docs/SECURITY.md` for the complete application/infrastructure split.

## Onboarding

Self-onboarding creates an organization, its first user membership and—for farms—a restricted farm-site record. New organizations begin in `PENDING_VERIFICATION`.

Farm exact address and source identity remain in the restricted source layer and never become marketplace fields.

## First database boot

After provisioning PostgreSQL:

```bash
cp .env.example .env
# edit DATABASE_URL and AUTH_SECRET
npm install
npm run prisma:validate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:migrate:drift
npm run dev
```

The repository now contains the reviewed initial migration baseline. Before a production launch, apply it with `db:migrate:deploy`, require clean migration status/drift checks, and connect the selected production identity provider.

Also configure TLS, edge/WAF throttling, trusted forwarding headers, PostgreSQL network restrictions, encrypted backups, centralized logging/alerting, dependency/image scanning and tested restore/incident procedures before admitting real transactions.

## Pilot readiness

Run `npm run pilot:check` against the intended production environment. A non-zero exit code means an automatically verifiable launch requirement is blocked.

RAM also exposes a super-admin `/ops/pilot` dashboard with the same automatic checks plus manual deployment gates.

CI runs the live workflow twice: once against isolated prototype storage and again against PostgreSQL created from the committed migration history. The PostgreSQL job also checks schema drift and performs a populated dump/restore comparison. These checks do not replace production-provider backup/PITR drills or external identity/payment validation.

See `docs/PILOT.md` before admitting real transactions.

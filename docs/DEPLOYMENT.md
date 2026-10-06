# RAM deployment foundation

## Required production configuration

RAM fails closed toward PostgreSQL in production. A deployment should set:

- `DATABASE_URL` — PostgreSQL connection string.
- `RAM_DATA_BACKEND=postgres`.
- `AUTH_SECRET` — long random secret used to sign HTTP-only session cookies.
- `RAM_IDENTITY_ASSERTION_SECRET` — separate long random secret shared only with the trusted identity gateway.
- `RAM_IDENTITY_ALLOWED_PROVIDERS` — comma-separated exact provider identifiers accepted in signed assertions.
- `RAM_IDENTITY_LOGIN_URL` — HTTPS entry point for the upstream identity provider/gateway.
- `RAM_IDENTITY_REQUIRE_MFA=true`.
- `RAM_PAYMENT_GATEWAY_NAME` — exact configured payment gateway identifier.
- `RAM_PAYMENT_GATEWAY_URL` — HTTPS gateway base URL.
- `RAM_PAYMENT_GATEWAY_SECRET` — long random payment signing secret distinct from session/identity secrets.
- `RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL=false`.
- `RAM_PUBLIC_ONBOARDING_ENABLED=false`.
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

Production identity proofing is deliberately provider-neutral. The upstream provider/gateway authenticates the user, verifies email/MFA, and POSTs a short-lived HMAC-signed one-time assertion to `/api/session/external`. RAM validates the provider allowlist, signature, audience, MFA signal, lifetime and replay ID before issuing a RAM session.

For PostgreSQL-backed requests, RAM then re-checks durable membership and organization status on every protected request. A still-valid cookie immediately loses operational authority when its membership or organization is suspended.

Local development can use environment-gated demo identities. Production demo auth is off unless explicitly enabled. See `docs/IDENTITY.md`.

## Payment execution boundary

RAM finance may initiate buyer collections, supplier payouts and buyer refunds through the configured provider-neutral gateway.

Outbound instructions and inbound webhooks are HMAC-signed. Provider success callbacks append the existing ledger movement; submission alone never counts as payment.

Network/5xx ambiguity is stored as `SUBMISSION_UNKNOWN` and retried with the same idempotency key rather than creating a second instruction.

Production requires HTTPS. The explicit insecure loopback override exists only for CI and blocks pilot readiness when enabled.

See `docs/PAYMENTS.md`.

## Request security

Unsafe `/api/*` requests pass explicit same-origin validation in addition to `SameSite=Strict` cookies. Cross-site Fetch Metadata is rejected, production fails closed when no usable same-origin source is available, and declared request bodies are capped by `RAM_MAX_MUTATION_BYTES`.

The platform/reverse proxy must separately enforce a hard request-body cap so chunked requests cannot bypass a `Content-Length`-based application check.

Public onboarding and demo sign-in use PostgreSQL-backed fixed-window throttles in deployed PostgreSQL mode. Production should also configure edge/WAF throttling.

Security headers are configured centrally in `next.config.ts`. HSTS is production-only.

See `docs/SECURITY.md` for the complete application/infrastructure split.

## Onboarding

Production self-onboarding begins only after a verified external identity. RAM binds the verified user to the enrollment flow, creates the organization and first membership, and creates an explicit organization-verification record. New organizations begin in `PENDING_VERIFICATION` and cannot perform operational actions until a RAM super admin approves them.

Farm exact address and source identity remain in the restricted source layer and never become marketplace fields.

## First database boot

After provisioning PostgreSQL:

```bash
cp .env.example .env
# edit DATABASE_URL, AUTH_SECRET, RAM_IDENTITY_* and RAM_PAYMENT_GATEWAY_* configuration
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

CI runs the live workflow twice: once against isolated prototype storage and again against PostgreSQL created from the committed migration history. The PostgreSQL job also exercises the signed external identity boundary, assertion replay prevention, verified onboarding, immediate durable-session revocation/reactivation, schema drift and populated dump/restore. These checks do not replace validation of the actual upstream identity provider/gateway, production-provider backup/PITR drills or payment-provider validation.

See `docs/PILOT.md` before admitting real transactions.

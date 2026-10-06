# RAM deployment foundation

## Required production configuration

RAM fails closed toward PostgreSQL in production. A deployment should set:

- `DATABASE_URL` — PostgreSQL connection string.
- `RAM_DATA_BACKEND=postgres`.
- `AUTH_SECRET` — long random secret used to sign HTTP-only session cookies.
- `RAM_PUBLIC_ONBOARDING_ENABLED=false` until the chosen external identity provider / email-verification path is connected.
- `RAM_DEMO_AUTH_ENABLED=false`.

Use `.env.example` for local configuration.

## Prisma 7

The project uses the Prisma 7 `prisma-client` generator with the PostgreSQL driver adapter. `npm install` runs `prisma generate` automatically.

Useful commands:

```bash
npm run prisma:validate
npm run prisma:generate
npm run db:push
npm run db:migrate:dev
```

For a disposable development database, `db:push` is adequate. Production schema changes should be committed as reviewed migrations before deployment.

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
npm run db:push
npm run dev
```

Before a production launch, replace `db:push` with committed migrations and connect the selected production identity provider.

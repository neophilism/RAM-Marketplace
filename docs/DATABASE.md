# RAM PostgreSQL migration and recovery runbook

## Governing rule

Production schema changes are migration-driven.

Do not use `prisma db push` against a production or pilot database. Do not use `prisma migrate reset` against a database containing real records.

The committed migration directory is the schema change record.

## Initial baseline

The first migration is:

`20261006062000_initial`

Its SQL was generated directly from the Prisma schema with Prisma 7:

```bash
prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

PR #15 then verifies that migration by applying it to an empty PostgreSQL 16 database in CI.

## Creating later migrations

For a schema change:

1. modify `prisma/schema.prisma`;
2. point `DATABASE_URL` to a disposable developer PostgreSQL database;
3. run:
   ```bash
   npm run db:migrate:dev -- --name descriptive_change_name --create-only
   ```
4. inspect the generated SQL;
5. check destructive operations, locks, table rewrites, enum changes, nullability changes and required backfills;
6. adjust the SQL deliberately when a multi-step/backfill migration is safer than Prisma's default;
7. commit both schema and migration;
8. let CI deploy the complete migration history from empty and run the PostgreSQL E2E suite.

Never hand-edit an already-applied production migration. Add a new corrective migration.

## Production deployment

Before application deployment:

```bash
npm install
npm run prisma:validate
npm run db:migrate:status
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:migrate:drift
```

`db:migrate:drift` compares the live configured database to `prisma/schema.prisma` and must report no difference after deployment.

The application release should not start accepting traffic if migration deployment or drift verification fails.

## Rollback policy

Prisma production migrations are treated as forward-only.

If a release has an application defect but the migration is compatible with the previous application version, roll back the application while leaving the schema in place.

If a migration itself caused a data/schema incident:

1. stop writes;
2. preserve logs and the failed database;
3. determine whether a forward corrective migration is safe;
4. if safe, create and deploy the corrective migration;
5. if data integrity requires point-in-time recovery, restore the latest verified backup into a **new database**;
6. validate migration status, application smoke tests and critical record counts;
7. switch application traffic only after validation.

Do not use `migrate reset`, destructive `db push`, or an edited historical migration as a rollback mechanism.

## Backup

The repository includes a portable logical backup command:

```bash
DATABASE_URL=postgresql://... npm run db:backup -- /secure/path/ram.dump
```

It creates:

- a PostgreSQL custom-format dump;
- a SHA-256 checksum sidecar.

Backups must be encrypted at rest by the storage system and copied outside the database failure domain.

This script is a logical backup helper; the production provider should also supply automated snapshots / point-in-time recovery where available.

## Restore verification

Create a fresh empty recovery database, then:

```bash
DATABASE_URL=postgresql://current-production/ram \
RAM_RESTORE_DATABASE_URL=postgresql://recovery-host/ram_restore \
npm run db:restore:verify -- /secure/path/ram.dump
```

The restore command:

- refuses to target the current `DATABASE_URL`;
- refuses a recovery database that already contains RAM tables;
- verifies the checksum when the sidecar is present;
- restores without ownership/ACL metadata;
- runs Prisma migration status against the recovered database.

After that, run application smoke/E2E checks against the recovered database before cutover.

## CI database verification

The PostgreSQL integration job uses a fresh PostgreSQL 16 service and performs:

1. install/generate Prisma client;
2. `prisma migrate deploy` from an empty database;
3. migration-status verification;
4. live-database/schema drift verification;
5. controlled multi-role seed;
6. production application build;
7. full happy-path HTTP E2E against PostgreSQL;
8. replacement-dispute E2E;
9. refund-dispute E2E;
10. `pg_dump` of the populated test database;
11. restore into a second database;
12. row-count comparison for critical business/audit tables;
13. migration-status verification on the restored database.

This complements the prototype E2E. The two jobs exercise the same application workflow against both storage implementations.

## Recovery objectives

Recovery point objective (RPO) and recovery time objective (RTO) are operational commitments, not values the application can invent.

Before a real pilot, RAM operations must choose them based on transaction volume, welfare/logistics consequences, financial records and acceptable manual reconstruction risk. Backup frequency, PITR retention and restore drills must then be configured to meet those targets.

## Migration permissions

The runtime application account should not need schema-creation privileges.

A preferred production model is:

- deployment/migration credential: can apply reviewed DDL migrations;
- application runtime credential: only the DML privileges required by RAM;
- backup/recovery credential: separately controlled according to provider requirements.

Database-level append-only restrictions for `AuditEvent` and `FinancialLedgerEntry` should be added when the production database privilege model is finalized.

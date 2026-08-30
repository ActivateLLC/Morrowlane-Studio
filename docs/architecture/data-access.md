# Data access and security

## Tenancy

Every table is reachable from an organization. Row-level security policies are written
against membership (`is_org_member`, `can_edit_org`, `can_read_brand`, `can_edit_brand`
— security-definer functions so policies do not recurse). There is no query path to
another tenant's rows.

## Which client runs where

- The **web app** authenticates users with Supabase Auth and performs its reads/writes
  through server actions using the service-role store, after `requireSession` /
  `requireBrand` establish membership and ownership in application code.
- The **worker** and **API** hold the service role: cross-user work (the publish queue,
  metrics collection) cannot run under a single user's RLS context.

## Secrets

Social access tokens are AES-256-GCM-encrypted (`MORROWLANE_ENCRYPTION_KEY`) before
they reach Postgres, and the store's read path never returns them on a connection
record — only `getConnectionSecret` decrypts, and only the worker calls it. The
demo session path is disabled whenever Supabase credentials are configured.

## Jobs

`claim_job()` uses `FOR UPDATE SKIP LOCKED`; scheduled posts are claimed by a
conditional status flip. Both are safe under concurrent workers.

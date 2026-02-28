Supabase / Postgres migrations for Story 002 — NFe Automation

Apply the migration using psql or the Supabase CLI.

Requirements
- A Postgres connection string with sufficient privileges.

Using psql:

```bash
psql "$PG_CONNECTION_STRING" -f supabase/migrations/001_init.sql
```

Using Supabase CLI (example):

```bash
# ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or a DB connection string
supabase db remote set "$PG_CONNECTION_STRING"
psql "$PG_CONNECTION_STRING" -f supabase/migrations/001_init.sql
```

Notes
- The migration enables `pgcrypto` for `gen_random_uuid()`; adjust if your Postgres setup differs.
- The schema includes unique constraints for `(seller_id, access_key_44)` and `(seller_id, serie, nNF)` to prevent duplicates.
- An `invoice_reservations` table is provided to support reservation patterns during `reserveInvoiceNumber()` implementation.

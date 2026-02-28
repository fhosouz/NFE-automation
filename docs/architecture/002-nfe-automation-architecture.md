# Architecture: Story 002 — NFe Automation

**Created:** February 23, 2026
**Scope:** Technical architecture and design for Story 002 (NFe Automation)

---

**Goals (recap)**
- Ingest `order.created` webhooks from Mercado Livre
- Fetch and normalize order data
- Map to Sebrae NFe layout and generate valid NFe XML
- Persist XML (Supabase Storage) and metadata (Supabase Postgres)
- Enforce MEI rules, validations, and concurrency-safe invoice numbering
- Deploy on Render; production exposed via Cloudflare (HTTPS)

---

**High-level system architecture (text diagram)**

```
      Mercado Livre Webhooks
               │
               ▼
        Cloudflare (DNS, TLS, WAF)
               │
               ▼
        Render Web Service (HTTP)  <-- Admin UI / Dashboard
               │
               ▼
         Queue (Redis / Render Background Jobs)
               │
               ▼
         Worker Pool (Render background instances)
               │
  ┌────────────┼──────────────┐
  │            │              │
  ▼            ▼              ▼
Postgres (Supabase)  Storage (Supabase Storage/S3)  Monitoring/Logs
   (metadata, locks)      (xml files)                    (Sentry/Prom)

```

---

Service responsibilities

- Web (Render service)
  - Expose `POST /webhooks/mercadolivre` endpoint
  - Authenticate webhook (signature/verification)
  - Quick validation & enqueue job (idempotency check)
  - Provide minimal authenticated dashboard endpoints (list XMLs, download signed URL)
  - Health, metrics, basic admin

- Worker (background)
  - Fetch complete order details from Mercado Livre API
  - Normalize payload to internal model
  - Validate required fields (product NCM, customer CPF/CNPJ)
  - Reserve invoice number atomically and generate NFe XML
  - Validate XML against XSDs and persist to Supabase Storage
  - Update DB records, emit events/notifications
  - Retry handling and dead-letter logging

- DB (Supabase Postgres)
  - Persist `sellers`, `orders`, `products`, `customers`, `xmls`
  - Provide ACID transactions for invoice numbering
  - Store processed webhook ids for idempotency

---

Folder structure (Node.js + TypeScript)

- src/
  - server/
    - index.ts                # app entry (Express/Fastify)
    - webhooks/mercadoLivre.ts
    - routes/*.ts
  - workers/
    - index.ts                # worker bootstrap
    - jobs/processOrder.ts
  - services/
    - mercadolivreClient.ts
    - supabaseClient.ts
    - xmlBuilder.ts           # mapping + XML generation
    - xsdValidator.ts         # XSD validation wrapper
    - invoiceService.ts       # invoice numbering & reservation
    - idempotency.ts
    - notifications.ts
  - db/
    - migrations/
    - models/
      - sellers.ts
      - orders.ts
      - products.ts
      - xmls.ts
  - config/
    - index.ts                # env, Render vars
  - utils/
    - logging.ts
    - retry.ts
    - locks.ts                # advisory locks helpers
  - tests/
  - scripts/
- package.json
- tsconfig.json
- README.md

---

Transaction strategy for atomic invoice numbering

Use Postgres transactions with a row lock on the `sellers` row. Example flow (pseudocode):

1. BEGIN TRANSACTION
2. SELECT next_invoice_number, serie FROM sellers WHERE id = $1 FOR UPDATE
3. nNF = next_invoice_number
4. UPDATE sellers SET next_invoice_number = next_invoice_number + 1 WHERE id = $1
5. INSERT xmls (order_id, seller_id, nNF, serie, ...)
6. COMMIT

Notes:
- Use SERIALIZABLE or REPEATABLE READ only if needed; `SELECT ... FOR UPDATE` + single-row update is sufficient and scales.
- Prefer short transactions and do not call external services while the transaction is open.
- If worker needs to validate XSD (external step), reserve the invoice number by marking it `reserved=true` or insert an intermediate `invoices` row and finalize after XML validation.
- For long-running operations, implement a two-phase reservation: (a) atomic reserve increment, (b) generate XML off-transaction, (c) attach xml to reserved invoice and mark `issued`.

---

Idempotency strategy for webhooks

- Primary idempotency key: Mercado Livre delivery `id` or `resource.id` + `event` + `seller_id`.
- Store processed webhook keys in `webhook_events` table with status and TTL (keep for 30 days).
- Web endpoint flow:
  - Validate signature → extract idempotency_key
  - Attempt INSERT into `webhook_events` with unique constraint on `idempotency_key` (INSERT ... ON CONFLICT DO NOTHING). If conflict, return 200 (already processed).
  - If new, enqueue job and respond 200 quickly.
- Workers use the order id as a second-level idempotency guard (upsert `orders` by `ml_order_id`).

---

NFe XML generation architecture

- Mapping layer (`xmlBuilder.ts`): transform normalized order model into NFe domain model using template objects.
- Use a declarative mapper: mapping rules per field (source path → NFe tag, transformation fn).
- Use a robust XML builder library (e.g., xmlbuilder2) that supports namespaces and attributes.
- Operate in worker: build XML string, run XSD validation, compute totals.
- Store both raw XML and a small normalized JSON representation for quick debugging.

Operational default fields (per MEI): set in mapping layer before rendering: `indFinal=1`, `indPres=2`, `modFrete=9`, `tpNF=1`, `procEmi=0`, `verProc="ML-NFE-1.0"`.

Access key (44-digit) generation

- Implement SEFAZ algorithm in `invoiceService.generateAccessKey()`:
  - Build key components: cUF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF
  - Calculate DV (mod 11) checksum
  - Return 44-digit string; store in `xmls.access_key_44`
- Validate against official spec and include in XML tag `chNFe`.

---

XSD validation approach

- Keep official NFe XSD files in repo under `/resources/xsds/` (versioned). Include CI tests.
- Use `libxmljs` or `xmllint` binary (called from worker) for strict validation.
- Validation steps in worker:
  1. Build XML string
  2. Validate against XSD; capture errors
  3. On success: store XML; on failure: store errors, mark `orders.status=error` and push to DLQ
- Add unit tests that assert generated XMLs validate against XSD in CI pipeline.

---

Error handling and retry strategy

- Transient errors (network, rate-limits): retry with exponential backoff (worker-level) up to N attempts (configurable, e.g., 5).
- Permanent validation errors (missing NCM, missing CPF/CNPJ): mark order `pending_configuration` and notify seller; do NOT retry automatically.
- Failed jobs exceed retry → move to Dead Letter Queue (DLQ) table for manual inspection/retry.
- Monitoring: Sentry for exceptions, Prometheus for job metrics, alerts for DLQ size > threshold.

---

Supabase integration design

- Use Supabase Postgres for metadata; use Supabase Storage for XML files (S3-compatible under the hood).
- Use a service role key for backend-only operations (never embed in client). Store secrets in Render environment variables.
- Recommended tables:
  - sellers (with `next_invoice_number`, `serie`, `environment`)
  - orders (ml_order_id unique, status, processing_attempts, last_error, updated_at)
  - products (ncm, pending_configuration boolean)
  - xmls (access_key_44, nNF, serie, xml_url, validation_status)
  - webhook_events (idempotency_key, processed_at)
- Use Supabase Row Level Security (RLS) for the dashboard endpoints and strict service-role usage for workers.

Signed download URLs

- Generate time-limited signed URLs via Supabase Storage SDK when a seller requests download.
- For API downloads, validate seller auth and serve signed URL or stream XML through the web service for extra access control.

---

Deployment architecture (Render + Cloudflare)

- Render: host two services
  - `web` (HTTP service): handles webhooks and dashboard
  - `worker` (background): processes queue jobs
- Redis: use managed Redis (or Render Background Workers + a managed Redis provider) for transient queue, or use Supabase Jobs + cron for simple setups
- DNS: Cloudflare to manage domain, proxy traffic to Render services, enable TLS and WAF rules
- Secrets: Set Render environment variables for Supabase URL/keys, Mercado Livre credentials, Cloudflare API token
- CI/CD: GitHub Actions pipeline to deploy to Render on merge; run XSD validation tests in CI

---

Concurrency model

- Web nodes are stateless; workers are horizontally scalable.
- Use database row-level locking (`FOR UPDATE`) for single-seller invoice reservations.
- Use advisory locks for cross-entity critical sections if needed (e.g., `pg_advisory_xact_lock(hashtext('seller:{id}'))`).
- Queue backpressure: limit worker concurrency per seller to avoid hot-contending sellers.
- Ensure idempotent writes (upsert patterns) to allow retries without duplication.

---

Operational notes & tradeoffs

- Keep transaction windows short; do not call external APIs while holding locks.
- Prefer reservation pattern: atomically reserve invoice number, release on success/failure path.
- Avoid heavy XML building inside DB transactions.
- Homologation default reduces risk when onboarding sellers; allow switching `environment` to production when ready.

---

Next steps (recommended)

1. Create DB migration scripts for Supabase tables described above.  
2. Implement `invoiceService` with `reserveInvoiceNumber()` (transactional) and `generateAccessKey44()`.  
3. Implement worker `processOrder` job with clear validation branches: auto-create `products` (pending) vs fail and notify.  
4. Add XSDs and CI validation tests.  

---

End of architecture document.

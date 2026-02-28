# Story 002 — Solo Developer Task Breakdown

Focus: fastest path to a working MVP that converts a Mercado Livre order into a validated NFe XML saved in Supabase and downloadable by the seller.

Suggested order is optimized for incremental, testable progress.

1. Task name: Repo scaffold & basic CI
   - Description: Create Node.js + TypeScript project scaffold, basic `package.json`, linting, tsconfig, and lightweight CI that runs tests. Add README with local dev steps and Supabase dev pointers.
   - Dependencies: none
   - Complexity: S

2. Task name: Supabase schema & migrations
   - Description: Add SQL migration files for `sellers`, `orders`, `xmls`, `products`, `customers`, and `webhook_events` (idempotency). Include unique constraints `(seller_id, access_key_44)` and `(seller_id, ml_order_id)` and indexes used by reservation logic.
   - Dependencies: Repo scaffold
   - Complexity: M

3. Task name: Webhook receiver + idempotency
   - Description: Implement `/webhook/ml` endpoint to receive Mercado Livre webhooks, verify signatures, persist `webhook_events` idempotency records, and create `orders` rows with status `received` (store raw payload).
   - Dependencies: Supabase migrations
   - Complexity: M

4. Task name: Mercado Livre client & order normalizer
   - Description: Implement a small ML client to fetch order details and a normalizer to map ML payload to the internal `normalized_payload` shape used by the mapping layer.
   - Dependencies: Webhook receiver
   - Complexity: M

5. Task name: Order lifecycle persistence & simple UI endpoint
   - Description: Persist lifecycle states (`received`, `processing`, `pending_configuration`, `xml_generated`, `error`). Add a minimal authenticated endpoint to view order status and error details (useful for debugging/pilot sellers).
   - Dependencies: Webhook, Order normalizer
   - Complexity: S

6. Task name: Product & customer validation (pending_configuration flow)
   - Description: Validate required fields: product `ncm` and customer `cpf_cnpj`. If missing, create `products` record marked `pending_configuration` and set order status to `pending_configuration` with actionable error message.
   - Dependencies: Order normalizer, Order persistence
   - Complexity: M

7. Task name: Transactional invoice reservation (`reserveInvoiceNumber`)
   - Description: Implement short, concurrency-safe DB transaction to reserve `nNF` for a seller: lock seller row (SELECT ... FOR UPDATE), read `next_invoice_number`, insert tentative `xmls` or reservation record, and increment `next_invoice_number` on commit.
   - Dependencies: Supabase schema, Order lifecycle
   - Complexity: M

8. Task name: Access key generator (`generateAccessKey44`) + tests
   - Description: Implement SEFAZ 44-digit access key generator (including `cNF` 8-digit) with unit tests and deterministic behavior for homologation. Ensure DB uniqueness handling (retry on conflict or use advisory lock).
   - Dependencies: Transactional invoice reservation
   - Complexity: M

9. Task name: `xmlBuilder.ts` mapping + MEI defaults + CFOP core logic
   - Description: Implement mapping layer from normalized order -> NFe XML structure. Include MEI defaults (CRT, CSOSN, taxes zero), CFOP default (5102) and comment where CFOP per-destination should be added later. Keep mapping modular and testable.
   - Dependencies: Order normalizer, Access key generator
   - Complexity: M

10. Task name: XSD validation & unit tests
    - Description: Integrate XSD validator to check generated XML against official schemas. Add unit tests that validate sample XMLs and fail fast when schema mismatches occur.
    - Dependencies: xmlBuilder
    - Complexity: M

11. Task name: Persist XML to Supabase Storage + metadata
    - Description: Store validated XML in Supabase Storage (S3-compatible), create `xmls` metadata record linking `order_id`, `seller_id`, `access_key_44`, `nNF`, `serie`, `xml_url`, and set status `xml_generated`.
    - Dependencies: XSD validation, Access key generator
    - Complexity: S

12. Task name: Signed download URL & minimal seller access
    - Description: Implement signed URL generation for downloaded XMLs and an authenticated endpoint/dashboard for pilot sellers to list/download XMLs.
    - Dependencies: XML storage
    - Complexity: S

13. Task name: Worker / queue integration (optional fast path)
    - Description: Implement a simple background worker using Redis + Bull (or a lightweight in-process queue initially). Worker processes `orders.processing` jobs: runs reservation, access-key generation, XML build, validation, and storage. Keep worker small to simplify retries and DLQ.
    - Dependencies: Order lifecycle, XML persistence
    - Complexity: M

14. Task name: Scheduled reprocessing for `pending_configuration`
    - Description: Add a scheduled job (cron) that finds `orders` in `pending_configuration` and retries after changes (e.g., missing NCM fixed). This is MVP replacement for event-driven requeue.
    - Dependencies: Product/customer validation, Worker
    - Complexity: S

15. Task name: Render deployment, Cloudflare DNS/TLS, signed URLs in prod
    - Description: Deploy web + worker to Render, configure Cloudflare DNS and TLS, ensure signed URLs and storage permissions are correct. Use `tpAmb=2` default in config for homologation.
    - Dependencies: All core runtime tasks complete
    - Complexity: S

16. Task name: CI tests, monitoring & basic alerts
    - Description: Add unit tests for `generateAccessKey44()` and XSD validation, wire Sentry/logging, and a basic health alert for failed jobs.
    - Dependencies: XSD validation, Worker
    - Complexity: S

17. Task name: Pilot onboarding (3 sellers)
    - Description: Onboard 3 pilot sellers, run test orders end-to-end, collect logs/errors, and make quick fixes prioritized by impact.
    - Dependencies: Deployment, Signed URLs, Monitoring
    - Complexity: S

Notes — fastest path to MVP suggestions
- Combine steps 3–11 into a single end-to-end flow early (webhook → normalize → reserve → generate access key → build XML → validate → store) so you can exercise the entire pipeline quickly. Refactor into worker + queue (task 13) after the happy path is stable.
- Timebox tasks per day. Early wins: scaffold + migrations + webhook + normalizer + reservation + access key + xmlBuilder → should produce first end-to-end run within a few days.
- Prioritize unit tests for `generateAccessKey44()` and XSD validation to avoid hard-to-debug failures during pilot.

---

Created: February 23, 2026

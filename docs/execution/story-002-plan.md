# Story 002 — Execution Plan

**Overview**

This document captures the recommended phased execution plan, task order, MVP milestone, and a solo-developer approach for Story 002 (NFe Automation).

## Phases

- Phase 0 — Prep: set up accounts (Supabase, Render, Cloudflare), dev environment, and CI basics.
- Phase 1 — Scaffold & Infra: Node.js + TypeScript scaffold, Supabase schema + migrations, Render service skeleton.
- Phase 2 — Ingress & Idempotency: webhook receiver, idempotency store, ML auth, order fetcher.
- Phase 3 — Core Mapping & Validation: `xmlBuilder.ts` mapping, MEI defaults, CFOP logic, XSD validation.
- Phase 4 — Invoice Reservation & Access Key: transactional `reserveInvoiceNumber()`, `generateAccessKey44()`, DB uniqueness constraints.
- Phase 5 — Worker & Storage: background worker, queue, XML persistence to Supabase Storage, signed URLs.
- Phase 6 — Operations & Retry: retries, DLQ, scheduled reprocessing for `pending_configuration` orders, monitoring and alerts.
- Phase 7 — Pilot & Iterate: onboard 3 pilot sellers, collect feedback, fix edge cases, prepare production cutover.

## Task Order (high-level)

1. Create repo scaffold: `package.json`, TypeScript, linting, basic README.
2. Add Supabase migrations: `sellers`, `orders`, `xmls`, `products`, `customers` and unique constraints `(seller_id, access_key_44)`, `(seller_id, ml_order_id)`.
3. Implement webhook endpoint with idempotency (`webhook_events` table) and basic auth verification for Mercado Livre.
4. Implement Mercado Livre client + order normalizer; create `orders` records with lifecycle state `received`.
5. Implement product/customer validation rules; mark `pending_configuration` when NCM/CPF missing.
6. Implement transactional invoice reservation (`reserveInvoiceNumber`) using short DB transactions and update `sellers.next_invoice_number` on success.
7. Implement `generateAccessKey44()` following SEFAZ rules; store `access_key_44` and enforce uniqueness.
8. Implement `xmlBuilder.ts` mapping with MEI defaults, CFOP core logic, and run XSD validation against official schemas.
9. Persist validated XML to Supabase Storage and save `xmls` metadata; generate signed URL for download.
10. Implement worker queue, retries, DLQ and scheduled reprocessing job for `pending_configuration`.
11. Setup Render deployment and Cloudflare DNS/TLS; add basic monitoring (Sentry / logs) and CI tests (XSD validation unit tests).

## MVP Milestone

Goal: Deliver a reliable pipeline that converts a Mercado Livre order into a valid NFe XML stored in Supabase and downloadable by the seller.

MVP Acceptance:
- Receive `order.created` webhook and create a single validated XML per order.
- Atomic invoice numbering per seller with DB-enforced uniqueness.
- Access key generation stored and unique per seller.
- Block generation when required fields (NCM, CPF/CNPJ) are missing and surface actionable errors.
- Storage of XML in Supabase Storage and signed download link.

Out of scope for MVP:
- Automatic certificate-based emission to SEFAZ.
- Event-driven reprocessing (Phase 2+ feature — MVP uses scheduled reprocess).

## Solo Developer Approach

How to work efficiently as a single engineer:

- Timebox each phase to 1–3 days depending on complexity; prefer small, testable milestones.
- Start with infra and migrations — these are high-leverage and reduce downstream rework.
- Implement minimal happy-path flows first: webhook → normalize → reserve number → build XML → validate → store.
- Add defensive checks afterwards: idempotency, uniqueness constraints, pending configuration flow.
- Use feature flags or config toggles for homologation (`tpAmb=2`) vs production `tpAmb=1`.
- Prefer small commits with tests: unit tests for `generateAccessKey44()` and XSD validation, integration test that runs end-to-end against local Supabase/Render environments.
- Use a lightweight queue (Redis + Bull) locally; consider Render background workers for production.

Quick checklist for first 3 days (solo sprint):

1. Repo scaffold + Supabase migration files.
2. Webhook receiver + idempotency table + ML order fetcher.
3. Transactional `reserveInvoiceNumber()` + simple `generateAccessKey44()` unit tests.

## Notes & Risks

- Risk: Incorrect access-key algorithm or concurrency bugs — mitigate with unit tests and DB uniqueness constraints.
- Risk: Missing NCM/CPF data from Mercado Livre — mitigate with `pending_configuration` flow and seller notifications.
- Operational: Start with scheduled reprocessing; plan for event-driven requeue later.

---

Created: February 23, 2026

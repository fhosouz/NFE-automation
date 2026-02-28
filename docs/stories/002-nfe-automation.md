# Story 002: NFe Automation - Generate NFe XML from Mercado Livre Orders

**Status:** Ready  
**Priority:** P0 - MVP  
**Epic:** NFe Automation  
**Assignee:** Team  

---

## Overview

Automatically transform Mercado Livre order data into a valid NFe XML (official layout used by Sebrae) so small sellers can import the XML into Sebrae for emission. Implementation language: Node.js. Suggested DB: Supabase (Postgres + storage). Deploy backend on Render. For local testing webhooks may use HTTP; production requires HTTPS (we assume a domain behind Cloudflare).

## Goal
- Remove repetitive manual invoice creation by generating ready-to-import NFe XML per order.

## Key Constraints
- Low-cost stack (Supabase + Render)  
- No automatic emission with certificates (manual import to Sebrae)  
- Production must use HTTPS (Cloudflare + Render recommended)  
- Implementation language: Node.js

---

## Acceptance Criteria

### Core Webhook & Data Flow
- [ ] `order.created` webhook from Mercado Livre is received and authenticated
- [ ] Duplicate webhooks are handled idempotently (no duplicate XMLs)
- [ ] System fetches complete order details from Mercado Livre API
- [ ] Data normalization/transformation layer maps Mercado Livre fields to Sebrae NFe layout
- [ ] Generated NFe XML validates against the official XSDs
- [ ] XML persisted in Supabase Storage and metadata saved in Supabase Postgres (order id, seller id, status, url)
- [ ] Seller can securely download XML via time-limited signed URL or via authenticated dashboard
- [ ] Clear logging and actionable validation errors for failed XMLs

### MEI Tax Regime Configuration
- [ ] System configured for MEI tax regime (CRT=1, CSOSN=102 for all items)
- [ ] All taxes automatically set to zero (vItem, vST, vICMS, vIPI, vPIS, vCOFINS = 0.00)
- [ ] Default CFOP configured to 5102 (sales for end consumer)
- [ ] Issuer data pre-configured with CNPJ, IE, full address, tax regime (not user-editable in MVP)

### Invoice Numbering & Sequencing
- [ ] Invoice numbering auto-increments per seller (serie + nNF combination tracked)
- [ ] `next_invoice_number` persisted in seller config and incremented after each successful XML generation
- [ ] Serie number configured per seller (e.g., "1", "2") and included in NFe ID

### Validation & Blocking Rules
- [ ] XML generation must be blocked if product NCM (NBM code) is missing; return actionable error
- [ ] XML generation must be blocked if customer CPF/CNPJ is missing; return actionable error
- [ ] Validation errors logged with details and seller notified

### Environment & Deployment
- [ ] Default environment set to homologation (tpAmb=2) for initial deployments
- [ ] Local dev supports HTTP webhooks for testing; production requires HTTPS with domain on Cloudflare + Render
- [ ] Deployed backend runs on Render (web + background worker) using Node.js

### Concurrency, Lifecycle & Operational Rules
- [ ] Invoice numbering must be atomic and concurrency-safe (use DB transaction when reserving/incrementing `next_invoice_number`)
- [ ] Order status lifecycle must include: `received`, `processing`, `pending_configuration`, `xml_generated`, `error`
- [ ] Unknown products from Mercado Livre must be automatically created in `products` and marked `pending_configuration` when `ncm` is missing
- [ ] NFe access key (44 digits) must be generated according to the official SEFAZ algorithm and stored with the `xmls` record
- [ ] Default operational fields set in generated XML: `indFinal=1`, `indPres=2`, `modFrete=9`, `tpNF=1`, `procEmi=0`, `verProc="ML-NFE-1.0"`

---

## Tasks

1. Backend scaffolding (Node.js + TypeScript) and Render service configuration  
2. Integrate Supabase (DB + Storage) and create schema for `sellers`, `orders`, `xmls`  
3. Implement webhook endpoint and ML webhook validation  
4. Implement order fetcher (Mercado Livre API client) and normalize payload  
5. Implement mapping layer to Sebrae NFe layout and XSD validation  
6. Persist XML to Supabase Storage and save metadata  
7. Generate signed download URLs and minimal dashboard endpoint  
8. Setup local dev instructions (ngrok or HTTP for local testing) and production HTTPS via Cloudflare  
9. Deployment to Render and basic monitoring/alerts  

---

## Data Model (minimum)
- `sellers`: id, mercadolivre_credentials (encrypted), issuer_data (CNPJ, IE, full address, tax regime), next_invoice_number, serie, environment (default: "2" for homologation), settings, created_at  
- `orders`: id, seller_id, ml_order_id, raw_payload, normalized_payload, status, processing_attempts, last_error, updated_at, created_at  
- `xmls`: id, order_id, seller_id, nNF (invoice number), serie, access_key_44, xml_url, xsd_version, validation_status, error_details, created_at  
- `products`: id, seller_id, ml_sku, ncm (required for validation), name, price, pending_configuration (boolean), created_at  
- `customers`: id, seller_id, ml_customer_id, cpf_cnpj (required for validation), name, address, created_at

## Future Considerations
- CFOP should be determined based on destination state (use `5102` for same-state consumer sales and `6102` for interstate where applicable).

---

## Notes for Implementation
- Use Supabase Storage for XML objects (public S3-compatible); issue signed URLs for downloads.  
- For production HTTPS: configure DNS in Cloudflare, point to Render service, enable TLS.  
- Local webhook testing may use HTTP; recommend `ngrok` or Render's test webhooks during development.  
- Keep certificate/emission flow out of MVP; provide clear instructions for sellers to import XML into Sebrae.  

---

## File List (update)
- [x] `docs/prd/nfe-automation-prd.md` - PRD created  
- [x] `docs/stories/002-nfe-automation.md` - Story (this file)  
- [x] `docs/execution/story-002-plan.md` - Execution plan

---

**Created:** February 23, 2026

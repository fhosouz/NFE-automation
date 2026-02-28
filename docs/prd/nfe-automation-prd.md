# PRD: NFe Automation

**Document Version:** 1.0  
**Last Updated:** February 23, 2026  
**Status:** Draft

---

## Executive Summary

NFe Automation is a lightweight SaaS that automatically generates Brazilian NFe XML files for Mercado Livre sellers immediately after a sale. The system receives order webhooks from Mercado Livre, fetches order details, composes a valid NFe XML using the official layout, and makes the XML available for download or storage so the seller can import it manually into Sebrae for emission. The solution is low-cost, intentionally does not perform certificate-based automatic emission, and targets small Mercado Livre merchants who issue invoices manually today.

---

## Problem Definition

Small Mercado Livre sellers manually generate NFe invoices via the Sebrae portal; the process is repetitive, error-prone, and time-consuming. Sellers must copy order details, product tax data, and buyer information into Sebrae for each sale, which increases labor cost and leads to delays in bookkeeping and fulfillment.

---

## Users

- Primary: Small Mercado Livre sellers who manually issue NF-e via Sebrae
- Secondary: Accountants/bookkeepers supporting multiple small sellers
- Persona constraints: Limited technical resources, price-sensitive, prefer simple UX

---

## Objective & Success Metrics

Objective: Automatically generate a valid NFe XML file for each Mercado Livre order so sellers can import it into Sebrae for emission.

Success Metrics
- XML generated automatically for 100% of new orders (target)  
- Average processing time per order: < 5 seconds  
- Measured manual work reduction: ≥ 80% for invoice generation tasks  
- Error rate (invalid XML or missing required fields): < 2%  
- Deployment cost: minimal (target ≤ $50/month infra for small volume)

---

## Constraints & Non-Goals

- Low-cost architecture required (cost-aware choices)  
- System will NOT perform automatic emission using seller certificates (no certificate handling)  
- Sellers will manually import the generated XML into Sebrae for signing/emission  
- Target only Mercado Livre orders (no other marketplaces in MVP)
- No complex tax engine or substitution rules in MVP — basic VAT/ICMS fields only as required

---

## Functional Requirements (MVP)

FR-1: Webhook Receiver
- System receives Mercado Livre `order.created` webhook and validates authenticity
- Idempotent processing to avoid duplicate XMLs

FR-2: Order Retrieval
- Fetch complete order details via Mercado Livre API when webhook arrives
- Retrieve buyer info, shipping, items (sku, qty, price), and order totals

FR-3: NFe XML Generation
- Map order fields to official NFe XML layout (layout version noted)  
- Populate required sections: issuer (from seller profile), recipient, goods, totals, taxes (basic), payment and transport blocks as applicable  
- Validate XML against NFe XSDs (schema validation) before storing/providing

FR-4: Storage & Access
- Persist generated XMLs in object storage (S3-compatible) and metadata in DB (order id, status, url)
- Provide secure per-seller access to download XML (direct link or dashboard)

FR-5: Download & Export
- Allow seller to download XML file directly from link or dashboard  
- Optionally provide bulk export (zip of XMLs) for date ranges (nice-to-have in MVP if time)

FR-6: Admin & Seller Configuration
- Simple onboarding: connect Mercado Livre account (API credentials)  
- Configure issuer data (CNPJ, company name, address, tax regime) used to populate NFe issuer fields

FR-7: Notifications & Error Handling
- Notify seller (email or dashboard notice) on XML generation success/failure  
- Log detailed errors for failed XML validation with actionable messages

FR-8: Deploy Target
- Deploy backend to Render (as specified) with environment variables for secrets, storage, and ML API keys if any

---

## Non-Functional Requirements

NFR-1: Performance
- Process and produce XML within 5 seconds p95 per order for normal payloads

NFR-2: Reliability
- Ensure idempotent handling and retry on transient failures (Mercado Livre API or storage)  
- Maintain 99% uptime for webhook processing in MVP

NFR-3: Security
- Store credentials and secrets in environment variables/secret store; no credentials logged  
- Secure download URLs (time-limited signed URLs) or auth-protected dashboard per seller

NFR-4: Cost Efficiency
- Use low-cost storage and lightweight compute on Render; design for small monthly infra spend (target ≤ $50/month at low volume)

NFR-5: Compliance & Data Retention
- Retain generated XMLs for configurable retention window (e.g., 1 year)  
- Provide data deletion on seller request (manual process described)

---

## MVP vs Future Scope

MVP (must-have)
- Receive Mercado Livre `order.created` webhook  
- Fetch order details  
- Generate valid NFe XML in official layout and validate against XSDs  
- Store XML and metadata  
- Allow seller to download XML or retrieve via API  
- Deploy backend on Render  
- Basic error notifications and logging

Future / Nice-to-have
- Automatic emission using seller digital certificate (A1/A3) and SEFAZ integration  
- Full tax engine with substitution rules and advanced tax scenarios  
- Multi-marketplace support (e.g., Shopify, WooCommerce)  
- UI enhancements: bulk export, CSV import, per-order edit UI before XML generation  
- Per-seller billing, usage dashboards, and quotas  
- Retry and reconciliation UI for failed XMLs

---

## Risks & Assumptions

Assumptions
- Sellers can provide accurate issuer data (CNPJ, address, tax regime) during onboarding  
- Mercado Livre webhooks and APIs are available and accessible for authorized integrations  
- Sellers will accept manual import into Sebrae for final emission  
- Basic tax fields suffice for a large portion of small merchants in MVP

Risks
- Mercado Livre webhook/API changes or rate limits could disrupt generation  
- Missing or inconsistent seller data may create invalid XMLs (mitigation: validation UI and onboarding checks)  
- NFe layout/XSD changes over time require maintenance (mitigation: versioned XML templates and CI tests)  
- Edge tax cases not handled: may require manual corrections by seller or accountant  
- Security risk if download URLs are misconfigured (mitigation: signed URLs and authentication)

Mitigations
- Implement schema validation and clear error messages linking to onboarding fixes  
- Keep XML templates versioned and include automated tests against official XSDs  
- Rate-limit inbound webhooks and implement queueing with retry/backoff  
- Start without certificate management to reduce compliance and complexity

---

## Technical Architecture (High Level)

- Webhook Receiver (HTTP) → Queue (Redis/Bull or Render background jobs) → Worker that:
  - Fetches order via Mercado Livre API
  - Normalizes order data
  - Maps to NFe XML template and validates against XSD
  - Stores XML in object storage and metadata in PostgreSQL
  - Notifies seller via email or dashboard

Suggested stack (low-cost)
- Backend: Node.js + TypeScript or Python FastAPI
- DB: PostgreSQL (Render managed DB or small cloud instance)  
- Storage: AWS S3 or Backblaze/Render-compatible object storage  
- Queue: Redis/Bull or Redis Streams (managed)  
- Deployment: Render services (web + background workers)  

---

## Implementation Roadmap (MVP ~4 weeks)

Week 1
- Project scaffolding, Render account setup, basic webhook endpoint  
- Seller onboarding API to store issuer data

Week 2
- Implement Mercado Livre webhook handling and order fetch  
- Implement idempotency and queueing

Week 3
- XML mapping templates and XSD validation  
- Storage and download links

Week 4
- Dashboard minimal (list of generated XMLs), error handling, testing, and deploy to Render

---

## Open Questions

1. Will sellers provide issuer data via a guided onboarding flow or via CSV upload?  
2. Which NFe layout/XSD version must we support initially?  
3. Preferred notification channel (email only or also dashboard)?

---

## Next Steps

- Confirm XSD/layout version and sample order payloads  
- Choose backend language (Node.js/TypeScript recommended)  
- Provision Render services and test webhook flow with Mercado Livre sandbox  
- Implement onboarding for seller issuer data

---

**Prepared By:** Analyst Team  
**Date:** February 23, 2026

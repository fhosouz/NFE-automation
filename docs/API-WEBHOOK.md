# Webhook API Reference

## Endpoint: POST /webhook/ml

Receives and processes Mercado Livre webhooks.

### Request

**Headers:**
```
Content-Type: application/json
X-Signature: v1={signature}  (optional in MVP)
```

**Body (Mercado Livre webhook format):**
```json
{
  "id": "12345",
  "resource": "/orders/{seller_id}/{order_id}",
  "user_id": 123456,
  "topic": "order.created",
  "application_id": 1234,
  "attempts": 1,
  "received_from": "192.168.0.1",
  "sent_at": "2026-02-25T10:30:00Z"
}
```

### Response Codes

| Code | Meaning | When |
|------|---------|------|
| `202 Accepted` | New order created | First time receiving webhook |
| `200 OK` | Already processed | Webhook already in database (idempotent) |
| `200 OK` | Warning/error logged | Signature issues or processing errors (prevents retries) |
| `400 Bad Request` | Invalid payload | Missing required fields |

### Response Examples

**New Order (202):**
```json
{
  "status": "accepted",
  "message": "New order received",
  "idempotencyKey": "ml_12345_order.created_/orders/123/456",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "isNewOrder": true
}
```

**Already Processed (200 - Idempotent):**
```json
{
  "status": "accepted",
  "message": "Webhook already processed",
  "idempotencyKey": "ml_12345_order.created_/orders/123/456",
  "isNewOrder": false
}
```

**Invalid Payload (400):**
```json
{
  "status": "error",
  "message": "Invalid webhook payload: missing required fields"
}
```

**Processing Error (200 - Still returns success to prevent ML retries):**
```json
{
  "status": "warning",
  "message": "Webhook received but processing failed",
  "error": "Error description for logging"
}
```

---

## How Idempotency Works

1. **Webhook received** → Generate idempotency key from `{id}_{topic}_{resource}`
2. **Insert attempt** → Try to INSERT record in `webhook_events` table
3. **First time**: INSERT succeeds → Order created with status `received` → Return 202
4. **Retry**: INSERT fails (unique constraint) → Return 200 (already processed)
5. **Double safety**: `orders` table also has unique constraint on `(seller_id, ml_order_id)`

### Example

ML sends webhook:
```
POST /webhook/ml
{
  "id": "12345",
  "resource": "/orders/123/456",
  "topic": "order.created"
}
```

**First request**: 
- Idempotency key: `ml_12345_order.created_/orders/123/456`
- Database: Inserts into `webhook_events` ✅
- Order: Created with status `received` ✅
- Response: `202 Accepted`

**ML retries (same webhook)**:
- Idempotency key: Same `ml_12345_order.created_/orders/123/456`
- Database: Duplicate key violation (already exists)
- Order: Not created again (protected by constraint) ✅
- Response: `200 OK` (success, not retried)

---

## Testing with cURL

```bash
# Test endpoint
curl -X POST http://localhost:3000/webhook/ml \
  -H "Content-Type: application/json" \
  -H "X-Signature: v1=test-signature" \
  -d '{
    "id": "12345",
    "resource": "/orders/123/456",
    "user_id": 123,
    "topic": "order.created",
    "application_id": 1234,
    "attempts": 1,
    "received_from": "192.168.0.1",
    "sent_at": "2026-02-25T10:30:00Z"
  }'

# Test health endpoint
curl http://localhost:3000/health
```

---

## Signature Verification (MVP)

**Current (MVP Phase):**
- Accepts any request with properly formatted `X-Signature: v1={signature}` header
- Validates header presence and format only
- Full HMAC-256 verification deferred to Task 4 when seller credentials available

**Future (Production Phase)**:
- Will verify request body signature using seller's shared secret
- Uses HMAC-256 with timing-safe comparison
- Prevents webhook spoofing/tampering

---

## Database Schema

### webhook_events table
```sql
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,          -- Primary deduplication key
  event_type text,
  payload jsonb,                        -- Full webhook payload
  received_at timestamptz DEFAULT now()
);
```

### orders table (relevant fields)
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  ml_order_id text NOT NULL,
  raw_payload jsonb,                    -- Full ML webhook stored here
  normalized_payload jsonb,             -- Set by ML client (Task 4)
  status text DEFAULT 'received',       -- received → processing → ...
  processing_attempts integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT orders_seller_ml_order_unique UNIQUE (seller_id, ml_order_id)
);
```

---

## Logging

All webhook activity is logged to console:

```
[WEBHOOK] Received webhook: { id: '12345', topic: 'order.created', ... }
[WEBHOOK_SIGNATURE_MVP] Signature format valid...
[WEBHOOK] Signature verification failed: ...
[WEBHOOK] Failed to process webhook: ...
```

In production, integrate with Sentry/logging service (see Task 16).

---

## Error Scenarios

| Scenario | Response | Action |
|----------|----------|--------|
| Valid first webhook | 202 | Create order, record event |
| Duplicate webhook (retry) | 200 | Return success (don't retry) |
| Missing X-Signature | 200 | Log warning, accept (MVP) |
| Invalid signature format | 200 | Log, accept (MVP) |
| Missing required fields (id/resource/topic) | 400 | Reject with error |
| Database error | 200 | Log error, accept (prevent ML retry) |
| Network timeout | Timeout | ML will retry |

---

## Integration Checklist

- ✅ POST /webhook/ml endpoint active
- ✅ Idempotency via database unique constraints
- ✅ Signature format validation (MVP)
- ✅ Order creation with raw payload preservation
- ✅ Comprehensive error handling
- ✅ All tests passing (23/23)
- ✅ Ready for Task 4 (ML client integration)

---

**Next**: Task 4 — Mercado Livre Client & Order Normalizer

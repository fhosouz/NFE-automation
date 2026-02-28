# Task 4: Mercado Livre Client & Order Normalizer — Implementation

**Status**: ✅ COMPLETED  
**Date**: February 28, 2026  
**Tests**: 42/42 passing (18 new tests added)

---

## Overview

Implemented a Mercado Livre API client and order normalizer to fetch and transform order details from ML into the internal format used by the NFe generation pipeline.

---

## Implementation Files

### 1. ML Client Service ([src/services/mercadolivreClient.ts](src/services/mercadolivreClient.ts))

**MercadoLivreClient class:**
- Authenticates using OAuth2 client credentials
- Fetches order details from ML API
- Fetches seller information
- Implements token caching to avoid repeated authentication

**Key methods:**
- `fetchOrder(orderId)` - GET `/orders/{orderId}` → Returns full order details
- `fetchSeller(sellerId)` - GET `/users/{sellerId}` → Returns seller info
- `getAccessToken()` - Internal: handles OAuth token lifecycle

**Factory:**
- `createMercadoLivreClient()` - Creates client from environment variables

**Environment variables used:**
```
ML_CLIENT_ID        - OAuth client identifier
ML_CLIENT_SECRET    - OAuth client secret
ML_URL_REDIRECT     - OAuth redirect URI (e.g., https://domain.com/auth/callback)
```

### 2. Order Normalizer ([src/services/orderNormalizer.ts](src/services/orderNormalizer.ts))

**Core functions:**
- `normalizeOrder(mlOrder)` - Maps ML order format to internal structure
- `validateNormalizedOrder(order)` - Validates against NFe requirements
- `getMissingRequiredFields(order)` - Identifies pending configuration needs

**NormalizedOrder structure:**
```typescript
{
  ml_order_id: string;
  ml_seller_id?: string;
  customer: {
    ml_customer_id: string;
    nickname: string;
    cpf_cnpj?: string;           // Required for NFe (to be populated)
    city?: string;
    state?: string;
    country?: string;
  };
  products: Array<{
    ml_sku: string;
    title: string;
    category_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    ncm?: string;               // Required for NFe (tax code)
  }>;
  shipping: {
    address_line?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  };
  total_amount: number;
  currency_id: string;
  order_date: string;
  status: string;
  metadata: {
    source: 'mercadolivre';
    fetched_at: string;
  };
}
```

**Validation requirements for NFe:**
- ✅ Order ID
- ✅ Customer ID & name
- ✅ At least 1 product
- ❌ Customer CPF/CNPJ (flags as pending_configuration if missing)
- ❌ Product NCM (flags as pending_configuration if missing)
- ✅ Shipping address (city, state)

---

## Test Coverage

**New tests (18 total):**

### ML Client Tests (10 tests)
- ✅ Initialize with credentials
- ✅ Fetch and return order details
- ✅ Fetch and return seller info
- ✅ Handle HTTP 404 errors
- ✅ Handle token request failures
- ✅ Reuse token within expiry window
- ✅ Cache tokens to reduce OAuth calls

### Order Normalizer Tests (8 tests)
- ✅ Normalize ML order to internal format
- ✅ Extract shipping address correctly
- ✅ Handle empty product lists
- ✅ Set metadata (source, timestamp)
- ✅ Validate complete orders
- ✅ Detect missing customer name
- ✅ Detect missing product NCM
- ✅ Identify multiple validation errors
- ✅ Detect missing NCM fields
- ✅ Detect missing customer CPF/CNPJ

**All tests passing:**
```
Test Suites: 6 passed, 6 total
Tests:       42 passed, 42 total
```

---

## Integration Flow (Next Steps)

Current architecture: Webhook receives order → **NOW: Fetch & normalize → Store → Flag if pending config**

**Expected integration:**

1. Webhook receives order created event
2. Handler calls `MercadoLivreClient.fetchOrder(mlOrderId)`
3. Handler calls `normalizeOrder()` to transform
4. Handler calls `validateNormalizedOrder()` to check completeness
5. Store `normalized_payload` in orders table
6. If validation fails → Set status `pending_configuration` + flag missing fields (Task 5)
7. If validation passes → Set status `processing` for XML generation (Task 7)

---

## Usage Example

```typescript
import { createMercadoLivreClient } from '@/services/mercadolivreClient';
import { normalizeOrder, validateNormalizedOrder } from '@/services/orderNormalizer';

// Create ML client
const mlClient = createMercadoLivreClient();

// Fetch order from ML API
const mlOrder = await mlClient.fetchOrder('123456789');

// Normalize to internal format
const normalized = normalizeOrder(mlOrder);

// Validate against NFe requirements
const validation = validateNormalizedOrder(normalized);

if (validation.valid) {
  // Ready for XML generation
  console.log('Order ready for NFe generation');
} else {
  // Missing required fields
  console.log('Configuration needed:', validation.errors);
  // Determine which fields are missing (for UI feedback)
  const missing = getMissingRequiredFields(normalized);
}
```

---

## Security & Error Handling

**Security considerations:**
- ML client credentials stored in environment variables (not hardcoded)
- Token caching reduces exposure window
- HTTP errors logged with context but without exposing full responses
- Orders table will store normalized payload (no ML API calls on retry)

**Error scenarios:**
- Network timeout → Exception caught, logged, order marked error for retry
- Invalid order ID → HTTP 404, caught and logged
- Missing ML credentials → Exception at client creation time
- Validation errors → Logged, order flagged as pending_configuration

---

## Configuration Checklist

✅ ML_CLIENT_ID configured in Render  
✅ ML_CLIENT_SECRET configured in Render  
✅ ML_URL_REDIRECT configured (production URL needed)  
✅ MercadoLivreClient factory implemented  
✅ Order normalizer with validation  
✅ Comprehensive test coverage  
✅ Error handling for network/auth failures  

---

## Next Steps (Task 5+)

1. **Task 5** - Integrate normalizer into webhook handler to populate `normalized_payload`
2. **Task 6** - Implement product/customer validation and `pending_configuration` flow
3. **Task 7** - Build invoice reservation service
4. **Task 8** - Implement access key (44-digit) generator
5. **Task 9** - Build XML mapper using normalized payload

---

## Files Modified/Created

| File | Status |
|------|--------|
| [src/services/mercadolivreClient.ts](src/services/mercadolivreClient.ts) | ✅ Created |
| [src/services/orderNormalizer.ts](src/services/orderNormalizer.ts) | ✅ Created |
| [tests/mercadolivreClient.test.ts](tests/mercadolivreClient.test.ts) | ✅ Created |
| [tests/orderNormalizer.test.ts](tests/orderNormalizer.test.ts) | ✅ Created |
| [.env.example](.env.example) | ✅ Updated |
| [jest.setup.js](jest.setup.js) | ✅ Updated |

---

**Ready for Task 5: Order Lifecycle Persistence & UI Endpoints**

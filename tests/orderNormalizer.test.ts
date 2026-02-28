/**
 * Tests for Order Normalizer
 */

import {
  normalizeOrder,
  validateNormalizedOrder,
  getMissingRequiredFields,
} from '@/services/orderNormalizer';

describe('orderNormalizer', () => {
  const mockMLOrder = {
    id: '123456789',
    seller_id: '987654321',
    buyer: {
      id: 111111,
      nickname: 'buyer_nickname',
    },
    order_items: [
      {
        id: 'item_001',
        item: {
          id: 'SKU123',
          title: 'Product 1',
          category_id: 'CAT001',
        },
        quantity: 2,
        unit_price: 100.0,
      },
    ],
    shipping: {
      receiver_address: {
        address_line: 'Rua Test 123',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '01234-567',
        country: {
          id: 'BR',
        },
      },
    },
    total_amount: 200.0,
    currency_id: 'BRL',
    date_created: '2026-02-28T10:00:00Z',
    status: 'paid',
  };

  describe('normalizeOrder', () => {
    it('should normalize ML order to internal format', () => {
      const normalized = normalizeOrder(mockMLOrder);

      expect(normalized.ml_order_id).toBe('123456789');
      expect(normalized.customer.ml_customer_id).toBe('111111');
      expect(normalized.customer.nickname).toBe('buyer_nickname');
      expect(normalized.products).toHaveLength(1);
      expect(normalized.products[0].ml_sku).toBe('SKU123');
      expect(normalized.products[0].quantity).toBe(2);
      expect(normalized.products[0].unit_price).toBe(100.0);
      expect(normalized.products[0].total_price).toBe(200.0);
    });

    it('should extract shipping address', () => {
      const normalized = normalizeOrder(mockMLOrder);

      expect(normalized.shipping.address_line).toBe('Rua Test 123');
      expect(normalized.shipping.city).toBe('São Paulo');
      expect(normalized.shipping.state).toBe('SP');
      expect(normalized.shipping.country).toBe('BR');
    });

    it('should handle empty order items', () => {
      const order = { ...mockMLOrder, order_items: [] };
      const normalized = normalizeOrder(order);

      expect(normalized.products).toHaveLength(0);
    });

    it('should set metadata correctly', () => {
      const normalized = normalizeOrder(mockMLOrder);

      expect(normalized.metadata.source).toBe('mercadolivre');
      expect(normalized.metadata.fetched_at).toBeDefined();
    });
  });

  describe('validateNormalizedOrder', () => {
    it('should validate complete order', () => {
      const normalized = normalizeOrder(mockMLOrder);
      // Add NCM to make it valid
      normalized.products[0].ncm = '12345678';
      normalized.customer.cpf_cnpj = '12345678901234';

      const result = validateNormalizedOrder(normalized);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing customer name', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.customer.nickname = '';

      const result = validateNormalizedOrder(normalized);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing customer name');
    });

    it('should detect missing product NCM', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.products[0].ncm = undefined;

      const result = validateNormalizedOrder(normalized);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('NCM'))).toBe(true);
    });

    it('should detect missing shipping address', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.shipping.address_line = undefined;

      const result = validateNormalizedOrder(normalized);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing shipping address');
    });

    it('should detect multiple errors', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.customer.nickname = '';
      normalized.shipping.city = '';

      const result = validateNormalizedOrder(normalized);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getMissingRequiredFields', () => {
    it('should identify missing NCM', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.customer.cpf_cnpj = '12345678901234';

      const missing = getMissingRequiredFields(normalized);

      expect(missing).toContain('ncm_SKU123');
    });

    it('should identify missing customer CPF/CNPJ', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.products[0].ncm = '12345678';
      normalized.customer.cpf_cnpj = undefined;

      const missing = getMissingRequiredFields(normalized);

      expect(missing).toContain('customer_cpf_cnpj');
    });

    it('should return empty array when all required fields present', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.products[0].ncm = '12345678';
      normalized.customer.cpf_cnpj = '12345678901234';

      const missing = getMissingRequiredFields(normalized);

      expect(missing).toHaveLength(0);
    });

    it('should identify multiple missing NCMs', () => {
      const normalized = normalizeOrder(mockMLOrder);
      normalized.products.push({
        ml_sku: 'SKU456',
        title: 'Product 2',
        category_id: 'CAT002',
        quantity: 1,
        unit_price: 50.0,
        total_price: 50.0,
      });
      normalized.customer.cpf_cnpj = '12345678901234';

      const missing = getMissingRequiredFields(normalized);

      expect(missing).toContain('ncm_SKU123');
      expect(missing).toContain('ncm_SKU456');
    });
  });
});

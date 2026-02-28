/**
 * Tests for Webhook Handler
 * Verifies idempotency logic, order creation, and payload handling
 */

import {
  generateIdempotencyKey,
  extractSellerIdFromResource,
  extractOrderIdFromResource,
} from '@/services/webhookHandler';
import { MercadoLivreWebhookPayload } from '@/types/webhook';

describe('webhookHandler', () => {
  const mockPayload: MercadoLivreWebhookPayload = {
    id: '12345',
    resource: '/orders/123456/987654321',
    user_id: 123456,
    topic: 'order.created',
    application_id: 1234,
    attempts: 1,
    received_from: '192.168.0.1',
    sent_at: '2026-02-25T10:30:00Z',
  };

  describe('generateIdempotencyKey', () => {
    it('should generate consistent idempotency key from payload', () => {
      const key1 = generateIdempotencyKey(mockPayload);
      const key2 = generateIdempotencyKey(mockPayload);
      
      expect(key1).toBe(key2);
      expect(key1).toContain('ml_');
      expect(key1).toContain(mockPayload.id);
      expect(key1).toContain(mockPayload.topic);
    });

    it('should generate different keys for different payloads', () => {
      const payload2: MercadoLivreWebhookPayload = {
        ...mockPayload,
        id: '54321',
      };
      
      const key1 = generateIdempotencyKey(mockPayload);
      const key2 = generateIdempotencyKey(payload2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('extractSellerIdFromResource', () => {
    it('should extract seller ID from valid resource string', () => {
      const sellerId = extractSellerIdFromResource('/orders/123456/987654321');
      expect(sellerId).toBe('123456');
    });

    it('should return null for invalid resource string', () => {
      expect(extractSellerIdFromResource('/invalid/path')).toBeNull();
      expect(extractSellerIdFromResource('')).toBeNull();
      expect(extractSellerIdFromResource('/orders/invalid')).toBeNull();
    });

    it('should handle different seller IDs', () => {
      expect(extractSellerIdFromResource('/orders/999/888')).toBe('999');
      expect(extractSellerIdFromResource('/orders/1/2')).toBe('1');
    });
  });

  describe('extractOrderIdFromResource', () => {
    it('should extract order ID from valid resource string', () => {
      const orderId = extractOrderIdFromResource('/orders/123456/987654321');
      expect(orderId).toBe('987654321');
    });

    it('should return null for invalid resource string', () => {
      expect(extractOrderIdFromResource('/invalid/path')).toBeNull();
      expect(extractOrderIdFromResource('')).toBeNull();
      expect(extractOrderIdFromResource('/orders/123456')).toBeNull();
    });

    it('should handle different order IDs', () => {
      expect(extractOrderIdFromResource('/orders/123/999')).toBe('999');
      expect(extractOrderIdFromResource('/orders/1/2')).toBe('2');
    });
  });
});

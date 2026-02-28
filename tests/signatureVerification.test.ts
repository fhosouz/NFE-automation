/**
 * Tests for Signature Verification
 * Verifies webhook signature validation logic
 */

import {
  extractSignatureFromHeader,
  verifyWebhookSignature,
} from '@/services/signatureVerification';

describe('signatureVerification', () => {
  describe('extractSignatureFromHeader', () => {
    it('should extract signature from valid header format', () => {
      const header = 'v1=abc123def456';
      const signature = extractSignatureFromHeader(header);
      
      expect(signature).toBe('abc123def456');
    });

    it('should handle headers with multiple parts', () => {
      const header = 'v1=abc123def456,v2=xyz789';
      const signature = extractSignatureFromHeader(header);
      
      expect(signature).toBe('abc123def456');
    });

    it('should return null for invalid format', () => {
      expect(extractSignatureFromHeader('invalid')).toBeNull();
      expect(extractSignatureFromHeader('abc123')).toBeNull();
      expect(extractSignatureFromHeader('v2=abc123')).toBeNull();
    });

    it('should return null for undefined header', () => {
      expect(extractSignatureFromHeader(undefined)).toBeNull();
      expect(extractSignatureFromHeader('')).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should reject webhook without signature header', () => {
      const result = verifyWebhookSignature('{}', undefined);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing X-Signature');
    });

    it('should reject invalid signature format', () => {
      const result = verifyWebhookSignature('{}', 'invalid_format');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid X-Signature format');
    });

    it('should accept valid signature header format (MVP)', () => {
      const result = verifyWebhookSignature('{}', 'v1=abc123def456');
      
      expect(result.valid).toBe(true);
    });

    it('should verify both valid and invalid formats', () => {
      const validResult = verifyWebhookSignature('{}', 'v1=sig123');
      const invalidResult = verifyWebhookSignature('{}', 'v2=sig456');
      
      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });
  });
});

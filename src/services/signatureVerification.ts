/**
 * Mercado Livre Webhook Signature Verification
 * 
 * Mercado Livre signs webhooks using X-Signature header
 * Format: X-Signature: v1={signature}
 * 
 * For MVP, we'll:
 * 1. Validate header presence
 * 2. Log for manual verification during testing
 * 3. Later integrate with ML credentials stored per seller
 */

import crypto from 'crypto';

interface SignatureVerificationResult {
  valid: boolean;
  reason: string;
}

/**
 * Extract signature from X-Signature header
 * Format: X-Signature: v1={signature}
 */
export const extractSignatureFromHeader = (
  xSignatureHeader?: string
): string | null => {
  if (!xSignatureHeader) {
    return null;
  }

  const match = xSignatureHeader.match(/v1=([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

/**
 * Verify webhook signature (structure validation)
 * 
 * For MVP:
 * - Require X-Signature header presence
 * - Log for manual verification
 * - Later: implement full HMAC verification with seller credentials
 */
export const verifyWebhookSignature = (
  _rawBody: string | Buffer,
  xSignatureHeader: string | undefined,
  _sellerId?: string
): SignatureVerificationResult => {
  // MVP: Just check header presence and log
  // TODO: Implement full HMAC verification with seller's shared secret
  
  if (!xSignatureHeader) {
    return {
      valid: false,
      reason: 'Missing X-Signature header',
    };
  }

  const signature = extractSignatureFromHeader(xSignatureHeader);
  if (!signature) {
    return {
      valid: false,
      reason: 'Invalid X-Signature format (expected v1={signature})',
    };
  }

  // MVP: Accept signature if header is present and properly formatted
  // In production, implement full HMAC-256 verification with seller credentials
  console.log(
    '[WEBHOOK_SIGNATURE_MVP] Signature format valid. Full verification deferred to seller integration phase.',
    { signature: signature.substring(0, 10) + '...' }
  );

  return {
    valid: true,
    reason: 'Signature format valid (MVP: full verification deferred)',
  };
};

/**
 * Full signature verification (future implementation)
 * Once seller credentials are available, implement:
 * 1. Get seller's shared secret from credentials
 * 2. Reconstruct request body exactly as sent
 * 3. Compute HMAC-256 with shared secret
 * 4. Compare with provided signature
 */
export const verifyWebhookSignatureStrict = (
  _rawBody: string | Buffer,
  _xSignatureHeader: string | undefined,
  _sellerId: string,
  _sharedSecret: string
): SignatureVerificationResult => {
  // TODO: Implement full verification
  // const computedSignature = crypto
  //   .createHmac('sha256', sharedSecret)
  //   .update(rawBody)
  //   .digest('hex');
  //
  // const valid = crypto.timingSafeEqual(
  //   Buffer.from(computedSignature),
  //   Buffer.from(xSignature)
  // );

  return {
    valid: false,
    reason: 'Strict verification not yet implemented',
  };
};

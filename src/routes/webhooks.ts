/**
 * Mercado Livre Webhook Route
 * Endpoint: POST /webhook/ml
 * 
 * Receives order.created webhooks from Mercado Livre
 * Returns 200 immediately for idempotency and reliable delivery
 */

import { Router, Request, Response } from 'express';
import { handleMercadoLivreWebhook } from '@/services/webhookHandler';
import { verifyWebhookSignature } from '@/services/signatureVerification';
import { MercadoLivreWebhookPayload } from '@/types/webhook';

const router = Router();

/**
 * POST /webhook/ml
 * Receive and process Mercado Livre webhooks
 */
router.post('/ml', async (req: Request, res: Response) => {
  try {
    // Get signature header for verification
    const xSignature = req.headers['x-signature'] as string | undefined;

    // Verify signature (MVP: basic validation)
    const signatureResult = verifyWebhookSignature(
      JSON.stringify(req.body),
      xSignature
    );

    if (!signatureResult.valid) {
      console.warn('[WEBHOOK] Signature verification failed:', signatureResult.reason);
      // Return 200 anyway to prevent retry storms, but log for investigation
      return res.status(200).json({
        status: 'warning',
        message: 'Webhook received but signature verification failed',
        reason: signatureResult.reason,
      });
    }

    // Validate payload structure
    const payload = req.body as MercadoLivreWebhookPayload;
    if (!payload.id || !payload.resource || !payload.topic) {
      console.error('[WEBHOOK] Invalid payload structure:', payload);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid webhook payload: missing required fields',
      });
    }

    console.log('[WEBHOOK] Received webhook:', {
      id: payload.id,
      topic: payload.topic,
      resource: payload.resource,
      timestamp: new Date().toISOString(),
    });

    // Process webhook (idempotency handled inside)
    const result = await handleMercadoLivreWebhook(payload);

    if (!result.success) {
      console.error('[WEBHOOK] Failed to process webhook:', result.error);
      // Still return 200 to prevent retry, but log error
      return res.status(200).json({
        status: 'warning',
        message: 'Webhook received but processing failed',
        error: result.error,
        idempotencyKey: result.idempotencyKey,
      });
    }

    // Success response
    return res.status(202).json({
      status: 'accepted',
      message: result.isNewOrder ? 'New order received' : 'Webhook already processed',
      idempotencyKey: result.idempotencyKey,
      orderId: result.orderId,
      isNewOrder: result.isNewOrder,
    });
  } catch (error) {
    console.error('[WEBHOOK] Unexpected error:', error);
    // Return 200 to prevent retry storms
    return res.status(200).json({
      status: 'warning',
      message: 'Webhook received but processing error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

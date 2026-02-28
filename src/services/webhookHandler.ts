/**
 * Webhook Handler Service
 * Handles Mercado Livre webhook reception, idempotency checks, and order persistence
 */

import { supabaseServiceClient as supabase } from '@/services/supabaseClient';
import { MercadoLivreWebhookPayload } from '@/types/webhook';

interface WebhookProcessResult {
  success: boolean;
  idempotencyKey: string;
  orderId?: string;
  isNewOrder: boolean;
  error?: string;
}

/**
 * Generate idempotency key from webhook payload
 * Uses ML webhook delivery ID + topic + resource to ensure uniqueness
 */
export const generateIdempotencyKey = (
  payload: MercadoLivreWebhookPayload
): string => {
  return `ml_${payload.id}_${payload.topic}_${payload.resource}`;
};

/**
 * Extract seller ID from ML webhook resource string
 * Format: /orders/{seller_id}/{order_id}
 */
export const extractSellerIdFromResource = (resource: string): string | null => {
  const match = resource.match(/\/orders\/(\d+)\//);
  return match ? match[1] : null;
};

/**
 * Extract order ID from ML webhook resource string
 * Format: /orders/{seller_id}/{order_id}
 */
export const extractOrderIdFromResource = (resource: string): string | null => {
  const match = resource.match(/\/orders\/\d+\/(\d+)$/);
  return match ? match[1] : null;
};

/**
 * Check if webhook already processed and return record if exists
 */
export const checkIdempotency = async (
  idempotencyKey: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error checking idempotency:', error);
  }

  return !!data;
};

/**
 * Record webhook event in idempotency table
 */
export const recordWebhookEvent = async (
  idempotencyKey: string,
  eventType: string,
  payload: MercadoLivreWebhookPayload
): Promise<boolean> => {
  const { error } = await supabase.from('webhook_events').insert({
    idempotency_key: idempotencyKey,
    event_type: eventType,
    payload: payload,
  });

  if (error) {
    // Unique constraint violation means it was already processed
    if (error.code === '23505') {
      return false;
    }
    console.error('Error recording webhook event:', error);
    throw error;
  }

  return true;
};

/**
 * Create order record from webhook payload
 * Stores raw payload with status "received" for later processing
 */
export const createOrderFromWebhook = async (
  sellerId: string,
  mlOrderId: string,
  payload: MercadoLivreWebhookPayload
): Promise<string> => {
  // Check if order already exists (seller_id, ml_order_id is unique)
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('ml_order_id', mlOrderId)
    .single();

  if (existingOrder) {
    return existingOrder.id;
  }

  // Create new order
  const { data, error } = await supabase
    .from('orders')
    .insert({
      seller_id: sellerId,
      ml_order_id: mlOrderId,
      raw_payload: payload,
      status: 'received',
      normalized_payload: null,
      processing_attempts: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating order:', error);
    throw error;
  }

  return data.id;
};

/**
 * Main webhook handler: process Mercado Livre webhook
 * 1. Check idempotency
 * 2. Extract seller and order IDs
 * 3. Record webhook event
 * 4. Create order record
 */
export const handleMercadoLivreWebhook = async (
  payload: MercadoLivreWebhookPayload
): Promise<WebhookProcessResult> => {
  const idempotencyKey = generateIdempotencyKey(payload);
  // Extract seller and order IDs from resource string
  const mlSellerId = extractSellerIdFromResource(payload.resource);
  const mlOrderId = extractOrderIdFromResource(payload.resource);

  if (!mlSellerId || !mlOrderId) {
    const error = `Invalid resource format: ${payload.resource}`;
    console.error(error);
    return {
      success: false,
      idempotencyKey,
      isNewOrder: false,
      error,
    };
  }

  try {
    // Call the atomic RPC that inserts webhook_events and orders in a single transaction
    const { data, error } = await supabase.rpc('insert_webhook_event_and_order', {
      p_idempotency_key: idempotencyKey,
      p_event_type: payload.topic,
      p_payload: payload,
      p_ml_seller_id: mlSellerId,
      p_ml_order_id: mlOrderId,
    });

    if (error) {
      console.error('RPC error inserting webhook and order:', error);
      return {
        success: false,
        idempotencyKey,
        isNewOrder: false,
        error: error.message || 'RPC error',
      };
    }

    // RPC returns an array of rows; take first
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!row) {
      return {
        success: false,
        idempotencyKey,
        isNewOrder: false,
        error: 'RPC did not return result',
      };
    }

    const orderId = row.order_id ?? null;
    const alreadyExists = !!row.already_exists;

    return {
      success: true,
      idempotencyKey,
      orderId: orderId ?? undefined,
      isNewOrder: !alreadyExists,
    };
  } catch (err) {
    console.error('Error processing webhook (unexpected):', err);
    return {
      success: false,
      idempotencyKey,
      isNewOrder: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

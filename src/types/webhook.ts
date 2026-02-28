/**
 * Mercado Livre Webhook Types and Interfaces
 */

export interface MercadoLivreWebhookPayload {
  id: string;
  resource: string;
  user_id: number;
  topic: string;
  application_id: number;
  attempts: number;
  received_from: string;
  sent_at: string;
}

export interface WebhookEventRecord {
  idempotency_key: string;
  event_type: string;
  payload: MercadoLivreWebhookPayload;
  processed_at: string;
}

export interface OrderCreatedData {
  seller_id: string;
  ml_order_id: string;
  raw_payload: MercadoLivreWebhookPayload;
  status: 'received';
  normalized_payload: null;
}

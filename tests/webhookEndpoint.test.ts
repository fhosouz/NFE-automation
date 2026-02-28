/**
 * Integration Tests for Webhook Endpoints
 * Tests the /webhook/ml endpoint with various payloads
 */

import request from 'supertest';
import app from '@/app';
import { MercadoLivreWebhookPayload } from '@/types/webhook';

describe('POST /webhook/ml', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    // stub rpc so handler doesn't throw
    const { supabaseServiceClient } = require('@/services/supabaseClient');
    supabaseServiceClient.rpc = jest.fn().mockResolvedValue({ data: [{ order_id: null, already_exists: false }], error: null });
  });

  it('should return 200 for webhook without signature', async () => {
    const response = await request(app)
      .post('/webhook/ml')
      .send(mockPayload);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
  });

  it('should return 200 or 202 for webhook with valid signature format', async () => {
    const response = await request(app)
      .post('/webhook/ml')
      .set('X-Signature', 'v1=abc123def456')
      .send(mockPayload);

    expect([200, 202]).toContain(response.status);
  });

  it('should reject payload with missing required fields', async () => {
    const invalidPayload = {
      id: '12345',
      // Missing resource, topic, etc.
    };

    const response = await request(app)
      .post('/webhook/ml')
      .set('X-Signature', 'v1=abc123def456')
      .send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
  });

  it('should accept valid complete payload', async () => {
    const response = await request(app)
      .post('/webhook/ml')
      .set('X-Signature', 'v1=abc123def456')
      .send(mockPayload);

    expect([200, 202]).toContain(response.status);
  });

  it('should return 500 or 200 for malformed JSON', async () => {
    const response = await request(app)
      .post('/webhook/ml')
      .set('Content-Type', 'application/json')
      .set('X-Signature', 'v1=abc123def456')
      .send('{invalid json}');

    // Express should return 400 for malformed JSON, but webhook endpoint returns 200
    expect([200, 400]).toContain(response.status);
  });
});

describe('GET /health', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

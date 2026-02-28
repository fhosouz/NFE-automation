/**
 * Tests for Mercado Livre OAuth Routes
 */

import request from 'supertest';
import app from '@/app';
import config from '@/config';
import { supabaseServiceClient } from '@/services/supabaseClient';

// helper to extract cookie value (handles string or array returned by Express)
const getCookie = (res: request.Response, name: string) => {
  const header = res.headers['set-cookie'];
  if (!header) return null;
  const cookies = Array.isArray(header) ? header : [header];
  const cookie = cookies.find((c: string) => c.startsWith(`${name}=`));
  if (!cookie) return null;
  return cookie.split(';')[0].split('=')[1];
};

describe('ML OAuth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock global fetch
    global.fetch = jest.fn();
  });

  describe('GET /api/ml/oauth/start', () => {
    it('should redirect to Mercado Livre authorization URL with state', async () => {
      const res = await request(app).get('/api/ml/oauth/start');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://auth.mercadolivre.com.br/authorization');
      expect(res.headers.location).toContain(`client_id=${config.mercadoLivre.clientId}`);
      expect(res.headers.location).toContain('response_type=code');

      const state = getCookie(res, 'ml_oauth_state');
      expect(state).toBeTruthy();
    });
  });

  describe('GET /api/ml/oauth/callback', () => {
    it('should return 400 if state mismatch or missing code', async () => {
      const res = await request(app)
        .get('/api/ml/oauth/callback')
        .set('Cookie', 'ml_oauth_state=stored_state')
        .query({ state: 'foo' });
      expect(res.status).toBe(400);
    });

    it('should exchange code and upsert seller', async () => {
      const fakeCode = 'code123';
      const fakeState = 'state123';
      const fakeToken = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        scope: 'read write',
        user_id: 555,
      };
      const fakeSeller = { id: 555, nickname: 'seller_name' };

      // mock fetch responses (3 calls: token exchange, getAccessToken for seller fetch, seller fetch)
      (global.fetch as jest.Mock)
        // token exchange
        .mockResolvedValueOnce({ ok: true, json: async () => fakeToken })
        // getAccessToken for seller fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'seller_token', expires_in: 3600 }) })
        // seller fetch
        .mockResolvedValueOnce({ ok: true, json: async () => fakeSeller });

      // spy on supabase upsert
      const upsertSpy = jest
        .spyOn(supabaseServiceClient, 'from')
        .mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
        } as any);

      // first request start to set state cookie
      const startRes = await request(app).get('/api/ml/oauth/start');
      const stateCookie = getCookie(startRes, 'ml_oauth_state');

      const callbackRes = await request(app)
        .get('/api/ml/oauth/callback')
        .set('Cookie', [`ml_oauth_state=${stateCookie}`])
        .query({ code: fakeCode, state: stateCookie });

      expect(callbackRes.status).toBe(200);
      expect(callbackRes.text).toContain('Authorization successful');
      expect(global.fetch).toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith('sellers');
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad' });

      const startRes = await request(app).get('/api/ml/oauth/start');
      const stateCookie = getCookie(startRes, 'ml_oauth_state');

      const res = await request(app)
        .get('/api/ml/oauth/callback')
        .set('Cookie', [`ml_oauth_state=${stateCookie}`])
        .query({ code: 'code', state: stateCookie });

      expect(res.status).toBe(500);
    });
  });
});

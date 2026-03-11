/**
 * Tests for Mercado Livre Client
 */

import { MercadoLivreClient, createMercadoLivreClient } from '@/services/mercadolivreClient';

describe('MercadoLivreClient', () => {
  const clientId = 'test_client_id';
  const clientSecret = 'test_client_secret';
  const redirectUrl = 'https://example.com/callback';

  let client: MercadoLivreClient;

  beforeEach(() => {
    client = new MercadoLivreClient(clientId, clientSecret, redirectUrl);
    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided credentials', () => {
      expect(client).toBeDefined();
    });
  });

  describe('fetchOrder', () => {
    it('should fetch and return order details', async () => {
      const mockOrder = {
        id: '123456789',
        buyer: { id: 111111, nickname: 'test_buyer' },
        order_items: [],
        total_amount: 100.0,
        currency_id: 'BRL',
        date_created: '2026-02-28T10:00:00Z',
        status: 'paid',
      };

      const mockToken = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
        user_id: 123,
      };

      // Mock token request
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        })
        // Mock order fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrder,
        });

      const order = await client.fetchOrder('123456789');

      expect(order.id).toBe('123456789');
      expect(order.total_amount).toBe(100.0);
    });

    it('should handle fetch errors', async () => {
      const mockToken = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
        user_id: 123,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      await expect(client.fetchOrder('invalid_order')).rejects.toThrow();
    });

    it('should handle token request failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.fetchOrder('123456789')).rejects.toThrow(
        'Token request failed'
      );
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange authorization code for tokens', async () => {
      const fakeTokenData = {
        access_token: 'token123',
        refresh_token: 'refresh456',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
        user_id: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => fakeTokenData,
      });

      const data = await client.exchangeCodeForToken('codefoo');
      expect(data).toEqual(fakeTokenData);
    });
  });

  describe('fetchSeller', () => {
    it('should fetch and return seller info', async () => {
      const mockSeller = {
        id: 987654321,
        nickname: 'test_seller',
        country_id: 'BR',
      };

      const mockToken = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
        user_id: 123,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSeller,
        });

      const seller = await client.fetchSeller('987654321');

      expect(seller.id).toBe(987654321);
      expect(seller.nickname).toBe('test_seller');
    });
  });

  describe('Token caching', () => {
    it('should reuse token within expiry time', async () => {
      const mockToken = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
        user_id: 123,
      };

      const mockOrder = {
        id: '123456789',
        buyer: { id: 111111, nickname: 'test_buyer' },
        order_items: [],
        total_amount: 100.0,
        currency_id: 'BRL',
        date_created: '2026-02-28T10:00:00Z',
        status: 'paid',
      };

      (global.fetch as jest.Mock)
        // Token request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        })
        // First order fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrder,
        })
        // Second order fetch (should not trigger another token request)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrder,
        });

      await client.fetchOrder('123456789');
      await client.fetchOrder('987654321');

      // Should only call fetch 3 times: token + 2 orders
      // (token should be cached)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Refresh and callback', () => {
    it('refreshAccessToken should obtain new token and call callback', async () => {
      client.setAccessToken('old', Date.now() - 1000, 'someRefresh');
      const newToken = {
        access_token: 'refreshed',
        refresh_token: 'newRefresh',
        token_type: 'Bearer',
        expires_in: 1800,
        scope: 'read',
        user_id: 1,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newToken,
      });

      const cb = jest.fn(async () => {});
      client.onTokenUpdate(cb);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await client.refreshAccessToken();
      expect(result).toEqual(newToken);
      expect(cb).toHaveBeenCalledWith(newToken);
      expect(await (client as any)['getAccessToken']()).toBe('refreshed');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('token refreshed or exchanged');
      logSpy.mockRestore();
    });

    it('getAccessToken should attempt refresh when expired', async () => {
      client.setAccessToken('x', Date.now() - 1000, 'refreshX');
      const newToken = {
        access_token: 're2',
        refresh_token: 'r2',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'r',
        user_id: 1,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newToken,
      });

      const token = await (client as any)['getAccessToken']();
      expect(token).toBe('re2');
    });

    it('fetchOrder should retry when initial call yields 401', async () => {
      // expired access token with refresh
      client.setAccessToken('expired', Date.now() - 1000, 'refreshToken');
      const orderResponse = { id: 'o1' } as any;
      const refreshedToken = {
        access_token: 'newtok',
        refresh_token: 'rt',
        token_type: 'Bearer',
        expires_in: 1000,
        scope: 's',
        user_id: 1,
      };
      // mock sequence: first refresh, first order (401), second refresh, second order success
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => refreshedToken })
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
        .mockResolvedValueOnce({ ok: true, json: async () => refreshedToken })
        .mockResolvedValueOnce({ ok: true, json: async () => orderResponse });

      const order = await client.fetchOrder('o1');
      expect(order).toEqual(orderResponse);
    });
  });

  describe('createMercadoLivreClient factory', () => {
    beforeEach(() => {
      // ensure environment is clean regardless of outside state
      delete process.env.ML_CLIENT_ID;
      delete process.env.ML_CLIENT_SECRET;
      delete process.env.ML_REDIRECT_URI;
      delete process.env.ML_URL_REDIRECT;
    });

    afterEach(() => {
      delete process.env.ML_CLIENT_ID;
      delete process.env.ML_CLIENT_SECRET;
      delete process.env.ML_REDIRECT_URI;
      delete process.env.ML_URL_REDIRECT;
    });

    it('throws if required env vars missing', async () => {
      await expect(createMercadoLivreClient()).rejects.toThrow();
    });

    it('initializes with stored seller credentials and persists updates', async () => {
      process.env.ML_CLIENT_ID = 'cid';
      process.env.ML_CLIENT_SECRET = 'secret';
      process.env.ML_REDIRECT_URI = 'https://r';

      const sellerService = await import('@/services/sellerService');
      const creds = {
        access_token: 'stored',
        refresh_token: 'storedRefresh',
        expires_at: Date.now() + 5000,
        scope: 's',
      } as any;
      jest.spyOn(sellerService, 'getSellerCredentials').mockResolvedValue(creds);
      const updateSpy = jest
        .spyOn(sellerService, 'updateSellerCredentials')
        .mockResolvedValue();

      const clientWithSeller = await createMercadoLivreClient('sellerX');
      // after factory, token should have been set
      // we also check callback by forcing a refresh
      clientWithSeller.setAccessToken('stored', creds.expires_at, creds.refresh_token);
      const newTok = {
        access_token: 'after',
        refresh_token: 'afterRefresh',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 's',
        user_id: 1,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newTok,
      });
      await clientWithSeller.refreshAccessToken();
      expect(updateSpy).toHaveBeenCalledWith('sellerX', {
        access_token: 'after',
        refresh_token: 'afterRefresh',
        expires_at: expect.any(Number),
        scope: 's',
      });
    });
  });
});

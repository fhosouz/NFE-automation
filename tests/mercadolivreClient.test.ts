/**
 * Tests for Mercado Livre Client
 */

import { MercadoLivreClient } from '@/services/mercadolivreClient';

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
});

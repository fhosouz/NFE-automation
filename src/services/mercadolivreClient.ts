/**
 * Mercado Livre Client Service
 * Handles authentication and order fetching from ML API
 */

export interface MLAuthToken {
  access_token: string;
  refresh_token?: string; // present when exchanging authorization code
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
}

interface MLOrderResponse {
  id: string;
  buyer: {
    id: number;
    nickname: string;
  };
  order_items: Array<{
    id: string;
    item: {
      id: string;
      title: string;
      category_id: string;
    };
    quantity: number;
    unit_price: number;
  }>;
  total_amount: number;
  currency_id: string;
  date_created: string;
  date_closed: string;
  status: string;
  shipping: {
    id: number;
    receiver_address: {
      address_line: string;
      city: string;
      state: string;
      zip_code: string;
      country: {
        id: string;
      };
    };
  };
}

/**
 * Mercado Livre API client
 * Uses OAuth2 with client credentials
 */
export class MercadoLivreClient {
  // add setter for external token
  public setAccessToken(token: string, expiresAt: number) {
    this.accessToken = token;
    this.tokenExpiry = expiresAt;
  }

  private baseUrl: string = 'https://api.mercadolibre.com';
  private clientId: string;
  private clientSecret: string;
  private redirectUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string, redirectUrl: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUrl = redirectUrl;

    // warn early if configuration looks incomplete; avoids obscure 400s
    if (!this.clientId || !this.clientSecret) {
      console.warn(
        '[ML_CLIENT] Warning: clientId or clientSecret is empty. ' +
          'Set ML_CLIENT_ID and ML_CLIENT_SECRET in environment.'
      );
    }
    if (!this.redirectUrl) {
      console.warn(
        '[ML_CLIENT] Warning: redirectUrl is not configured. ' +
          'Set ML_REDIRECT_URI and ensure it matches the app configuration on Mercado Livre.'
      );
    }
  }

  /**
   * Get access token using client credentials
   * For production, use authorization code flow; this uses refresh token pattern
   */
  private async getAccessToken(): Promise<string> {
    // If token still valid, reuse it
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new token (using refresh token or client credentials)
    // For MVP, assume we have a refresh token stored or use client credentials
    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as MLAuthToken;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // Buffer 5 min

      return this.accessToken;
    } catch (error) {
      console.error('[ML_CLIENT] Token request error:', error);
      throw error;
    }
  }

  /**
   * Exchange an authorization code for OAuth tokens.
   * This is used in the Authorization Code flow during seller onboarding.
   */
  async exchangeCodeForToken(code: string): Promise<MLAuthToken> {
    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUrl,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Code exchange failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as MLAuthToken;

      // store token for immediate use so subsequent calls (e.g. fetchSeller)
      // don't trigger a new client-credentials request with potentially
      // invalid/empty credentials.
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      return data;
    } catch (error) {
      console.error('[ML_CLIENT] Code exchange error:', error);
      throw error;
    }
  }

  /**
   * Fetch order details from Mercado Livre API
   * GET /orders/{orderId}
   */
  async fetchOrder(orderId: string): Promise<MLOrderResponse> {
    const token = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Order fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const order = (await response.json()) as MLOrderResponse;
      return order;
    } catch (error) {
      console.error(`[ML_CLIENT] Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch seller info from Mercado Livre API
   * GET /users/{userId}
   */
  async fetchSeller(sellerId: string): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/users/${sellerId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Seller fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const seller = await response.json();
      return seller;
    } catch (error) {
      console.error(`[ML_CLIENT] Error fetching seller ${sellerId}:`, error);
      throw error;
    }
  }
}

/**
 * Factory to create ML client from environment variables
 */
export interface SellerCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
}

export const createMercadoLivreClient = async (
  sellerId?: string
): Promise<MercadoLivreClient> => {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  // use canonical name first, fall back to alias
  const redirectUrl = process.env.ML_REDIRECT_URI || process.env.ML_URL_REDIRECT;

  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error(
      'Missing Mercado Livre credentials: ML_CLIENT_ID, ML_CLIENT_SECRET, ' +
        'and ML_REDIRECT_URI (or ML_URL_REDIRECT as alias)'
    );
  }

  if (!process.env.ML_REDIRECT_URI && process.env.ML_URL_REDIRECT) {
    console.warn(
      '[ML_CLIENT] using ML_URL_REDIRECT as redirect URI; consider renaming to ML_REDIRECT_URI'
    );
  }

  const client = new MercadoLivreClient(clientId, clientSecret, redirectUrl);

  // If a sellerId is provided, try to load that seller's stored token.
  if (sellerId) {
    try {
      const { getSellerCredentials } = await import('./sellerService');
      const creds = await getSellerCredentials(sellerId);
      if (creds && creds.access_token) {
        client.setAccessToken(creds.access_token, creds.expires_at);
        console.log('[ML_CLIENT] initialized with seller access token');
      }
    } catch (err) {
      console.warn('[ML_CLIENT] failed to load seller credentials', err);
    }
  }

  return client;
};


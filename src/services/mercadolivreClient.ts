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
  // optional callback that consumers can register to be notified whenever
  // the client obtains a fresh token from Mercado Livre (exchange or refresh).
  private tokenUpdateCallback?: (token: MLAuthToken) => Promise<void>;

  // add setter for external token
  public setAccessToken(token: string, expiresAt: number, refreshToken?: string) {
    this.accessToken = token;
    this.tokenExpiry = expiresAt;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  /**
   * Register a callback invoked when a new MLAuthToken is received.  This
   * allows higher-level logic (e.g. orderProcessor) to persist updated
   * credentials for a seller.
   */
  public onTokenUpdate(cb: (token: MLAuthToken) => Promise<void>) {
    this.tokenUpdateCallback = cb;
  }

  private baseUrl: string = 'https://api.mercadolibre.com';
  private clientId: string;
  private clientSecret: string;
  private redirectUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
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

    // If we have a refresh token, try to refresh
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        if (this.accessToken) {
          return this.accessToken;
        }
        // fallback to client credentials if refresh somehow didn't set one
      } catch (err) {
        console.warn('[ML_CLIENT] refresh failed, falling back to client-credentials', err);
      }
    }

    // Request new token (using client credentials)
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
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      if (this.tokenUpdateCallback) {
        // async notify but don't block the return path
        this.tokenUpdateCallback(data).catch((e) =>
          console.warn('[ML_CLIENT] token update callback failed', e)
        );
      }

      return data;
    } catch (error) {
      console.error('[ML_CLIENT] Code exchange error:', error);
      throw error;
    }
  }

  /**
   * Use the refresh token to obtain a new access (and optionally refresh) token.
   * Returns the raw MLAuthToken so callers can persist it if needed.
   */
  public async refreshAccessToken(): Promise<MLAuthToken> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Refresh token request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as MLAuthToken;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      console.log('[ML_CLIENT] token refreshed or exchanged; expiry', new Date(this.tokenExpiry).toISOString());

      if (this.tokenUpdateCallback) {
        this.tokenUpdateCallback(data).catch((e) =>
          console.warn('[ML_CLIENT] token update callback failed', e)
        );
      }

      return data;
    } catch (err) {
      console.error('[ML_CLIENT] refreshAccessToken error:', err);
      throw err;
    }
  }

  /**
   * Fetch order details from Mercado Livre API
   * GET /orders/{orderId}
   */
  async fetchOrder(orderId: string, _retry = false): Promise<MLOrderResponse> {
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
    } catch (error: any) {
      console.error(`[ML_CLIENT] Error fetching order ${orderId}:`, error);
      // if unauthorized and we haven't retried yet, attempt a refresh and try again
      if (
        !(_retry) &&
        error.message &&
        error.message.includes('401') &&
        this.refreshToken
      ) {
        try {
          await this.refreshAccessToken();
          return this.fetchOrder(orderId, true);
        } catch (refreshErr) {
          // fall through to rethrow original error below
          console.warn('[ML_CLIENT] retry after refresh failed', refreshErr);
        }
      }
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

  // If a sellerId is provided, try to load that seller's stored token and
  // register a callback so future refreshes are persisted automatically.
  if (sellerId) {
    try {
      const { getSellerCredentials, updateSellerCredentials } =
        await import('./sellerService');
      const creds = await getSellerCredentials(sellerId);
      if (creds && creds.access_token) {
        client.setAccessToken(creds.access_token, creds.expires_at, creds.refresh_token);
        console.log('[ML_CLIENT] initialized with seller access token');
      }

      // registration ensures that whenever the client refreshes or exchanges a
      // token, our database stays up to date.
      client.onTokenUpdate(async (newToken) => {
        // convert to SellerCredentials shape
        await updateSellerCredentials(sellerId, {
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          expires_at: Date.now() + newToken.expires_in * 1000,
          scope: newToken.scope,
        });
      });
    } catch (err) {
      console.warn('[ML_CLIENT] failed to load or persist seller credentials', err);
    }
  }

  return client;
};


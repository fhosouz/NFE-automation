/**
 * Mercado Livre OAuth2 Routes
 *
 * 1. GET /api/ml/oauth/start     -> Redirects user to Mercado Livre authorization page
 * 2. GET /api/ml/oauth/callback  -> Handles authorization code, exchanges for tokens,
 *                                     persists credentials and seller info.
 */

import { Router } from 'express';
import crypto from 'crypto';
// oauth/token requests use global fetch (Node 18+) so we avoid extra dependencies
import config from '@/config';
import { supabaseServiceClient as supabase } from '@/services/supabaseClient';
import { createMercadoLivreClient } from '@/services/mercadolivreClient';

const router = Router();
const STATE_COOKIE = 'ml_oauth_state';
const COOKIE_OPTIONS: any = { httpOnly: true, secure: true, sameSite: 'lax' };

// Helper to generate random state
const generateState = (): string => crypto.randomBytes(16).toString('hex');

/**
 * Start OAuth2 flow by redirecting user to ML authorization URL
 */
router.get('/ml/oauth/start', (req: any, res: any) => {
  const state = generateState();
  const authUrl = new URL('https://auth.mercadolivre.com.br/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.mercadoLivre.clientId);
  authUrl.searchParams.set('redirect_uri', config.mercadoLivre.redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'read write');

  res.cookie(STATE_COOKIE, state, COOKIE_OPTIONS);
  res.redirect(authUrl.toString());
});

/**
 * OAuth callback handler: exchange code for tokens and persist seller record
 */
router.get('/ml/oauth/callback', async (req: any, res: any) => {
  const { code, state, error, error_description } = req.query as any;
  const storedState = req.cookies?.[STATE_COOKIE];

  // Clear state cookie
  res.clearCookie(STATE_COOKIE);

  if (error) {
    console.error('[ML_OAUTH] Authorization error:', error, error_description);
    return res.status(400).send('Authorization failed');
  }

  if (!code || !state || state !== storedState) {
    console.error('[ML_OAUTH] State mismatch or missing code');
    return res.status(400).send('Invalid OAuth state');
  }

  try {
    // Exchange authorization code for tokens (delegated to ML client)
    const mlClient = await createMercadoLivreClient();
    const tokenData = await mlClient.exchangeCodeForToken(code as string);
    const mlUserId = tokenData.user_id?.toString();

    if (!mlUserId) {
      throw new Error('Token response missing user_id');
    }

    // Optionally fetch seller profile for name
    const sellerProfile = await mlClient.fetchSeller(mlUserId);

    // Persist seller in database (upsert by ml_seller_id)
    const credentials = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      scope: tokenData.scope,
    };

    const { error: dbError } = await supabase
      .from('sellers')
      .upsert(
        {
          ml_seller_id: mlUserId,
          name: sellerProfile.nickname || null,
          mercadolivre_credentials: credentials,
        },
        { onConflict: 'ml_seller_id' }
      );

    if (dbError) {
      console.error('[ML_OAUTH] DB upsert error:', dbError);
      throw dbError;
    }

    // Redirect to a success page or return simple message
    res.send('Authorization successful! You can close this window.');
  } catch (err) {
    console.error('[ML_OAUTH] Callback processing error:', err);
    res.status(500).send('OAuth processing failed');
  }
});

export default router;

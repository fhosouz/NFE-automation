import { supabaseServiceClient as supabase } from '@/services/supabaseClient';

export interface SellerCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
}

/**
 * Retrieve stored Mercado Livre credentials for a seller.
 * The caller will typically pass the numeric ML seller ID from the webhook.
 */
export const getSellerCredentials = async (
  mlSellerId: string
): Promise<SellerCredentials | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('mercadolivre_credentials')
    .eq('ml_seller_id', mlSellerId)
    .single();

  if (error) {
    console.error('[SELLER_SERVICE] error fetching credentials', error);
    throw error;
  }

  return data?.mercadolivre_credentials || null;
};

/**
 * Update stored Mercado Livre credentials for a seller.  This is used when a
 * refresh token exchange returns a new access token or refresh token.
 */
export const updateSellerCredentials = async (
  mlSellerId: string,
  creds: SellerCredentials
): Promise<void> => {
  const { error } = await supabase
    .from('sellers')
    .update({ mercadolivre_credentials: creds })
    .eq('ml_seller_id', mlSellerId);

  if (error) {
    console.error('[SELLER_SERVICE] error updating credentials', error);
    throw error;
  }
};

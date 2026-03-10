/**
 * Real Mercado Livre Integration Test (manual)
 *
 * This suite is **disabled by default** and only runs when the
 * environment variable `RUN_REAL_ML_INTEGRATION` is set to `true`.
 *
 * It requires the following environment variables to be populated:
 *   ML_CLIENT_ID, ML_CLIENT_SECRET, ML_URL_REDIRECT (optional)
 *   ML_TEST_ORDER_ID      -> ID of an existing Mercado Livre order to fetch
 *   ML_TEST_SELLER_ID     -> numeric seller id associated with the order
 *   TEST_ISSUER_CNPJ       -> CNPJ to use when building the NFe issuer (real)
 *   TEST_ISSUER_IE         -> IE of the issuer
 *   TEST_ISSUER_NAME       -> Company name
 *   TEST_ISSUER_ADDRESS_*  -> Address fields as in the issuer interface
 *
 * To run:
 *   RUN_REAL_ML_INTEGRATION=true npm test -- tests/realIntegration.test.ts
 *
 * This test will hit the Mercado Livre API and then feed the resulting
 * payload through the same business logic used in production.  It will
 * create records in the configured Supabase project (service role key)
 * and upload an XML to storage, so run against a test database.
 */

import { createMercadoLivreClient } from '@/services/mercadolivreClient';
import { processOrderFromWebhook } from '@/services/orderProcessor';
import { MercadoLivreWebhookPayload } from '@/types/webhook';
import { NFeIssuer } from '@/services/xmlBuilder';

// guard that stops suite when env var not enabled
const shouldRun = process.env.RUN_REAL_ML_INTEGRATION === 'true';

(shouldRun ? describe : describe.skip)('Real ML integration (manual)', () => {
  let issuer: NFeIssuer;
  let sellerId: string;

  beforeAll(() => {
    if (!process.env.ML_TEST_ORDER_ID || !process.env.ML_TEST_SELLER_ID) {
      throw new Error('ML_TEST_ORDER_ID and ML_TEST_SELLER_ID must be provided');
    }

    sellerId = process.env.ML_TEST_SELLER_ID as string;

    issuer = {
      CNPJ: process.env.TEST_ISSUER_CNPJ || '',
      xNome: process.env.TEST_ISSUER_NAME || '',
      IE: process.env.TEST_ISSUER_IE || '',
      CRT: 1,
      indIEDest: 1,
      enderEmit: {
        xLgr: process.env.TEST_ISSUER_ADDRESS_STREET || '',
        nro: process.env.TEST_ISSUER_ADDRESS_NUMBER || '',
        xBairro: process.env.TEST_ISSUER_ADDRESS_NEIGHBORHOOD || '',
        cMun: process.env.TEST_ISSUER_ADDRESS_MUNICIPAL_CODE || '3550308',
        xMun: process.env.TEST_ISSUER_ADDRESS_CITY || 'São Paulo',
        UF: process.env.TEST_ISSUER_ADDRESS_UF || 'SP',
        CEP: process.env.TEST_ISSUER_ADDRESS_CEP || '01000000',
        cPais: '1058',
        xPais: 'Brasil',
      },
    };
  });

  it('should fetch order from Mercado Livre and generate XML', async () => {
    const orderId = process.env.ML_TEST_ORDER_ID!;
    const mlClient = await createMercadoLivreClient(sellerId);

    // fetch live order
    const mlOrder = await mlClient.fetchOrder(orderId);
    expect(mlOrder).toBeDefined();
    expect(mlOrder.id).toBe(orderId);

    // construct a webhook payload similar to what ML sends
    const payload: MercadoLivreWebhookPayload = {
      id: `manual-${Date.now()}`,
      resource: `/orders/${sellerId}/${orderId}`,
      user_id: Number(sellerId),
      topic: 'order.created',
      application_id: Number(process.env.ML_CLIENT_ID || 0),
      attempts: 1,
      received_from: '127.0.0.1',
      sent_at: new Date().toISOString(),
    };

    const result = await processOrderFromWebhook(payload, issuer);

    expect(result.success).toBe(true);
    expect(result.accessKey44).toHaveLength(44);
    expect(result.xmlUrl).toBeDefined();
    expect(result.signedDownloadUrl).toBeDefined();

    console.log('Integration result:', result);
  });
});

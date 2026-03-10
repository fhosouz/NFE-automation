# NFe Automation — Backend (minimal scaffold)

**Deployment Status**: 🚀 Live on Render  
**Last Deployed**: February 28, 2026

Run the backend locally for development.

Local setup

```bash
# install
npm ci

# dev server (auto-restart)
npm run dev

# run tests
npm test

# build
npm run build
```

Environment

- Create a `.env` file with `PORT=3000` and Supabase/config vars when ready.
- **Mercado Livre credentials are mandatory for OAuth/webhook processing**. Set:
  - `ML_CLIENT_ID`, `ML_CLIENT_SECRET` (from your ML developer app)
  - `ML_REDIRECT_URI` must exactly match the redirect URL configured in the
    ML app settings (e.g. `https://your-domain.com/api/ml/oauth/callback`).
  If any of these are missing you will see `Bad Request` errors during the
  OAuth dance, as the sample log above demonstrated.

## Real Mercado Livre Integration (Manual Testing)

To exercise the full production flow with a real ML order you can run the
integration script/test. First populate the following environment variables
in your `.env` or CI profile:

```
ML_CLIENT_ID=<your ML app id>
ML_CLIENT_SECRET=<your ML app secret>
ML_URL_REDIRECT=<redirect URI if needed>

ML_TEST_ORDER_ID=<existing ML order id for testing>
ML_TEST_SELLER_ID=<numeric seller id for that order>

TEST_ISSUER_CNPJ=00000000000191
TEST_ISSUER_NAME="Minha Empresa MEI"
TEST_ISSUER_IE=123456789
TEST_ISSUER_ADDRESS_STREET="Rua Teste"
TEST_ISSUER_ADDRESS_NUMBER=123
TEST_ISSUER_ADDRESS_NEIGHBORHOOD="Centro"
TEST_ISSUER_ADDRESS_CITY="São Paulo"
TEST_ISSUER_ADDRESS_UF=SP
TEST_ISSUER_ADDRESS_CEP=01000000

# allow the test to run (disabled by default)
RUN_REAL_ML_INTEGRATION=true
```

Then execute the bespoke jest suite:

```bash
npm test -- tests/realIntegration.test.ts
```

This will fetch the order from Mercado Livre, process it through the pipeline
and upload an XML to your Supabase project. Use a staging database/Storage key.

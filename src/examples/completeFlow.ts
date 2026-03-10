/**
 * Example: Complete NFe Generation Flow
 * Demonstrates the full integration from Mercado Livre webhook to XML download
 */

import { processOrderFromWebhook } from '@/services/orderProcessor';
import { MercadoLivreWebhookPayload } from '@/types/webhook';
import { NFeIssuer } from '@/services/xmlBuilder';

// Example issuer data (would come from seller configuration)
const EXAMPLE_ISSUER: NFeIssuer = {
  CNPJ: '12345678000195',
  xNome: 'Minha Empresa MEI Ltda',
  xFant: 'Minha Empresa',
  IE: '123456789',
  CRT: 1, // Simples Nacional
  indIEDest: 1,
  enderEmit: {
    xLgr: 'Rua das Flores',
    nro: '123',
    xBairro: 'Centro',
    cMun: '3550308', // São Paulo
    xMun: 'São Paulo',
    UF: 'SP',
    CEP: '01000000',
    cPais: '1058',
    xPais: 'Brasil',
    fone: '11999999999',
  },
};

// Example webhook payload from Mercado Livre
const EXAMPLE_WEBHOOK: MercadoLivreWebhookPayload = {
  id: '123456789',
  resource: '/orders/123456/987654321', // seller_id/order_id
  user_id: 123456,
  topic: 'order.created',
  application_id: 12345,
  attempts: 1,
  received_from: '192.168.0.1',
  sent_at: '2026-03-09T10:00:00Z',
};

/**
 * Complete flow demonstration
 */
export const demonstrateCompleteFlow = async () => {
  console.log('🚀 Demonstrating Complete NFe Generation Flow\n');

  try {
    console.log('📨 Step 1: Receive Mercado Livre Webhook');
    console.log(`   Webhook ID: ${EXAMPLE_WEBHOOK.id}`);
    console.log(`   Topic: ${EXAMPLE_WEBHOOK.topic}`);
    console.log(`   Resource: ${EXAMPLE_WEBHOOK.resource}`);
    console.log(`   Seller ID: 123456, Order ID: 987654321\n`);

    console.log('🔄 Step 2: Process Order (Webhook → XML)');
    const result = await processOrderFromWebhook(EXAMPLE_WEBHOOK, EXAMPLE_ISSUER);

    if (!result.success) {
      console.log('❌ Processing failed:');
      console.log(`   Error: ${result.error}`);

      if (result.validationErrors && result.validationErrors.length > 0) {
        console.log('   Validation errors:');
        result.validationErrors.forEach(error => console.log(`   - ${error}`));
      }

      if (result.error?.includes('pending_configuration')) {
        console.log('\n💡 This would happen if:');
        console.log('   - Product has no NCM code');
        console.log('   - Customer has no CPF/CNPJ');
        console.log('   - Seller needs to configure missing data in dashboard');
      }

      return;
    }

    console.log('✅ Processing successful!');
    console.log(`   Order ID: ${result.orderId}`);
    console.log(`   Invoice Number: ${result.invoiceNumber}`);
    console.log(`   Access Key: ${result.accessKey44}`);
    console.log(`   XML URL: ${result.xmlUrl}`);
    console.log(`   Download URL: ${result.signedDownloadUrl}\n`);

    console.log('📋 Step 3: XML Generated Successfully');
    console.log('   ✅ Webhook idempotency checked');
    console.log('   ✅ Order fetched from ML API');
    console.log('   ✅ Data normalized to internal format');
    console.log('   ✅ Required fields validated (NCM, CPF/CNPJ)');
    console.log('   ✅ Invoice number reserved atomically');
    console.log('   ✅ SEFAZ access key generated (44 digits)');
    console.log('   ✅ NFe XML built with MEI defaults');
    console.log('   ✅ XML validated against structure');
    console.log('   ✅ XML stored in Supabase Storage');
    console.log('   ✅ Signed download URL generated\n');

    console.log('🎯 Step 4: Ready for Sebrae Import');
    console.log('   The seller can now:');
    console.log('   1. Download the XML using the signed URL');
    console.log('   2. Import the XML into Sebrae system');
    console.log('   3. Complete the NFe emission process manually');
    console.log('   4. No automatic SEFAZ submission (MVP scope)\n');

    console.log('📊 Key Features Demonstrated:');
    console.log('   • Atomic invoice numbering (no duplicates)');
    console.log('   • SEFAZ-compliant access key generation');
    console.log('   • MEI tax regime (all taxes = 0.00)');
    console.log('   • CFOP 5102 for consumer sales');
    console.log('   • Idempotent webhook processing');
    console.log('   • Secure file storage with signed URLs');
    console.log('   • Comprehensive validation and error handling\n');

  } catch (error) {
    console.error('💥 Unexpected error in demonstration:', error);
  }
};

/**
 * Example of what the generated XML looks like
 */
export const showExampleXml = () => {
  const exampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe352603123456780001955500100000000100000001">
    <ide>
      <cUF>35</cUF>
      <cNF>00000001</cNF>
      <natOp>Venda de mercadorias</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>1</nNF>
      <dhEmi>2026-03-09T10:00:00</dhEmi>
      <tpNF>1</tpNF>
      <tpAmb>2</tpAmb>
      <procEmi>0</procEmi>
      <verProc>ML-NFE-1.0</verProc>
      <indFinal>1</indFinal>
      <indPres>2</indPres>
      <modFrete>9</modFrete>
    </ide>

    <emit>
      <CNPJ>12345678000195</CNPJ>
      <xNome>Minha Empresa MEI Ltda</xNome>
      <IE>123456789</IE>
      <CRT>1</CRT>
      <enderEmit>
        <xLgr>Rua das Flores</xLgr>
        <nro>123</nro>
        <xBairro>Centro</xBairro>
        <cMun>3550308</cMun>
        <xMun>São Paulo</xMun>
        <UF>SP</UF>
        <CEP>01000000</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
    </emit>

    <dest>
      <CPF>12345678901</CPF>
      <xNome>João Comprador</xNome>
      <enderDest>
        <xLgr>Rua do Cliente, 456</xLgr>
        <nro>SN</nro>
        <xBairro>Centro</xBairro>
        <cMun>3550308</cMun>
        <xMun>São Paulo</xMun>
        <UF>SP</UF>
        <CEP>01234000</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderDest>
    </dest>

    <det nItem="1">
      <prod>
        <cProd>MLB123456</cProd>
        <xProd>Produto Teste</xProd>
        <NCM>84713010</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>2</qCom>
        <vUnCom>50.00</vUnCom>
        <vProd>100.00</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
            <modBC>0</modBC>
            <vBC>0.00</vBC>
            <vICMS>0.00</vICMS>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>

    <total>
      <ICMSTot>
        <vProd>100.00</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>100.00</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>

    <transp>
      <modFrete>9</modFrete>
    </transp>

    <pag>
      <detPag>
        <indPag>0</indPag>
        <tPag>99</tPag>
        <vPag>100.00</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;

  console.log('📄 Example Generated NFe XML:');
  console.log('=' .repeat(80));
  console.log(exampleXml);
  console.log('=' .repeat(80));
  console.log('\n✨ This XML can be imported directly into Sebrae for NFe emission!');
};

// Uncomment to run demonstration
// demonstrateCompleteFlow().then(() => showExampleXml());

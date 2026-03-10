/**
 * Tests for XML Builder Service
 * Verifies NFe XML generation with MEI defaults and CFOP logic
 */

import { buildNFeXml, nfeToXmlString, NFeIssuer } from '@/services/xmlBuilder';
import { NormalizedOrder } from '@/services/orderNormalizer';

describe('xmlBuilder', () => {
  const mockIssuer: NFeIssuer = {
    CNPJ: '12345678000195',
    xNome: 'Empresa Teste MEI Ltda',
    xFant: 'Empresa Teste',
    IE: '123456789',
    CRT: 1, // Simples Nacional
    indIEDest: 1,
    IM: '12345',
    CNAE: '6201-5/00',
    enderEmit: {
      xLgr: 'Rua Teste',
      nro: '123',
      xBairro: 'Centro',
      cMun: '3550308',
      xMun: 'São Paulo',
      UF: 'SP',
      CEP: '01000000',
      cPais: '1058',
      xPais: 'Brasil',
      fone: '11999999999',
    },
  };

  const mockNormalizedOrder: NormalizedOrder = {
    ml_order_id: '123456789',
    ml_seller_id: '123456',
    customer: {
      ml_customer_id: '987654321',
      nickname: 'João Comprador',
      cpf_cnpj: '12345678901', // CPF
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
    },
    products: [
      {
        ml_sku: 'MLB123456',
        title: 'Produto Teste',
        category_id: 'MLB1234',
        quantity: 2,
        unit_price: 50.00,
        total_price: 100.00,
        ncm: '84713010', // Required for NFe
      },
    ],
    shipping: {
      address_line: 'Rua do Cliente, 456',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01234000',
      country: 'BR',
    },
    total_amount: 100.00,
    currency_id: 'BRL',
    order_date: '2026-03-09T10:00:00Z',
    status: 'paid',
    metadata: {
      source: 'mercadolivre',
      fetched_at: '2026-03-09T10:05:00Z',
    },
  };

  describe('buildNFeXml', () => {
    it('should build valid NFe structure', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const invoiceNumber = 1;
      const serie = '1';

      const nfe = buildNFeXml(
        mockNormalizedOrder,
        mockIssuer,
        accessKey44,
        invoiceNumber,
        serie
      );

      expect(nfe).toBeDefined();
      expect(nfe.infNFe.Id).toBe(`NFe${accessKey44}`);
      expect(nfe.ide.nNF).toBe(invoiceNumber);
      expect(nfe.ide.serie).toBe(serie);
      expect(nfe.emit.CNPJ).toBe(mockIssuer.CNPJ);
      expect(nfe.dest.CPF).toBe(mockNormalizedOrder.customer.cpf_cnpj);
      expect(nfe.det).toHaveLength(1);
    });

    it('should set MEI tax defaults (all taxes zero)', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');

      // Check ICMS defaults
      expect(nfe.det[0].ICMS.orig).toBe(0);
      expect(nfe.det[0].ICMS.CST).toBe('102'); // CSOSN for MEI
      expect(nfe.det[0].ICMS.vBC).toBe(0.00);
      expect(nfe.det[0].ICMS.vICMS).toBe(0.00);

      // Check PIS/COFINS defaults
      expect(nfe.det[0].PIS.CST).toBe('07'); // Isento
      expect(nfe.det[0].COFINS.CST).toBe('07'); // Isento

      // Check totals
      expect(nfe.total.ICMSTot.vBC).toBe(0.00);
      expect(nfe.total.ICMSTot.vICMS).toBe(0.00);
      expect(nfe.total.ICMSTot.vPIS).toBe(0.00);
      expect(nfe.total.ICMSTot.vCOFINS).toBe(0.00);
    });

    it('should set CFOP default to 5102', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');

      expect(nfe.det[0].CFOP).toBe('5102');
    });

    it('should set operational defaults', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');

      expect(nfe.ide.indFinal).toBe(1); // Consumidor final
      expect(nfe.ide.indPres).toBe(2); // Não presencial
      expect(nfe.ide.indIntermed).toBe(0); // Sem intermediador
      expect(nfe.ide.modFrete).toBe(9); // Sem frete
      expect(nfe.ide.tpNF).toBe(1); // Saída
      expect(nfe.ide.procEmi).toBe(0); // Emissão própria
      expect(nfe.ide.verProc).toBe('ML-NFE-1.0');
    });

    it('should handle multiple products', () => {
      const orderWithMultipleProducts: NormalizedOrder = {
        ...mockNormalizedOrder,
        products: [
          mockNormalizedOrder.products[0],
          {
            ...mockNormalizedOrder.products[0],
            ml_sku: 'MLB789012',
            title: 'Segundo Produto',
            quantity: 1,
            unit_price: 75.00,
            total_price: 75.00,
          },
        ],
      };

      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(orderWithMultipleProducts, mockIssuer, accessKey44, 1, '1');

      expect(nfe.det).toHaveLength(2);
      expect(nfe.total.ICMSTot.vProd).toBe(175.00); // 100 + 75
      expect(nfe.total.ICMSTot.vNF).toBe(175.00);
    });

    it('should handle CNPJ recipients', () => {
      const orderWithCNPJ: NormalizedOrder = {
        ...mockNormalizedOrder,
        customer: {
          ...mockNormalizedOrder.customer,
          cpf_cnpj: '12345678000195', // CNPJ
        },
      };

      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(orderWithCNPJ, mockIssuer, accessKey44, 1, '1');

      expect(nfe.dest.CNPJ).toBe('12345678000195');
      expect(nfe.dest.CPF).toBeUndefined();
    });
  });

  describe('nfeToXmlString', () => {
    it('should generate valid XML string', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');
      const xml = nfeToXmlString(nfe);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">');
      expect(xml).toContain(`Id="NFe${accessKey44}"`);
      expect(xml).toContain('<cUF>35</cUF>'); // SP
      expect(xml).toContain('<CNPJ>12345678000195</CNPJ>');
      expect(xml).toContain('<CPF>12345678901</CPF>');
      expect(xml).toContain('<xProd>Produto Teste</xProd>');
      expect(xml).toContain('<NCM>84713010</NCM>');
      expect(xml).toContain('<CFOP>5102</CFOP>');
      expect(xml).toContain('<vBC>0.00</vBC>');
      expect(xml).toContain('<vICMS>0.00</vICMS>');
      expect(xml).toContain('</NFe>');
    });

    it('should include all required blocks', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');
      const xml = nfeToXmlString(nfe);

      expect(xml).toContain('<ide>');
      expect(xml).toContain('<emit>');
      expect(xml).toContain('<dest>');
      expect(xml).toContain('<det nItem="1">');
      expect(xml).toContain('<total>');
      expect(xml).toContain('<transp>');
      expect(xml).toContain('<pag>');
    });

    it('should format monetary values correctly', () => {
      const accessKey44 = '352603123456780001955500100000000100000001';
      const nfe = buildNFeXml(mockNormalizedOrder, mockIssuer, accessKey44, 1, '1');
      const xml = nfeToXmlString(nfe);

      expect(xml).toContain('<vProd>100.00</vProd>');
      expect(xml).toContain('<vNF>100.00</vNF>');
      expect(xml).toContain('<vUnCom>50.00</vUnCom>');
      expect(xml).toContain('<vPag>100.00</vPag>');
    });
  });
});

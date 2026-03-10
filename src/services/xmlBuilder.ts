/**
 * XML Builder Service
 * Maps normalized Mercado Livre order to NFe XML structure
 * Task 9: xmlBuilder.ts mapping + MEI defaults + CFOP core logic
 */

import { NormalizedOrder } from '@/services/orderNormalizer';

export interface NFeIssuer {
  CNPJ: string;
  xNome: string;
  xFant?: string;
  IE: string;
  CRT: number; // 1 = Simples Nacional
  indIEDest: number; // 1 = Contribuinte ICMS
  IM?: string;
  CNAE?: string;
  enderEmit: {
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun: string;
    xMun: string;
    UF: string;
    CEP: string;
    cPais: string;
    xPais: string;
    fone?: string;
  };
}

export interface NFeRecipient {
  CPF?: string;
  CNPJ?: string;
  xNome: string;
  indIEDest: number; // 2 = Não contribuinte
  email?: string;
  enderDest: {
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun: string;
    xMun: string;
    UF: string;
    CEP: string;
    cPais: string;
    xPais: string;
    fone?: string;
  };
}

export interface NFeProduct {
  cProd: string;
  cEAN: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cEANTrib: string;
  uTrib: string;
  qTrib: number;
  vUnTrib: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;
  indTot: number; // 1 = Compoe valor total da NF-e
  // Impostos - MEI defaults (todos zero)
  ICMS: {
    orig: number; // 0 = Nacional
    CST: string; // CSOSN 102 = Tributada pelo Simples Nacional sem permissão de crédito
    modBC: number; // 0 = Margem Valor Agregado (%)
    vBC: number; // 0.00
    pICMS: number; // 0.00
    vICMS: number; // 0.00
    pFCP: number; // 0.00
    vFCP: number; // 0.00
  };
  PIS: {
    CST: string; // 07 = Operação isenta da contribuição
    vBC: number; // 0.00
    pPIS: number; // 0.00
    vPIS: number; // 0.00
  };
  COFINS: {
    CST: string; // 07 = Operação isenta da contribuição
    vBC: number; // 0.00
    pCOFINS: number; // 0.00
    vCOFINS: number; // 0.00
  };
}

export interface NFeStructure {
  infNFe: {
    versao: string;
    Id: string; // NFe + access key
  };
  ide: {
    cUF: string;
    cNF: string;
    natOp: string;
    mod: string; // 55 = NFe
    serie: string;
    nNF: number;
    dhEmi: string;
    dhSaiEnt: string;
    tpNF: number; // 1 = Saída
    idDest: number; // 1 = Operação interna
    cMunFG: string;
    tpImp: number; // 1 = Retrato
    tpEmis: number; // 0 = Normal
    cDV: number;
    tpAmb: number; // 2 = Homologação
    procEmi: number; // 0 = Emissão própria
    verProc: string; // ML-NFE-1.0
    indFinal: number; // 1 = Consumidor final
    indPres: number; // 2 = Não presencial
    indIntermed: number; // 0 = Sem intermediador
    modFrete: number; // 9 = Sem frete
  };
  emit: NFeIssuer;
  dest: NFeRecipient;
  det: NFeProduct[];
  total: {
    ICMSTot: {
      vBC: number; // 0.00
      vICMS: number; // 0.00
      vICMSDeson: number; // 0.00
      vFCPUFDest: number; // 0.00
      vICMSUFDest: number; // 0.00
      vICMSUFRemet: number; // 0.00
      vFCP: number; // 0.00
      vBCST: number; // 0.00
      vST: number; // 0.00
      vFCPST: number; // 0.00
      vFCPSTRet: number; // 0.00
      vProd: number;
      vFrete: number; // 0.00
      vSeg: number; // 0.00
      vDesc: number; // 0.00
      vII: number; // 0.00
      vIPI: number; // 0.00
      vIPIDevol: number; // 0.00
      vPIS: number; // 0.00
      vCOFINS: number; // 0.00
      vOutro: number; // 0.00
      vNF: number;
      vTotTrib: number; // 0.00
    };
  };
  transp: {
    modFrete: number; // 9 = Sem frete
  };
  cobr?: any; // Optional
  pag: {
    detPag: {
      indPag: number; // 0 = Pagamento à vista
      tPag: string; // 99 = Outros
      vPag: number;
    }[];
  };
  infIntermed?: any; // Optional
  infRespTec?: any; // Optional
}

/**
 * Build NFe XML from normalized order
 * Includes MEI defaults and CFOP logic
 */
export const buildNFeXml = (
  normalizedOrder: NormalizedOrder,
  issuerData: NFeIssuer,
  accessKey44: string,
  invoiceNumber: number,
  serie: string,
  environment: '1' | '2' = '2' // 2 = homologation
): NFeStructure => {
  const currentDate = new Date().toISOString();

  // Extract UF from access key (first 2 digits)
  const cUF = accessKey44.substring(0, 2);

  // Extract cNF from access key (last 8 digits before DV)
  const cNF = accessKey44.substring(35, 43);

  // Calculate DV from access key
  const cDV = parseInt(accessKey44[43]);

  // Build products array
  const products: NFeProduct[] = normalizedOrder.products.map((product, index) => ({
    cProd: product.ml_sku,
    cEAN: '', // Empty for now
    xProd: product.title,
    NCM: product.ncm || '', // Should be validated before
    CFOP: '5102', // Default: Venda para consumidor final
    uCom: 'UN', // Default unit
    qCom: product.quantity,
    vUnCom: product.unit_price,
    vProd: product.total_price,
    cEANTrib: '',
    uTrib: 'UN',
    qTrib: product.quantity,
    vUnTrib: product.unit_price,
    vFrete: 0.00,
    vSeg: 0.00,
    vDesc: 0.00,
    vOutro: 0.00,
    indTot: 1,
    // MEI tax defaults - all zero
    ICMS: {
      orig: 0,
      CST: '102', // CSOSN for MEI
      modBC: 0,
      vBC: 0.00,
      pICMS: 0.00,
      vICMS: 0.00,
      pFCP: 0.00,
      vFCP: 0.00,
    },
    PIS: {
      CST: '07',
      vBC: 0.00,
      pPIS: 0.00,
      vPIS: 0.00,
    },
    COFINS: {
      CST: '07',
      vBC: 0.00,
      pCOFINS: 0.00,
      vCOFINS: 0.00,
    },
  }));

  // Calculate totals
  const vProd = products.reduce((sum, p) => sum + p.vProd, 0);
  const vNF = vProd; // No taxes for MEI

  // Build recipient
  const recipient: NFeRecipient = {
    CPF: normalizedOrder.customer.cpf_cnpj?.length === 11 ? normalizedOrder.customer.cpf_cnpj : undefined,
    CNPJ: normalizedOrder.customer.cpf_cnpj?.length === 14 ? normalizedOrder.customer.cpf_cnpj : undefined,
    xNome: normalizedOrder.customer.nickname,
    indIEDest: 2, // Não contribuinte
    enderDest: {
      xLgr: normalizedOrder.shipping.address_line || '',
      nro: 'SN', // Sem número
      xBairro: 'Centro', // Default
      cMun: '3550308', // São Paulo default
      xMun: normalizedOrder.shipping.city || 'São Paulo',
      UF: normalizedOrder.shipping.state || 'SP',
      CEP: normalizedOrder.shipping.zip_code?.replace(/\D/g, '') || '01000000',
      cPais: '1058', // Brasil
      xPais: 'Brasil',
    },
  };

  // Build NFe structure
  const nfe: NFeStructure = {
    infNFe: {
      versao: '4.00',
      Id: `NFe${accessKey44}`,
    },
    ide: {
      cUF,
      cNF,
      natOp: 'Venda de mercadorias',
      mod: '55',
      serie,
      nNF: invoiceNumber,
      dhEmi: currentDate,
      dhSaiEnt: currentDate,
      tpNF: 1, // Saída
      idDest: 1, // Operação interna
      cMunFG: '3550308', // São Paulo
      tpImp: 1, // Retrato
      tpEmis: 0, // Normal
      cDV,
      tpAmb: parseInt(environment),
      procEmi: 0, // Emissão própria
      verProc: 'ML-NFE-1.0',
      indFinal: 1, // Consumidor final
      indPres: 2, // Não presencial
      indIntermed: 0, // Sem intermediador
      modFrete: 9, // Sem frete
    },
    emit: issuerData,
    dest: recipient,
    det: products,
    total: {
      ICMSTot: {
        vBC: 0.00,
        vICMS: 0.00,
        vICMSDeson: 0.00,
        vFCPUFDest: 0.00,
        vICMSUFDest: 0.00,
        vICMSUFRemet: 0.00,
        vFCP: 0.00,
        vBCST: 0.00,
        vST: 0.00,
        vFCPST: 0.00,
        vFCPSTRet: 0.00,
        vProd,
        vFrete: 0.00,
        vSeg: 0.00,
        vDesc: 0.00,
        vII: 0.00,
        vIPI: 0.00,
        vIPIDevol: 0.00,
        vPIS: 0.00,
        vCOFINS: 0.00,
        vOutro: 0.00,
        vNF,
        vTotTrib: 0.00,
      },
    },
    transp: {
      modFrete: 9, // Sem frete
    },
    pag: {
      detPag: [{
        indPag: 0, // À vista
        tPag: '99', // Outros
        vPag: vNF,
      }],
    },
  };

  return nfe;
};

/**
 * Convert NFe structure to XML string
 */
export const nfeToXmlString = (nfe: NFeStructure): string => {
  // Simple XML builder - in production, use xmlbuilder2 or similar
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="${nfe.infNFe.versao}" Id="${nfe.infNFe.Id}">
    <ide>
      <cUF>${nfe.ide.cUF}</cUF>
      <cNF>${nfe.ide.cNF}</cNF>
      <natOp>${nfe.ide.natOp}</natOp>
      <mod>${nfe.ide.mod}</mod>
      <serie>${nfe.ide.serie}</serie>
      <nNF>${nfe.ide.nNF}</nNF>
      <dhEmi>${nfe.ide.dhEmi}</dhEmi>
      <dhSaiEnt>${nfe.ide.dhSaiEnt}</dhSaiEnt>
      <tpNF>${nfe.ide.tpNF}</tpNF>
      <idDest>${nfe.ide.idDest}</idDest>
      <cMunFG>${nfe.ide.cMunFG}</cMunFG>
      <tpImp>${nfe.ide.tpImp}</tpImp>
      <tpEmis>${nfe.ide.tpEmis}</tpEmis>
      <cDV>${nfe.ide.cDV}</cDV>
      <tpAmb>${nfe.ide.tpAmb}</tpAmb>
      <procEmi>${nfe.ide.procEmi}</procEmi>
      <verProc>${nfe.ide.verProc}</verProc>
      <indFinal>${nfe.ide.indFinal}</indFinal>
      <indPres>${nfe.ide.indPres}</indPres>
      <indIntermed>${nfe.ide.indIntermed}</indIntermed>
      <modFrete>${nfe.ide.modFrete}</modFrete>
    </ide>

    <emit>
      <CNPJ>${nfe.emit.CNPJ}</CNPJ>
      <xNome>${nfe.emit.xNome}</xNome>
      ${nfe.emit.xFant ? `<xFant>${nfe.emit.xFant}</xFant>` : ''}
      <IE>${nfe.emit.IE}</IE>
      <CRT>${nfe.emit.CRT}</CRT>
      <indIEDest>${nfe.emit.indIEDest}</indIEDest>
      <enderEmit>
        <xLgr>${nfe.emit.enderEmit.xLgr}</xLgr>
        <nro>${nfe.emit.enderEmit.nro}</nro>
        <xBairro>${nfe.emit.enderEmit.xBairro}</xBairro>
        <cMun>${nfe.emit.enderEmit.cMun}</cMun>
        <xMun>${nfe.emit.enderEmit.xMun}</xMun>
        <UF>${nfe.emit.enderEmit.UF}</UF>
        <CEP>${nfe.emit.enderEmit.CEP}</CEP>
        <cPais>${nfe.emit.enderEmit.cPais}</cPais>
        <xPais>${nfe.emit.enderEmit.xPais}</xPais>
        ${nfe.emit.enderEmit.fone ? `<fone>${nfe.emit.enderEmit.fone}</fone>` : ''}
      </enderEmit>
    </emit>

    <dest>
      ${nfe.dest.CPF ? `<CPF>${nfe.dest.CPF}</CPF>` : ''}
      ${nfe.dest.CNPJ ? `<CNPJ>${nfe.dest.CNPJ}</CNPJ>` : ''}
      <xNome>${nfe.dest.xNome}</xNome>
      <indIEDest>${nfe.dest.indIEDest}</indIEDest>
      <enderDest>
        <xLgr>${nfe.dest.enderDest.xLgr}</xLgr>
        <nro>${nfe.dest.enderDest.nro}</nro>
        <xBairro>${nfe.dest.enderDest.xBairro}</xBairro>
        <cMun>${nfe.dest.enderDest.cMun}</cMun>
        <xMun>${nfe.dest.enderDest.xMun}</xMun>
        <UF>${nfe.dest.enderDest.UF}</UF>
        <CEP>${nfe.dest.enderDest.CEP}</CEP>
        <cPais>${nfe.dest.enderDest.cPais}</cPais>
        <xPais>${nfe.dest.enderDest.xPais}</xPais>
        ${nfe.dest.enderDest.fone ? `<fone>${nfe.dest.enderDest.fone}</fone>` : ''}
      </enderDest>
    </dest>

    ${nfe.det.map((product, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${product.cProd}</cProd>
        <cEAN>${product.cEAN}</cEAN>
        <xProd>${product.xProd}</xProd>
        <NCM>${product.NCM}</NCM>
        <CFOP>${product.CFOP}</CFOP>
        <uCom>${product.uCom}</uCom>
        <qCom>${product.qCom}</qCom>
        <vUnCom>${product.vUnCom.toFixed(2)}</vUnCom>
        <vProd>${product.vProd.toFixed(2)}</vProd>
        <cEANTrib>${product.cEANTrib}</cEANTrib>
        <uTrib>${product.uTrib}</uTrib>
        <qTrib>${product.qTrib}</qTrib>
        <vUnTrib>${product.vUnTrib.toFixed(2)}</vUnTrib>
        <indTot>${product.indTot}</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>${product.ICMS.orig}</orig>
            <CSOSN>${product.ICMS.CST}</CSOSN>
            <modBC>${product.ICMS.modBC}</modBC>
            <vBC>${product.ICMS.vBC.toFixed(2)}</vBC>
            <pICMS>${product.ICMS.pICMS.toFixed(2)}</pICMS>
            <vICMS>${product.ICMS.vICMS.toFixed(2)}</vICMS>
            <pFCP>${product.ICMS.pFCP.toFixed(2)}</pFCP>
            <vFCP>${product.ICMS.vFCP.toFixed(2)}</vFCP>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>${product.PIS.CST}</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>${product.COFINS.CST}</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>`).join('')}

    <total>
      <ICMSTot>
        <vBC>${nfe.total.ICMSTot.vBC.toFixed(2)}</vBC>
        <vICMS>${nfe.total.ICMSTot.vICMS.toFixed(2)}</vICMS>
        <vICMSDeson>${nfe.total.ICMSTot.vICMSDeson.toFixed(2)}</vICMSDeson>
        <vFCPUFDest>${nfe.total.ICMSTot.vFCPUFDest.toFixed(2)}</vFCPUFDest>
        <vICMSUFDest>${nfe.total.ICMSTot.vICMSUFDest.toFixed(2)}</vICMSUFDest>
        <vICMSUFRemet>${nfe.total.ICMSTot.vICMSUFRemet.toFixed(2)}</vICMSUFRemet>
        <vFCP>${nfe.total.ICMSTot.vFCP.toFixed(2)}</vFCP>
        <vBCST>${nfe.total.ICMSTot.vBCST.toFixed(2)}</vBCST>
        <vST>${nfe.total.ICMSTot.vST.toFixed(2)}</vST>
        <vFCPST>${nfe.total.ICMSTot.vFCPST.toFixed(2)}</vFCPST>
        <vFCPSTRet>${nfe.total.ICMSTot.vFCPSTRet.toFixed(2)}</vFCPSTRet>
        <vProd>${nfe.total.ICMSTot.vProd.toFixed(2)}</vProd>
        <vFrete>${nfe.total.ICMSTot.vFrete.toFixed(2)}</vFrete>
        <vSeg>${nfe.total.ICMSTot.vSeg.toFixed(2)}</vSeg>
        <vDesc>${nfe.total.ICMSTot.vDesc.toFixed(2)}</vDesc>
        <vII>${nfe.total.ICMSTot.vII.toFixed(2)}</vII>
        <vIPI>${nfe.total.ICMSTot.vIPI.toFixed(2)}</vIPI>
        <vIPIDevol>${nfe.total.ICMSTot.vIPIDevol.toFixed(2)}</vIPIDevol>
        <vPIS>${nfe.total.ICMSTot.vPIS.toFixed(2)}</vPIS>
        <vCOFINS>${nfe.total.ICMSTot.vCOFINS.toFixed(2)}</vCOFINS>
        <vOutro>${nfe.total.ICMSTot.vOutro.toFixed(2)}</vOutro>
        <vNF>${nfe.total.ICMSTot.vNF.toFixed(2)}</vNF>
        <vTotTrib>${nfe.total.ICMSTot.vTotTrib.toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>

    <transp>
      <modFrete>${nfe.transp.modFrete}</modFrete>
    </transp>

    <pag>
      <detPag>
        <indPag>${nfe.pag.detPag[0].indPag}</indPag>
        <tPag>${nfe.pag.detPag[0].tPag}</tPag>
        <vPag>${nfe.pag.detPag[0].vPag.toFixed(2)}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;

  return xml;
};

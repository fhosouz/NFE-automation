/**
 * XSD Validation Service
 * Validates generated NFe XML against official SEFAZ schemas
 * Task 10: XSD validation & unit tests
 */

import * as fs from 'fs';
import * as path from 'path';

// For MVP, we'll use a simple XML structure validator
// In production, use libxmljs or xmllint with official XSD files

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate NFe XML structure (MVP implementation)
 * In production, this would validate against official XSD files
 */
export const validateNFeXml = (xmlString: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic XML structure checks
    if (!xmlString.includes('<?xml version="1.0"')) {
      errors.push('XML declaration missing');
    }

    if (!xmlString.includes('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">')) {
      errors.push('NFe root element missing or invalid namespace');
    }

    if (!xmlString.includes('<infNFe')) {
      errors.push('infNFe element missing');
    }

    if (!xmlString.includes('<ide>')) {
      errors.push('ide (identification) block missing');
    }

    if (!xmlString.includes('<emit>')) {
      errors.push('emit (issuer) block missing');
    }

    if (!xmlString.includes('<dest>')) {
      errors.push('dest (recipient) block missing');
    }

    if (!xmlString.includes('<det ')) {
      errors.push('det (product details) missing');
    }

    if (!xmlString.includes('<total>')) {
      errors.push('total block missing');
    }

    if (!xmlString.includes('<transp>')) {
      errors.push('transp (transport) block missing');
    }

    if (!xmlString.includes('<pag>')) {
      errors.push('pag (payment) block missing');
    }

    // Check for required fields in ide block
    const requiredIdeFields = [
      '<cUF>', '<cNF>', '<natOp>', '<mod>', '<serie>', '<nNF>',
      '<dhEmi>', '<tpNF>', '<tpAmb>', '<procEmi>', '<verProc>'
    ];

    for (const field of requiredIdeFields) {
      if (!xmlString.includes(field)) {
        errors.push(`Required field missing: ${field}`);
      }
    }

    // Check for required fields in emit block
    const requiredEmitFields = ['<CNPJ>', '<xNome>', '<IE>', '<CRT>'];
    for (const field of requiredEmitFields) {
      if (!xmlString.includes(field)) {
        errors.push(`Required issuer field missing: ${field}`);
      }
    }

    // Check for required fields in dest block
    const hasCPF = xmlString.includes('<CPF>');
    const hasCNPJ = xmlString.includes('<CNPJ>');
    if (!hasCPF && !hasCNPJ) {
      errors.push('Recipient must have either CPF or CNPJ');
    }

    if (!xmlString.includes('<xNome>') || !xmlString.includes('<enderDest>')) {
      errors.push('Recipient name and address required');
    }

    // Check product details
    const detMatches = xmlString.match(/<det nItem="\d+">/g);
    if (!detMatches || detMatches.length === 0) {
      errors.push('At least one product detail required');
    }

    // Check for MEI tax defaults (all should be zero)
    if (!xmlString.includes('<vBC>0.00</vBC>') || !xmlString.includes('<vICMS>0.00</vICMS>')) {
      warnings.push('ICMS values should be zero for MEI regime');
    }

    if (!xmlString.includes('<vPIS>0.00</vPIS>') || !xmlString.includes('<vCOFINS>0.00</vCOFINS>')) {
      warnings.push('PIS/COFINS values should be zero for MEI regime');
    }

    // Check access key format (should be 44 digits)
    const idMatch = xmlString.match(/Id="NFe(\d+)"/);
    if (idMatch) {
      const accessKey = idMatch[1];
      if (accessKey.length !== 44) {
        errors.push(`Access key should be 44 digits, got ${accessKey.length}`);
      }
      if (!/^\d{44}$/.test(accessKey)) {
        errors.push('Access key should contain only digits');
      }
    } else {
      errors.push('NFe ID with access key not found');
    }

    // Check for proper closing tags
    if (!xmlString.includes('</NFe>')) {
      errors.push('NFe closing tag missing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`XML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
    };
  }
};

/**
 * Validate XML against XSD schema (placeholder for production)
 * In production, this would use libxmljs or xmllint with official SEFAZ XSDs
 */
export const validateAgainstXsd = async (
  xmlString: string,
  xsdPath?: string
): Promise<ValidationResult> => {
  // For MVP, use our structure validator
  // In production, implement full XSD validation

  console.log('[XSD_VALIDATION] Validating XML structure (MVP implementation)');

  const result = validateNFeXml(xmlString);

  if (result.valid) {
    console.log('[XSD_VALIDATION] XML structure validation passed');
  } else {
    console.error('[XSD_VALIDATION] XML structure validation failed:', result.errors);
  }

  return result;
};

/**
 * Get validation summary for logging
 */
export const getValidationSummary = (result: ValidationResult): string => {
  if (result.valid) {
    return `✅ Valid XML (${result.warnings.length} warnings)`;
  } else {
    return `❌ Invalid XML (${result.errors.length} errors, ${result.warnings.length} warnings)`;
  }
};

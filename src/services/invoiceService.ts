/**
 * Invoice Service
 * Handles invoice numbering reservation and access key generation
 * Tasks 7 & 8: Transactional invoice reservation and SEFAZ 44-digit access key
 */

import { supabaseServiceClient as supabase } from '@/services/supabaseClient';

export interface InvoiceReservation {
  nNF: number; // Invoice number
  serie: string;
  accessKey44: string;
}

/**
 * Reserve next invoice number for a seller (atomically)
 * Uses SELECT ... FOR UPDATE to lock the seller row during transaction
 * Returns the reserved invoice number
 */
export const reserveInvoiceNumber = async (sellerId: string): Promise<number> => {
  try {
    // Use Supabase RPC to atomically reserve and get next number
    const { data, error } = await supabase.rpc('reserve_next_invoice_number', {
      p_seller_id: sellerId,
    });

    if (error) {
      console.error(`[INVOICE] Error reserving invoice number for seller ${sellerId}:`, error);
      throw error;
    }

    if (!data || typeof data !== 'number') {
      throw new Error('RPC did not return a valid invoice number');
    }

    console.log(
      `[INVOICE] Reserved invoice number ${data} for seller ${sellerId}`
    );
    return data;
  } catch (err) {
    console.error(`[INVOICE] Reservation error:`, err);
    throw err;
  }
};

/**
 * SEFAZ Access Key (44-digit) Generation
 * Format: cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + DV (1)
 * 
 * Components:
 * - cUF: UF code (35 for São Paulo, etc.)
 * - AAMM: Year + Month (AAMM)
 * - CNPJ: Seller CNPJ (14 digits)
 * - mod: NFe model (55)
 * - serie: Invoice serie (3 digits)
 * - nNF: Invoice number (9 digits)
 * - tpEmis: Emission type (0 = normal)
 * - cNF: Sequential number (8 digits, usually 00000001)
 * - DV: Check digit (calculated via mod 11)
 */
export const generateAccessKey44 = (
  sellerCnpj: string,
  invoiceNumber: number,
  serie: string,
  issuerUF: string = '35', // Default: São Paulo
  currentDate: Date = new Date()
): string => {
  // Extract UF code from issuer data.  The caller may provide either
  // the numeric code ("35") or the two-letter abbreviation ("SP").
  // Convert abbreviations to their numeric equivalents using official list.
  const ufCodes: { [abbr: string]: string } = {
    AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
    ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
    PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
    RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
  };

  let cUF: string;
  if (/^\d+$/.test(issuerUF)) {
    cUF = issuerUF.padStart(2, '0');
  } else {
    cUF = ufCodes[issuerUF.toUpperCase()] || issuerUF;
  }

  // Format AAMM
  const year = String(currentDate.getFullYear()).slice(-2);
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const aamm = year + month;

  // Format CNPJ (remove non-numeric)
  const cnpjClean = sellerCnpj.replace(/\D/g, '');
  if (cnpjClean.length !== 14) {
    throw new Error(`Invalid CNPJ: must be 14 digits, got ${cnpjClean.length}`);
  }

  // Format serie (3 digits, left-padded with 0)
  const serieFormatted = String(serie).padStart(3, '0').substring(0, 3);

  // Format invoice number (9 digits)
  const nNFFormatted = String(invoiceNumber).padStart(9, '0');

  // NFe model (55) and emission type (0 for normal)
  const mod = '55';
  const tpEmis = '0';

  // Sequential number (cNF) - normally 00000001 for homologation
  const cNF = '00000001';

  // Build the key without check digit (43 digits)
  const keyWithoutDv = cUF + aamm + cnpjClean + mod + serieFormatted + nNFFormatted + tpEmis + cNF;

  if (keyWithoutDv.length !== 43) {
    throw new Error(
      `Invalid key format: expected 43 digits, got ${keyWithoutDv.length}: ${keyWithoutDv}`
    );
  }

  // Calculate check digit (DV) using mod 11
  let sum = 0;
  let multiplier = 2;

  // Process digits from right to left
  for (let i = keyWithoutDv.length - 1; i >= 0; i--) {
    const digit = parseInt(keyWithoutDv[i], 10);
    sum += digit * multiplier;
    multiplier++;

    if (multiplier === 10) {
      multiplier = 2;
    }
  }

  const remainder = sum % 11;
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  // Build final 44-digit access key
  const accessKey44 = keyWithoutDv + dv;

  console.log(
    `[INVOICE_KEY] Generated access key for invoice ${invoiceNumber}: ${accessKey44}`
  );

  return accessKey44;
};

/**
 * Store generated access key in xmls table
 * Ensures uniqueness constraint (seller_id, access_key_44)
 */
export const storeAccessKey = async (
  orderId: string,
  sellerId: string,
  invoiceNumber: number,
  serie: string,
  accessKey44: string
): Promise<string> => {
  const { data, error } = await supabase
    .from('xmls')
    .insert({
      order_id: orderId,
      seller_id: sellerId,
      nNF: invoiceNumber,
      serie: serie,
      access_key_44: accessKey44,
      validation_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // Check if it's a uniqueness constraint violation
    if (error.code === '23505') {
      console.error(
        `[INVOICE_KEY] Access key uniqueness violation for seller ${sellerId}: ${accessKey44}`,
        error
      );
      throw new Error(`Access key already exists for this seller (duplicate transaction?)`);
    }
    console.error(`[INVOICE_KEY] Error storing access key:`, error);
    throw error;
  }

  console.log(`[INVOICE_KEY] Stored access key ${accessKey44} for order ${orderId}`);
  return data.id;
};

/**
 * Complete invoice reservation after successful XML generation
 */
export const completeInvoiceReservation = async (
  orderId: string,
  xmlId: string,
  accessKey44: string
): Promise<void> => {
  const { error } = await supabase
    .from('xmls')
    .update({
      validation_status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', xmlId);

  if (error) {
    console.error(`[INVOICE] Error completing reservation for order ${orderId}:`, error);
    throw error;
  }

  console.log(
    `[INVOICE] Completed reservation for order ${orderId} with access key ${accessKey44}`
  );
};

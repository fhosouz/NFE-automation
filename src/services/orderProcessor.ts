/**
 * Order Processor Service
 * Orchestrates the complete NFe generation flow from webhook to XML storage
 * Combines all services: validation, invoice, XML building, XSD validation, storage
 */

import { MercadoLivreWebhookPayload } from '@/types/webhook';
import { NormalizedOrder } from '@/services/orderNormalizer';
import { ValidationResult } from '@/services/validationService';
import { InvoiceReservation } from '@/services/invoiceService';
import { NFeIssuer } from '@/services/xmlBuilder';

import { handleMercadoLivreWebhook } from '@/services/webhookHandler';
import { createMercadoLivreClient } from '@/services/mercadolivreClient';
import { normalizeOrder } from '@/services/orderNormalizer';
import { validateOrderForXmlGeneration } from '@/services/validationService';
import {
  updateOrderStatus,
  markOrderProcessing,
  markOrderPendingConfiguration,
  markOrderXmlGenerated,
  markOrderError,
} from '@/services/orderLifecycleService';
import { reserveInvoiceNumber, generateAccessKey44, storeAccessKey } from '@/services/invoiceService';
import { buildNFeXml, nfeToXmlString } from '@/services/xmlBuilder';
import { validateAgainstXsd } from '@/services/xsdValidator';
import { storeXmlAndGenerateUrl } from '@/services/storageService';

export interface OrderProcessingResult {
  success: boolean;
  orderId?: string;
  xmlUrl?: string;
  signedDownloadUrl?: string;
  accessKey44?: string;
  invoiceNumber?: number;
  error?: string;
  validationErrors?: string[];
}

/**
 * Complete order processing flow
 * 1. Handle webhook (idempotency)
 * 2. Fetch order from ML API
 * 3. Normalize order data
 * 4. Validate required fields
 * 5. Reserve invoice number
 * 6. Generate access key
 * 7. Build NFe XML
 * 8. Validate XML
 * 9. Store XML and generate download URL
 */
export const processOrderFromWebhook = async (
  webhookPayload: MercadoLivreWebhookPayload,
  issuerData: NFeIssuer
): Promise<OrderProcessingResult> => {
  let orderId: string | undefined;
  let normalizedOrder: NormalizedOrder | undefined;

  try {
    console.log(`[PROCESSOR] Starting order processing for webhook ${webhookPayload.id}`);

    // Step 1: Handle webhook with idempotency
    const webhookResult = await handleMercadoLivreWebhook(webhookPayload);

    if (!webhookResult.success) {
      return {
        success: false,
        error: webhookResult.error || 'Webhook processing failed',
      };
    }

    if (!webhookResult.isNewOrder) {
      console.log(`[PROCESSOR] Webhook already processed, order ${webhookResult.orderId}`);
      return {
        success: true,
        orderId: webhookResult.orderId,
        error: 'Order already processed',
      };
    }

    orderId = webhookResult.orderId!;
    console.log(`[PROCESSOR] Created order ${orderId}, fetching from ML API`);

    // Step 2: Fetch complete order from ML API
    const sellerId = extractSellerIdFromResource(webhookPayload.resource)!;
    const mlClient = await createMercadoLivreClient(sellerId);
    const mlOrderId = extractOrderIdFromResource(webhookPayload.resource);

    if (!mlOrderId) {
      await markOrderError(orderId, 'Invalid ML order ID in webhook');
      return {
        success: false,
        orderId,
        error: 'Invalid ML order ID',
      };
    }

    const mlOrder = await mlClient.fetchOrder(mlOrderId);
    console.log(`[PROCESSOR] Fetched order ${mlOrderId} from ML API`);

    // Step 3: Normalize order data
    normalizedOrder = normalizeOrder(mlOrder);
    console.log(`[PROCESSOR] Normalized order with ${normalizedOrder.products.length} products`);

    // Step 4: Mark order as processing and store normalized payload
    await markOrderProcessing(orderId, normalizedOrder);

    // Step 5: Validate required fields
    const validation = await validateOrderForXmlGeneration(
      extractSellerIdFromResource(webhookPayload.resource)!,
      normalizedOrder
    );

    if (!validation.valid) {
      await markOrderPendingConfiguration(orderId, validation.errorMessage!);
      return {
        success: false,
        orderId,
        error: validation.errorMessage,
        validationErrors: validation.missingFields,
      };
    }

    console.log(`[PROCESSOR] Validation passed, proceeding with XML generation`);

    // Step 6: Reserve invoice number (transactional)
    const invoiceNumber = await reserveInvoiceNumber(
      extractSellerIdFromResource(webhookPayload.resource)!
    );

    // Step 7: Generate access key
    const accessKey44 = generateAccessKey44(
      issuerData.CNPJ,
      invoiceNumber,
      '1', // Default serie
      issuerData.enderEmit.UF
    );

    // Step 8: Store access key in database
    const xmlId = await storeAccessKey(
      orderId,
      extractSellerIdFromResource(webhookPayload.resource)!,
      invoiceNumber,
      '1',
      accessKey44
    );

    console.log(`[PROCESSOR] Reserved invoice ${invoiceNumber}, access key ${accessKey44}`);

    // Step 9: Build NFe XML
    const nfeStructure = buildNFeXml(
      normalizedOrder,
      issuerData,
      accessKey44,
      invoiceNumber,
      '1'
    );

    const xmlString = nfeToXmlString(nfeStructure);
    console.log(`[PROCESSOR] Generated XML (${xmlString.length} characters)`);

    // Step 10: Validate XML against XSD
    const xsdValidation = await validateAgainstXsd(xmlString);

    if (!xsdValidation.valid) {
      await markOrderError(orderId, `XML validation failed: ${xsdValidation.errors.join(', ')}`);
      return {
        success: false,
        orderId,
        error: `XML validation failed: ${xsdValidation.errors.join(', ')}`,
        validationErrors: xsdValidation.errors,
      };
    }

    console.log(`[PROCESSOR] XML validation passed`);

    // Step 11: Store XML and generate signed URL
    const storageResult = await storeXmlAndGenerateUrl(
      xmlString,
      accessKey44,
      extractSellerIdFromResource(webhookPayload.resource)!,
      orderId,
      invoiceNumber,
      '1'
    );

    if (!storageResult.success) {
      await markOrderError(orderId, `Storage failed: ${storageResult.error}`);
      return {
        success: false,
        orderId,
        error: storageResult.error,
      };
    }

    // Step 12: Mark order as completed
    await markOrderXmlGenerated(orderId);

    console.log(`[PROCESSOR] Order ${orderId} processing completed successfully`);

    return {
      success: true,
      orderId,
      xmlUrl: storageResult.xmlUrl,
      signedDownloadUrl: storageResult.signedUrl,
      accessKey44,
      invoiceNumber,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    console.error(`[PROCESSOR] Processing failed:`, error);

    if (orderId) {
      await markOrderError(orderId, errorMessage);
    }

    return {
      success: false,
      orderId,
      error: errorMessage,
    };
  }
};

/**
 * Reprocess order that was in pending_configuration
 * Called when seller fixes missing data (NCM, CPF/CNPJ)
 */
export const reprocessPendingOrder = async (
  orderId: string,
  issuerData: NFeIssuer
): Promise<OrderProcessingResult> => {
  try {
    console.log(`[PROCESSOR] Reprocessing pending order ${orderId}`);

    // Get order details
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        orderId,
        error: 'Order not found',
      };
    }

    if (!order.normalized_payload) {
      return {
        success: false,
        orderId,
        error: 'Order has no normalized payload',
      };
    }

    // Re-validate
    const validation = await validateOrderForXmlGeneration(
      order.seller_id,
      order.normalized_payload
    );

    if (!validation.valid) {
      // Still has issues
      return {
        success: false,
        orderId,
        error: validation.errorMessage,
        validationErrors: validation.missingFields,
      };
    }

    // Continue from step 6 (reserve invoice)
    const invoiceNumber = await reserveInvoiceNumber(order.seller_id);

    const accessKey44 = generateAccessKey44(
      issuerData.CNPJ,
      invoiceNumber,
      '1',
      issuerData.enderEmit.UF
    );

    await storeAccessKey(orderId, order.seller_id, invoiceNumber, '1', accessKey44);

    // Build XML
    const nfeStructure = buildNFeXml(
      order.normalized_payload,
      issuerData,
      accessKey44,
      invoiceNumber,
      '1'
    );

    const xmlString = nfeToXmlString(nfeStructure);

    // Validate
    const xsdValidation = await validateAgainstXsd(xmlString);
    if (!xsdValidation.valid) {
      await markOrderError(orderId, `XML validation failed: ${xsdValidation.errors.join(', ')}`);
      return {
        success: false,
        orderId,
        error: `XML validation failed: ${xsdValidation.errors.join(', ')}`,
      };
    }

    // Store
    const storageResult = await storeXmlAndGenerateUrl(
      xmlString,
      accessKey44,
      order.seller_id,
      orderId,
      invoiceNumber,
      '1'
    );

    if (!storageResult.success) {
      await markOrderError(orderId, `Storage failed: ${storageResult.error}`);
      return {
        success: false,
        orderId,
        error: storageResult.error,
      };
    }

    await markOrderXmlGenerated(orderId);

    return {
      success: true,
      orderId,
      xmlUrl: storageResult.xmlUrl,
      signedDownloadUrl: storageResult.signedUrl,
      accessKey44,
      invoiceNumber,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Reprocessing failed';
    console.error(`[PROCESSOR] Reprocessing failed:`, error);

    await markOrderError(orderId, errorMessage);

    return {
      success: false,
      orderId,
      error: errorMessage,
    };
  }
};

// Helper functions
const extractSellerIdFromResource = (resource: string): string | null => {
  const match = resource.match(/\/orders\/(\d+)\//);
  return match ? match[1] : null;
};

const extractOrderIdFromResource = (resource: string): string | null => {
  const match = resource.match(/\/orders\/\d+\/(\d+)$/);
  return match ? match[1] : null;
};

// Import missing function
import { getOrder } from '@/services/orderLifecycleService';

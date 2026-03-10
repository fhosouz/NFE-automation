/**
 * Validation Service
 * Validates required fields for NFe generation and marks pending_configuration when needed
 */

import { supabaseServiceClient as supabase } from '@/services/supabaseClient';
import { NormalizedOrder } from '@/services/orderNormalizer';

export interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  pendingConfigurationProductIds?: string[];
  pendingConfigurationCustomerId?: string;
  errorMessage?: string;
}

/**
 * Get or create customer record from normalized order
 */
export const ensureCustomerExists = async (
  sellerId: string,
  mlCustomerId: string,
  customerData: any
): Promise<{ id: string; missing_cpf_cnpj: boolean }> => {
  // Check if customer already exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id, cpf_cnpj')
    .eq('seller_id', sellerId)
    .eq('ml_customer_id', mlCustomerId)
    .single();

  if (existingCustomer) {
    return {
      id: existingCustomer.id,
      missing_cpf_cnpj: !existingCustomer.cpf_cnpj,
    };
  }

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      seller_id: sellerId,
      ml_customer_id: mlCustomerId,
      cpf_cnpj: customerData.cpf_cnpj || null,
      name: customerData.nickname || customerData.name || '',
      address: {
        city: customerData.city,
        state: customerData.state,
        country: customerData.country,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    throw error;
  }

  console.log(`[VALIDATION] Created customer ${newCustomer.id} for ML customer ${mlCustomerId}`);

  return {
    id: newCustomer.id,
    missing_cpf_cnpj: !customerData.cpf_cnpj,
  };
};

/**
 * Get or create product records from normalized order
 * Marks products as pending_configuration if NCM is missing
 */
export const ensureProductsExist = async (
  sellerId: string,
  products: any[]
): Promise<{ ids: string[]; pendingConfigurationIds: string[] }> => {
  const createdIds: string[] = [];
  const pendingIds: string[] = [];

  for (const product of products) {
    const mlSku = product.ml_sku || product.category_id;

    // Check if product already exists
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id, pending_configuration')
      .eq('seller_id', sellerId)
      .eq('ml_sku', mlSku)
      .single();

    if (existingProduct) {
      createdIds.push(existingProduct.id);
      if (existingProduct.pending_configuration) {
        pendingIds.push(existingProduct.id);
      }
      continue;
    }

    // Create new product
    const hasMissingNcm = !product.ncm;

    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        seller_id: sellerId,
        ml_sku: mlSku,
        ncm: product.ncm || null,
        name: product.title || '',
        price: product.unit_price || 0,
        pending_configuration: hasMissingNcm,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw error;
    }

    createdIds.push(newProduct.id);

    if (hasMissingNcm) {
      pendingIds.push(newProduct.id);
      console.log(
        `[VALIDATION] Created product ${newProduct.id} marked as pending_configuration (missing NCM)`
      );
    } else {
      console.log(`[VALIDATION] Created product ${newProduct.id}`);
    }
  }

  return {
    ids: createdIds,
    pendingConfigurationIds: pendingIds,
  };
};

/**
 * Validate order has all required fields for NFe generation
 * Required:
 * - Order must have at least 1 product
 * - Customer must have CPF/CNPJ
 * - All products must have NCM
 */
export const validateOrderForXmlGeneration = async (
  sellerId: string,
  normalizedOrder: NormalizedOrder
): Promise<ValidationResult> => {
  const missingFields: string[] = [];
  const pendingConfigurationProductIds: string[] = [];
  let pendingConfigurationCustomerId: string | undefined;

  // Validate customer exists and has CPF/CNPJ
  const customerValidation = await ensureCustomerExists(
    sellerId,
    normalizedOrder.customer.ml_customer_id,
    normalizedOrder.customer
  );

  if (customerValidation.missing_cpf_cnpj) {
    missingFields.push('customer.cpf_cnpj');
    pendingConfigurationCustomerId = customerValidation.id;
  }

  // Validate at least 1 product
  if (!normalizedOrder.products || normalizedOrder.products.length === 0) {
    missingFields.push('products (at least 1 required)');
  }

  // Validate and create products
  const productValidation = await ensureProductsExist(sellerId, normalizedOrder.products);

  if (productValidation.pendingConfigurationIds.length > 0) {
    missingFields.push('products.ncm (required for all items)');
    pendingConfigurationProductIds.push(...productValidation.pendingConfigurationIds);
  }

  // Build error message
  let errorMessage = '';
  if (missingFields.length > 0) {
    errorMessage = `XML generation blocked. Missing required fields: ${missingFields.join(', ')}. Please configure: ${missingFields.join(', ')}`;
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    pendingConfigurationProductIds,
    pendingConfigurationCustomerId,
    errorMessage,
  };
};

/**
 * Check if order has been fixed (no more pending items)
 */
export const checkOrderCanBeReprocessed = async (
  sellerId: string,
  normalizedOrder: NormalizedOrder
): Promise<{ canReprocess: boolean; stillMissingFields: string[] }> => {
  const stillMissingFields: string[] = [];

  // Check customer has CPF/CNPJ
  const { data: customer } = await supabase
    .from('customers')
    .select('cpf_cnpj')
    .eq('seller_id', sellerId)
    .eq('ml_customer_id', normalizedOrder.customer.ml_customer_id)
    .single();

  if (!customer?.cpf_cnpj) {
    stillMissingFields.push('customer.cpf_cnpj');
  }

  // Check all products have NCM
  for (const product of normalizedOrder.products) {
    const { data: dbProduct } = await supabase
      .from('products')
      .select('ncm')
      .eq('seller_id', sellerId)
      .eq('ml_sku', product.ml_sku)
      .single();

    if (!dbProduct?.ncm) {
      stillMissingFields.push(`product.ncm (${product.title})`);
    }
  }

  return {
    canReprocess: stillMissingFields.length === 0,
    stillMissingFields,
  };
};

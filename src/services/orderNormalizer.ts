/**
 * Order Normalizer
 * Maps Mercado Livre order format to internal normalized payload
 */

interface NormalizedProduct {
  ml_sku: string;
  title: string;
  category_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  ncm?: string; // Will be populated from product lookup
}

interface NormalizedCustomer {
  ml_customer_id: string;
  nickname: string;
  cpf_cnpj?: string; // To be fetched separately or provided in full order
  city?: string;
  state?: string;
  country?: string;
}

interface NormalizedShipping {
  address_line?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export interface NormalizedOrder {
  ml_order_id: string;
  ml_seller_id?: string;
  customer: NormalizedCustomer;
  products: NormalizedProduct[];
  shipping: NormalizedShipping;
  total_amount: number;
  currency_id: string;
  order_date: string;
  status: string;
  metadata: {
    source: 'mercadolivre';
    fetched_at: string;
  };
}

/**
 * Normalize Mercado Livre order to internal format
 */
export const normalizeOrder = (mlOrder: any): NormalizedOrder => {
  // Extract buyer info
  const buyer = mlOrder.buyer || {};

  // Extract products from order items
  const products: NormalizedProduct[] = (mlOrder.order_items || []).map(
    (item: any) => ({
      ml_sku: item.item?.id || '',
      title: item.item?.title || '',
      category_id: item.item?.category_id || '',
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total_price: (item.quantity || 0) * (item.unit_price || 0),
    })
  );

  // Extract shipping info
  const shipping = mlOrder.shipping?.receiver_address || {};
  const normalizedShipping: NormalizedShipping = {
    address_line: shipping.address_line,
    city: shipping.city,
    state: shipping.state,
    zip_code: shipping.zip_code,
    country: shipping.country?.id,
  };

  // Build normalized order
  const normalized: NormalizedOrder = {
    ml_order_id: mlOrder.id || '',
    ml_seller_id: mlOrder.seller_id || '',
    customer: {
      ml_customer_id: buyer.id?.toString() || '',
      nickname: buyer.nickname || '',
      cpf_cnpj: buyer.cpf_cnpj, // preserve CPF/CNPJ if ML provides it in buyer object
    },
    products,
    shipping: normalizedShipping,
    total_amount: mlOrder.total_amount || 0,
    currency_id: mlOrder.currency_id || 'BRL',
    order_date: mlOrder.date_created || new Date().toISOString(),
    status: mlOrder.status || 'unknown',
    metadata: {
      source: 'mercadolivre',
      fetched_at: new Date().toISOString(),
    },
  };

  return normalized;
};

/**
 * Validate normalized order has required fields for NFe generation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateNormalizedOrder = (
  order: NormalizedOrder
): ValidationResult => {
  const errors: string[] = [];

  if (!order.ml_order_id) {
    errors.push('Missing order ID');
  }

  if (!order.customer?.ml_customer_id) {
    errors.push('Missing customer ID');
  }

  if (!order.customer?.nickname) {
    errors.push('Missing customer name');
  }

  if (!order.products || order.products.length === 0) {
    errors.push('Missing products');
  }

  order.products?.forEach((product, idx) => {
    if (!product.ml_sku) {
      errors.push(`Product ${idx} missing SKU`);
    }
    if (!product.title) {
      errors.push(`Product ${idx} missing title`);
    }
    if (!product.ncm) {
      errors.push(`Product ${idx} missing NCM (tax classification)`);
    }
    if (product.quantity <= 0) {
      errors.push(`Product ${idx} invalid quantity`);
    }
  });

  if (!order.shipping?.address_line) {
    errors.push('Missing shipping address');
  }

  if (!order.shipping?.city) {
    errors.push('Missing shipping city');
  }

  if (!order.shipping?.state) {
    errors.push('Missing shipping state');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * List of fields required for NFe generation (for pending_configuration flagging)
 */
export const getMissingRequiredFields = (
  order: NormalizedOrder
): string[] => {
  const missing: string[] = [];

  // Check for NCM on all products
  order.products?.forEach((product) => {
    if (!product.ncm) {
      missing.push(`ncm_${product.ml_sku}`);
    }
  });

  // Check for customer CPF/CNPJ
  if (!order.customer?.cpf_cnpj) {
    missing.push('customer_cpf_cnpj');
  }

  return missing;
};

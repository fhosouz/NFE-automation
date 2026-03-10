/**
 * Order Lifecycle Service
 * Manages order status transitions and persistence
 */

import { supabaseServiceClient as supabase } from '@/services/supabaseClient';

export type OrderStatus = 'received' | 'processing' | 'pending_configuration' | 'xml_generated' | 'error';

interface OrderLifecycleUpdate {
  orderId: string;
  status: OrderStatus;
  lastError?: string;
  processingAttempts?: number;
}

/**
 * Update order status with error tracking
 */
export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  lastError?: string
): Promise<void> => {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (lastError) {
    updateData.last_error = lastError;
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    console.error(`Error updating order ${orderId} to status ${status}:`, error);
    throw error;
  }

  console.log(`[ORDER] Order ${orderId} transitioned to status: ${status}`);
};

/**
 * Increment processing attempts for an order
 */
export const incrementProcessingAttempts = async (orderId: string): Promise<number> => {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('processing_attempts')
    .eq('id', orderId)
    .single();

  if (fetchError) {
    console.error(`Error fetching order ${orderId}:`, fetchError);
    throw fetchError;
  }

  const newAttempts = (order?.processing_attempts ?? 0) + 1;

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      processing_attempts: newAttempts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    console.error(`Error incrementing attempts for order ${orderId}:`, updateError);
    throw updateError;
  }

  return newAttempts;
};

/**
 * Get current order status
 */
export const getOrderStatus = async (orderId: string): Promise<OrderStatus | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows
      return null;
    }
    console.error(`Error fetching order status ${orderId}:`, error);
    throw error;
  }

  return data?.status as OrderStatus;
};

/**
 * Get order with all details
 */
export const getOrder = async (
  orderId: string
): Promise<{
  id: string;
  seller_id: string;
  ml_order_id: string;
  raw_payload: any;
  normalized_payload: any;
  status: OrderStatus;
  processing_attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
} | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error(`Error fetching order ${orderId}:`, error);
    throw error;
  }

  return data;
};

/**
 * Set order to processing state and mark normalized payload
 */
export const markOrderProcessing = async (
  orderId: string,
  normalizedPayload: any
): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'processing',
      normalized_payload: normalizedPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error(`Error marking order ${orderId} as processing:`, error);
    throw error;
  }

  console.log(`[ORDER] Order ${orderId} marked as processing`);
};

/**
 * Set order to pending_configuration with validation error
 */
export const markOrderPendingConfiguration = async (
  orderId: string,
  errorMessage: string
): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'pending_configuration',
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error(`Error marking order ${orderId} as pending_configuration:`, error);
    throw error;
  }

  console.log(`[ORDER] Order ${orderId} marked as pending_configuration: ${errorMessage}`);
};

/**
 * Mark order as successfully generated XML
 */
export const markOrderXmlGenerated = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'xml_generated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error(`Error marking order ${orderId} as xml_generated:`, error);
    throw error;
  }

  console.log(`[ORDER] Order ${orderId} successfully generated XML`);
};

/**
 * Mark order as failed
 */
export const markOrderError = async (orderId: string, errorMessage: string): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'error',
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error(`Error marking order ${orderId} as error:`, error);
    throw error;
  }

  console.log(`[ORDER] Order ${orderId} marked as error: ${errorMessage}`);
};

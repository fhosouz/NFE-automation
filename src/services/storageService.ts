/**
 * Storage Service
 * Handles XML persistence to Supabase Storage and signed download URLs
 * Task 11: Persist XML to Supabase Storage + metadata
 */

import { supabaseServiceClient as supabase } from '@/services/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export interface XmlStorageResult {
  success: boolean;
  xmlUrl?: string;
  signedUrl?: string;
  error?: string;
}

/**
 * Upload XML to Supabase Storage
 */
export const uploadXmlToStorage = async (
  xmlContent: string,
  accessKey44: string,
  sellerId: string
): Promise<XmlStorageResult> => {
  try {
    // Create a unique filename based on access key
    const fileName = `nfe-${accessKey44}.xml`;
    const filePath = `xmls/${sellerId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('xmls') // Bucket name
      .upload(filePath, xmlContent, {
        contentType: 'application/xml',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('[STORAGE] Upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }

    console.log(`[STORAGE] XML uploaded successfully: ${filePath}`);

    // Get public URL (if bucket is public)
    const { data: publicUrlData } = supabase.storage
      .from('xmls')
      .getPublicUrl(filePath);

    return {
      success: true,
      xmlUrl: publicUrlData.publicUrl,
    };

  } catch (error) {
    console.error('[STORAGE] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
};

/**
 * Generate signed download URL for XML
 * URLs expire after specified time (default 7 days)
 */
export const generateSignedDownloadUrl = async (
  xmlUrl: string,
  expiresIn: number = 60 * 60 * 24 * 7 // 7 days in seconds
): Promise<string | null> => {
  try {
    // Extract bucket and path from public URL
    const urlParts = xmlUrl.split('/storage/v1/object/public/');
    if (urlParts.length !== 2) {
      console.error('[STORAGE] Invalid XML URL format:', xmlUrl);
      return null;
    }

    const pathParts = urlParts[1].split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');

    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('[STORAGE] Signed URL generation error:', error);
      return null;
    }

    console.log(`[STORAGE] Signed URL generated (expires in ${expiresIn}s)`);
    return data.signedUrl;

  } catch (error) {
    console.error('[STORAGE] Signed URL error:', error);
    return null;
  }
};

/**
 * Store XML metadata in database and generate signed URL
 */
export const storeXmlAndGenerateUrl = async (
  xmlContent: string,
  accessKey44: string,
  sellerId: string,
  orderId: string,
  invoiceNumber: number,
  serie: string
): Promise<XmlStorageResult> => {
  try {
    // First, upload XML to storage
    const uploadResult = await uploadXmlToStorage(xmlContent, accessKey44, sellerId);

    if (!uploadResult.success || !uploadResult.xmlUrl) {
      return uploadResult;
    }

    // Generate signed URL for download
    const signedUrl = await generateSignedDownloadUrl(uploadResult.xmlUrl);

    if (!signedUrl) {
      return {
        success: false,
        error: 'Failed to generate signed download URL',
      };
    }

    // Store metadata in xmls table
    const { error: dbError } = await supabase
      .from('xmls')
      .update({
        xml_url: uploadResult.xmlUrl,
        xsd_version: '4.00',
        validation_status: 'validated',
        error_details: null,
        updated_at: new Date().toISOString(),
      })
      .eq('access_key_44', accessKey44);

    if (dbError) {
      console.error('[STORAGE] Database update error:', dbError);
      // Don't fail the whole operation if DB update fails
      // The XML is already stored
    }

    console.log(`[STORAGE] XML stored and signed URL generated for access key ${accessKey44}`);

    return {
      success: true,
      xmlUrl: uploadResult.xmlUrl,
      signedUrl,
    };

  } catch (error) {
    console.error('[STORAGE] Complete storage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Storage operation failed',
    };
  }
};

/**
 * Get XML download URL for a specific access key
 */
export const getXmlDownloadUrl = async (
  accessKey44: string,
  sellerId: string
): Promise<string | null> => {
  try {
    // Get XML metadata from database
    const { data, error } = await supabase
      .from('xmls')
      .select('xml_url')
      .eq('access_key_44', accessKey44)
      .eq('seller_id', sellerId)
      .single();

    if (error || !data?.xml_url) {
      console.error('[STORAGE] XML not found:', error);
      return null;
    }

    // Generate fresh signed URL
    const signedUrl = await generateSignedDownloadUrl(data.xml_url);

    return signedUrl;

  } catch (error) {
    console.error('[STORAGE] Get download URL error:', error);
    return null;
  }
};

/**
 * List XMLs for a seller (for dashboard)
 */
export const listSellerXmls = async (
  sellerId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  access_key_44: string;
  nNF: number;
  serie: string;
  xml_url: string;
  created_at: string;
  validation_status: string;
}>> => {
  try {
    const { data, error } = await supabase
      .from('xmls')
      .select('id, access_key_44, nNF, serie, xml_url, created_at, validation_status')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[STORAGE] List XMLs error:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('[STORAGE] List XMLs unexpected error:', error);
    return [];
  }
};

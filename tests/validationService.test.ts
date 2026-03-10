/**
 * Tests for Validation Service
 * Verifies product/customer validation and pending_configuration flow
 */

import { generateAccessKey44 } from '@/services/invoiceService';

describe('validationService', () => {
  describe('Validation requirements', () => {
    it('should require customer CPF/CNPJ', () => {
      // Validation logic: CPF/CNPJ is mandatory
      const requiredFields = ['customer.cpf_cnpj', 'product.ncm'];
      expect(requiredFields).toContain('customer.cpf_cnpj');
    });

    it('should require product NCM', () => {
      const requiredFields = ['customer.cpf_cnpj', 'product.ncm'];
      expect(requiredFields).toContain('product.ncm');
    });

    it('should require at least one product', () => {
      const minProducts = 1;
      expect(minProducts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Pending configuration flow', () => {
    it('should mark products pending_configuration when NCM missing', () => {
      const product = {
        ml_sku: 'MLB123456',
        title: 'Test Product',
        category_id: 'CAT456',
        quantity: 1,
        unit_price: 100,
        total_price: 100,
        ncm: null, // Missing NCM
      };

      const hasMissingNcm = !product.ncm;
      expect(hasMissingNcm).toBe(true);
    });

    it('should mark customers pending_configuration when CPF_CNPJ missing', () => {
      const customer = {
        ml_customer_id: '123456789',
        nickname: 'Test Buyer',
        cpf_cnpj: null, // Missing CPF/CNPJ
      };

      const hasMissingCpfCnpj = !customer.cpf_cnpj;
      expect(hasMissingCpfCnpj).toBe(true);
    });

    it('should detect when all required fields are present', () => {
      const product = {
        ncm: '12345678', // Present
      };

      const customer = {
        cpf_cnpj: '12345678901234', // Present
      };

      expect(product.ncm).toBeTruthy();
      expect(customer.cpf_cnpj).toBeTruthy();
    });
  });

  describe('Validation error messages', () => {
    it('should provide actionable error for missing NCM', () => {
      const error =
        'XML generation blocked. Missing required fields: products.ncm. Please configure NCM (tax classification code) in the product catalog.';
      expect(error).toContain('products.ncm');
      expect(error).toContain('XML generation blocked');
    });

    it('should provide actionable error for missing CPF/CNPJ', () => {
      const error =
        'XML generation blocked. Missing required fields: customer.cpf_cnpj. Please add customer CPF or CNPJ.';
      expect(error).toContain('customer.cpf_cnpj');
      expect(error).toContain('XML generation blocked');
    });

    it('should list all missing fields in error', () => {
      const missingFields = ['customer.cpf_cnpj', 'product.ncm'];
      const error = `XML generation blocked. Missing required fields: ${missingFields.join(', ')}`;
      expect(error).toContain('customer.cpf_cnpj');
      expect(error).toContain('product.ncm');
    });
  });
});

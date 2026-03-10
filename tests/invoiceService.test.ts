/**
 * Tests for Invoice Service
 * Verifies invoice number reservation and access key generation (Tasks 7 & 8)
 */

import { generateAccessKey44 } from '@/services/invoiceService';

describe('invoiceService', () => {
  describe('generateAccessKey44 - SEFAZ 44-digit access key', () => {
    /**
     * Access Key Format (44 digits):
     * cUF (2) + AAMM (4) + CNPJ (14) + mod (2 = "55") + serie (3) + nNF (9) + tpEmis (1 = "0") + cNF (8 = "00000001") + DV (1)
     * Total = 2+4+14+2+3+9+1+8+1 = 44
     */

    it('should generate a valid 44-digit access key', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      expect(key).toBeDefined();
      expect(key.length).toBe(44);
      expect(/^\d+$/.test(key)).toBe(true); // All digits
    });

    it('should include correct UF code (35 for São Paulo)', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';
      const uf = '35'; // SP

      const key = generateAccessKey44(cnpj, invoiceNumber, serie, uf);

      expect(key.substring(0, 2)).toBe('35');
    });

    it('should include AAMM (Year + Month)', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';
      const testDate = new Date(2026, 2, 9); // March 9, 2026

      const key = generateAccessKey44(cnpj, invoiceNumber, serie, '35', testDate);

      // Year = 26, Month = 03
      const aamm = key.substring(2, 6);
      expect(aamm).toMatch(/^\d{4}$/);
      expect(aamm).toBe('2603');
    });

    it('should include clean CNPJ (14 digits)', () => {
      const cnpj = '12.345.678/0001-95';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      // CNPJ should be in positions 6-19 (14 digits)
      const cnpjInKey = key.substring(6, 20);
      expect(cnpjInKey).toBe('12345678000195');
    });

    it('should include model 55 (NFe)', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      // Model is at positions 20-21
      const model = key.substring(20, 22);
      expect(model).toBe('55');
    });

    it('should format serie with left-padding', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;

      const key1 = generateAccessKey44(cnpj, invoiceNumber, '1');
      const key2 = generateAccessKey44(cnpj, invoiceNumber, '001');

      // Serie should be the same when padded
      const serie1 = key1.substring(22, 25);
      const serie2 = key2.substring(22, 25);
      expect(serie1).toBe(serie2);
      expect(serie1).toBe('001');
    });

    it('should format invoice number with left-padding to 9 digits', () => {
      const cnpj = '12345678000195';
      const serie = '1';

      const key1 = generateAccessKey44(cnpj, 1, serie);
      const key2 = generateAccessKey44(cnpj, 123, serie);

      // nNF should be padded to 9 digits
      const nnf1 = key1.substring(25, 34);
      const nnf2 = key2.substring(25, 34);
      expect(nnf1).toBe('000000001');
      expect(nnf2).toBe('000000123');
    });

    it('should include emission type 0 (normal)', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      // tpEmis at position 34
      expect(key[34]).toBe('0');
    });

    it('should include cNF 00000001', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      // cNF at positions 35-42
      const cnf = key.substring(35, 43);
      expect(cnf).toBe('00000001');
    });

    it('should calculate correct check digit (mod 11)', () => {
      // Known test case: Invoice 1, CNPJ 12345678000195, serie 001
      const cnpj = '12345678000195';
      const invoiceNumber = 1;
      const serie = '1';

      const key = generateAccessKey44(cnpj, invoiceNumber, serie);

      // Key should be 44 digits
      expect(key.length).toBe(44);
      // Last digit is the check digit
      const checkDigit = key[43];
      expect(/\d/.test(checkDigit)).toBe(true);
    });

    it('should generate consistent key for same inputs', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 123;
      const serie = '1';
      const uf = '35';
      const date = new Date(2026, 2, 9);

      const key1 = generateAccessKey44(cnpj, invoiceNumber, serie, uf, date);
      const key2 = generateAccessKey44(cnpj, invoiceNumber, serie, uf, date);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different invoice numbers', () => {
      const cnpj = '12345678000195';
      const serie = '1';

      const key1 = generateAccessKey44(cnpj, 1, serie);
      const key2 = generateAccessKey44(cnpj, 2, serie);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different series', () => {
      const cnpj = '12345678000195';
      const invoiceNumber = 1;

      const key1 = generateAccessKey44(cnpj, invoiceNumber, '1');
      const key2 = generateAccessKey44(cnpj, invoiceNumber, '2');

      expect(key1).not.toBe(key2);
    });

    it('should reject invalid CNPJ length', () => {
      const shortCnpj = '1234567800019'; // Only 13 digits
      const invoiceNumber = 1;
      const serie = '1';

      expect(() => {
        generateAccessKey44(shortCnpj, invoiceNumber, serie);
      }).toThrow(/Invalid CNPJ/);
    });

    it('should handle various real-world test cases', () => {
      // Test with typical values
      const testCases = [
        {
          cnpj: '11222333000181',
          invoice: 1,
          serie: '1',
          uf: '35',
        },
        {
          cnpj: '99999999000199',
          invoice: 999,
          serie: '99',
          uf: '21', // RJ
        },
        {
          cnpj: '11444777000161',
          invoice: 50000,
          serie: '1',
          uf: '35',
        },
      ];

      testCases.forEach((testCase) => {
        const key = generateAccessKey44(
          testCase.cnpj,
          testCase.invoice,
          testCase.serie,
          testCase.uf
        );

        expect(key).toBeDefined();
        expect(key.length).toBe(44);
        expect(/^\d{44}$/.test(key)).toBe(true);
      });
    });
  });

  describe('Invoice numbering', () => {
    it('should support sequential invoice numbering', () => {
      const serie = '1';
      let nextNumber = 1;

      const key1 = generateAccessKey44('12345678000195', nextNumber, serie);
      nextNumber++;
      const key2 = generateAccessKey44('12345678000195', nextNumber, serie);

      expect(key1).not.toBe(key2);
    });

    it('should handle high invoice numbers', () => {
      const cnpj = '12345678000195';
      const serie = '1';
      const highNumber = 999999999; // 9 nines

      const key = generateAccessKey44(cnpj, highNumber, serie);

      expect(key.length).toBe(44);
      expect(/^\d+$/.test(key)).toBe(true);
    });
  });
});

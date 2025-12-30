import { describe, it, expect } from 'vitest'
import { 
  normalizeBarcode, 
  eanChecksum, 
  isValidEan, 
  generateEan13, 
  formatBarcode 
} from '../barcode-utils'

describe('Barcode Utils', () => {
  describe('normalizeBarcode', () => {
    it('should remove non-numeric characters', () => {
      expect(normalizeBarcode('123-456-789')).toBe('123456789')
      expect(normalizeBarcode('ABC123DEF456')).toBe('123456')
      expect(normalizeBarcode('  123  456  ')).toBe('123456')
    })

    it('should handle empty strings', () => {
      expect(normalizeBarcode('')).toBe('')
      expect(normalizeBarcode('ABC')).toBe('')
    })
  })

  describe('eanChecksum', () => {
    it('should calculate correct checksum for EAN-13', () => {
      // Código conocido válido: 5901234123457 (checksum = 7)
      expect(eanChecksum('590123412345')).toBe(7)
      // Otro código válido: 1234567890128 (checksum = 8)
      expect(eanChecksum('123456789012')).toBe(8)
    })

    it('should calculate correct checksum for EAN-8', () => {
      // Código conocido: 12345670 (checksum = 0)
      expect(eanChecksum('1234567')).toBe(0)
    })

    it('should handle different length codes', () => {
      const ean13 = '123456789012'
      const ean8 = '1234567'
      
      expect(typeof eanChecksum(ean13)).toBe('number')
      expect(typeof eanChecksum(ean8)).toBe('number')
      expect(eanChecksum(ean13)).toBeGreaterThanOrEqual(0)
      expect(eanChecksum(ean13)).toBeLessThanOrEqual(9)
    })
  })

  describe('isValidEan', () => {
    it('should validate correct EAN-13 codes', () => {
      expect(isValidEan('5901234123457')).toBe(true)
      expect(isValidEan('1234567890128')).toBe(true)
    })

    it('should validate correct EAN-8 codes', () => {
      expect(isValidEan('12345670')).toBe(true)
    })

    it('should reject invalid EAN codes', () => {
      expect(isValidEan('5901234123456')).toBe(false) // Wrong checksum
      expect(isValidEan('12345671')).toBe(false) // Wrong checksum
    })

    it('should reject codes with wrong length', () => {
      expect(isValidEan('123456789')).toBe(false) // 9 digits
      expect(isValidEan('12345')).toBe(false) // 5 digits
      expect(isValidEan('')).toBe(false) // Empty
    })
  })

  describe('generateEan13', () => {
    it('should generate valid EAN-13 codes', () => {
      const generated = generateEan13('123456789012')
      expect(generated).toHaveLength(13)
      expect(isValidEan(generated)).toBe(true)
    })

    it('should pad short prefixes', () => {
      const generated = generateEan13('123')
      expect(generated).toHaveLength(13)
      expect(generated.startsWith('123')).toBe(true)
      expect(isValidEan(generated)).toBe(true)
    })

    it('should truncate long prefixes', () => {
      const generated = generateEan13('12345678901234567890')
      expect(generated).toHaveLength(13)
      expect(isValidEan(generated)).toBe(true)
    })
  })

  describe('formatBarcode', () => {
    it('should format EAN-13 codes correctly', () => {
      expect(formatBarcode('7891234567890')).toBe('7-891234-56789-0')
    })

    it('should format EAN-8 codes correctly', () => {
      expect(formatBarcode('12345670')).toBe('1234-5670')
    })

    it('should handle codes with non-numeric characters', () => {
      expect(formatBarcode('789-123-456-789-0')).toBe('7-891234-56789-0')
    })

    it('should return normalized code for invalid lengths', () => {
      expect(formatBarcode('123456789')).toBe('123456789')
      expect(formatBarcode('12345')).toBe('12345')
    })
  })
})
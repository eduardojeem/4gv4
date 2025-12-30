// Utilidades para manejo de códigos de barras EAN-8/13

/**
 * Normaliza un código de barras removiendo caracteres no numéricos
 */
export const normalizeBarcode = (raw: string): string => {
  return raw.replace(/\D+/g, '').trim()
}

/**
 * Calcula el checksum para códigos EAN-8 y EAN-13
 */
export const eanChecksum = (digits: string): number => {
  const len = digits.length
  
  if (len === 12 || len === 13) {
    // EAN-13: usar los primeros 12 dígitos
    const codeDigits = digits.slice(0, 12)
    let odd = 0  // posiciones impares (1,3,5,7,9,11) - índices 0,2,4,6,8,10
    let even = 0 // posiciones pares (2,4,6,8,10,12) - índices 1,3,5,7,9,11
    
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) {
        odd += Number(codeDigits[i])
      } else {
        even += Number(codeDigits[i])
      }
    }
    
    // Multiplicar números en posiciones pares por 3
    even = even * 3
    
    const total = odd + even
    const checksum = total % 10
    
    return checksum === 0 ? 0 : 10 - checksum
    
  } else if (len === 7 || len === 8) {
    // EAN-8: usar los primeros 7 dígitos
    const codeDigits = digits.slice(0, 7)
    let sum = 0
    
    for (let i = 0; i < 7; i++) {
      const weight = (i % 2 === 0) ? 3 : 1
      sum += Number(codeDigits[i]) * weight
    }
    
    const checksum = sum % 10
    return checksum === 0 ? 0 : 10 - checksum
  }
  
  return 0
}

/**
 * Valida si un código EAN-8 o EAN-13 es válido
 */
export const isValidEan = (digits: string): boolean => {
  const n = digits.length
  if (n !== 8 && n !== 13) return false
  
  const expected = eanChecksum(digits)
  const actual = Number(digits[n - 1])
  return actual === expected
}

/**
 * Genera un código EAN-13 válido basado en un prefijo
 */
export const generateEan13 = (prefix: string): string => {
  // Asegurar que el prefijo tenga 12 dígitos
  const paddedPrefix = prefix.padEnd(12, '0').slice(0, 12)
  const checkDigit = eanChecksum(paddedPrefix + '0')
  return paddedPrefix + checkDigit.toString()
}

/**
 * Formatea un código de barras para mostrar
 */
export const formatBarcode = (barcode: string): string => {
  const normalized = normalizeBarcode(barcode)
  if (normalized.length === 13) {
    // Formato EAN-13: X-XXXXXX-XXXXXX-X
    return `${normalized.slice(0,1)}-${normalized.slice(1,7)}-${normalized.slice(7,12)}-${normalized.slice(12)}`
  } else if (normalized.length === 8) {
    // Formato EAN-8: XXXX-XXXX
    return `${normalized.slice(0,4)}-${normalized.slice(4)}`
  }
  return normalized
}
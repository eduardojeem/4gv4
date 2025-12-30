/**
 * Barcode Validator
 * Validación de códigos de barras EAN-8 y EAN-13
 */

/**
 * Normalize barcode - remove non-digits
 */
export function normalizeBarcode(raw: string): string {
    return raw.replace(/\D+/g, '').trim()
}

/**
 * Calculate EAN checksum
 */
export function eanChecksum(digits: string): number {
    const len = digits.length
    const weights = len === 8 ? [3, 1, 3, 1, 3, 1, 3] : [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]

    const sum = digits
        .slice(0, len - 1)
        .split('')
        .reduce((acc, d, i) => acc + Number(d) * weights[i], 0)

    const check = (10 - (sum % 10)) % 10
    return check
}

/**
 * Validate EAN-8 or EAN-13 barcode
 */
export function isValidEan(digits: string): boolean {
    const n = digits.length
    if (n !== 8 && n !== 13) return false

    const expected = eanChecksum(digits)
    return Number(digits[n - 1]) === expected
}

/**
 * Format barcode for display
 */
export function formatBarcode(barcode: string): string {
    const normalized = normalizeBarcode(barcode)

    if (normalized.length === 8) {
        // EAN-8: XXXX XXXX
        return `${normalized.slice(0, 4)} ${normalized.slice(4)}`
    } else if (normalized.length === 13) {
        // EAN-13: X XXXXXX XXXXXX X
        return `${normalized[0]} ${normalized.slice(1, 7)} ${normalized.slice(7, 13)}`
    }

    return normalized
}

/**
 * Detect barcode type
 */
export function getBarcodeType(barcode: string): 'EAN-8' | 'EAN-13' | 'UNKNOWN' {
    const normalized = normalizeBarcode(barcode)

    if (normalized.length === 8 && isValidEan(normalized)) {
        return 'EAN-8'
    } else if (normalized.length === 13 && isValidEan(normalized)) {
        return 'EAN-13'
    }

    return 'UNKNOWN'
}

/**
 * Generate random EAN-13 barcode (for testing)
 */
export function generateRandomEan13(): string {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    const checksum = eanChecksum(digits)
    return digits + checksum
}

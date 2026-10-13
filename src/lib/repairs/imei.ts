/**
 * El IMEI tiene 15 dígitos y el último es de control (Luhn): con él se detecta
 * un número mal tipeado. Un dígito equivocado hacía que el historial del equipo
 * no encontrara sus reparaciones anteriores.
 *
 * El mismo campo guarda números de serie (notebooks, consolas), así que esto solo
 * avisa: nunca impide guardar.
 */

/** Sin espacios, guiones ni puntos: «35 209900 176148 1» → «352099001761481». */
export function compactImei(value: string): string {
  return value.replace(/[\s.\-/]/g, '')
}

/** Dígito de control de Luhn sobre los 15 dígitos. */
export function isValidImei(value: string): boolean {
  const digits = compactImei(value)
  if (!/^\d{15}$/.test(digits)) return false
  let sum = 0
  for (let index = 0; index < 15; index += 1) {
    let digit = Number(digits[index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/**
 * Aviso para mostrar debajo del campo, o null si no hay nada que decir.
 * Solo opina cuando el valor parece un IMEI (solo números, 14 a 16 dígitos).
 */
export function imeiWarning(value: string | null | undefined): string | null {
  const digits = compactImei(value ?? '')
  if (!/^\d+$/.test(digits)) return null
  if (digits.length === 14 || digits.length === 16) {
    return `Tiene ${digits.length} dígitos y un IMEI tiene 15. Revisalo (marcá *#06# en el equipo).`
  }
  if (digits.length === 15 && !isValidImei(digits)) {
    return 'Este IMEI no es válido: algún número está mal. Revisalo (marcá *#06# en el equipo).'
  }
  return null
}

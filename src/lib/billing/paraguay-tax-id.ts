/**
 * RUC y cédula de Paraguay.
 *
 * El RUC es el número de la persona o empresa más un dígito verificador
 * (80000000-1). La cédula es solo el número. El dígito se calcula con el
 * módulo 11 que publica la SET (pesos de 2 a 11 desde la derecha).
 */

export type ParsedTaxId = {
  /** Número sin dígito verificador. */
  number: string
  /** Dígito verificador, si se cargó con guion. */
  checkDigit: string | null
}

export function computeRucCheckDigit(number: string): number {
  let total = 0
  let weight = 2
  for (let index = number.length - 1; index >= 0; index -= 1) {
    total += Number(number[index]) * weight
    weight = weight === 11 ? 2 : weight + 1
  }
  const rest = total % 11
  return rest > 1 ? 11 - rest : 0
}

export function parseParaguayTaxId(value: string | null | undefined): ParsedTaxId | null {
  const clean = (value ?? '').trim().replace(/[.\s]/g, '')
  const match = /^(\d{3,10})(?:-(\d))?$/.exec(clean)
  if (!match) return null
  return { number: match[1], checkDigit: match[2] ?? null }
}

/** null si es válido; si no, el motivo para mostrar. */
export function validateParaguayTaxId(value: string | null | undefined): string | null {
  if (!value?.trim()) return 'Ingresá el RUC o la cédula.'
  const parsed = parseParaguayTaxId(value)
  if (!parsed) return 'Escribilo solo con números y, si es RUC, el guion del dígito verificador (80000000-1).'
  if (parsed.checkDigit !== null && Number(parsed.checkDigit) !== computeRucCheckDigit(parsed.number)) {
    return 'El dígito verificador del RUC no coincide. Revisalo en tu constancia.'
  }
  return null
}

export function formatParaguayTaxId(parsed: ParsedTaxId) {
  return parsed.checkDigit === null ? parsed.number : `${parsed.number}-${parsed.checkDigit}`
}

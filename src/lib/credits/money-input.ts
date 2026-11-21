// Shared by the web and the Expo app (relative imports only).
import { getCurrencyFractionDigits } from '../regional/contract'

export const MAX_MONEY_INPUT = 1_000_000_000

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyInputError'
  }
}

/** Decimales de la moneda: 0 en guaraníes. */
export function moneyFractionDigits(currency: string): number {
  return Math.max(0, Math.min(2, getCurrencyFractionDigits(currency)))
}

/** Redondea a la unidad mínima de la moneda (guaraní entero en PYG). */
export function roundMoneyToCurrency(value: number, currency: string): number {
  const step = 10 ** moneyFractionDigits(currency)
  return Math.round((value + Number.EPSILON) * step) / step
}

/** true si el monto no tiene más decimales que los que admite la moneda. */
export function isCurrencyAmount(value: number, currency: string): boolean {
  if (!Number.isFinite(value)) return false
  return Math.abs(roundMoneyToCurrency(value, currency) - value) < 1e-9
}

const THOUSANDS = /^\d{1,3}(?:\.\d{3})+$/

/**
 * Lee un monto escrito a mano con la convención de Paraguay: el punto separa
 * miles y la coma, decimales. «150.000» son ciento cincuenta mil. En monedas
 * con decimales también se acepta «10.50» (un solo punto con 1 o 2 cifras).
 */
export function parseMoneyInput(raw: string, currency: string): number {
  const text = String(raw ?? '').trim().replace(/\s/g, '')
  const digits = moneyFractionDigits(currency)
  if (!text) throw new MoneyInputError('Ingresá el monto.')
  let integer = text
  let fraction = ''
  const comma = text.split(',')
  if (comma.length > 2) throw new MoneyInputError('El monto tiene más de una coma.')
  if (comma.length === 2) {
    integer = comma[0]
    fraction = comma[1]
  } else if (digits > 0 && /^\d+\.\d{1,2}$/.test(text)) {
    ;[integer, fraction] = text.split('.')
  }
  if (fraction && digits === 0) throw new MoneyInputError('Los guaraníes no llevan decimales. Ingresá el monto entero, por ejemplo 150.000.')
  if (fraction && !new RegExp(`^\\d{1,${digits}}$`).test(fraction)) {
    throw new MoneyInputError(`Ingresá hasta ${digits} decimales después de la coma.`)
  }
  if (!/^\d+$/.test(integer) && !THOUSANDS.test(integer)) {
    throw new MoneyInputError(digits === 0
      ? 'Ingresá el monto en guaraníes enteros, por ejemplo 150.000.'
      : 'Revisá el monto: el punto separa miles y la coma, decimales.')
  }
  const value = Number(integer.replace(/\./g, '') + (fraction ? '.' + fraction : ''))
  if (!Number.isFinite(value) || value <= 0) throw new MoneyInputError('El monto debe ser mayor a cero.')
  if (value > MAX_MONEY_INPUT) throw new MoneyInputError('El monto supera el máximo permitido para un cobro.')
  return value
}

/** Texto para el campo de monto: «150.000» en PYG, «1.250,50» con decimales. */
export function formatMoneyInput(value: number, currency: string): string {
  if (!Number.isFinite(value) || value < 0) throw new MoneyInputError('El monto no es válido.')
  const digits = moneyFractionDigits(currency)
  const rounded = roundMoneyToCurrency(value, currency)
  const [integer, fraction = ''] = rounded.toFixed(digits).split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return digits > 0 && Number(fraction) > 0 ? `${grouped},${fraction}` : grouped
}

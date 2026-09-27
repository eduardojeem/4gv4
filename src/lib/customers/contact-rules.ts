/**
 * Reglas de contacto de un cliente, en un solo lugar.
 *
 * Habia tres formularios de alta —dos dentro de reparaciones y uno en la seccion
 * de clientes— y cada uno pedia campos distintos: uno exigia apellido y telefono,
 * otro solo el nombre. Un cliente cargado por el formulario mas laxo quedaba sin
 * telefono y despues no habia forma de avisarle nada.
 */

export const MIN_PHONE_DIGITS = 6

/** Deja solo digitos: `0981-123 456`, `(0981) 123456` y `0981123456` son el mismo numero. */
export function normalizePhone(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

/**
 * Dos telefonos son el mismo si coinciden sus ultimos digitos significativos.
 * Cubre el caso de uno cargado con prefijo internacional y otro sin el.
 */
export function isSamePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePhone(a)
  const right = normalizePhone(b)
  if (left.length < MIN_PHONE_DIGITS || right.length < MIN_PHONE_DIGITS) return false
  const length = Math.min(left.length, right.length, 8)
  return left.slice(-length) === right.slice(-length)
}

export type CustomerContactInput = {
  name?: string | null
  phone?: string | null
  email?: string | null
  alternatePhone?: string | null
  alternatePhoneLabel?: string | null
}

export type CustomerContactErrors = Partial<
  Record<'name' | 'phone' | 'email' | 'alternatePhone' | 'alternatePhoneLabel', string>
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Valida los datos de contacto.
 *
 * El apellido no se exige: una empresa no tiene, y obligarlo llevaba a inventar
 * uno para poder facturar. El telefono si, porque sin el la mitad de las
 * funciones —avisos, recordatorios de deuda, entrega de reparaciones— no sirven.
 */
export function validateCustomerContact(input: CustomerContactInput): CustomerContactErrors {
  const errors: CustomerContactErrors = {}

  const name = String(input.name ?? '').trim()
  if (name.length < 2) {
    errors.name = 'El nombre o razón social es obligatorio (mínimo 2 caracteres).'
  }

  const phone = normalizePhone(input.phone)
  if (phone.length === 0) {
    errors.phone = 'El teléfono es obligatorio: sin él no vas a poder avisarle nada al cliente.'
  } else if (phone.length < MIN_PHONE_DIGITS) {
    errors.phone = `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
  }

  const email = String(input.email ?? '').trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'El correo electrónico no es válido.'
  }

  const alternatePhone = normalizePhone(input.alternatePhone)
  if (alternatePhone.length > 0 && alternatePhone.length < MIN_PHONE_DIGITS) {
    errors.alternatePhone = `El teléfono alternativo debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
  }

  // Un alternativo igual al principal no aporta nada: el punto es tener otra via.
  if (alternatePhone.length >= MIN_PHONE_DIGITS && isSamePhone(input.phone, input.alternatePhone)) {
    errors.alternatePhone = 'El teléfono alternativo es el mismo que el principal.'
  }

  const label = String(input.alternatePhoneLabel ?? '').trim()
  if (alternatePhone.length >= MIN_PHONE_DIGITS && label.length === 0) {
    errors.alternatePhoneLabel = 'Indicá de quién es el teléfono para saber con quién se habla.'
  }

  return errors
}

export function hasContactErrors(errors: CustomerContactErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Sugerencias para el campo "de quién es": son las relaciones mas frecuentes. */
export const ALTERNATE_PHONE_LABELS = [
  'Familiar',
  'Pareja',
  'Hijo/a',
  'Hermano/a',
  'Trabajo',
  'Vecino/a',
  'Otro',
] as const

/**
 * Busqueda de clientes del panel.
 *
 * La anterior tenia cuatro problemas de fondo:
 *
 * 1. El «fuzzy» era una subsecuencia y devolvia SIEMPRE 80 cuando la consulta
 *    entraba entera, sin importar que tan parecida fuera. Con una letra
 *    coincidia casi todo el padron, y todos con el mismo puntaje, asi que el
 *    orden quedaba al azar. «sr» traia a Silvia Romero, a Sergio y a cualquiera
 *    con una s antes de una r.
 * 2. El puntaje era el PROMEDIO de los campos que coincidian, asi que coincidir
 *    en mas campos BAJABA el puntaje: quien acertaba nombre y correo quedaba
 *    debajo de quien solo acertaba el nombre.
 * 3. El telefono solo se comparaba por digitos si la consulta traia 8 o mas; con
 *    menos caia en `phone.includes(term)` con el texto crudo, que falla apenas
 *    el numero guardado tenga un espacio o un guion. Buscar «0981123» no
 *    encontraba «0981 123 456».
 * 4. El RUC solo hacia match exacto con 12 digitos justos, un formato que casi
 *    ningun RUC paraguayo tiene.
 *
 * Ademas no miraba `alternate_phone` —el telefono secundario— y no ignoraba
 * tildes, que aca es lo mismo que no encontrar a «José».
 */

export interface SearchableCustomer {
  id?: string
  name?: string | null
  email?: string | null
  phone?: string | null
  alternate_phone?: string | null
  ruc?: string | null
  customerCode?: string | null
  city?: string | null
  company?: string | null
  address?: string | null
  notes?: string | null
  customer_type?: string | null
  status?: string | null
  segment?: string | null
}

/** Campo por el que coincidio, para poder decirle a la persona por que aparece. */
export type CustomerMatchField =
  | 'name'
  | 'email'
  | 'phone'
  | 'alternate_phone'
  | 'ruc'
  | 'code'
  | 'company'
  | 'city'
  | 'address'
  | 'notes'

export interface CustomerMatch<T> {
  customer: T
  score: number
  fields: CustomerMatchField[]
}

/** Minúsculas y sin tildes: «José» y «jose» son la misma persona. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Numero comparable: solo digitos, sin el prefijo de pais ni el cero inicial.
 * `+595 981 123-456`, `0981123456` y `981123456` tienen que encontrarse entre si.
 */
export function normalizePhone(value: string | null | undefined): string {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.length > 9 && digits.startsWith('595')) digits = digits.slice(3)
  if (digits.length > 1 && digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

export function normalizeDocument(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export const QUICK_FILTER_FIELDS = ['customer_type', 'city', 'status', 'segment'] as const
export type QuickFilterField = typeof QUICK_FILTER_FIELDS[number]

export type ParsedCustomerQuery =
  | { kind: 'empty' }
  | { kind: 'quick-filter'; field: QuickFilterField; value: string }
  | { kind: 'text'; text: string; digits: string }

export function parseCustomerQuery(raw: string | null | undefined): ParsedCustomerQuery {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { kind: 'empty' }

  const separator = trimmed.indexOf(':')
  if (separator > 0) {
    const field = normalizeText(trimmed.slice(0, separator)) as QuickFilterField
    const value = normalizeText(trimmed.slice(separator + 1))
    if (QUICK_FILTER_FIELDS.includes(field) && value) {
      return { kind: 'quick-filter', field, value }
    }
  }

  return { kind: 'text', text: normalizeText(trimmed), digits: normalizePhone(trimmed) }
}

/**
 * Longitud minima para que valga una coincidencia en medio de una palabra.
 *
 * Con una o dos letras, «contiene» trae a cualquiera: buscar «a» devolvia el
 * padron entero. Empezar por el principio de una palabra si tiene sentido desde
 * la primera letra —escribir «j» y ver a los Juan es lo esperable—, asi que ese
 * nivel no se limita.
 */
const MIN_LENGTH_FOR_CONTAINS = 3

/** Coincidencia de texto en un campo, de mas a menos fuerte. `0` es no coincide. */
function textScore(haystack: string, needle: string, weights: [number, number, number]): number {
  if (!haystack || !needle) return 0
  const [exact, prefix, contains] = weights

  if (haystack === needle) return exact
  if (haystack.startsWith(needle)) return prefix
  // Prefijo de palabra: buscar «rodriguez» tiene que encontrar «Ana Rodriguez»,
  // pero «riguez» no deberia pesar como si fuera el apellido.
  if (haystack.split(/\s+/).some((word) => word.startsWith(needle))) return prefix
  if (needle.length >= MIN_LENGTH_FOR_CONTAINS && haystack.includes(needle)) return contains
  return 0
}

/**
 * Cuanto coincide un cliente con la consulta.
 *
 * El puntaje SUMA los campos que aciertan —coincidir en nombre y telefono es
 * mejor evidencia que coincidir solo en el nombre, no peor—. Los campos debiles
 * (ciudad, direccion, notas) piden una consulta mas larga: con dos letras
 * ensucian la lista sin aportar nada.
 */
export function scoreCustomer<T extends SearchableCustomer>(
  customer: T,
  query: ParsedCustomerQuery
): CustomerMatch<T> | null {
  if (query.kind !== 'text') return null

  const { text, digits } = query
  const fields: CustomerMatchField[] = []
  let score = 0

  const add = (points: number, field: CustomerMatchField) => {
    if (points <= 0) return
    score += points
    if (!fields.includes(field)) fields.push(field)
  }

  add(textScore(normalizeText(customer.name), text, [1000, 700, 450]), 'name')
  add(textScore(normalizeText(customer.email), text, [900, 600, 350]), 'email')
  add(textScore(normalizeText(customer.customerCode), text, [900, 600, 300]), 'code')
  add(textScore(normalizeText(customer.company), text, [400, 300, 200]), 'company')

  // Telefonos: siempre digitos contra digitos. Tres alcanzan para empezar a
  // filtrar y evitan que un «12» suelto traiga medio padron.
  if (digits.length >= 3) {
    for (const [value, field] of [
      [customer.phone, 'phone'],
      [customer.alternate_phone, 'alternate_phone'],
    ] as const) {
      const stored = normalizePhone(value)
      if (!stored) continue
      if (stored === digits) add(950, field)
      else if (stored.startsWith(digits)) add(650, field)
      else if (stored.includes(digits)) add(400, field)
    }

    const ruc = normalizeDocument(customer.ruc)
    if (ruc) {
      if (ruc === digits) add(950, 'ruc')
      else if (ruc.startsWith(digits)) add(600, 'ruc')
      else if (ruc.includes(digits)) add(350, 'ruc')
    }
  }

  if (text.length >= 3) {
    add(textScore(normalizeText(customer.city), text, [200, 150, 120]), 'city')
  }

  // Direccion y notas son texto libre: solo con una consulta que ya es
  // especifica, y pesando poco, para que nunca desplacen a un nombre.
  if (text.length >= 4) {
    add(normalizeText(customer.address).includes(text) ? 90 : 0, 'address')
    add(normalizeText(customer.notes).includes(text) ? 60 : 0, 'notes')
  }

  return score > 0 ? { customer, score, fields } : null
}

function matchesQuickFilter(customer: SearchableCustomer, field: QuickFilterField, value: string): boolean {
  switch (field) {
    case 'customer_type':
      return normalizeText(customer.customer_type) === value
    case 'city':
      return normalizeText(customer.city) === value
    case 'status':
      return normalizeText(customer.status) === value
    case 'segment':
      return normalizeText(customer.segment) === value
    default:
      return false
  }
}

/** Los clientes que coinciden, del mas relevante al menos. */
export function rankCustomers<T extends SearchableCustomer>(
  customers: T[],
  rawQuery: string | null | undefined
): CustomerMatch<T>[] {
  const query = parseCustomerQuery(rawQuery)

  if (query.kind === 'empty') {
    return customers.map((customer) => ({ customer, score: 0, fields: [] }))
  }

  if (query.kind === 'quick-filter') {
    return customers
      .filter((customer) => matchesQuickFilter(customer, query.field, query.value))
      .map((customer) => ({ customer, score: 0, fields: [] }))
  }

  const matches: CustomerMatch<T>[] = []
  for (const customer of customers) {
    const match = scoreCustomer(customer, query)
    if (match) matches.push(match)
  }

  // El nombre desempata para que dos clientes con el mismo puntaje no bailen de
  // lugar entre renders.
  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      normalizeText(a.customer.name).localeCompare(normalizeText(b.customer.name))
  )
}

export function searchCustomers<T extends SearchableCustomer>(
  customers: T[],
  rawQuery: string | null | undefined
): T[] {
  return rankCustomers(customers, rawQuery).map((match) => match.customer)
}

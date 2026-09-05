/**
 * Datos de un cliente que no se pueden repetir dentro de una misma empresa.
 *
 * Sin esto la misma persona termina cargada tres veces —una por reparaciones,
 * una por el POS, una por la seccion de clientes— y a partir de ahi su deuda,
 * sus compras y sus reparaciones quedan repartidas entre fichas distintas. Es el
 * tipo de problema que no se nota el dia que se crea.
 *
 * La comparacion va sobre la version normalizada: el mismo numero esta cargado
 * como "0981-123 456" y como "0981123456", y el mismo RUC con y sin guion.
 */

import { normalizePhone } from './contact-rules'

export type DuplicateField = 'phone' | 'email' | 'ruc'

export type CustomerDuplicate = {
  field: DuplicateField
  /** Lo que escribio la persona, no la version normalizada. */
  value: string
  customerId: string
  customerName: string
}

const FIELD_LABEL: Record<DuplicateField, string> = {
  phone: 'teléfono',
  email: 'correo',
  ruc: 'RUC/C.I.',
}

/** Deja el RUC/CI comparable: `80012345-6` y `800123456` son el mismo documento. */
export function normalizeDocument(value: string | null | undefined): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * El mensaje nombra al cliente que ya lo tiene. Decir solo "ya existe" obliga a
 * salir a buscarlo a mano, y en la practica se termina creando el duplicado
 * igual con el numero cambiado por un digito.
 */
export function duplicateMessage(duplicate: CustomerDuplicate): string {
  return `Ese ${FIELD_LABEL[duplicate.field]} ya está cargado en «${duplicate.customerName}».`
}

export function duplicatesMessage(duplicates: CustomerDuplicate[]): string {
  if (duplicates.length === 0) return ''
  if (duplicates.length === 1) return duplicateMessage(duplicates[0])

  const campos = duplicates.map((d) => FIELD_LABEL[d.field]).join(' y el ')
  const nombres = [...new Set(duplicates.map((d) => d.customerName))]
  return nombres.length === 1
    ? `El ${campos} ya están cargados en «${nombres[0]}».`
    : `El ${campos} ya están cargados en otros clientes: ${nombres.map((n) => `«${n}»`).join(', ')}.`
}

export type DuplicateCandidate = {
  phone?: string | null
  email?: string | null
  ruc?: string | null
  /** Al editar, el propio cliente no cuenta como duplicado de si mismo. */
  excludeId?: string | null
}

type CustomerRow = { id: string; name: string | null }

/**
 * Lo minimo que se le pide al cliente de Supabase, para poder probar esto sin
 * uno real.
 *
 * El constructor de consultas va sin tipar a proposito: describirlo con su forma
 * encadenada hacia que TypeScript comparara el cliente real contra esta firma y
 * se quedara sin profundidad de inferencia («Type instantiation is excessively
 * deep»). El cuerpo de la funcion es corto y esta cubierto por pruebas.
 */
export type DuplicateQueryClient = {
  from: (table: string) => any
}

/**
 * Busca, campo por campo, si alguno ya esta cargado en otro cliente de la misma
 * empresa.
 *
 * Va con una consulta por campo y `.eq()` en vez de un `.or(...)` armado a mano:
 * asi los valores viajan como parametros y no hay forma de que un correo con
 * caracteres raros se cuele dentro del filtro. Son consultas chicas y con indice.
 */
export async function findCustomerDuplicates(
  supabase: DuplicateQueryClient,
  organizationId: string,
  candidate: DuplicateCandidate
): Promise<CustomerDuplicate[]> {
  const checks: Array<{ field: DuplicateField; column: string; fallback: string; normalized: string; raw: string }> = []

  const phone = normalizePhone(candidate.phone)
  if (phone) {
    checks.push({ field: 'phone', column: 'phone_digits', fallback: 'phone', normalized: phone, raw: String(candidate.phone ?? '').trim() })
  }

  const email = normalizeEmail(candidate.email)
  if (email) {
    checks.push({ field: 'email', column: 'email_lower', fallback: 'email', normalized: email, raw: String(candidate.email ?? '').trim() })
  }

  const ruc = normalizeDocument(candidate.ruc)
  if (ruc) {
    checks.push({ field: 'ruc', column: 'ruc_digits', fallback: 'ruc', normalized: ruc, raw: String(candidate.ruc ?? '').trim() })
  }

  if (checks.length === 0) return []

  const results = await Promise.all(checks.map(async (check) => {
    const run = (column: string, value: string) =>
      supabase
        .from('customers')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq(column, value)
        .limit(5)

    let { data, error } = await run(check.column, check.normalized)

    // Un despliegue sin la migracion no tiene las columnas normalizadas. Ahi se
    // compara el texto tal cual: encuentra menos —no ve el mismo numero con otro
    // formato— pero sigue atajando el caso comun, en vez de reventar el alta.
    if (error) {
      ;({ data, error } = await run(check.fallback, check.raw))
      if (error) throw error
    }

    const rows = (data ?? []) as CustomerRow[]
    const match = rows.find((row) => row.id !== candidate.excludeId)
    if (!match) return null

    return {
      field: check.field,
      value: check.raw,
      customerId: match.id,
      customerName: (match.name || '').trim() || 'un cliente sin nombre',
    } satisfies CustomerDuplicate
  }))

  return results.filter((result): result is CustomerDuplicate => result !== null)
}

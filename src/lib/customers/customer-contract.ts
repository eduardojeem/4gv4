export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'pending'
export type CustomerDatabaseStatus = 'activo' | 'inactivo' | 'suspendido' | 'pendiente'
export type CustomerType = 'regular' | 'premium' | 'empresa' | 'wholesale'
export type CustomerFormType = 'individual' | 'vip' | 'empresa' | 'mayorista'

const STATUS_ALIASES: Record<string, CustomerStatus> = {
  active: 'active',
  activo: 'active',
  inactive: 'inactive',
  inactivo: 'inactive',
  suspended: 'suspended',
  suspendido: 'suspended',
  pending: 'pending',
  pendiente: 'pending',
}

const DATABASE_STATUS: Record<CustomerStatus, CustomerDatabaseStatus> = {
  active: 'activo',
  inactive: 'inactivo',
  suspended: 'suspendido',
  pending: 'pendiente',
}

export function normalizeCustomerStatus(value: unknown): CustomerStatus {
  const key = String(value ?? '').trim().toLowerCase()
  return STATUS_ALIASES[key] ?? 'inactive'
}

export function statusForDatabase(value: unknown): CustomerDatabaseStatus {
  return DATABASE_STATUS[normalizeCustomerStatus(value)]
}

export function normalizeCustomerType(value: unknown): CustomerType {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'premium' || key === 'vip') return 'premium'
  if (key === 'empresa' || key === 'company') return 'empresa'
  if (key === 'wholesale' || key === 'mayorista') return 'wholesale'
  return 'regular'
}

export function classificationForFormType(value: CustomerFormType): {
  customer_type: CustomerType
  segment: string
} {
  if (value === 'vip') return { customer_type: 'premium', segment: 'vip' }
  if (value === 'empresa') return { customer_type: 'empresa', segment: 'empresa' }
  if (value === 'mayorista') return { customer_type: 'wholesale', segment: 'wholesale' }
  return { customer_type: 'regular', segment: 'regular' }
}

function normalizeWhitespace(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function capitalizePersonName(value: unknown): string {
  return normalizeWhitespace(value)
    .split(' ')
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word
      return word.charAt(0).toLocaleUpperCase('es-PY') + word.slice(1).toLocaleLowerCase('es-PY')
    })
    .join(' ')
}

export function buildCustomerIdentity(input: {
  name?: unknown
  first_name?: unknown
  last_name?: unknown
  company?: unknown
  company_name?: unknown
}) {
  const suppliedFirst = capitalizePersonName(input.first_name)
  const suppliedLast = capitalizePersonName(input.last_name)
  const legacyName = capitalizePersonName(input.name)
  const nameParts = legacyName.split(' ').filter(Boolean)
  const firstName = suppliedFirst || nameParts.shift() || ''
  const lastName = suppliedLast || nameParts.join(' ')
  const name = [firstName, lastName].filter(Boolean).join(' ') || legacyName
  const companyName = normalizeWhitespace(input.company_name) || normalizeWhitespace(input.company)

  return {
    name,
    first_name: firstName || null,
    last_name: lastName || null,
    company: companyName || null,
    company_name: companyName || null,
  }
}

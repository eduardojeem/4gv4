export const CUSTOMER_REPAIRS_PAGE_SIZE = 8

export const CUSTOMER_REPAIR_FILTERS = ['all', 'active', 'ready', 'delivered', 'cancelled'] as const
export type CustomerRepairFilter = typeof CUSTOMER_REPAIR_FILTERS[number]

type QueryValue = string | string[] | undefined

// Mismo formato que los slugs de organizacion. Lo que llega por la URL se
// valida antes de tocar la base: el filtro se resuelve despues contra las
// tiendas que la persona realmente tiene, asi que un slug ajeno no muestra nada.
const SAFE_STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseCustomerRepairsQuery(query: {
  status?: QueryValue
  page?: QueryValue
  store?: QueryValue
}): {
  status: CustomerRepairFilter
  page: number
  store: string | null
} {
  const rawStatus = first(query.status)
  const status = CUSTOMER_REPAIR_FILTERS.includes(rawStatus as CustomerRepairFilter)
    ? rawStatus as CustomerRepairFilter
    : 'all'
  const parsedPage = Number.parseInt(first(query.page) || '1', 10)
  const rawStore = first(query.store)?.trim().toLowerCase() ?? ''

  return {
    status,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    store: SAFE_STORE_SLUG_RE.test(rawStore) ? rawStore : null,
  }
}

export function getCustomerRepairStatusFilter(filter: CustomerRepairFilter): string[] | null {
  switch (filter) {
    case 'active':
      return ['recibido', 'diagnostico', 'reparacion', 'pausado']
    case 'ready':
      return ['listo']
    case 'delivered':
      return ['entregado']
    case 'cancelled':
      return ['cancelado']
    default:
      return null
  }
}

export function buildCustomerRepairsHref(
  baseHref: string,
  status: CustomerRepairFilter,
  page = 1,
  store: string | null = null
): string {
  const search = new URLSearchParams()
  if (store) search.set('store', store)
  if (status !== 'all') search.set('status', status)
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return query ? `${baseHref}?${query}` : baseHref
}

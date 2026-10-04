import { z } from 'zod'

const uuid = z.string().uuid()
const statuses = ['all', 'active', 'inactive', 'used', 'unused', 'no-category', 'no-brand', 'no-image', 'candidate', 'review', 'published'] as const
const sorts = ['name', 'name_desc', 'usage_desc', 'newest'] as const

export type CatalogAdminQuery = {
  q: string
  status: (typeof statuses)[number]
  brand: string | null
  category: string | null
  sort: (typeof sorts)[number]
  page: number
  pageSize: number
}

const positiveInteger = (value: string | null, fallback: number, max?: number) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return max ? Math.min(parsed, max) : parsed
}

export function parseCatalogAdminQuery(searchParams: URLSearchParams): CatalogAdminQuery {
  const status = z.enum(statuses).catch('all').parse(searchParams.get('status') ?? 'all')
  const sort = z.enum(sorts).catch('name').parse(searchParams.get('sort') ?? 'name')
  const optionalUuid = (key: string) => {
    const value = searchParams.get(key)
    return value && uuid.safeParse(value).success ? value : null
  }
  return {
    q: (searchParams.get('q') ?? '').trim().slice(0, 120),
    status,
    brand: optionalUuid('brand'),
    category: optionalUuid('category'),
    sort,
    page: positiveInteger(searchParams.get('page'), 1),
    pageSize: positiveInteger(searchParams.get('pageSize'), 50, 100),
  }
}

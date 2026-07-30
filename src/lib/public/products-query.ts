const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 50
const DEFAULT_MAX_PRICE = 999999

function parseFiniteNumber(value: string | null, fallback: number) {
  if (!value?.trim()) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return maximum ? Math.min(parsed, maximum) : parsed
}

export function parsePublicProductsQuery(searchParams: URLSearchParams) {
  const minPrice = Math.max(0, parseFiniteNumber(searchParams.get('min_price'), 0))
  const rawMaxPrice = parseFiniteNumber(searchParams.get('max_price'), DEFAULT_MAX_PRICE)

  return {
    page: parsePositiveInteger(searchParams.get('page'), DEFAULT_PAGE),
    perPage: parsePositiveInteger(searchParams.get('per_page'), DEFAULT_PER_PAGE, MAX_PER_PAGE),
    minPrice,
    maxPrice: rawMaxPrice >= 0 ? rawMaxPrice : DEFAULT_MAX_PRICE,
  }
}

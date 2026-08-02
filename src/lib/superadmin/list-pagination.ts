export const SUPERADMIN_PAGE_SIZES = [10, 25, 50, 100] as const

export function paginateList<T>(
  items: T[],
  requestedPage: string,
  requestedPageSize: string
) {
  const parsedSize = Number.parseInt(requestedPageSize, 10)
  const pageSize = SUPERADMIN_PAGE_SIZES.includes(parsedSize as (typeof SUPERADMIN_PAGE_SIZES)[number])
    ? parsedSize
    : 25
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const parsedPage = Number.parseInt(requestedPage, 10)
  const page = Number.isFinite(parsedPage)
    ? Math.min(Math.max(parsedPage, 1), totalPages)
    : 1
  const start = (page - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalPages,
  }
}

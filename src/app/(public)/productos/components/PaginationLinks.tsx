/**
 * Server component that renders rel="prev" and rel="next" link tags
 * in the <head> for SEO-friendly pagination.
 */

interface PaginationLinksProps {
  currentPage: number
  totalPages: number
  baseUrl?: string
}

export function PaginationLinks({ currentPage, totalPages, baseUrl = '/productos' }: PaginationLinksProps) {
  if (totalPages <= 1) return null

  return (
    <>
      {currentPage > 1 && (
        <link rel="prev" href={`${baseUrl}?page=${currentPage - 1}`} />
      )}
      {currentPage < totalPages && (
        <link rel="next" href={`${baseUrl}?page=${currentPage + 1}`} />
      )}
    </>
  )
}

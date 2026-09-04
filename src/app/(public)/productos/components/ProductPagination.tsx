'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductPaginationProps {
  currentPage: number
  totalPages: number
  total?: number
  perPage?: number
}

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100]

function buildPageRange(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const delta = 1
  const range = new Set<number>()
  range.add(1)
  range.add(total)
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.add(i)
  }

  const sorted = Array.from(range).sort((a, b) => a - b)
  const result: (number | null)[] = []

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push(null)
    }
    result.push(sorted[i])
  }

  return result
}

export function ProductPagination({
  currentPage,
  totalPages,
  total,
  perPage = 25,
}: ProductPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('per_page', size.toString())
    params.set('page', '1')

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const from = total ? Math.min((currentPage - 1) * perPage + 1, total) : 0
  const to = total ? Math.min(currentPage * perPage, total) : 0
  const pages = buildPageRange(currentPage, totalPages)

  if (totalPages <= 1 && (!total || total <= 25)) return null

  return (
    <div
      className={cn(
        'mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4',
        isPending && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Resumen de Resultados */}
      <div className="text-xs text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
        {total ? (
          <span>
            Mostrando <strong className="text-foreground">{from} - {to}</strong> de{' '}
            <strong className="text-foreground">{total}</strong> productos
          </span>
        ) : null}
      </div>

      {/* Navegación de Páginas */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1 order-1 sm:order-2" aria-label="Paginación">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pages.map((pageNum, idx) =>
            pageNum === null ? (
              <span
                key={`ellipsis-${idx}`}
                className="flex h-8 w-8 items-center justify-center text-muted-foreground text-xs"
                aria-hidden="true"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
                className={cn(
                  'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold',
                  currentPage === pageNum
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={`Página ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}

      {/* Selector de Límite por Página */}
      <div className="flex items-center gap-1.5 order-3">
        <span className="text-[11px] font-semibold text-muted-foreground">Ver:</span>
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/80">
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isCurrent = perPage === size
            return (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-bold transition-all',
                  isCurrent
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {size}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

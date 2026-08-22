'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

interface ProductPaginationProps {
  currentPage: number
  totalPages: number
}

/** Calcula el conjunto de números de página a mostrar con elipsis.
 *  Siempre incluye la primera y la última página, y una ventana de 3
 *  alrededor de la página actual. El separador `null` representa "…". */
function buildPageRange(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const delta = 1 // páginas a cada lado de la actual
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
      result.push(null) // elipsis
    }
    result.push(sorted[i])
  }

  return result
}

export function ProductPagination({ currentPage, totalPages }: ProductPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())

    // Al cambiar de página sí se vuelve arriba (a diferencia de los filtros,
    // donde conservar la posición evita saltos molestos).
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  if (totalPages <= 1) return null

  const pages = buildPageRange(currentPage, totalPages)

  return (
    <nav
      className={`flex items-center justify-center gap-1 pt-10 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
      aria-label="Paginacion"
    >
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Pagina anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((pageNum, idx) =>
        pageNum === null ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground"
            aria-hidden="true"
          >
            <MoreHorizontal className="h-4 w-4" />
          </span>
        ) : (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePageChange(pageNum)}
            className={`h-9 w-9 rounded-lg text-sm ${
              currentPage === pageNum ? '' : 'text-muted-foreground'
            }`}
            aria-label={`Pagina ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
          >
            {pageNum}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Pagina siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

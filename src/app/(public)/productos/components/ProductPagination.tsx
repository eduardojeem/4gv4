'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ProductPaginationProps {
  currentPage: number
  totalPages: number
}

export function ProductPagination({ currentPage, totalPages }: ProductPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: true })
    })
  }

  if (totalPages <= 1) return null

  return (
    <nav className={`flex items-center justify-center gap-1 pt-10 ${isPending ? 'opacity-60 pointer-events-none' : ''}`} aria-label="Paginacion">
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

      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let pageNum: number
        if (totalPages <= 5) {
          pageNum = i + 1
        } else if (currentPage <= 3) {
          pageNum = i + 1
        } else if (currentPage >= totalPages - 2) {
          pageNum = totalPages - 4 + i
        } else {
          pageNum = currentPage - 2 + i
        }

        return (
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
      })}

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

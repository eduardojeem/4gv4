'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { readActiveProductFilters, clearAllProductFilters } from '@/lib/utils/product-filters'

export function ClearAllFiltersButton() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const { hasActiveFilters: hasFilters } = readActiveProductFilters(
    new URLSearchParams(searchParams.toString())
  )

  if (!hasFilters) return null

  const onClear = () => {
    const params = clearAllProductFilters(new URLSearchParams(searchParams.toString()))
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Button variant="outline" onClick={onClear} className="rounded-lg">
      Limpiar filtros y busqueda
    </Button>
  )
}

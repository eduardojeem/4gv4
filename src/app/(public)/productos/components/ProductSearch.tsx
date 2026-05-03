'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2 } from 'lucide-react'

export function ProductSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const initialQuery = searchParams.get('query') || ''
  const [value, setValue] = useState(initialQuery)

  useEffect(() => {
    setValue(searchParams.get('query') || '')
  }, [searchParams])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value === initialQuery) return

      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('query', value)
      } else {
        params.delete('query')
      }
      params.set('page', '1')

      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false })
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [value, initialQuery, router, searchParams])

  const clearSearch = () => {
    setValue('')
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar productos..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-10 pr-10 h-10 rounded-lg bg-background"
        aria-label="Buscar productos"
      />
      {value && !isPending && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={clearSearch}
          aria-label="Limpiar busqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

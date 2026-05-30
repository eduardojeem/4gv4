'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  inputClassName?: string
  buttonClassName?: string
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
  initialQuery?: string
}

export function MarketplaceSearchBox({
  className,
  inputClassName,
  buttonClassName,
  placeholder = 'Buscar productos, empresas, marcas...',
  compact = false,
  autoFocus = false,
  initialQuery = '',
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `/marketplace/buscar?q=${encodeURIComponent(value)}` : '/marketplace/buscar')
  }

  return (
    <form onSubmit={submitSearch} role="search" className={cn('flex gap-2', className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          type="search"
          name="q"
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder-slate-500',
            compact && 'h-9 text-xs',
            inputClassName
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Limpiar busqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        type="submit"
        size={compact ? 'sm' : 'default'}
        className={cn('shrink-0 bg-cyan-600 hover:bg-cyan-700', buttonClassName)}
      >
        Buscar
      </Button>
    </form>
  )
}

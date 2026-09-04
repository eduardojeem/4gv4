'use client'

import { FocusEvent, FormEvent, useEffect, useState } from 'react'
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
  /**
   * Avisa cuando el buscador toma o suelta el foco. Lo usa el encabezado del
   * marketplace para hacerle lugar: mientras se escribe, esconde los enlaces de
   * navegacion y deja crecer el campo.
   */
  onFocusChange?: (focused: boolean) => void
}

export function MarketplaceSearchBox({
  className,
  inputClassName,
  buttonClassName,
  placeholder = 'Buscar productos, empresas, marcas...',
  compact = false,
  autoFocus = false,
  initialQuery = '',
  onFocusChange,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  function changeFocus(next: boolean) {
    setFocused(next)
    onFocusChange?.(next)
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    // El foco puede pasar al boton de limpiar o al de buscar sin salir del
    // formulario: eso no es soltarlo, y colapsar ahi haria desaparecer el boton
    // justo antes del clic.
    if (event.currentTarget.contains(event.relatedTarget)) return
    changeFocus(false)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `/marketplace/buscar?q=${encodeURIComponent(value)}` : '/marketplace/buscar')
  }

  return (
    <form
      onSubmit={submitSearch}
      onFocus={() => changeFocus(true)}
      onBlur={handleBlur}
      role="search"
      className={cn('flex gap-2', className)}
    >
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
            'h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm shadow-sm outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder-slate-500',
            // `type="search"` trae su propia X y quedaban dos, una al lado de la
            // otra. La nuestra es la que se ve y la que se puede alcanzar con el
            // teclado, asi que se esconde la del navegador.
            '[&::-webkit-search-cancel-button]:appearance-none',
            // En el encabezado el campo va chico para no comerse la fila; al
            // tomar el foco crece, que es cuando hace falta leer lo que se escribe.
            compact && (focused ? 'h-10 text-sm shadow-md' : 'h-9 text-xs'),
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

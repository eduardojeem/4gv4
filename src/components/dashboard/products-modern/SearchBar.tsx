/**
 * SearchBar Component
 * Search input with icon, clear button, and keyboard shortcut
 */

import React, { useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const SearchBar = React.memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar por nombre, código SKU o marca...',
  className
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Atajo de teclado: Ctrl+K o Cmd+K para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('relative flex-1 group', className)}>
      <label htmlFor="product-search" className="sr-only">
        Buscar productos
      </label>
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        id="product-search"
        type="search"
        role="searchbox"
        aria-label="Buscar productos por nombre, SKU o marca"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-20 h-10 rounded-xl text-xs sm:text-sm border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition-all"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            aria-label="Limpiar búsqueda"
            className="h-6 w-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <kbd className="hidden lg:inline-flex items-center gap-0.5 pointer-events-none text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700/70 select-none shadow-2xs">
          Ctrl K
        </kbd>
      </div>
    </div>
  )
})

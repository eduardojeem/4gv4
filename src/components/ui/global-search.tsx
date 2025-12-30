"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, SlidersHorizontal } from 'lucide-react'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSearch?: (input: { query: string; filters: any }) => Array<{ title: string; subtitle?: string; href: string }>
}

export function GlobalSearch({ open, onOpenChange, onSearch }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<any>({ type: 'todos', status: 'todos' })
  const [results, setResults] = useState<Array<{ title: string; subtitle?: string; href: string }>>([])
  const [resultsCount, setResultsCount] = useState(0)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const normalized = query.trim()
      if (onSearch) {
        try {
          const r = onSearch({ query: normalized, filters })
          setResults(r)
          setResultsCount(r.length)
        } catch (e) {
          setResults([])
          setResultsCount(0)
        }
      } else {
        setResults([])
        setResultsCount(0)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open, onSearch, filters])

  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => !!v), [filters])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="global-search-desc" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Búsqueda global
          </DialogTitle>
        </DialogHeader>
        <div id="global-search-desc" className="sr-only">
          Busca en usuarios, inventario, seguridad y configuraciones. Usa filtros para refinar.
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar en todo el sistema (Ctrl+K)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Buscar"
              autoFocus
            />
            <Button variant="outline" onClick={() => onOpenChange(false)} aria-label="Cerrar búsqueda">Cerrar</Button>
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div className="flex flex-wrap gap-2">
              {activeFilters.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sin filtros</span>
              ) : (
                activeFilters.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>
                ))
              )}
            </div>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setFilters({ type: 'todos', status: 'todos', from: undefined, to: undefined })
                }}
                aria-label="Limpiar búsqueda y filtros"
              >
                Limpiar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Tipo
              <select
                className="border rounded px-2 py-1 text-sm bg-background"
                value={filters.type ?? 'todos'}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value as any }))}
                aria-label="Filtrar por tipo"
              >
                <option value="todos">Todos</option>
                <option value="productos">Productos</option>
                <option value="clientes">Clientes</option>
                <option value="reparaciones">Reparaciones</option>
                <option value="usuarios">Usuarios</option>
                <option value="seguridad">Seguridad</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Estado (usuarios)
              <select
                className="border rounded px-2 py-1 text-sm bg-background"
                value={filters.status ?? 'todos'}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}
                aria-label="Filtrar por estado de usuario"
              >
                <option value="todos">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="suspended">Suspendido</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Desde
                <Input type="date" value={filters.from ?? ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} aria-label="Fecha desde" />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Hasta
                <Input type="date" value={filters.to ?? ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} aria-label="Fecha hasta" />
              </label>
            </div>
          </div>
          <div aria-live="polite" className="text-xs text-muted-foreground">{resultsCount} resultados</div>
          <div role="list" aria-label="Resultados de búsqueda" className="max-h-64 overflow-auto border rounded-md p-2">
            {results.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              results.map((r, idx) => (
                <a
                  role="listitem"
                  key={idx}
                  href={r.href}
                  className="block px-2 py-2 rounded hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <div className="text-sm font-medium">{r.title}</div>
                  {r.subtitle && <div className="text-xs text-muted-foreground">{r.subtitle}</div>}
                </a>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
'use client'

import { useState, useMemo } from 'react'
import { Check, CheckCircle2, ChevronDown, ChevronUp, ImageOff, Loader2, Plus, Search, Sparkles, Store, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { GlobalProductCandidate } from '@/lib/products/barcode-catalog'

interface GlobalProductCandidatesProps {
  candidates: GlobalProductCandidate[]
  total: number
  busy: boolean
  optionName: (kind: 'brand' | 'category', id: string | null) => string | null
  onImport: (entries: GlobalProductCandidate[]) => void
}

export function GlobalProductCandidates({
  candidates,
  total,
  busy,
  optionName,
  onImport,
}: GlobalProductCandidatesProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.gtin.includes(q) ||
      (c.brandName && c.brandName.toLowerCase().includes(q)) ||
      c.otherNames.some((o) => o.toLowerCase().includes(q)),
    )
  }, [candidates, search])

  const toggle = (gtin: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(gtin)) next.delete(gtin)
      else next.add(gtin)
      return next
    })

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.gtin)))
  const clearSelection = () => setSelected(new Set())

  const chosen = useMemo(
    () => candidates.filter((candidate) => selected.has(candidate.gtin)),
    [candidates, selected],
  )

  if (candidates.length === 0) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-background to-blue-50/40 p-4 sm:p-5 shadow-xs transition-all dark:border-sky-900/50 dark:from-sky-950/20 dark:to-blue-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground sm:text-base">
                Sugerencias automáticas de tiendas
              </h2>
              <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 text-xs">
                {total} pendiente{total === 1 ? '' : 's'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Productos con código de barras cargados por las tiendas que aún no forman parte del catálogo oficial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {open && chosen.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
              disabled={busy}
              onClick={() => onImport(chosen)}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Sumar seleccionados ({chosen.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            className="gap-1.5 rounded-xl border-sky-300 dark:border-sky-800"
          >
            {open ? (
              <>
                <span>Ocultar sugerencias</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Revisar ({total})</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-sky-200/60 dark:border-sky-900/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar sugerencias..."
                className="h-8 pl-8 text-xs bg-background/80 rounded-lg"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs px-2.5">
                Elegir visibles ({filtered.length})
              </Button>
              {selected.size > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs px-2.5 text-muted-foreground hover:text-destructive">
                  Deseleccionar
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {filtered.map((candidate) => {
              const isChecked = selected.has(candidate.gtin)
              const brand = optionName('brand', candidate.globalBrandId) ?? candidate.brandName
              const category = optionName('category', candidate.globalCategoryId)

              return (
                <div
                  key={candidate.gtin}
                  className={cn(
                    'group flex items-start gap-3 rounded-xl border p-2.5 text-xs transition-all',
                    isChecked
                      ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 ring-1 ring-sky-500'
                      : 'border-border/80 bg-card hover:border-sky-300 dark:hover:border-sky-800',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    checked={isChecked}
                    onChange={() => toggle(candidate.gtin)}
                    aria-label={`Seleccionar ${candidate.name}`}
                  />

                  <div className="h-12 w-12 shrink-0 rounded-lg border bg-white p-1 flex items-center justify-center overflow-hidden">
                    {candidate.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={candidate.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate leading-snug">
                      {candidate.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono bg-muted/60 px-1 rounded text-[10px]">{candidate.gtin}</span>
                      {brand && <span className="font-medium text-foreground/80">• {brand}</span>}
                      {category && <span className="truncate text-muted-foreground">• {category}</span>}
                    </div>
                    {candidate.otherNames.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/75 truncate mt-0.5">
                        Otros nombres: {candidate.otherNames.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-5 font-medium">
                      <Store className="h-2.5 w-2.5" />
                      {candidate.stores} {candidate.stores === 1 ? 'tienda' : 'tiendas'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40"
                      disabled={busy}
                      onClick={() => onImport([candidate])}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> Sumar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              Mostrando {filtered.length} de {candidates.length} sugerencias {total > candidates.length ? `(${total} en total)` : ''}.
            </span>
            {chosen.length > 0 && (
              <span className="font-semibold text-sky-700 dark:text-sky-300">
                {chosen.length} seleccionada{chosen.length === 1 ? '' : 's'} para importar
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

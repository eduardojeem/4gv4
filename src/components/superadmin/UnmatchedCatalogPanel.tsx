'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Lo que falta en el catálogo.
 *
 * Vincular por nombre solo alcanza a lo que ya existe, y el catálogo recién
 * arranca: la mayoría de las marcas y categorías de las empresas no tiene
 * equivalente oficial. Antes eso no se veía en ninguna parte —la pantalla decía
 * que no había nada pendiente— y era justamente el trabajo por hacer.
 *
 * Acá aparecen agrupadas por nombre, las más usadas primero, para subirlas al
 * catálogo y vincularlas de una.
 */

export type UnmatchedEntry = {
  name: string
  count: number
  organizations: string[]
  ids: string[]
}

export function UnmatchedCatalogPanel({
  entries,
  itemLabel,
  busy,
  onCreate,
}: {
  entries: UnmatchedEntry[]
  /** «marca» o «categoría»: se usa en los textos. */
  itemLabel: 'marca' | 'categoría'
  busy: boolean
  onCreate: (entries: UnmatchedEntry[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Crear en el catálogo escribe para todas las empresas: nada viene marcado.
  const [chosen, setChosen] = useState<Record<string, boolean>>({})

  const selected = useMemo(() => entries.filter((entry) => chosen[entry.name]), [entries, chosen])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) =>
      entry.name.toLowerCase().includes(needle) ||
      entry.organizations.some((organization) => organization.toLowerCase().includes(needle)),
    )
  }, [entries, search])

  if (entries.length === 0) return null

  const plural = itemLabel === 'marca' ? 'marcas' : 'categorías'
  const rows = entries.reduce((total, entry) => total + entry.count, 0)

  return (
    <section aria-label={`${plural} que faltan en el catálogo`} className="rounded-xl border border-border bg-muted/40">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-foreground"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Faltan <strong>{entries.length}</strong> {entries.length === 1 ? itemLabel : plural} en el catálogo, que hoy
            usan {rows} {rows === 1 ? 'ficha' : 'fichas'} de empresas.{' '}
            <span className="underline underline-offset-2">{open ? 'Ocultar' : 'Ver cuáles'}</span>
          </span>
        </button>

        <Button
          size="sm"
          onClick={() => onCreate(selected)}
          disabled={busy || selected.length === 0}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear {selected.length > 0 ? selected.length : ''} en el catálogo
        </Button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar entre las ${plural} pendientes`}
              className="h-9 pl-9"
            />
          </div>

          <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
            {visible.map((entry) => (
              <li key={entry.name}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
                    chosen[entry.name] ? 'bg-primary/10' : 'bg-background/60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    checked={Boolean(chosen[entry.name])}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setChosen((current) => ({ ...current, [entry.name]: checked }))
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">{entry.name}</span>
                    {entry.organizations.length > 0 && (
                      <span className="text-muted-foreground"> · {entry.organizations.join(', ')}</span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {entry.count}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ninguna coincide con esa búsqueda.</p>
          )}

          <p className="text-xs text-muted-foreground">
            {itemLabel === 'marca'
              ? 'Se crean sin logo: quedan en «Sin logo» para cargarles el oficial.'
              : 'Entran como categorías principales; después podés colgarlas de otra.'}{' '}
            Las fichas de las empresas con ese nombre quedan vinculadas.
          </p>
        </div>
      )}
    </section>
  )
}

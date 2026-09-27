'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Qué se va a vincular, antes de vincularlo.
 *
 * El botón aplicaba los vínculos de una y recién después se veía el resultado.
 * Acá se listan uno por uno —qué marca o categoría de qué empresa se une a
 * cuál del catálogo— y se pueden desmarcar los que no correspondan.
 */

export type LinkSuggestion = {
  id: string
  name: string
  organizationName: string | null
  targetId: string
  targetName: string
  targetLogoUrl?: string | null
  /** `false` cuando el nombre no es igual, solo parecido. */
  exact?: boolean
}

export function LinkSuggestionsPanel({
  suggestions,
  itemLabel,
  busy,
  onApply,
}: {
  suggestions: LinkSuggestion[]
  /** «marca» o «categoría»: se usa en los textos. */
  itemLabel: 'marca' | 'categoría'
  busy: boolean
  onApply: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  // Solo lo que el operador tocó. Lo demás sale del propio dato: las
  // coincidencias exactas vienen marcadas y las aproximadas no, porque son una
  // propuesta y vincular de más ensucia el catálogo de todas las empresas.
  // Guardar la lista entera no serviría: las sugerencias llegan después.
  const [decisions, setDecisions] = useState<Record<string, boolean>>({})
  const isSelected = (suggestion: LinkSuggestion) => decisions[suggestion.id] ?? suggestion.exact !== false

  const selected = useMemo(
    () => suggestions.filter((suggestion) => decisions[suggestion.id] ?? suggestion.exact !== false),
    [suggestions, decisions],
  )

  const byTarget = useMemo(() => {
    const groups = new Map<string, LinkSuggestion[]>()
    for (const suggestion of suggestions) {
      groups.set(suggestion.targetName, [...(groups.get(suggestion.targetName) ?? []), suggestion])
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'))
  }, [suggestions])

  const approximate = suggestions.filter((suggestion) => suggestion.exact === false).length

  if (suggestions.length === 0) return null

  const plural = itemLabel === 'marca' ? 'marcas' : 'categorías'

  return (
    <section
      aria-label={`${plural} de empresas para vincular`}
      className="rounded-xl border border-amber-500/40 bg-amber-500/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-amber-900 dark:text-amber-200"
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          <span>
            Hay <strong>{suggestions.length}</strong> {suggestions.length === 1 ? itemLabel : plural} de empresas que coinciden con el catálogo
          {approximate > 0 && <> ({approximate} {approximate === 1 ? 'aproximada' : 'aproximadas'})</>}.{' '}
            <span className="underline underline-offset-2">{open ? 'Ocultar' : 'Ver cuáles'}</span>
          </span>
        </button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onApply(selected.map((suggestion) => suggestion.id))}
          disabled={busy || selected.length === 0}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Vincular {selected.length === suggestions.length ? 'todas' : selected.length}
        </Button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-amber-500/30 px-4 py-3">
          {byTarget.map(([targetName, rows]) => (
            <div key={targetName} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">
                {targetName} · {rows.length}
              </p>
              <ul className="space-y-1">
                {rows.map((suggestion) => (
                  <li key={suggestion.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-background/60 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0"
                        checked={isSelected(suggestion)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setDecisions((current) => ({ ...current, [suggestion.id]: checked }))
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-foreground">{suggestion.name}</span>
                        {suggestion.organizationName && (
                          <span className="text-muted-foreground"> · {suggestion.organizationName}</span>
                        )}
                        {suggestion.exact === false && (
                          <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                            aproximada
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                        {suggestion.targetLogoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={suggestion.targetLogoUrl} alt="" className="h-5 w-5 rounded bg-background object-contain" />
                        )}
                        {suggestion.targetName}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
            Se vinculan las marcadas. Lo que dejes sin marcar queda como está y vuelve a aparecer acá.
          </p>
        </div>
      )}
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, CheckCircle2, Link2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { BrandMark } from './BrandMark'
import { cn } from '@/lib/utils'

type CatalogEntry = {
  id: string
  name: string
  logo_url: string | null
  already_added: boolean
  own_brand_id: string | null
}

interface BrandCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
  /** Para crear como propia lo que no está en el catálogo. */
  onCreateOwn: (name: string) => void
}

/**
 * Elegir varias marcas oficiales y agregarlas de una vez, ya vinculadas: con el
 * logo de la plataforma y agrupadas en el marketplace.
 */
export function BrandCatalogDialog({ open, onOpenChange, onAdded, onCreateOwn }: BrandCatalogDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(false)
  // Lo elegido se recuerda aunque cambie la búsqueda.
  const [selected, setSelected] = useState<Map<string, CatalogEntry>>(new Map())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/brands/catalog?limit=60&search=${encodeURIComponent(query)}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!cancelled) setResults(payload?.success ? payload.data ?? [] : [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, query])

  const toggle = (entry: CatalogEntry) => {
    if (entry.already_added) return
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.set(entry.id, entry)
      return next
    })
  }

  const close = (next: boolean) => {
    if (saving) return
    if (!next) {
      setQuery('')
      setSelected(new Map())
    }
    onOpenChange(next)
  }

  const toLink = [...selected.values()].filter((entry) => entry.own_brand_id).length

  const handleAdd = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/brands/from-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected.keys()] }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudieron agregar las marcas.')
      const parts = [
        payload.created ? `${payload.created} agregada${payload.created === 1 ? '' : 's'}` : '',
        payload.linked ? `${payload.linked} propia${payload.linked === 1 ? '' : 's'} pasó a oficial` : '',
        payload.skipped ? `${payload.skipped} no se pudo` : '',
      ].filter(Boolean)
      toast.success('Marcas oficiales agregadas', { description: parts.join(' · ') })
      setSelected(new Map())
      setQuery('')
      onAdded()
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudieron agregar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const typed = query.trim()

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Agregar marcas oficiales
          </DialogTitle>
          <DialogDescription>
            Marcas del catálogo de la plataforma: llegan con su logo y tus productos aparecen agrupados con los de otras tiendas en el marketplace. Podés elegir varias.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscá la marca: Samsung, Apple, Xiaomi…"
            className="pl-9"
            aria-label="Buscar en el catálogo de marcas"
            autoFocus
          />
        </div>

        <div className="min-h-[260px] flex-1 overflow-y-auto rounded-lg border p-2">
          {loading && results.length === 0 ? (
            <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando…
            </p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <p>{typed ? `«${typed}» no está en el catálogo oficial.` : 'No hay marcas en el catálogo.'}</p>
              {typed && (
                <Button variant="outline" size="sm" onClick={() => { close(false); onCreateOwn(typed) }}>
                  Crear «{typed}» como marca propia
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="list">
              {results.map((entry) => {
                const isSelected = selected.has(entry.id)
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => toggle(entry)}
                      disabled={entry.already_added || saving}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm transition-colors',
                        entry.already_added
                          ? 'cursor-default opacity-60'
                          : isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'hover:border-primary/40 hover:bg-muted/50'
                      )}
                    >
                      <BrandMark brand={entry} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{entry.name}</span>
                        {entry.already_added ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Ya en tu tienda
                          </span>
                        ) : entry.own_brand_id ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Link2 className="h-3 w-3" aria-hidden="true" /> La tenés como propia
                          </span>
                        ) : null}
                      </span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" role="status">
          <span>
            {selected.size === 0
              ? 'Tocá las marcas que querés agregar.'
              : `${selected.size} elegida${selected.size === 1 ? '' : 's'}${toLink ? ` · ${toLink} que tenías como propia${toLink === 1 ? '' : 's'} pasa${toLink === 1 ? '' : 'n'} a oficial` : ''}`}
          </span>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...selected.values()].slice(0, 6).map((entry) => (
                <Badge key={entry.id} variant="secondary" className="text-xs">{entry.name}</Badge>
              ))}
              {selected.size > 6 && <Badge variant="secondary" className="text-xs">+{selected.size - 6}</Badge>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleAdd()} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Agregar {selected.size > 0 ? selected.size : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

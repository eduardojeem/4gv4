'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CatalogUsageRow } from '@/lib/catalog/manual-link'

/**
 * Qué empresas usan una categoría o marca global, con el nombre que le puso
 * cada una. Antes solo se veía el número: un vínculo equivocado («Genérico»
 * dentro de «Samsung») no se podía encontrar ni deshacer.
 */
export function CatalogUsageDialog({
  endpoint,
  item,
  itemLabel,
  onClose,
  onChanged,
}: {
  endpoint: string
  item: { id: string; name: string } | null
  itemLabel: 'marca' | 'categoría'
  onClose: () => void
  /** Se llama después de desvincular, para refrescar los conteos. */
  onChanged: () => void
}) {
  const [rows, setRows] = useState<CatalogUsageRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setRows(null)
    setError(null)
    try {
      const response = await fetch(`${endpoint}?usage=${id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar.')
      setRows(payload.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.')
    }
  }, [endpoint])

  useEffect(() => { if (item) void load(item.id) }, [item, load])

  const unlinkRow = async (row: CatalogUsageRow) => {
    setBusyId(row.id)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlink', ids: [row.id] }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo desvincular.')
      toast.success(`«${row.name}»${row.organizationName ? ` de ${row.organizationName}` : ''} quedó sin vincular`)
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desvincular.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quién usa «{item?.name}»</DialogTitle>
          <DialogDescription>
            Las {itemLabel === 'marca' ? 'marcas' : 'categorías'} de las empresas vinculadas, con el nombre que les puso cada una. Si alguna quedó mal, desvinculala.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ninguna empresa la usa todavía.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{row.organizationName ?? 'Empresa sin nombre'}</span>
                  <span className="block truncate text-xs text-muted-foreground">la llama «{row.name}»</span>
                </span>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" disabled={busyId !== null} onClick={() => void unlinkRow(row)}>
                  {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Desvincular
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

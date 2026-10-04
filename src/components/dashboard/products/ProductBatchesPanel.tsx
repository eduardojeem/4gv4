'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { BATCH_STATUS_LABELS, type BatchStatus, type EstimatedBatch } from '@/lib/inventory/batches'

export const BATCH_STATUS_STYLES: Record<BatchStatus, string> = {
  expired: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  week: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  month: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
}

export function formatDay(date: string) {
  return date.slice(0, 10).split('-').reverse().join('/')
}

/**
 * Lotes de un producto ya creado: cuándo vence cada uno y cuánto se estima
 * que queda. Se usa en la pestaña Inventario del formulario.
 *
 * `alwaysShow`: el rubro trabaja con vencimientos. Si no, el panel solo
 * aparece cuando el producto ya tiene lotes cargados.
 */
export function ProductBatchesPanel({ productId, alwaysShow }: { productId: string; alwaysShow: boolean }) {
  const [batches, setBatches] = useState<EstimatedBatch[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lot, setLot] = useState('')
  const [expires, setExpires] = useState('')
  const [quantity, setQuantity] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`/api/products/${productId}/batches`, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    setAvailable(body.available !== false)
    setBatches(Array.isArray(body.batches) ? body.batches : [])
  }, [productId])
  useEffect(() => { void load() }, [load])

  if (batches === null) return null
  if (!alwaysShow && batches.length === 0) return null

  const add = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/products/${productId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_code: lot.trim() || null, expires_on: expires, quantity: Number(quantity) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar el lote')
        return
      }
      toast.success('Lote registrado')
      setLot('')
      setExpires('')
      setQuantity('')
      setOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const act = async (id: string, action: 'discard' | 'restore') => {
    const reason = action === 'discard' ? window.prompt('¿Por qué se descarta? (vencido, roto, devuelto…)', 'Vencido') : undefined
    if (action === 'discard' && reason === null) return
    const response = await fetch(`/api/products/${productId}/batches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason: reason || undefined }),
    })
    if (!response.ok) {
      toast.error('No se pudo actualizar el lote')
      return
    }
    if (action === 'discard') toast.success('Lote descartado. Si lo sacaste del estante, ajustá el stock.')
    await load()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold sm:text-base"><CalendarClock className="h-4 w-4 text-amber-600" /> Lotes y vencimientos</h3>
          <p className="text-xs text-muted-foreground">Registrá cada ingreso con su vencimiento. Lo que queda de cada lote se estima vendiendo primero lo que vence antes.</p>
        </div>
        {available && !open && <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registrar lote</Button>}
      </div>

      {!available && <p className="text-xs text-amber-700">Lotes y vencimientos todavía no están activados en la base de datos.</p>}

      {open && (
        <div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_150px_110px_auto] sm:items-end">
          <div className="space-y-1"><Label htmlFor="batch-lot" className="text-xs">Lote (opcional)</Label><Input id="batch-lot" value={lot} onChange={(event) => setLot(event.target.value)} placeholder="L2410" /></div>
          <div className="space-y-1"><Label htmlFor="batch-expires" className="text-xs">Vence</Label><Input id="batch-expires" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="batch-qty" className="text-xs">Unidades</Label><Input id="batch-qty" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div className="flex gap-1">
            <Button type="button" size="sm" onClick={() => void add()} disabled={saving || !expires || !(Number(quantity) > 0)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground sm:col-span-4">Registrar el lote no suma stock: el stock se carga en la compra o con un ajuste.</p>
        </div>
      )}

      {batches.length === 0 ? (
        available && <p className="text-xs text-muted-foreground">Todavía no hay lotes registrados para este producto.</p>
      ) : (
        <ul className="divide-y rounded-xl border text-sm dark:divide-slate-800 dark:border-slate-800">
          {batches.map((batch) => (
            <li key={batch.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5', batch.discarded_at && 'opacity-50')}>
              <span className="min-w-0 flex-1">
                <span className="font-medium">Vence {formatDay(batch.expires_on)}</span>
                <span className="text-xs text-muted-foreground">{batch.lot_code ? ` · lote ${batch.lot_code}` : ''} · ingresaron {batch.quantity}</span>
              </span>
              {batch.discarded_at ? (
                <Badge variant="outline">Descartado{batch.discarded_reason ? `: ${batch.discarded_reason}` : ''}</Badge>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">{batch.remaining > 0 ? `≈ ${batch.remaining} en stock` : 'Agotado (estimado)'}</span>
                  <Badge variant="secondary" className={BATCH_STATUS_STYLES[batch.status]}>{BATCH_STATUS_LABELS[batch.status]}</Badge>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={batch.discarded_at ? 'Volver a contar el lote' : 'Descartar lote'}
                onClick={() => void act(batch.id, batch.discarded_at ? 'restore' : 'discard')}
              >
                {batch.discarded_at ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

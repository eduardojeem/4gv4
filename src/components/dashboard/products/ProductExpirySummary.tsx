'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { CalendarClock, AlertTriangle, RefreshCw } from 'lucide-react'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BATCH_STATUS_LABELS } from '@/lib/inventory/batches'

const batchSchema = z.object({
  id: z.string(), variant_id: z.string().nullable(), lot_code: z.string().nullable(),
  expires_on: z.string().date(), remaining: z.number().finite().nonnegative(),
  status: z.enum(['expired', 'week', 'month', 'ok']), discarded_at: z.string().nullable(),
  variant_name: z.string().nullable().optional(),
})
const payloadSchema = z.object({ available: z.boolean(), batches: z.array(batchSchema) })
type Payload = z.infer<typeof payloadSchema>
type Load = { key: string; payload?: Payload; error?: string }

/** Solo lectura: el stock por lote es estimado para toda la empresa. */
export function ProductExpirySummary({ productId, variantId, expected = false }: { productId: string; variantId?: string; expected?: boolean }) {
  const { scope, currentScope, organizationId } = useTenantScope()
  const key = `${scope}:${productId}`
  const [load, setLoad] = useState<Load | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!organizationId) return
    const controller = new AbortController()
    let active = true
    void (async () => {
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(productId)}/batches`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 403 ? 'No tenés acceso a los lotes de este producto.' : 'No se pudieron consultar los vencimientos.')
        const result = payloadSchema.safeParse(await response.json())
        if (!result.success) throw new Error('La información de vencimientos está incompleta.')
        if (active && currentScope.current === scope) setLoad({ key, payload: result.data })
      } catch (error) {
        if (active && currentScope.current === scope) setLoad({ key, error: error instanceof Error ? error.message : 'No se pudieron consultar los vencimientos.' })
      }
    })()
    return () => { active = false; controller.abort() }
  }, [productId, organizationId, key, scope, currentScope, retry])

  const current = load?.key === key ? load : null
  const payload = current?.payload
  const batches = payload?.batches.filter(b => !b.discarded_at && (!variantId || !b.variant_id || b.variant_id === variantId)) ?? []
  const remaining = batches.filter(b => b.remaining > 0)
  const needsAttention = remaining.some(b => b.status !== 'ok')
  if (payload?.available && !expected && batches.length === 0) return null

  return <section className="space-y-3 rounded-xl border bg-background p-4" aria-label="Lotes y vencimientos">
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Lotes y vencimientos</h3><Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Actualizar vencimientos" title="Actualizar vencimientos" disabled={!current} onClick={() => { setLoad(null); setRetry(n => n + 1) }}><RefreshCw className="h-4 w-4" aria-hidden="true" /></Button></div>
    <p className="text-xs leading-relaxed text-muted-foreground">Datos de toda la empresa. El stock por lote es estimado: las ventas no identifican el lote entregado.</p>
    {!current && <p role="status" className="text-sm text-muted-foreground">Consultando vencimientos…</p>}
    {current?.error && <div role="alert" className="space-y-2 text-sm"><p>{current.error}</p><Button type="button" size="sm" variant="outline" onClick={() => { setLoad(null); setRetry(n => n + 1) }}><RefreshCw className="mr-2 h-4 w-4" />Reintentar vencimientos</Button></div>}
    {payload?.available === false && <p className="text-sm text-muted-foreground">Lotes y vencimientos no están disponibles en la base de datos. No se puede confirmar una fecha.</p>}
    {payload?.available && <>
      {needsAttention && <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />Hay lotes vencidos o próximos a vencer con stock estimado. Revisá el lote físico antes de cobrar o entregar.</p>}
      {remaining.length > 0 ? <ul className="max-h-56 divide-y overflow-y-auto overscroll-contain">
        {remaining.map(batch => <li key={batch.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums">{batch.expires_on.split('-').reverse().join('/')}</span><Badge variant={batch.status === 'expired' ? 'destructive' : 'outline'} className={batch.status === 'week' || batch.status === 'month' ? 'border-amber-500/50 bg-amber-500/10' : ''}>{batch.status === 'month' ? 'Vence en 30 días' : BATCH_STATUS_LABELS[batch.status]}</Badge></div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="break-all">Lote: <span className="font-medium">{batch.lot_code || 'Sin código'}</span></span><span>≈ {batch.remaining} unidades estimadas</span></div>
          {(batch.variant_name || (variantId && !batch.variant_id)) && <p className="break-words text-xs text-muted-foreground">{batch.variant_name || 'Lote sin variante asignada: verificá a qué presentación corresponde.'}</p>}
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{batches.length ? 'No hay lotes con stock estimado para esta selección.' : 'No hay lotes registrados para esta selección. No se puede confirmar su vencimiento.'}</p>}
    </>}
  </section>
}

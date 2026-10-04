'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BatchStatus, EstimatedBatch } from '@/lib/inventory/batches'
import { BATCH_STATUS_STYLES, formatDay } from '@/components/dashboard/products/ProductBatchesPanel'

type Row = EstimatedBatch & { product_name: string; variant_name: string | null; stock: number }

const SECTIONS: Array<{ status: BatchStatus; title: string; hint: string }> = [
  { status: 'expired', title: 'Vencidos', hint: 'Sacalos del estante y descartalos (ajustá el stock).' },
  { status: 'week', title: 'Vencen en 7 días', hint: 'Buen momento para una oferta.' },
  { status: 'month', title: 'Vencen este mes', hint: 'Priorizalos en la venta.' },
  { status: 'ok', title: 'Vencen en los próximos 60 días', hint: '' },
]

export function ExpirationsBoard() {
  const [rows, setRows] = useState<Row[]>([])
  const [available, setAvailable] = useState(true)
  const [tracked, setTracked] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inventory/expirations?days=60', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      setAvailable(body.available !== false)
      setRows(Array.isArray(body.batches) ? body.batches : [])
      setTracked(Number(body.tracked) || 0)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => SECTIONS.map((section) => ({ ...section, rows: rows.filter((row) => row.status === section.status) })), [rows])

  const discard = async (row: Row) => {
    const reason = window.prompt(`¿Descartar el lote de ${row.product_name} que vence el ${formatDay(row.expires_on)}?`, 'Vencido')
    if (reason === null) return
    const response = await fetch(`/api/products/${row.product_id}/batches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, action: 'discard', reason }),
    })
    if (!response.ok) {
      toast.error('No se pudo descartar el lote')
      return
    }
    toast.success('Lote descartado. Si lo sacaste del estante, ajustá el stock del producto.')
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vencimientos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lotes vencidos o por vencer que se estima que siguen en el estante (se vende primero lo que vence antes).</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
        </Button>
      </div>

      {!available && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Lotes y vencimientos todavía no están activados en la base de datos. Pedile al administrador de la plataforma que aplique la actualización.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {grouped.map((section) => (
          <Card key={section.status} className="rounded-xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{section.title}</p>
              <p className={cn('mt-1 text-2xl font-bold tabular-nums', section.status === 'expired' && section.rows.length > 0 && 'text-red-600')}>{section.rows.length}</p>
              <p className="text-xs text-muted-foreground">{section.rows.reduce((sum, row) => sum + row.remaining, 0)} unidades</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {tracked > 0 ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <CalendarClock className="h-8 w-8" />}
          {tracked > 0
            ? 'Nada vence en los próximos 60 días.'
            : <>Todavía no registraste lotes. Al crear un producto cargá el vencimiento del stock inicial, y en cada producto registrá los nuevos ingresos en <b>Inventario → Lotes y vencimientos</b>.</>}
        </div>
      ) : (
        grouped.filter((section) => section.rows.length > 0).map((section) => (
          <section key={section.status} className="space-y-2">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">
              {section.title} <span className="text-xs font-normal text-muted-foreground">{section.hint}</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {section.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <Link href={`/dashboard/products/${row.product_id}`} className="font-medium hover:underline">{row.product_name}{row.variant_name ? ` — ${row.variant_name}` : ''}</Link>
                    <span className="block text-xs text-muted-foreground">
                      Vence {formatDay(row.expires_on)}{row.lot_code ? ` · lote ${row.lot_code}` : ''} · ingresaron {row.quantity} el {formatDay(row.received_on)}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">≈ {row.remaining} en stock</span>
                  <Badge variant="secondary" className={BATCH_STATUS_STYLES[row.status]}>
                    {row.status === 'expired' ? `Vencido hace ${-row.daysLeft} d` : row.daysLeft === 0 ? 'Vence hoy' : `${row.daysLeft} días`}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => void discard(row)}>
                    <Trash2 className="h-3.5 w-3.5" /> Descartar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-xs text-muted-foreground">Los lotes que vencen en más de 60 días no se muestran.</p>
    </div>
  )
}

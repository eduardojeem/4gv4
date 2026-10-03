'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { serviceSku, type SuggestedService } from '@/lib/agenda/suggested-services'
import type { AgendaSettings } from '@/lib/agenda/agenda-server'

interface Row {
  name: string
  checked: boolean
  price: string
  duration: number
}

/**
 * Servicios típicos del rubro para cargar de una vez. Se crean como productos
 * con unidad «servicio» por la API normal (respeta límites del plan y SKU
 * únicos) y después se les guarda la duración en la agenda.
 */
export function SuggestedServicesCard({
  suggestions,
  currency,
  savedSettings,
  rubroLabel,
  onAdded,
}: {
  suggestions: SuggestedService[]
  currency: string
  /** La configuración tal como está guardada: se reenvía sin los cambios sin guardar del panel. */
  savedSettings: AgendaSettings
  rubroLabel: string
  onAdded: () => Promise<void> | void
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    suggestions.map((service) => ({
      name: service.name,
      checked: true,
      price: currency === 'PYG' ? String(service.pricePyg) : '',
      duration: service.durationMinutes,
    }))
  )
  const [adding, setAdding] = useState(false)
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const selected = rows.filter((row) => row.checked)
  const missingPrice = selected.some((row) => !(Number(row.price) > 0))

  const add = async () => {
    setAdding(true)
    const created: Array<{ id: string; duration: number }> = []
    try {
      for (const row of selected) {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            sku: serviceSku(row.name),
            sale_price: Number(row.price),
            purchase_price: 0,
            unit_measure: 'servicio',
            stock_quantity: 0,
            min_stock: 0,
            is_active: true,
            visibility: 'public',
          }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body?.data?.id) {
          toast.error(body?.error || `No se pudo crear «${row.name}»`)
          break
        }
        created.push({ id: body.data.id, duration: row.duration })
      }

      if (created.length > 0) {
        const response = await fetch('/api/agenda/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...savedSettings,
            services: created.map((service) => ({ product_id: service.id, duration_minutes: service.duration, online: true })),
          }),
        })
        if (!response.ok) toast.warning('Los servicios se crearon, pero revisá sus duraciones abajo y guardá.')
        else toast.success(created.length === 1 ? 'Servicio agregado' : `${created.length} servicios agregados`)
        await onAdded()
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Servicios típicos de {rubroLabel}</p>
          <p className="text-xs text-muted-foreground">Marcá los que ofrecés, ajustá precio y minutos, y agregalos en un clic. Después podés editarlos en Productos.</p>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.name} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <Checkbox checked={row.checked} onCheckedChange={(checked) => update(index, { checked: checked === true })} aria-label={`Agregar ${row.name}`} />
              <span className="truncate">{row.name}</span>
            </label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-8 w-28"
              value={row.price}
              placeholder="Precio"
              aria-label={`Precio de ${row.name}`}
              disabled={!row.checked}
              onChange={(event) => update(index, { price: event.target.value })}
            />
            <span className="flex items-center gap-1">
              <Input
                type="number"
                min={5}
                step={5}
                className="h-8 w-16"
                value={row.duration}
                aria-label={`Duración de ${row.name}`}
                disabled={!row.checked}
                onChange={(event) => update(index, { duration: Math.min(600, Math.max(5, Number(event.target.value) || 5)) })}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{missingPrice ? `Completá el precio (${currency}) de los marcados.` : `${selected.length} seleccionados`}</p>
        <Button size="sm" onClick={() => void add()} disabled={adding || selected.length === 0 || missingPrice}>
          {adding && <Loader2 className="h-4 w-4 animate-spin" />}
          Agregar servicios
        </Button>
      </div>
    </div>
  )
}

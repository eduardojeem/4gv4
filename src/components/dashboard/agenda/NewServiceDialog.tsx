'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { serviceSku } from '@/lib/agenda/suggested-services'
import type { AgendaSettings } from '@/lib/agenda/agenda-server'

const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180]

/**
 * Un servicio nuevo sin salir de la agenda. Se crea como producto con unidad
 * «servicio» por la API normal (respeta los límites del plan y el SKU único) y
 * después se le guarda la duración, igual que los servicios sugeridos.
 */
export function NewServiceDialog({
  open,
  onOpenChange,
  existingNames,
  savedSettings,
  defaultDuration,
  currency,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  /** La configuración tal como está guardada: se reenvía sin los cambios sin guardar del panel. */
  savedSettings: AgendaSettings
  defaultDuration: number
  currency: string
  onCreated: () => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState(String(DURATIONS.includes(defaultDuration) ? defaultDuration : 30))
  const [online, setOnline] = useState(true)
  const [saving, setSaving] = useState(false)

  const trimmed = name.trim()
  const duplicate = existingNames.some((other) => other.trim().toLowerCase() === trimmed.toLowerCase())
  // En guaraníes el punto separa miles («50.000»); en otras monedas, decimales.
  const priceValue = currency === 'PYG' ? Number(price.replace(/[.\s]/g, '')) : Number(price.replace(',', '.'))
  const priceOk = price.trim() !== '' && Number.isFinite(priceValue) && priceValue >= 0

  const create = async () => {
    if (!trimmed || duplicate || !priceOk) return
    setSaving(true)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          sku: serviceSku(trimmed),
          sale_price: priceValue,
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
        toast.error(body?.error || `No se pudo crear «${trimmed}»`)
        return
      }
      const configured = await fetch('/api/agenda/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...savedSettings, services: [{ product_id: body.data.id, duration_minutes: Number(duration), online }] }),
      }).then((res) => res.ok).catch(() => false)
      if (configured) toast.success(`«${trimmed}» agregado`)
      else toast.warning(`«${trimmed}» se creó, pero revisá su duración en la lista y guardá.`)
      setName('')
      setPrice('')
      onOpenChange(false)
      await onCreated()
    } catch {
      toast.error('No se pudo crear el servicio. Revisá tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(event) => { event.preventDefault(); void create() }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo servicio</DialogTitle>
            <DialogDescription>Queda en tu catálogo de servicios y, si querés, se puede reservar desde la tienda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-service-name">Nombre</Label>
            <Input id="new-service-name" autoFocus value={name} maxLength={120} placeholder="Ej.: Corte + lavado" onChange={(event) => setName(event.target.value)} aria-invalid={duplicate} />
            {trimmed && duplicate && <p className="text-xs text-destructive">Ya tenés un servicio con este nombre.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-service-price">Precio</Label>
              <Input id="new-service-price" inputMode="decimal" value={price} placeholder="Ej.: 50000" onChange={(event) => setPrice(event.target.value)} />
              {price.trim() !== '' && !priceOk && <p className="text-xs text-destructive">Poné un número.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Duración</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{DURATIONS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
            <span>
              <span className="block font-medium">Se puede reservar online</span>
              <span className="block text-xs text-muted-foreground">Aparece en la reserva de tu tienda.</span>
            </span>
            <Switch checked={online} onCheckedChange={setOnline} aria-label="Se puede reservar online" />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!trimmed || duplicate || !priceOk || saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Agregar servicio</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { DeliveryZoneOption } from '@/types/website-settings'

const MAX_DELIVERY_ZONES = 20

function createDeliveryZone(): DeliveryZoneOption {
  return {
    id: crypto.randomUUID(),
    name: '',
    cost: 5000,
  }
}

export function DeliveryZoneOptionsEditor({
  zones,
  onChange,
}: {
  zones: DeliveryZoneOption[]
  onChange: (zones: DeliveryZoneOption[]) => void
}) {
  const updateZone = (
    id: string,
    field: keyof Omit<DeliveryZoneOption, 'id'>,
    value: string | number
  ) => {
    onChange(zones.map((zone) => (
      zone.id === id ? { ...zone, [field]: value } : zone
    )))
  }

  const setFreeDelivery = (zone: DeliveryZoneOption, isFree: boolean) => {
    updateZone(zone.id, 'cost', isFree ? 0 : 5000)
  }

  const addZone = () => {
    if (zones.length >= MAX_DELIVERY_ZONES) return
    onChange([...zones, createDeliveryZone()])
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Zonas y tarifas</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            El cliente elegirá su zona y el carrito calculará el delivery automáticamente.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addZone}
          disabled={zones.length >= MAX_DELIVERY_ZONES}
          className="h-8 gap-1.5 rounded-md text-xs"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Agregar zona
        </Button>
      </div>

      {zones.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-dashed bg-background p-4">
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold">Todavía no agregaste zonas</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Sin zonas, el carrito usará el costo por defecto configurado arriba.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map((zone, index) => {
            const fieldPrefix = `delivery-zone-${zone.id}`
            const isFree = zone.cost === 0

            return (
              <fieldset key={zone.id} className="rounded-lg border bg-background p-3">
                <legend className="sr-only">Zona de cobertura {index + 1}</legend>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                    <p className="truncate text-xs font-semibold">
                      {zone.name.trim() || `Zona ${index + 1}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(zones.filter((item) => item.id !== zone.id))}
                    aria-label={`Eliminar zona ${index + 1}`}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_110px] sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-name`} className="text-xs">Zona o barrio</Label>
                    <Input
                      id={`${fieldPrefix}-name`}
                      value={zone.name}
                      onChange={(event) => updateZone(zone.id, 'name', event.target.value)}
                      placeholder="Ej. Encarnación"
                      maxLength={100}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-cost`} className="text-xs">Costo (Gs.)</Label>
                    <Input
                      id={`${fieldPrefix}-cost`}
                      type="number"
                      min={0}
                      max={9_999_999}
                      step={500}
                      value={isFree ? 0 : zone.cost}
                      onChange={(event) => updateZone(zone.id, 'cost', Number(event.target.value) || 0)}
                      disabled={isFree}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="flex h-9 items-center justify-between gap-2 rounded-md border px-3">
                    <Label htmlFor={`${fieldPrefix}-free`} className="cursor-pointer text-xs font-medium">
                      Gratis
                    </Label>
                    <Switch
                      id={`${fieldPrefix}-free`}
                      checked={isFree}
                      onCheckedChange={(checked) => setFreeDelivery(zone, checked)}
                      aria-label={`Delivery gratis para ${zone.name || `zona ${index + 1}`}`}
                    />
                  </div>
                </div>
              </fieldset>
            )
          })}
        </div>
      )}

      {zones.length >= MAX_DELIVERY_ZONES && (
        <p className="text-[11px] text-muted-foreground">
          Alcanzaste el máximo de {MAX_DELIVERY_ZONES} zonas.
        </p>
      )}
    </div>
  )
}

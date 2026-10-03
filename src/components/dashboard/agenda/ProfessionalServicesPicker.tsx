'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AgendaProfessional, AgendaService } from '@/lib/agenda/agenda-server'

/**
 * Qué servicios hace un profesional. Sin ninguno marcado hace todos: así
 * siguen funcionando las agendas que no lo configuran.
 */
export function ProfessionalServicesPicker({
  professional,
  services,
  onSaved,
}: {
  professional: AgendaProfessional
  services: AgendaService[]
  onSaved: (serviceIds: string[]) => void
}) {
  const saved = professional.service_ids ?? []
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(saved)
  const [saving, setSaving] = useState(false)
  const label = saved.length === 0 ? 'Todos los servicios' : `${saved.length} ${saved.length === 1 ? 'servicio' : 'servicios'}`

  const toggle = (id: string, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)))

  const save = async () => {
    setSaving(true)
    try {
      // Todos marcados equivale a «todos»: se guarda vacío para que los servicios nuevos también le apliquen.
      const serviceIds = selected.length === services.length ? [] : selected
      const response = await fetch('/api/agenda/professionals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: professional.id, service_ids: serviceIds }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar')
        return
      }
      onSaved(serviceIds)
      setOpen(false)
      toast.success(`Servicios de ${professional.name} guardados`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setSelected(saved.length ? saved : services.map((service) => service.product_id))
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" disabled={services.length === 0} aria-label={`Servicios que hace ${professional.name}: ${label}`}>
          <Scissors aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-sm font-semibold">¿Qué hace {professional.name}?</p>
          <p className="text-xs text-muted-foreground">En la reserva online solo aparece para estos servicios.</p>
        </div>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {services.map((service) => (
            <li key={service.product_id}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selected.includes(service.product_id)} onCheckedChange={(on) => toggle(service.product_id, on === true)} />
                <span className="truncate">{service.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(services.map((service) => service.product_id))}>
            Marcar todos
          </Button>
          <Button size="sm" className="h-8" onClick={() => void save()} disabled={saving || selected.length === 0}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

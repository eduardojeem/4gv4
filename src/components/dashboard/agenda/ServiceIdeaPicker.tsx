'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SERVICE_SPECIALTIES, SERVICE_SPECIALTY_LABELS, type ServiceSpecialty } from '@/lib/organization/service-specialties'
import { missingSuggestedServices } from '@/lib/agenda/suggested-services'

/** Browsing ideas never changes the organization's specialties or saves a service. */
export function ServiceIdeaPicker({ vertical, specialties, existingNames, onChoose }: {
  vertical: string | null | undefined
  specialties: readonly ServiceSpecialty[]
  existingNames: string[]
  onChoose: (name: string) => void
}) {
  const [category, setCategory] = useState<ServiceSpecialty | 'recommended'>('recommended')
  const suggestions = missingSuggestedServices(vertical, existingNames,
    category === 'recommended' ? specialties : [category])
  return (
    <section className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-label="Ideas para tu servicio">
      <div className="space-y-1.5">
        <Label htmlFor="new-service-type">Tipo de servicio</Label>
        <select id="new-service-type" value={category}
          onChange={event => setCategory(event.target.value as ServiceSpecialty | 'recommended')}
          className="border-input bg-background focus-visible:ring-ring min-h-11 w-full rounded-md border px-3 text-base focus-visible:outline-none focus-visible:ring-2">
          <option value="recommended">Según mi negocio</option>
          {SERVICE_SPECIALTIES.map(specialty => <option key={specialty} value={specialty}>
            {specialty === 'other' ? 'Servicio personalizado' : SERVICE_SPECIALTY_LABELS[specialty]}
          </option>)}
        </select>
        <p className="text-xs text-muted-foreground">Podés explorar otras especialidades sin cambiar el rubro de tu negocio.</p>
      </div>
      {suggestions.length > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map(suggestion => <Button key={suggestion.name} type="button" variant="outline"
          className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left"
          aria-label={`Usar ${suggestion.name}`} onClick={() => onChoose(suggestion.name)}>
          {suggestion.name}
        </Button>)}
      </div> : <p role="status" className="text-sm text-muted-foreground">
        {category === 'other' ? 'Escribí el nombre del servicio que ofrecés abajo.' : 'No hay ideas pendientes en esta selección. Podés escribir tu propio servicio.'}
      </p>}
      <p className="text-xs text-muted-foreground">Las ideas solo completan el nombre. El precio y el tiempo los definís vos.</p>
    </section>
  )
}

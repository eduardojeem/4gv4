'use client'

import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SERVICE_SPECIALTIES, SERVICE_SPECIALTY_LABELS, type ServiceSpecialty } from '@/lib/organization/service-specialties'
import { missingSuggestedServices } from '@/lib/agenda/suggested-services'

/** Browsing ideas never changes the organization's specialties or saves a service. */
export function ServiceIdeaPicker({ vertical, specialties, existingNames, selectedName, onChoose }: {
  vertical: string | null | undefined
  specialties: readonly ServiceSpecialty[]
  existingNames: string[]
  selectedName?: string
  onChoose: (name: string) => void
}) {
  const [category, setCategory] = useState<ServiceSpecialty | 'recommended'>('recommended')
  const suggestions = missingSuggestedServices(vertical, existingNames,
    category === 'recommended' ? specialties : [category])

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4" aria-label="Ideas para tu servicio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <Label htmlFor="new-service-type" className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Tipo de servicio
          </Label>
        </div>
        {suggestions.length > 0 && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground border">
            {suggestions.length} {suggestions.length === 1 ? 'idea disponible' : 'ideas disponibles'}
          </span>
        )}
      </div>

      <select
        id="new-service-type"
        value={category}
        onChange={event => setCategory(event.target.value as ServiceSpecialty | 'recommended')}
        className="border-input bg-background focus-visible:ring-ring min-h-10 w-full rounded-lg border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
      >
        <option value="recommended">Según mi negocio</option>
        {SERVICE_SPECIALTIES.map(specialty => (
          <option key={specialty} value={specialty}>
            {specialty === 'other' ? 'Servicio personalizado' : SERVICE_SPECIALTY_LABELS[specialty]}
          </option>
        ))}
      </select>

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map(suggestion => {
            const isChosen = selectedName?.trim().toLowerCase() === suggestion.name.toLowerCase()
            return (
              <Button
                key={suggestion.name}
                type="button"
                variant="outline"
                className={cn(
                  'h-auto min-h-10 justify-start gap-2 whitespace-normal rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
                  isChosen
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                    : 'bg-background hover:border-primary/50 hover:bg-primary/5'
                )}
                aria-label={`Usar ${suggestion.name}`}
                onClick={() => onChoose(suggestion.name)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">{suggestion.name}</span>
              </Button>
            )
          })}
        </div>
      ) : (
        <p role="status" className="rounded-lg border border-dashed bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
          {category === 'other'
            ? 'Escribí el nombre del servicio que ofrecés abajo.'
            : 'No hay ideas pendientes en esta selección. Podés escribir tu propio servicio.'}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Explorá otras especialidades sin cambiar tu rubro. Las ideas solo completan el nombre; el precio y el tiempo los definís vos.
      </p>
    </section>
  )
}

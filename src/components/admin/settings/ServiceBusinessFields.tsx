'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SERVICE_SPECIALTIES, SERVICE_SPECIALTY_LABELS, type ServiceBusinessDetails } from '@/lib/organization/service-specialties'

export function ServiceBusinessFields({ value, onChange, disabled = false, specialtiesOnly = false }: {
  value: ServiceBusinessDetails; onChange: (value: ServiceBusinessDetails) => void; disabled?: boolean
  specialtiesOnly?: boolean
}) {
  const specialties = value.serviceSpecialties ?? []
  return <fieldset disabled={disabled} className="space-y-4 rounded-lg border p-4">
    <legend className="px-2 text-sm font-semibold">Especialidades y atención</legend>
    <p className="text-xs text-muted-foreground">Podés ofrecer varias especialidades. Esto no cambia los servicios ni sus precios.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SERVICE_SPECIALTIES.map(item => <label key={item} className="flex items-center gap-2 text-sm">
        <Checkbox aria-label={SERVICE_SPECIALTY_LABELS[item]} disabled={disabled} checked={specialties.includes(item)}
          onCheckedChange={checked => onChange({ ...value, serviceSpecialties: checked === true ? [...specialties, item] : specialties.filter(s => s !== item) })} />
        {SERVICE_SPECIALTY_LABELS[item]}
      </label>)}
    </div>
    {!specialtiesOnly && <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="service-attention-mode">Dónde atendés</Label>
        <select id="service-attention-mode" className="h-10 w-full rounded-md border bg-background px-3 text-base" value={value.attentionMode ?? 'local'} onChange={e => onChange({ ...value, attentionMode: e.target.value as ServiceBusinessDetails['attentionMode'] })}>
          <option value="local">En el local</option><option value="home">A domicilio</option><option value="both">Local y domicilio</option>
        </select></div>
      <div className="space-y-1"><Label htmlFor="service-appointment-mode">Cómo recibís clientes</Label>
        <select id="service-appointment-mode" className="h-10 w-full rounded-md border bg-background px-3 text-base" value={value.appointmentMode ?? 'booking'} onChange={e => onChange({ ...value, appointmentMode: e.target.value as ServiceBusinessDetails['appointmentMode'] })}>
          <option value="booking">Con reserva</option><option value="walk_in">Sin turno</option><option value="both">Con reserva y sin turno</option>
        </select></div>
    </div>}
    {!specialtiesOnly && <p className="text-xs text-muted-foreground">Son datos de atención. Las reservas online requieren agenda, servicios y disponibilidad configurados; domicilio no agrega logística.</p>}
  </fieldset>
}

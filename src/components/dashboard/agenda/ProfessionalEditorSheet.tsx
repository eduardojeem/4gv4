'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { AgendaProfessional, AgendaProfessionalRate, AgendaService } from '@/lib/agenda/agenda-server'
import { ProfessionalPhotoButton } from '@/components/dashboard/agenda/ProfessionalPhotoButton'
import { ProfessionalScheduleEditor } from '@/components/dashboard/agenda/ProfessionalScheduleEditor'
import { ProfessionalRatesEditor } from '@/components/dashboard/agenda/ProfessionalRatesEditor'

export const PROFESSIONAL_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6']

export type EditorTab = 'perfil' | 'servicios' | 'horario' | 'tarifas'

type Props = {
  professional: AgendaProfessional | null
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: EditorTab
  services: AgendaService[]
  rates: AgendaProfessionalRate[]
  currency: string
  /** Horario individual, visibilidad online y tarifas (requieren la migración de reservas). */
  advanced: boolean
  /** Otros nombres del equipo, para avisar si se repite. */
  otherNames: string[]
  onUpdate: (patch: Partial<AgendaProfessional>) => Promise<boolean>
  onServicesSaved: (serviceIds: string[]) => void
  onRatesSaved: (rates: AgendaProfessionalRate[]) => void
}

/**
 * Todo lo de un profesional en un solo lugar: perfil, qué hace, cuándo atiende y
 * cuánto cobra. El padre le pone `key` por profesional y pestaña, así cada vez
 * abre en la pestaña pedida.
 */
export function ProfessionalEditorSheet({
  professional,
  open,
  onOpenChange,
  initialTab = 'perfil',
  services,
  rates,
  currency,
  advanced,
  otherNames,
  onUpdate,
  onServicesSaved,
  onRatesSaved,
}: Props) {
  const [tab, setTab] = useState<EditorTab>(initialTab)

  if (!professional) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <div className="flex items-center gap-3 pr-8">
            <ProfessionalPhotoButton
              professional={professional}
              className="h-12 w-12"
              onUploaded={async (url) => { if (await onUpdate({ photo_url: url })) toast.success('Foto actualizada') }}
            />
            <div className="min-w-0">
              <SheetTitle className="truncate">{professional.name}</SheetTitle>
              <SheetDescription>Tocá la foto para cambiarla. Se ve en tu tienda.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-4 grid h-auto grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="perfil" className="min-h-9">Perfil</TabsTrigger>
            <TabsTrigger value="servicios" className="min-h-9">Servicios</TabsTrigger>
            {advanced && <TabsTrigger value="horario" className="min-h-9">Horario</TabsTrigger>}
            {advanced && <TabsTrigger value="tarifas" className="min-h-9">Tarifas</TabsTrigger>}
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="perfil" className="mt-0">
              <ProfileForm key={professional.id} professional={professional} advanced={advanced} otherNames={otherNames} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="servicios" className="mt-0">
              <ServicesChecklist key={`${professional.id}:${(professional.service_ids ?? []).join(',')}`} professional={professional} services={services} onSaved={onServicesSaved} />
            </TabsContent>
            {advanced && (
              <TabsContent value="horario" className="mt-0">
                <ProfessionalScheduleEditor
                  key={`${professional.id}:${JSON.stringify(professional.opening_hours ?? null)}`}
                  name={professional.name}
                  value={professional.opening_hours ?? null}
                  onSave={async (hours) => {
                    const ok = await onUpdate({ opening_hours: hours })
                    if (ok) toast.success('Horario guardado')
                    return ok
                  }}
                />
              </TabsContent>
            )}
            {advanced && (
              <TabsContent value="tarifas" className="mt-0">
                <ProfessionalRatesEditor
                  key={professional.id}
                  professional={professional}
                  services={services}
                  rates={rates}
                  currency={currency}
                  onSaved={(saved) => { onRatesSaved(saved); toast.success('Tarifas guardadas') }}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function ProfileForm({
  professional,
  advanced,
  otherNames,
  onUpdate,
}: {
  professional: AgendaProfessional
  advanced: boolean
  otherNames: string[]
  onUpdate: (patch: Partial<AgendaProfessional>) => Promise<boolean>
}) {
  const [name, setName] = useState(professional.name)
  const [specialty, setSpecialty] = useState(professional.specialty ?? '')
  const [color, setColor] = useState(professional.color)
  const [active, setActive] = useState(professional.is_active)
  const [visible, setVisible] = useState(professional.online_visible !== false)
  const [saving, setSaving] = useState(false)

  const trimmed = name.trim()
  const duplicate = otherNames.some((other) => other.trim().toLowerCase() === trimmed.toLowerCase())
  const patch: Partial<AgendaProfessional> = {
    ...(trimmed !== professional.name ? { name: trimmed } : {}),
    ...(specialty.trim() !== (professional.specialty ?? '') ? { specialty: specialty.trim() || null } : {}),
    ...(color !== professional.color ? { color } : {}),
    ...(active !== professional.is_active ? { is_active: active } : {}),
    ...(advanced && visible !== (professional.online_visible !== false) ? { online_visible: visible } : {}),
  }
  const dirty = Object.keys(patch).length > 0

  const save = async () => {
    if (!trimmed) return
    setSaving(true)
    try {
      if (await onUpdate(patch)) toast.success(`${trimmed} guardado`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (dirty) void save() }}>
      <div className="space-y-1.5">
        <Label htmlFor="professional-name">Nombre</Label>
        <Input id="professional-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} aria-invalid={!trimmed || duplicate} />
        {!trimmed && <p className="text-xs text-destructive">Poné el nombre.</p>}
        {trimmed && duplicate && <p className="text-xs text-amber-700 dark:text-amber-300">Ya hay alguien con este nombre: agregá un apellido o inicial para distinguirlos en la agenda.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="professional-specialty">Especialidad</Label>
        <Input id="professional-specialty" value={specialty} maxLength={80} placeholder="Ej.: Barbero · fades y diseños" onChange={(event) => setSpecialty(event.target.value)} />
        <p className="text-xs text-muted-foreground">Se muestra en tu tienda debajo del nombre.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Color en la agenda</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PROFESSIONAL_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Color ${swatch}`}
              aria-pressed={color.toLowerCase() === swatch}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition', color.toLowerCase() === swatch && 'ring-2 ring-foreground')}
              style={{ backgroundColor: swatch }}
            >
              {color.toLowerCase() === swatch && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
            </button>
          ))}
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs text-muted-foreground">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Otro color" />
            Otro
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Así distinguís sus turnos de un vistazo.</p>
      </fieldset>

      <div className="space-y-3 rounded-xl border p-3">
        <label className="flex items-start justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Activo</span>
            <span className="block text-xs text-muted-foreground">Tiene su columna en la agenda. Si ya no trabaja, desactivalo: sus turnos pasados se conservan.</span>
          </span>
          <Switch checked={active} onCheckedChange={setActive} aria-label="Activo" />
        </label>
        {advanced && (
          <label className="flex items-start justify-between gap-3 border-t pt-3 text-sm">
            <span>
              <span className="font-medium">Se puede reservar online</span>
              <span className="block text-xs text-muted-foreground">Apagado, sigue en la agenda pero los clientes no lo eligen desde la tienda.</span>
            </span>
            <Switch checked={visible} onCheckedChange={setVisible} aria-label="Se puede reservar online" disabled={!active} />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={!dirty || !trimmed || saving} className="min-h-10">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar perfil
        </Button>
      </div>
    </form>
  )
}

function ServicesChecklist({
  professional,
  services,
  onSaved,
}: {
  professional: AgendaProfessional
  services: AgendaService[]
  onSaved: (serviceIds: string[]) => void
}) {
  const saved = professional.service_ids ?? []
  const [all, setAll] = useState(saved.length === 0)
  const [selected, setSelected] = useState<string[]>(saved.length ? saved : services.map((service) => service.product_id))
  const [saving, setSaving] = useState(false)

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay servicios. Cargalos en la sección «Servicios» y después elegí cuáles hace {professional.name}.</p>
  }

  const serviceIds = all || selected.length === services.length ? [] : selected
  const dirty = serviceIds.join(',') !== saved.join(',')
  const toggle = (id: string, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)))

  const save = async () => {
    setSaving(true)
    try {
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
      toast.success(`Servicios de ${professional.name} guardados`)
    } catch {
      toast.error('No se pudo guardar. Revisá tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
        <span>
          <span className="font-medium">Hace todos los servicios</span>
          <span className="block text-xs text-muted-foreground">También los que agregues más adelante.</span>
        </span>
        <Switch checked={all} onCheckedChange={setAll} aria-label="Hace todos los servicios" />
      </label>
      {!all && (
        <fieldset className="space-y-1">
          <legend className="mb-2 text-sm font-medium">¿Qué hace {professional.name}?</legend>
          {services.map((service) => (
            <label key={service.product_id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted/50">
              <Checkbox checked={selected.includes(service.product_id)} onCheckedChange={(on) => toggle(service.product_id, on === true)} />
              <span className="min-w-0 flex-1 truncate">{service.name}</span>
              <span className="text-xs text-muted-foreground">{service.duration_minutes} min</span>
            </label>
          ))}
          {selected.length === 0 && <p className="pt-1 text-xs text-destructive">Elegí al menos un servicio, o activá «Hace todos».</p>}
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground">En la reserva online solo aparece para estos servicios.</p>
      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving || (!all && selected.length === 0)} className="min-h-10">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar servicios
        </Button>
      </div>
    </div>
  )
}

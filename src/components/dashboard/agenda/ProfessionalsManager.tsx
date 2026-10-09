'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, Globe, Loader2, Pencil, Scissors, UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { AgendaProfessional, AgendaProfessionalRate, AgendaService } from '@/lib/agenda/agenda-server'
import { ProfessionalPhotoButton } from '@/components/dashboard/agenda/ProfessionalPhotoButton'
import { PROFESSIONAL_COLORS, ProfessionalEditorSheet, type EditorTab } from '@/components/dashboard/agenda/ProfessionalEditorSheet'

type Props = {
  professionals: AgendaProfessional[]
  services: AgendaService[]
  rates: AgendaProfessionalRate[]
  currency: string
  advanced: boolean
  onProfessionalsChange: (update: (current: AgendaProfessional[]) => AgendaProfessional[]) => void
  onRatesChange: (professionalId: string, rates: AgendaProfessionalRate[]) => void
}

/** Lo que hace, en una línea: «Todos los servicios» o «3 de 5 servicios». */
export function professionalServicesLabel(professional: AgendaProfessional, services: AgendaService[]) {
  const ids = (professional.service_ids ?? []).filter((id) => services.some((service) => service.product_id === id))
  if (ids.length === 0 || ids.length === services.length) return 'Todos los servicios'
  return `${ids.length} de ${services.length} ${services.length === 1 ? 'servicio' : 'servicios'}`
}

/** Orden de la agenda y de la tienda: el que se ve arriba, primero. */
export function sortProfessionals(list: AgendaProfessional[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function ProfessionalsManager({ professionals, services, rates, currency, advanced, onProfessionalsChange, onRatesChange }: Props) {
  const [editing, setEditing] = useState<{ id: string; tab: EditorTab } | null>(null)
  const [adding, setAdding] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [reordering, setReordering] = useState(false)

  const sorted = sortProfessionals(professionals)
  const active = sorted.filter((professional) => professional.is_active)
  const inactive = sorted.filter((professional) => !professional.is_active)
  const current = editing ? professionals.find((professional) => professional.id === editing.id) ?? null : null

  const patchProfessional = async (id: string, patch: Partial<AgendaProfessional>) => {
    if (Object.keys(patch).length === 0) return true
    try {
      const response = await fetch('/api/agenda/professionals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar')
        return false
      }
      // La respuesta no trae sus servicios: se conservan los que ya tenía.
      onProfessionalsChange((list) => list.map((item) => (item.id === id ? { ...item, ...body.professional } : item)))
      return true
    } catch {
      toast.error('No se pudo guardar. Revisá tu conexión.')
      return false
    }
  }

  /** Mueve uno lugar arriba o abajo entre los activos y guarda el orden de todos los que cambiaron. */
  const move = async (id: string, direction: -1 | 1) => {
    const index = active.findIndex((professional) => professional.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= active.length) return
    const reordered = [...active]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const order = [...reordered, ...inactive].map((professional, position) => ({ id: professional.id, sort_order: position }))
    const changed = order.filter(({ id: itemId, sort_order }) => professionals.find((item) => item.id === itemId)?.sort_order !== sort_order)
    const previous = professionals.map(({ id: itemId, sort_order }) => ({ id: itemId, sort_order }))
    onProfessionalsChange((list) => list.map((item) => ({ ...item, sort_order: order.find((row) => row.id === item.id)?.sort_order ?? item.sort_order })))
    setReordering(true)
    try {
      const results = await Promise.all(changed.map(({ id: itemId, sort_order }) =>
        fetch('/api/agenda/professionals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId, sort_order }) }).then((response) => response.ok).catch(() => false)))
      if (results.some((ok) => !ok)) throw new Error('order')
    } catch {
      onProfessionalsChange((list) => list.map((item) => ({ ...item, sort_order: previous.find((row) => row.id === item.id)?.sort_order ?? item.sort_order })))
      toast.error('No se pudo cambiar el orden. Probá de nuevo.')
    } finally {
      setReordering(false)
    }
  }

  const card = (professional: AgendaProfessional, position: number) => {
    const ownSchedule = advanced && professional.opening_hours != null
    const hiddenOnline = advanced && professional.is_active && professional.online_visible === false
    return (
      <li key={professional.id} className={cn('flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors', !professional.is_active && 'bg-muted/30')}>
        <ProfessionalPhotoButton
          professional={professional}
          className={cn('h-11 w-11 text-sm', !professional.is_active && 'opacity-60 grayscale')}
          onUploaded={async (url) => { if (await patchProfessional(professional.id, { photo_url: url })) toast.success('Foto actualizada') }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: professional.color }} aria-hidden="true" />
            <span className="truncate">{professional.name}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{professional.specialty || 'Sin especialidad'}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEditing({ id: professional.id, tab: 'servicios' })} className="inline-flex !min-h-0 !min-w-0 items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              <Scissors aria-hidden="true" className="h-3 w-3" />{professionalServicesLabel(professional, services)}
            </button>
            {advanced && (
              <button type="button" onClick={() => setEditing({ id: professional.id, tab: 'horario' })} className="inline-flex !min-h-0 !min-w-0 items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                <CalendarClock aria-hidden="true" className="h-3 w-3" />{ownSchedule ? 'Horario propio' : 'Horario de la tienda'}
              </button>
            )}
            {hiddenOnline && <Badge variant="outline" className="gap-1 text-[11px]"><Globe aria-hidden="true" className="h-3 w-3" />No se reserva online</Badge>}
            {!professional.is_active && <Badge variant="secondary" className="text-[11px]">Inactivo</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {professional.is_active && active.length > 1 && (
            <div className="flex flex-col">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={reordering || position === 0} onClick={() => void move(professional.id, -1)} aria-label={`Subir a ${professional.name}`}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={reordering || position === active.length - 1} onClick={() => void move(professional.id, 1)} aria-label={`Bajar a ${professional.name}`}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {professional.is_active ? (
            <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => setEditing({ id: professional.id, tab: 'perfil' })} aria-label={`Editar a ${professional.name}`}>
              <Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Editar</span>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => void patchProfessional(professional.id, { is_active: true }).then((ok) => ok && toast.success(`${professional.name} vuelve a atender`))}>
              Reactivar
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length === 0 ? 'Sin profesionales, la agenda es una sola columna.' : `${active.length} ${active.length === 1 ? 'persona atiende' : 'personas atienden'}. Cada una tiene su columna en la agenda, en este orden.`}
        </p>
        <Button type="button" onClick={() => setAdding(true)} className="min-h-10"><UserPlus className="h-4 w-4" /> Agregar profesional</Button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Users aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">¿Atienden varias personas?</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Agregá a cada una para que tenga su columna, sus servicios y, si querés, que el cliente elija con quién atenderse.</p>
          <Button type="button" variant="outline" className="mt-4 min-h-10" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Agregar el primero</Button>
        </div>
      ) : (
        <ul className="space-y-2">{active.map((professional, position) => card(professional, position))}</ul>
      )}

      {inactive.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowInactive((value) => !value)} aria-expanded={showInactive} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', showInactive && 'rotate-180')} />
            Inactivos ({inactive.length})
          </button>
          {showInactive && (
            <ul className="mt-2 space-y-2">{inactive.map((professional, position) => card(professional, position))}</ul>
          )}
        </div>
      )}

      <AddProfessionalDialog
        open={adding}
        onOpenChange={setAdding}
        existingNames={professionals.map((professional) => professional.name)}
        nextColor={PROFESSIONAL_COLORS[professionals.length % PROFESSIONAL_COLORS.length]}
        nextOrder={professionals.length}
        onCreated={(professional) => {
          onProfessionalsChange((list) => [...list, professional])
          // Recién creado: directo a elegir qué servicios hace.
          setEditing({ id: professional.id, tab: services.length > 0 ? 'servicios' : 'perfil' })
        }}
      />

      <ProfessionalEditorSheet
        key={editing ? `${editing.id}:${editing.tab}` : 'cerrado'}
        professional={current}
        open={Boolean(current)}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        initialTab={editing?.tab}
        services={services}
        rates={rates}
        currency={currency}
        advanced={advanced}
        otherNames={professionals.filter((professional) => professional.id !== current?.id).map((professional) => professional.name)}
        onUpdate={(patch) => (current ? patchProfessional(current.id, patch) : Promise.resolve(false))}
        onServicesSaved={(serviceIds) => current && onProfessionalsChange((list) => list.map((item) => (item.id === current.id ? { ...item, service_ids: serviceIds } : item)))}
        onRatesSaved={(saved) => current && onRatesChange(current.id, saved)}
      />
    </div>
  )
}

function AddProfessionalDialog({
  open,
  onOpenChange,
  existingNames,
  nextColor,
  nextOrder,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  nextColor: string
  nextOrder: number
  onCreated: (professional: AgendaProfessional) => void
}) {
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()
  const duplicate = existingNames.some((other) => other.trim().toLowerCase() === trimmed.toLowerCase())

  const create = async () => {
    if (!trimmed) return
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color: nextColor, sort_order: nextOrder, ...(specialty.trim() ? { specialty: specialty.trim() } : {}) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo agregar')
        return
      }
      toast.success(`${trimmed} agregado`)
      setName('')
      setSpecialty('')
      onOpenChange(false)
      onCreated({ service_ids: [], ...body.professional })
    } catch {
      toast.error('No se pudo agregar. Revisá tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(event) => { event.preventDefault(); void create() }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Agregar profesional</DialogTitle>
            <DialogDescription>Después elegís qué servicios hace, su horario y su foto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-professional-name">Nombre</Label>
            <Input id="new-professional-name" autoFocus value={name} maxLength={80} placeholder="Ej.: Juan" onChange={(event) => setName(event.target.value)} />
            {trimmed && duplicate && <p className="text-xs text-amber-700 dark:text-amber-300">Ya hay alguien con este nombre: agregá un apellido o inicial.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-professional-specialty">Especialidad <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="new-professional-specialty" value={specialty} maxLength={80} placeholder="Ej.: Barbero · fades" onChange={(event) => setSpecialty(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!trimmed || saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

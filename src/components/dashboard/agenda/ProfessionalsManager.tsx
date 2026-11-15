'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, Coins, Globe, Pencil, Scissors, UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgendaProfessional, AgendaProfessionalRate, AgendaService } from '@/lib/agenda/agenda-server'
import { ProfessionalPhotoButton } from '@/components/dashboard/agenda/ProfessionalPhotoButton'
import { ProfessionalEditorSheet, type EditorTab } from '@/components/dashboard/agenda/ProfessionalEditorSheet'
import { AddProfessionalDialog } from '@/components/dashboard/agenda/AddProfessionalDialog'
import { BarberSettlementDialog } from '@/components/dashboard/agenda/BarberSettlementDialog'

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
  const [settlementProfId, setSettlementProfId] = useState<string | null>(null)

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
      <li
        key={professional.id}
        className={cn(
          'flex flex-col gap-3.5 rounded-2xl border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 sm:flex-row sm:items-center sm:p-4',
          !professional.is_active && 'bg-muted/30 opacity-75',
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
          <ProfessionalPhotoButton
            professional={professional}
            className={cn('h-13 w-13 shrink-0 rounded-2xl text-base shadow-xs', !professional.is_active && 'opacity-60 grayscale')}
            onUploaded={async (url) => { if (await patchProfessional(professional.id, { photo_url: url })) toast.success('Foto actualizada') }}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-background shadow-xs"
                style={{ backgroundColor: professional.color }}
                aria-hidden="true"
              />
              <p className="truncate text-base font-bold text-foreground">{professional.name}</p>
              {professional.is_active ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Activo
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Inactivo
                </span>
              )}
            </div>
            <p className="truncate text-xs font-medium text-muted-foreground">{professional.specialty || 'Sin especialidad definida'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setEditing({ id: professional.id, tab: 'servicios' })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Scissors aria-hidden="true" className="h-3 w-3 text-primary" />
                <span>{professionalServicesLabel(professional, services)}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditing({ id: professional.id, tab: 'comisiones' })}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20"
                title="Configurar comisión del barbero"
              >
                <Coins aria-hidden="true" className="h-3 w-3" />
                <span>{professional.commission_rate_services != null ? `${professional.commission_rate_services}% comisión` : '50% comisión'}</span>
              </button>
              {advanced && (
                <button
                  type="button"
                  onClick={() => setEditing({ id: professional.id, tab: 'horario' })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <CalendarClock aria-hidden="true" className="h-3 w-3 text-primary" />
                  <span>{ownSchedule ? 'Horario propio' : 'Horario de la tienda'}</span>
                </button>
              )}
              {hiddenOnline && (
                <Badge variant="outline" className="gap-1 rounded-full text-[11px] text-amber-700 dark:text-amber-300">
                  <Globe aria-hidden="true" className="h-3 w-3" />
                  <span>Solo agenda interna</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 border-t pt-2.5 sm:border-t-0 sm:pt-0">
          {professional.is_active && active.length > 1 && (
            <div className="flex items-center rounded-xl border bg-background/80 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={reordering || position === 0}
                onClick={() => void move(professional.id, -1)}
                aria-label={`Subir a ${professional.name}`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={reordering || position === active.length - 1}
                onClick={() => void move(professional.id, 1)}
                aria-label={`Bajar a ${professional.name}`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {professional.is_active ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl font-semibold border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-2xs"
                onClick={() => setSettlementProfId(professional.id)}
                title="Calcular liquidación de turnos y comisiones"
              >
                <Coins className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Liquidar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl font-semibold shadow-2xs"
                onClick={() => setEditing({ id: professional.id, tab: 'perfil' })}
                aria-label={`Editar a ${professional.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl font-semibold"
              onClick={() =>
                void patchProfessional(professional.id, { is_active: true }).then(
                  (ok) => ok && toast.success(`${professional.name} vuelve a atender`),
                )
              }
            >
              Reactivar
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen superior */}
      <div className="grid grid-cols-3 gap-2.5 text-sm">
        <div className="rounded-xl border bg-muted/20 p-3">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Equipo activo</span>
          <strong className="mt-0.5 block text-lg font-bold tabular-nums">{active.length} <span className="text-xs font-normal text-muted-foreground">profesionales</span></strong>
        </div>
        <div className="rounded-xl border bg-muted/20 p-3">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Visibles online</span>
          <strong className="mt-0.5 block text-lg font-bold tabular-nums text-primary">{active.filter((person) => person.online_visible !== false).length}</strong>
        </div>
        <div className="rounded-xl border bg-muted/20 p-3">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Con foto</span>
          <strong className="mt-0.5 block text-lg font-bold tabular-nums">
            {active.filter((person) => Boolean(person.photo_url)).length} <span className="text-xs font-normal text-muted-foreground">de {active.length}</span>
          </strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          {active.length === 0
            ? 'Sin profesionales cargados, la agenda funciona en una sola columna general.'
            : `${active.length} ${active.length === 1 ? 'profesional atiende' : 'profesionales atienden'}. Cada uno tiene su propia columna en la agenda en el orden que indiques.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {active.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettlementProfId(active[0]?.id ?? 'all')}
              className="min-h-10 gap-2 rounded-xl font-semibold border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Coins className="h-4 w-4" />
              <span>Liquidación semanal</span>
            </Button>
          )}
          <Button type="button" onClick={() => setAdding(true)} className="min-h-10 gap-2 rounded-xl font-semibold shadow-xs">
            <UserPlus className="h-4 w-4" />
            <span>Agregar profesional</span>
          </Button>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/10 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-xs">
            <Users aria-hidden="true" className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-bold">¿Atienden varias personas en tu negocio?</p>
          <p className="mx-auto mt-1 max-w-sm text-xs sm:text-sm text-muted-foreground">
            Agregá a cada miembro del equipo para asignarle sus servicios, su columna en la agenda y permitir que los clientes elijan con quién atenderse.
          </p>
          <Button type="button" variant="outline" className="mt-4 min-h-10 rounded-xl font-semibold" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" />
            <span>Agregar el primero</span>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">{active.map((professional, position) => card(professional, position))}</ul>
      )}

      {inactive.length > 0 && (
        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => setShowInactive((value) => !value)}
            aria-expanded={showInactive}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', showInactive && 'rotate-180')} />
            <span>Inactivos ({inactive.length})</span>
          </button>
          {showInactive && (
            <ul className="mt-3 space-y-3">{inactive.map((professional, position) => card(professional, position))}</ul>
          )}
        </div>
      )}

      <AddProfessionalDialog
        open={adding}
        onOpenChange={setAdding}
        services={services}
        advanced={advanced}
        existingNames={professionals.map((professional) => professional.name)}
        usedColors={active.map((professional) => professional.color)}
        nextOrder={professionals.length}
        onCreated={(professional) => onProfessionalsChange((list) => [...list, professional])}
        onCompleteProfile={(professional) => setEditing({ id: professional.id, tab: 'perfil' })}
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
        onProfessionalSaved={(patch) => current && onProfessionalsChange(list => list.map(item => item.id === current.id ? {...item, ...patch} : item))}
        onUpdate={(patch) => (current ? patchProfessional(current.id, patch) : Promise.resolve(false))}
        onServicesSaved={(serviceIds) => current && onProfessionalsChange((list) => list.map((item) => (item.id === current.id ? { ...item, service_ids: serviceIds } : item)))}
        onRatesSaved={(saved) => current && onRatesChange(current.id, saved)}
      />

      {settlementProfId && (
        <BarberSettlementDialog
          open={Boolean(settlementProfId)}
          onOpenChange={(open) => { if (!open) setSettlementProfId(null) }}
          professionals={active.length > 0 ? active : professionals}
          currency={currency}
          defaultProfessionalId={settlementProfId}
        />
      )}
    </div>
  )
}


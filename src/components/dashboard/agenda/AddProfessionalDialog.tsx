'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AgendaProfessional, AgendaService } from '@/lib/agenda/agenda-server'
import { PROFESSIONAL_PHOTO_TYPES, professionalInitials, professionalPhotoProblem, uploadProfessionalPhoto } from '@/components/dashboard/agenda/ProfessionalPhotoButton'

export const PROFESSIONAL_PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6']

/** El primer color que nadie del equipo activo usa; si están todos, rota. */
export function suggestProfessionalColor(usedColors: string[]) {
  const used = new Set(usedColors.map((color) => color.toLowerCase()))
  return PROFESSIONAL_PALETTE.find((color) => !used.has(color)) ?? PROFESSIONAL_PALETTE[usedColors.length % PROFESSIONAL_PALETTE.length]
}

export type NewProfessionalDraft = {
  name: string
  specialty: string
  color: string
  allServices: boolean
  serviceIds: string[]
  onlineVisible: boolean
}

/** Qué falta o qué está mal, en palabras: el formulario lo muestra y no deja enviar. */
export function validateNewProfessional(draft: NewProfessionalDraft, existingNames: string[]) {
  const name = draft.name.trim()
  return {
    name: !name ? 'Poné el nombre.' : null,
    duplicate: name && existingNames.some((other) => other.trim().toLowerCase() === name.toLowerCase())
      ? 'Ya hay alguien con este nombre: agregá un apellido o inicial para distinguirlos en la agenda.'
      : null,
    services: !draft.allServices && draft.serviceIds.length === 0 ? 'Elegí al menos un servicio, o activá «Hace todos los servicios».' : null,
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: AgendaService[]
  /** Visibilidad online por profesional (requiere la migración de reservas). */
  advanced: boolean
  existingNames: string[]
  usedColors: string[]
  nextOrder: number
  onCreated: (professional: AgendaProfessional) => void
  /** Abre el editor completo (foto y horario) del recién creado. */
  onCompleteProfile: (professional: AgendaProfessional) => void
}

const emptyDraft = (color: string): NewProfessionalDraft => ({ name: '', specialty: '', color, allServices: true, serviceIds: [], onlineVisible: true })

/**
 * Alta de un profesional en un solo paso: quién es, qué hace y si se reserva
 * online. La foto y el horario propio se completan después, desde su ficha.
 */
export function AddProfessionalDialog({ open, onOpenChange, services, advanced, existingNames, usedColors, nextOrder, onCreated, onCompleteProfile }: Props) {
  const [draft, setDraft] = useState<NewProfessionalDraft>(() => emptyDraft(suggestProfessionalColor(usedColors)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  // La foto se elige antes de crear y se sube apenas existe el profesional.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview) }, [photo])

  const pickPhoto = (file: File | undefined) => {
    if (photoRef.current) photoRef.current.value = ''
    if (!file) return
    const problem = professionalPhotoProblem(file)
    setPhotoError(problem)
    if (problem) return
    setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  const set = (patch: Partial<NewProfessionalDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const problems = validateNewProfessional(draft, existingNames)
  const blocked = Boolean(problems.name || problems.services)
  const name = draft.name.trim()

  const reset = (colors: string[] = usedColors) => {
    setDraft(emptyDraft(suggestProfessionalColor(colors)))
    setError(null)
    setTouched(false)
    setPhoto(null)
    setPhotoError(null)
  }

  const close = (next: boolean) => {
    if (!next && !saving) reset()
    onOpenChange(next)
  }

  const create = async (another: boolean) => {
    setTouched(true)
    if (blocked) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/agenda/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color: draft.color,
          sort_order: nextOrder,
          ...(draft.specialty.trim() ? { specialty: draft.specialty.trim() } : {}),
          ...(advanced ? { online_visible: draft.onlineVisible } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body?.professional?.id) {
        setError(body?.error || 'No se pudo agregar. Probá de nuevo.')
        return
      }
      let professional: AgendaProfessional = { service_ids: [], ...body.professional }

      // Todos marcados equivale a «todos»: se guarda vacío para que los servicios nuevos también le apliquen.
      const serviceIds = draft.allServices || draft.serviceIds.length === services.length ? [] : draft.serviceIds
      if (serviceIds.length > 0) {
        const saved = await fetch('/api/agenda/professionals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: professional.id, service_ids: serviceIds }),
        }).then((res) => res.ok).catch(() => false)
        if (saved) professional = { ...professional, service_ids: serviceIds }
        else toast.warning(`${name} se agregó, pero no se guardaron sus servicios: elegilos desde «Editar».`)
      }

      if (photo) {
        const uploaded = await uploadProfessionalPhoto(photo.file, professional.id)
        const saved = 'url' in uploaded
          ? await fetch('/api/agenda/professionals', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: professional.id, photo_url: uploaded.url }),
            }).then((res) => res.ok).catch(() => false)
          : false
        if (saved && 'url' in uploaded) professional = { ...professional, photo_url: uploaded.url }
        else toast.warning(`${name} se agregó sin foto`, { description: 'error' in uploaded ? uploaded.error : 'Probá subirla desde «Editar».' })
      }

      onCreated(professional)
      toast.success(`${name} agregado`, {
        description: photo ? 'Podés sumarle un horario propio.' : 'Podés sumarle foto y horario propio.',
        action: { label: 'Completar perfil', onClick: () => onCompleteProfile(professional) },
      })
      if (another) {
        reset([...usedColors, draft.color])
        // Para cargar al equipo de corrido: el cursor vuelve al nombre.
        requestAnimationFrame(() => nameRef.current?.focus())
      } else {
        reset([...usedColors, draft.color])
        onOpenChange(false)
      }
    } catch {
      setError('No se pudo agregar. Revisá tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  const toggleService = (id: string, on: boolean) => set({ serviceIds: on ? [...draft.serviceIds, id] : draft.serviceIds.filter((item) => item !== id) })
  const servicesSummary = draft.allServices || draft.serviceIds.length === services.length
    ? 'Todos los servicios'
    : `${draft.serviceIds.length} de ${services.length} servicios`

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[92dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <form
          onSubmit={(event) => { event.preventDefault(); void create(false) }}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle>Agregar profesional</DialogTitle>
            <DialogDescription>Quién atiende, qué hace y su foto. El horario propio lo sumás después.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Así se va a ver en la lista y en la tienda. */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                aria-label={photo ? 'Cambiar la foto' : 'Elegir foto de perfil'}
                className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{ backgroundColor: draft.color }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true">{name ? professionalInitials(name) : '?'}</span>
                )}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/55 transition-colors group-hover:bg-black/70">
                  <Camera className="h-3.5 w-3.5" />
                </span>
              </button>
              <input ref={photoRef} type="file" accept={PROFESSIONAL_PHOTO_TYPES.join(',')} className="hidden" aria-label="Foto de perfil" onChange={(event) => pickPhoto(event.target.files?.[0])} />
              <span aria-hidden="true" className="min-w-0">
                <span className="block truncate font-semibold">{name || 'Nombre del profesional'}</span>
                <span className="block truncate text-xs text-muted-foreground">{draft.specialty.trim() || 'Especialidad'}</span>
                {services.length > 0 && <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{servicesSummary}</span>}
              </span>
            </div>
            <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <button type="button" onClick={() => photoRef.current?.click()} className="font-semibold text-primary hover:underline">
                {photo ? 'Cambiar foto' : 'Elegir foto de perfil'}
              </button>
              {photo && <button type="button" onClick={() => setPhoto(null)} className="text-muted-foreground hover:text-foreground hover:underline">Quitar</button>}
              <span className="text-muted-foreground">Opcional · JPG, PNG o WebP hasta 5 MB. Se ve en tu tienda.</span>
            </div>
            {photoError && <p role="alert" className="-mt-3 text-xs text-destructive">{photoError}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="new-professional-name">Nombre <span aria-hidden="true" className="text-destructive">*</span></Label>
              <Input
                id="new-professional-name"
                ref={nameRef}
                autoFocus
                required
                value={draft.name}
                maxLength={80}
                placeholder="Ej.: Juan Pérez"
                autoComplete="off"
                onChange={(event) => set({ name: event.target.value })}
                onBlur={() => setTouched(true)}
                aria-invalid={Boolean((touched && problems.name) || problems.duplicate)}
                aria-describedby="new-professional-name-help"
              />
              <p id="new-professional-name-help" className={cn('text-xs', touched && problems.name ? 'text-destructive' : problems.duplicate ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                {touched && problems.name ? problems.name : problems.duplicate ?? 'Así aparece en la agenda y en tu tienda.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-professional-specialty">Especialidad <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="new-professional-specialty" value={draft.specialty} maxLength={80} placeholder="Ej.: Barbero · fades y diseños" autoComplete="off" onChange={(event) => set({ specialty: event.target.value })} />
              <p className="text-xs text-muted-foreground">Se muestra en tu tienda debajo del nombre.</p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Color en la agenda</legend>
              <div className="flex flex-wrap gap-2">
                {PROFESSIONAL_PALETTE.map((swatch) => {
                  const selected = draft.color.toLowerCase() === swatch
                  const inUse = usedColors.some((color) => color.toLowerCase() === swatch)
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => set({ color: swatch })}
                      aria-label={`Color ${swatch}${inUse ? ' (ya lo usa otro profesional)' : ''}`}
                      aria-pressed={selected}
                      title={inUse ? 'Ya lo usa otro profesional' : undefined}
                      className={cn('relative flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition', selected && 'ring-2 ring-foreground', inUse && !selected && 'opacity-40')}
                      style={{ backgroundColor: swatch }}
                    >
                      {selected && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">Los colores más apagados ya los usa alguien del equipo.</p>
            </fieldset>

            {services.length > 0 && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">¿Qué servicios hace?</legend>
                <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
                  <span>
                    <span className="block font-medium">Hace todos los servicios</span>
                    <span className="block text-xs text-muted-foreground">También los que agregues más adelante.</span>
                  </span>
                  <Switch
                    checked={draft.allServices}
                    onCheckedChange={(on) => set({ allServices: on, serviceIds: on ? [] : services.map((service) => service.product_id) })}
                    aria-label="Hace todos los servicios"
                  />
                </label>
                {!draft.allServices && (
                  <div className="space-y-1 rounded-xl border p-2">
                    {services.map((service) => (
                      <label key={service.product_id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted/50">
                        <Checkbox checked={draft.serviceIds.includes(service.product_id)} onCheckedChange={(on) => toggleService(service.product_id, on === true)} />
                        <span className="min-w-0 flex-1 truncate">{service.name}</span>
                        <span className="text-xs text-muted-foreground">{service.duration_minutes} min</span>
                      </label>
                    ))}
                    {problems.services && <p role="alert" className="px-2 pt-1 text-xs text-destructive">{problems.services}</p>}
                  </div>
                )}
              </fieldset>
            )}

            {advanced && (
              <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>
                  <span className="block font-medium">Se puede reservar online</span>
                  <span className="block text-xs text-muted-foreground">Apagado, tiene su columna en la agenda pero los clientes no lo eligen desde la tienda.</span>
                </span>
                <Switch checked={draft.onlineVisible} onCheckedChange={(on) => set({ onlineVisible: on })} aria-label="Se puede reservar online" />
              </label>
            )}

            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2 border-t px-5 py-3 sm:justify-between">
            {/* En el celular cierra la ✕ de arriba: los dos botones quedan lado a lado. */}
            <Button type="button" variant="ghost" className="hidden sm:inline-flex" onClick={() => close(false)} disabled={saving}>Cancelar</Button>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button type="button" variant="outline" aria-label="Guardar y agregar otro" disabled={saving || blocked} onClick={() => void create(true)}>
                <span className="sm:hidden">Agregar otro</span>
                <span className="hidden sm:inline">Guardar y agregar otro</span>
              </Button>
              <Button type="submit" disabled={saving || blocked}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Agregar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

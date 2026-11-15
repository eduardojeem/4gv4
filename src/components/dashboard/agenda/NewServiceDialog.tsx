'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarCheck2,
  Clock,
  Eye,
  Globe,
  ImagePlus,
  Loader2,
  Scissors,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { normalizeServiceName } from '@/lib/agenda/suggested-services'
import { ServiceIdeaPicker } from './ServiceIdeaPicker'
import { createAgendaService, serviceCreationDefinitelyRejected, type AgendaServiceCreateInput } from '@/lib/agenda/service-creation'
import {
  SERVICE_COVER_TYPES,
  imagesWithCover,
  serviceCoverProblem,
  serviceWebsitePayload,
  uploadServiceCover,
} from '@/lib/agenda/service-cover'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

const DURATION_PRESETS = [
  { minutes: 15, label: '15 min' },
  { minutes: 20, label: '20 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 90, label: '1 h 30' },
] as const

function formatDurationBadge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

/**
 * Un servicio nuevo sin salir de la agenda. Se crea como producto con unidad
 * «servicio» y su duración se guardan juntos, sin reenviar horarios.
 */
export function NewServiceDialog({
  open,
  onOpenChange,
  existingNames,
  currency,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  currency: string
  onCreated: () => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [online, setOnline] = useState(true)
  const [catalogVisible, setCatalogVisible] = useState(true)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const attempt = useRef<AgendaServiceCreateInput | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const { businessVertical, serviceSpecialties } = useSubscriptionStatus()

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  const trimmed = name.trim()
  const duplicate = existingNames.some((other) => normalizeServiceName(other) === normalizeServiceName(trimmed))
  const durationNum = Number(duration)
  const durationOk = duration.trim() !== '' && Number.isInteger(durationNum) && durationNum >= 5 && durationNum <= 600
  // En guaraníes el punto separa miles («50.000»); en otras monedas, decimales.
  const priceValue = currency === 'PYG' ? Number(price.replace(/[.\s]/g, '')) : Number(price.replace(',', '.'))
  const priceOk = price.trim() !== '' && Number.isFinite(priceValue) && priceValue >= 0 && priceValue <= 99999999.99 && Math.abs(priceValue * 100 - Math.round(priceValue * 100)) < 0.000001
  const formReady = Boolean(trimmed) && !duplicate && priceOk && durationOk

  const formattedPrice = priceOk
    ? priceValue === 0
      ? 'Gratuito'
      : formatCurrency(priceValue, { currency })
    : null

  const clearCover = () => {
    setCoverFile(null)
    setCoverError(null)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const create = async () => {
    if (pending.current || !formReady) return
    pending.current = true
    setSaving(true)
    try {
      attempt.current ??= { requestKey: crypto.randomUUID(), name: trimmed, price: priceValue, durationMinutes: durationNum, online, catalogVisible }
      const result = await createAgendaService(attempt.current)

      if (coverFile) {
        try {
          const uploadedUrl = await uploadServiceCover(coverFile)
          const coverResp = await fetch(`/api/products/${encodeURIComponent(result.service.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              serviceWebsitePayload({
                visible: catalogVisible,
                images: imagesWithCover([], uploadedUrl),
              })
            ),
          })
          if (!coverResp.ok) throw new Error('cover_save_failed')
          toast.success(`«${trimmed}» agregado con su portada`)
        } catch {
          toast.warning(`«${trimmed}» fue creado, pero no se pudo guardar la portada. Podés subirla en Foto y página web.`)
        }
      } else {
        toast.success(`«${trimmed}» agregado`)
      }

      attempt.current = null
      setRetrying(false)
      setName('')
      setPrice('')
      setDuration('')
      setOnline(true)
      setCatalogVisible(true)
      clearCover()
      onOpenChange(false)
      await Promise.resolve().then(onCreated).catch(() => toast.warning('El servicio está creado. Recargá la lista para verlo.'))
    } catch (error) {
      const rejected = !retrying && serviceCreationDefinitelyRejected(error)
      if (rejected) attempt.current = null
      setRetrying(!rejected)
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el alta. Reintentá con los mismos datos.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending.current) onOpenChange(next) }}>
      <DialogContent className="max-h-[92dvh] overflow-hidden p-0 sm:max-w-2xl">
        <form onSubmit={(event) => { event.preventDefault(); void create() }} className="flex max-h-[92dvh] min-h-0 flex-col">
          {/* Header */}
          <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 py-4 pr-12 text-left sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Scissors className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight">Nuevo servicio</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Queda en tu catálogo de servicios y, si querés, se puede reservar online desde tu tienda.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
            {retrying && (
              <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-foreground">
                Conservamos los datos del intento anterior. Reintentá para confirmar sin duplicar.
              </p>
            )}

            <fieldset disabled={saving || retrying} className="space-y-5">
              {/* 1. Ideas rápidas */}
              <ServiceIdeaPicker
                vertical={businessVertical}
                specialties={serviceSpecialties}
                existingNames={existingNames}
                selectedName={name}
                onChoose={(suggestion) => {
                  setName(suggestion)
                  setPrice('')
                  setDuration('')
                }}
              />

              {/* 2. Nombre, Precio y Duración */}
              <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-2xs" aria-label="Datos principales">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Datos principales</span>
                  <span className="text-[11px] text-muted-foreground">Obligatorios</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="new-service-name" className="font-semibold">Nombre</Label>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{name.length}/120</span>
                  </div>
                  <Input
                    id="new-service-name"
                    className="min-h-11 text-base md:text-sm"
                    disabled={saving}
                    value={name}
                    maxLength={120}
                    placeholder="Ej.: Corte degradado, manicura o diseño de cejas"
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={duplicate}
                    aria-describedby={duplicate ? 'new-service-duplicate' : undefined}
                  />
                  {trimmed && duplicate && (
                    <p id="new-service-duplicate" role="alert" className="text-xs font-medium text-destructive">
                      Ya tenés un servicio con este nombre.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Precio */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="new-service-price" className="font-semibold">Precio</Label>
                      <button
                        type="button"
                        onClick={() => setPrice('0')}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                          price.trim() === '0'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Gratis (0)
                      </button>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                        <Tag className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
                        {currency === 'PYG' ? 'Gs.' : currency}
                      </span>
                      <Input
                        id="new-service-price"
                        className="min-h-11 pl-12 text-base tabular-nums md:text-sm"
                        disabled={saving}
                        inputMode="decimal"
                        value={price}
                        placeholder={`Precio en ${currency}`}
                        onChange={(event) => setPrice(event.target.value)}
                        aria-describedby="new-service-price-help"
                        aria-invalid={price.trim() !== '' && !priceOk}
                      />
                    </div>
                    <p id="new-service-price-help" className="text-xs text-muted-foreground">
                      {currency === 'PYG' ? 'En guaraníes. Ej.: 50.000. Usá 0 si es gratuito.' : `En ${currency}. Usá 0 si es gratuito.`}
                    </p>
                    {price.trim() !== '' && !priceOk && (
                      <p role="alert" className="text-xs font-medium text-destructive">Poné un número.</p>
                    )}
                  </div>

                  {/* Duración */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new-service-duration" className="font-semibold">Duración</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
                      </span>
                      <Input
                        id="new-service-duration"
                        className="min-h-11 pl-9 pr-12 text-base tabular-nums md:text-sm"
                        type="number"
                        min={5}
                        max={600}
                        step={1}
                        inputMode="numeric"
                        value={duration}
                        placeholder="Minutos (5–600)"
                        onChange={(event) => setDuration(event.target.value)}
                        aria-invalid={duration !== '' && !durationOk}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                        min
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label="Duraciones rápidas">
                      {DURATION_PRESETS.map((preset) => {
                        const active = duration === String(preset.minutes)
                        return (
                          <button
                            key={preset.minutes}
                            type="button"
                            onClick={() => setDuration(String(preset.minutes))}
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                              active
                                ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                                : 'border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                            )}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                    {duration !== '' && !durationOk && (
                      <p role="alert" className="text-xs font-medium text-destructive">Entre 5 y 600 minutos.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* 3. Portada opcional */}
              <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs" aria-label="Portada opcional">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Portada en la tienda</span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Opcional</span>
                </div>

                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="flex aspect-video w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/60 text-[11px] text-muted-foreground">
                    {coverPreview
                      // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
                      ? <img src={coverPreview} alt="Vista previa de portada" className="h-full w-full object-cover" />
                      : <span className="px-2 text-center">Sin portada</span>}
                  </div>
                  <div className="min-w-0 flex-1 basis-44 space-y-2">
                    <input
                      ref={coverInputRef}
                      id="new-service-cover"
                      type="file"
                      accept={SERVICE_COVER_TYPES.join(',')}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        const problem = serviceCoverProblem(file)
                        if (problem) {
                          setCoverError(problem)
                          event.target.value = ''
                          return
                        }
                        setCoverError(null)
                        setCoverFile(file)
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => coverInputRef.current?.click()}>
                        <ImagePlus className="h-4 w-4" />
                        {coverFile ? 'Cambiar foto' : 'Subir foto de portada'}
                      </Button>
                      {coverFile && (
                        <Button type="button" size="sm" variant="ghost" onClick={clearCover}>
                          <Trash2 className="h-4 w-4" /> Quitar
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Formato 16:9 recomendado (JPG, PNG, WebP o AVIF, máx. 5 MB). También podés cargarla luego en «Foto y página web».
                    </p>
                    {coverError && <p role="alert" className="text-xs font-medium text-destructive">{coverError}</p>}
                  </div>
                </div>
              </section>

              {/* 4. Visibilidad y reservas */}
              <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs" aria-label="Visibilidad y reservas">
                <span className="block text-xs font-semibold uppercase tracking-wide text-foreground">Visibilidad y reservas online</span>

                <label className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3.5 text-sm cursor-pointer transition-colors hover:bg-muted/20">
                  <span className="flex items-start gap-2.5">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold">Mostrar en la página web</span>
                      <span className="block text-xs text-muted-foreground">
                        Los clientes podrán verlo en tu catálogo y en la sección Nuestros servicios.
                      </span>
                    </span>
                  </span>
                  <Switch checked={catalogVisible} onCheckedChange={setCatalogVisible} aria-label="Mostrar en catálogo" />
                </label>

                <label className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3.5 text-sm cursor-pointer transition-colors hover:bg-muted/20">
                  <span className="flex items-start gap-2.5">
                    <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold">Se puede reservar online</span>
                      <span className="block text-xs text-muted-foreground">
                        {catalogVisible
                          ? 'Habilita turnos online para este servicio cuando la agenda web esté activa.'
                          : 'Activá «Mostrar en la página web» para que los clientes puedan elegirlo al reservar online.'}
                      </span>
                    </span>
                  </span>
                  <Switch disabled={saving} checked={online} onCheckedChange={setOnline} aria-label="Se puede reservar online" />
                </label>
              </section>
            </fieldset>

            {/* Vista previa / Resumen en vivo */}
            {formReady && (
              <div
                aria-label="Resumen del servicio"
                className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-2xs"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Así quedará cargado</span>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#111116] text-primary">
                    {coverPreview
                      // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
                      ? <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                      : <Sparkles className="h-5 w-5" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-bold text-foreground">{trimmed}</p>
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">
                      {formattedPrice} · {formatDurationBadge(durationNum)} ({duration} min)
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold', catalogVisible ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                        Web: {catalogVisible ? 'sí' : 'no'}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold', online && catalogVisible ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                        Reserva online: {online ? 'sí' : 'no'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              El personal con «Todos los servicios» incluye este nuevo servicio automáticamente. Revisá{' '}
              <a
                href="#equipo"
                className="font-medium underline hover:text-foreground"
                onClick={(event) => {
                  if (pending.current) event.preventDefault()
                  else onOpenChange(false)
                }}
              >
                Quién atiende
              </a>{' '}
              para ajustar tarifas y asignaciones.
            </p>
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-3.5 sm:px-6">
            <Button className="min-h-11" type="button" disabled={saving} variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="min-h-11 gap-2 sm:px-6" type="submit" disabled={!formReady || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar servicio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

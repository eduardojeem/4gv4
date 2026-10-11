'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { normalizeServiceName } from '@/lib/agenda/suggested-services'
import { ServiceIdeaPicker } from './ServiceIdeaPicker'
import { createAgendaService, serviceCreationDefinitelyRejected, type AgendaServiceCreateInput } from '@/lib/agenda/service-creation'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

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
  const attempt = useRef<AgendaServiceCreateInput | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const { businessVertical, serviceSpecialties } = useSubscriptionStatus()

  const trimmed = name.trim()
  const duplicate = existingNames.some((other) => normalizeServiceName(other) === normalizeServiceName(trimmed))
  const durationOk = Number.isInteger(Number(duration)) && Number(duration) >= 5 && Number(duration) <= 600
  // En guaraníes el punto separa miles («50.000»); en otras monedas, decimales.
  const priceValue = currency === 'PYG' ? Number(price.replace(/[.\s]/g, '')) : Number(price.replace(',', '.'))
  const priceOk = price.trim() !== '' && Number.isFinite(priceValue) && priceValue >= 0 && priceValue <= 99999999.99 && Math.abs(priceValue * 100 - Math.round(priceValue * 100)) < 0.000001

  const create = async () => {
    if (pending.current || !trimmed || duplicate || !priceOk || !durationOk) return
    pending.current = true
    setSaving(true)
    try {
      attempt.current ??= { requestKey: crypto.randomUUID(), name: trimmed, price: priceValue, durationMinutes: Number(duration), online, catalogVisible }
      await createAgendaService(attempt.current)
      toast.success(`«${trimmed}» agregado`)
      attempt.current = null
      setRetrying(false)
      setName('')
      setPrice('')
      setDuration('')
      setOnline(true)
      setCatalogVisible(true)
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
      <DialogContent className="max-h-[90dvh] overflow-hidden p-0 sm:max-w-2xl">
        <form onSubmit={(event) => { event.preventDefault(); void create() }} className="flex max-h-[90dvh] min-h-0 flex-col">
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 text-left">
            <DialogTitle>Nuevo servicio</DialogTitle>
            <DialogDescription>Queda en tu catálogo de servicios y, si querés, se puede reservar desde la tienda.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          {retrying && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">Conservamos los datos del intento. Reintentá para confirmar sin duplicar.</p>}
          <fieldset disabled={saving || retrying} className="space-y-4">
          <ServiceIdeaPicker vertical={businessVertical} specialties={serviceSpecialties} existingNames={existingNames}
            onChoose={suggestion => { setName(suggestion); setPrice(''); setDuration('') }} />
          <div className="space-y-1.5">
            <Label htmlFor="new-service-name">Nombre</Label>
            <Input id="new-service-name" className="min-h-11 text-base md:text-sm" disabled={saving} value={name} maxLength={120} placeholder="Ej.: Corte degradado, manicura o diseño de cejas" onChange={(event) => setName(event.target.value)} aria-invalid={duplicate} aria-describedby={duplicate ? 'new-service-duplicate' : undefined} />
            {trimmed && duplicate && <p id="new-service-duplicate" role="alert" className="text-xs text-destructive">Ya tenés un servicio con este nombre.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-service-price">Precio</Label>
              <Input id="new-service-price" className="min-h-11 text-base md:text-sm" disabled={saving} inputMode="decimal" value={price} placeholder={`Precio en ${currency}`} onChange={(event) => setPrice(event.target.value)} aria-describedby="new-service-price-help" aria-invalid={price.trim() !== '' && !priceOk} />
              <p id="new-service-price-help" className="text-xs text-muted-foreground">{currency === 'PYG' ? 'En guaraníes. Ej.: 50.000. Usá 0 si es gratuito.' : `En ${currency}. Usá 0 si es gratuito.`}</p>
              {price.trim() !== '' && !priceOk && <p className="text-xs text-destructive">Poné un número.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-service-duration">Duración</Label>
              <Input id="new-service-duration" className="min-h-11 text-base md:text-sm" type="number" min={5} max={600} step={1} inputMode="numeric" value={duration} placeholder="Minutos (5–600)" onChange={event => setDuration(event.target.value)} aria-invalid={duration !== '' && !durationOk} />
              <p className="text-xs text-muted-foreground">Elegí la duración: entre 5 y 600 minutos.</p>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
            <span><span className="block font-medium">Mostrar en catálogo</span><span className="block text-xs text-muted-foreground">Los clientes podrán verlo en tu página pública.</span></span>
            <Switch checked={catalogVisible} onCheckedChange={setCatalogVisible} aria-label="Mostrar en catálogo" />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
            <span>
              <span className="block font-medium">Se puede reservar online</span>
              <span className="block text-xs text-muted-foreground">Habilita la opción para este servicio. Solo estará disponible al público si también se muestra en catálogo y la tienda tiene reservas online activadas.</span>
            </span>
            <Switch disabled={saving} checked={online} onCheckedChange={setOnline} aria-label="Se puede reservar online" />
          </label>
          </fieldset>
          {trimmed && priceOk && durationOk && <p aria-label="Resumen del servicio" className="rounded-lg bg-muted p-3 text-sm">{trimmed} · {priceValue.toLocaleString('es-PY')} {currency} · {duration} min · Catálogo: {catalogVisible ? 'sí' : 'no'} · Reserva online: {online ? 'sí' : 'no'}</p>}
          <p className="text-xs text-muted-foreground">El personal con «Todos los servicios» incluye este nuevo servicio. Revisá <a href="#equipo" className="underline" onClick={event => { if (pending.current) event.preventDefault(); else onOpenChange(false) }}>Quién atiende</a> para ajustar tarifas y asignaciones.</p>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4">
            <Button className="min-h-11" type="button" disabled={saving} variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="min-h-11" type="submit" disabled={!trimmed || duplicate || !priceOk || !durationOk || saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Agregar servicio</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

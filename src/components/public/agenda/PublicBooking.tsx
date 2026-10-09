'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { addDays, weekdayOf, WEEKDAY_LABELS } from '@/lib/agenda/time'
import { useBookingQuote } from './use-booking-quote'
import { BookingQuoteSummary } from './BookingQuoteSummary'

type Info = {
  storeName: string
  currency: string
  today: string
  maxDaysAhead: number
  requireConfirmation: boolean
  professionalBookingAvailable?: boolean
  professionalSelection?: 'disabled' | 'optional' | 'required'
  message: string | null
  openDays: number[]
  /** professionalIds: quién hace el servicio (vacío si no hay profesionales). */
  services: Array<{ id: string; name: string; duration: number; price: number | null; professionalIds?: string[]; professionalTerms?:Array<{professionalId:string;price:number|null;duration:number}> }>
  professionals: Array<{ id: string; name: string; color: string }>
}

const ANY = 'any'

function Step({ number, title, children, done }: { number: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', done ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground')}>{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function PublicBooking({ slug, initialServiceId }: { slug: string; initialServiceId?: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosenServiceId, setServiceId] = useState<string | null>(initialServiceId ?? null)
  // Un servicio que llega por la URL (desde la portada) solo cuenta si la agenda lo ofrece.
  const serviceId = info?.services.some((item) => item.id === chosenServiceId) ? chosenServiceId : null
  const [chosenProfessionalId, setProfessionalId] = useState<string>(ANY)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ key: string; list: Array<{ startsAt: string; time: string }> } | null>(null)
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [booked, setBooked] = useState<{ token: string; status: string } | null>(null)
  const [refresh,setRefresh]=useState(0)
  // Solo quienes hacen el servicio elegido; si el elegido antes no lo hace, vuelve a «Cualquiera».
  const serviceProfessionalIds = info?.services.find((item) => item.id === serviceId)?.professionalIds
  const serviceProfessionals = (info?.professionals ?? []).filter((professional) => !serviceProfessionalIds || serviceProfessionalIds.includes(professional.id))
  const mode=info?.professionalBookingAvailable ? info.professionalSelection??'optional':'optional'
  const professionalId = mode!=='disabled' && serviceProfessionals.some((professional) => professional.id === chosenProfessionalId) ? chosenProfessionalId : ANY
  const needsProfessional=mode==='required' && professionalId===ANY
  const showProfessionals=mode!=='disabled' && (serviceProfessionals.length>1 || mode==='required')
  const quoted=useBookingQuote(slug,serviceId,professionalId===ANY?null:professionalId,startsAt,info?.professionalBookingAvailable===true,refresh)

  useEffect(() => {
    fetch(`/api/public/agenda/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) setError(body.error || 'No se pudo cargar la agenda')
        else setInfo(body)
      })
      .catch(() => setError('No se pudo cargar la agenda'))
  }, [slug])

  const slotKey = serviceId && date ? `${serviceId}|${professionalId}|${date}` : null
  useEffect(() => {
    if (!slotKey || !serviceId || !date || needsProfessional) return
    const params = new URLSearchParams({ date, service: serviceId })
    if (professionalId !== ANY) params.set('professional', professionalId)
    let cancelled = false
    fetch(`/api/public/agenda/${encodeURIComponent(slug)}?${params}`)
      .then((response) => response.json())
      .then((body) => { if (!cancelled) setSlots({ key: slotKey, list: Array.isArray(body.slots) ? body.slots : [] }) })
      .catch(() => { if (!cancelled) setSlots({ key: slotKey, list: [] }) })
    return () => { cancelled = true }
  }, [slotKey, serviceId, date, professionalId, slug,refresh,needsProfessional])

  const days = useMemo(() => {
    if (!info) return []
    return Array.from({ length: Math.min(info.maxDaysAhead, 30) + 1 }, (_, index) => addDays(info.today, index))
      .filter((day) => info.openDays.includes(weekdayOf(day)))
  }, [info])

  const service = info?.services.find((item) => item.id === serviceId) ?? null
  const visibleSlots = slots && slots.key === slotKey ? slots.list : null

  const book = async () => {
    if (!serviceId || !startsAt || (info?.professionalBookingAvailable && (!quoted.quote || !quoted.accepted))) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/agenda/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(info?.professionalBookingAvailable ? {
          quote_id:quoted.quote!.quoteId,idempotency_key:quoted.attemptId,
        } : {
          service_id: serviceId,
          professional_id: professionalId === ANY ? null : professionalId,
          starts_at: startsAt,
        }),
          name,
          phone,
          notes: notes || null,
          website,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'No se pudo reservar')
        // El horario se ocupó: se vuelven a pedir los libres.
        if (response.status === 409) {
          setStartsAt(null)
          setSlots(null)
          setRefresh(value=>value+1)
        }
        return
      }
      setBooked(body)
    } catch {
      setError('No pudimos confirmar la respuesta. Revisá tu conexión y reintentá sin cambiar los datos; no se duplicará el turno.')
    } finally {
      setSending(false)
    }
  }

  if (error && !info) return <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{error}</p>
  if (!info) return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando turnos…</p>

  if (booked) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-bold">{booked.status === 'pending' ? '¡Pedido de turno enviado!' : '¡Turno reservado!'}</h2>
        <p className="text-sm text-muted-foreground">
          {booked.status === 'pending'
            ? `${info.storeName} te va a confirmar por WhatsApp.`
            : `Te esperamos en ${info.storeName}.`}
        </p>
        <Button asChild><Link href={`/turno/${booked.token}`}>Ver mi turno</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {info.message && <p className="rounded-xl bg-primary/5 p-3 text-sm">{info.message}</p>}

      <Step number={1} title="¿Qué servicio?" done={Boolean(serviceId)}>
        {info.services.length === 0 ? <p className="text-sm text-muted-foreground">Por ahora no hay servicios para reservar online.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {info.services.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={serviceId === item.id}
                onClick={() => { setServiceId(item.id); setStartsAt(null) }}
                className={cn('rounded-xl border p-3 text-left transition-colors', serviceId === item.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
              >
                <p className="font-medium">{item.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {item.duration} min
                  {item.price === null ? ' · Precio a consultar' : <> · {formatCurrency(item.price, { currency: info.currency })}{info.professionalBookingAvailable && ' (tarifa base)'}</>}
                </p>
              </button>
            ))}
          </div>
        )}
      </Step>

      {serviceId && showProfessionals && (
        <Step number={2} title="¿Con quién?" done={!needsProfessional}>
            {serviceProfessionals.length===0&&<p role="alert">No hay profesionales disponibles para este servicio. Consultá con la tienda.</p>}
          <div className="flex flex-wrap gap-2">
            {[...(mode==='required'?[]:[{ id: ANY, name: 'Cualquiera', color: '#94a3b8' }]), ...serviceProfessionals].map((professional) => (
              <button
                key={professional.id}
                type="button"
                aria-pressed={professionalId === professional.id}
                onClick={() => { setProfessionalId(professional.id); setStartsAt(null) }}
                className={cn('flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-base', professionalId === professional.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: professional.color }} /> {professional.name}
                  {service?.professionalTerms?.filter(row=>row.professionalId===professional.id).map(row=><span key={row.professionalId} className="text-sm">· {row.duration} min · {row.price===null?'Precio a consultar':row.price===0?'Sin costo':formatCurrency(row.price,{currency:info.currency})}</span>)}
              </button>
            ))}
          </div>
        </Step>
      )}

      {serviceId && !needsProfessional && (
        <Step number={showProfessionals ? 3 : 2} title="¿Qué día?" done={Boolean(date)}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={date === day}
                onClick={() => { setDate(day); setStartsAt(null) }}
                className={cn('flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-sm', date === day ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50')}
              >
                <span className="text-xs">{day === info.today ? 'Hoy' : WEEKDAY_LABELS[weekdayOf(day)].slice(0, 3)}</span>
                <span className="text-lg font-bold">{Number(day.slice(8))}</span>
                <span className="text-[10px] opacity-80">{['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(day.slice(5, 7)) - 1]}</span>
              </button>
            ))}
          </div>
          {date && (
            visibleSlots === null ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horarios…</p>
              : visibleSlots.length === 0 ? <p className="text-sm text-muted-foreground">No quedan horarios libres ese día. Probá con otro.</p>
                : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {visibleSlots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        aria-pressed={startsAt === slot.startsAt}
                        onClick={() => setStartsAt(slot.startsAt)}
                        className={cn('min-h-11 rounded-lg border py-2 text-base font-medium tabular-nums', startsAt === slot.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50')}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )
          )}
        </Step>
      )}

      {startsAt && service && (
        <Step number={showProfessionals ? 4 : 3} title="Tus datos">
          {info.professionalBookingAvailable && (quoted.loading ? <p role="status">Confirmando tarifa y disponibilidad…</p> : quoted.quote ?
            <BookingQuoteSummary quote={quoted.quote} currency={info.currency} accepted={quoted.accepted} onAccept={quoted.accept} expired={quoted.expired} /> : <p role="alert">{quoted.error}</p>)}
          {info.professionalBookingAvailable && (quoted.error || quoted.expired) && <Button variant="outline" onClick={()=>setRefresh(value=>value+1)}>Actualizar cotización</Button>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="booking-name">Nombre</Label>
              <Input id="booking-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="booking-phone">WhatsApp</Label>
              <Input id="booking-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0981 123 456" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-notes">Algo que debamos saber (opcional)</Label>
            <Textarea id="booking-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {/* Trampa para bots: invisible para las personas. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(event) => setWebsite(event.target.value)} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button className="min-h-11 w-full" size="lg" onClick={() => void book()} disabled={sending || name.trim().length < 2 || phone.replace(/\D/g, '').length < 6 || (info.professionalBookingAvailable && !quoted.accepted)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
            {info.requireConfirmation ? 'Pedir el turno' : 'Reservar el turno'}
          </Button>
          {info.requireConfirmation && <p className="text-center text-xs text-muted-foreground">La tienda te confirma por WhatsApp.</p>}
        </Step>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useEffect, useMemo, useRef, useState } from 'react'
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

type DisplaySlot = { startsAt: string; time: string; professionalIds?: string[] }

type Info = {
  storeName: string
  currency: string
  timeZone?: string
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
  const { user, loading: authLoading } = useAuth()
  const accountContactOwner = useRef<string | null>(null)
  const [usingAccount, setUsingAccount] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosenServiceId, setServiceId] = useState<string | null>(initialServiceId ?? null)
  // Un servicio que llega por la URL (desde la portada) solo cuenta si la agenda lo ofrece.
  const serviceId = info?.services.some((item) => item.id === chosenServiceId) ? chosenServiceId : null
  const [chosenProfessionalId, setProfessionalId] = useState<string>(ANY)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ key: string; list: DisplaySlot[]; unavailable?: DisplaySlot[] } | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('')
  const accountName = user?.profile?.name?.trim() || ''
  const accountPhone = user?.profile?.phone?.trim() || user?.phone?.trim() || ''
  useEffect(() => {
    if (authLoading || !accountContactOwner.current || accountContactOwner.current === user?.id) return
    accountContactOwner.current = null
    setName('')
    setPhone('')
    setUsingAccount(false)
  }, [user?.id, authLoading])
  const useAccountContact = () => {
    if (!user) return
    setName(accountName)
    setPhone(accountPhone)
    accountContactOwner.current = user.id
    setUsingAccount(true)
  }

  const sendLock = useRef(false)
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
    setSlotsError(null)
    fetch(`/api/public/agenda/${encodeURIComponent(slug)}?${params}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'No se pudieron consultar los horarios.')
        return body
      })
      .then((body) => { if (!cancelled) setSlots({ key: slotKey, list: Array.isArray(body.slots) ? body.slots : [], unavailable: Array.isArray(body.unavailableSlots) ? body.unavailableSlots : [] }) })
      .catch(() => { if (!cancelled) { setSlotsError('No pudimos consultar los horarios. Revisá tu conexión y volvé a intentar.'); setSlots({ key: slotKey, list: [] }) } })
    return () => { cancelled = true }
  }, [slotKey, serviceId, date, professionalId, slug,refresh,needsProfessional])

  const days = useMemo(() => {
    if (!info) return []
    return Array.from({ length: info.maxDaysAhead + 1 }, (_, index) => addDays(info.today, index))
      .filter((day) => info.openDays.includes(weekdayOf(day)))
  }, [info])

  const service = info?.services.find((item) => item.id === serviceId) ?? null
  const visibleSlots = slots && slots.key === slotKey ? slots.list : null
  const blockedSlots = slots?.key === slotKey ? slots.unavailable ?? [] : []
  const displaySlots = [...(visibleSlots ?? []).map(slot => ({...slot, unavailable:false})), ...blockedSlots.filter(slot=>!visibleSlots?.some(free=>free.startsAt===slot.startsAt)).map(slot => ({...slot, unavailable:true}))].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))
  const selectedProfessional = serviceProfessionals.find(person=>person.id===professionalId)
  const selectedSlotProfessionals = visibleSlots?.find(slot=>slot.startsAt===startsAt)?.professionalIds?.map(id=>serviceProfessionals.find(person=>person.id===id)?.name).filter(Boolean) ?? []

  const book = async () => {
    if (sendLock.current || !serviceId || !startsAt || slotsError || !visibleSlots?.some(slot => slot.startsAt === startsAt) || (info?.professionalBookingAvailable && (!quoted.quote || !quoted.accepted))) return
    sendLock.current = true
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
      sendLock.current = false
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
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      <fieldset disabled={sending} className="min-w-0 space-y-4 border-0 p-0">
      {!authLoading && user && <section aria-label="Reservar con mi cuenta" className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div><p className="font-semibold">{usingAccount ? 'Estás reservando para vos' : '¿Querés reservar para vos?'}</p><p className="text-sm text-muted-foreground">Sesión iniciada como {accountName || user.email || 'usuario'}. Podés usar los datos de tu cuenta y revisarlos antes de confirmar.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={useAccountContact}>{usingAccount ? 'Volver a usar mis datos' : 'Reservar para mí'}</Button>{usingAccount && <Button type="button" variant="ghost" onClick={() => { accountContactOwner.current=null; setUsingAccount(false); setName(''); setPhone('') }}>Reservar para otra persona</Button>}</div>
        {usingAccount && (!accountName || !accountPhone) && <p role="status" className="text-sm text-muted-foreground">Tu cuenta no tiene todos los datos de contacto. Completá los campos faltantes en el paso final.</p>}
      </section>}
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
                  {item.price === null ? ' · Precio a consultar' : item.price === 0 ? ' · Sin costo (Asesoramiento gratuito)' : <> · {formatCurrency(item.price, { currency: info.currency })}{info.professionalBookingAvailable && ' (tarifa base)'}</>}
                </p>
              </button>
            ))}
          </div>
        )}
      </Step>

      {serviceId && showProfessionals && (
        <Step number={2} title="¿Con quién?" done={!needsProfessional}>
            {serviceProfessionals.length===0&&<p role="alert">No hay profesionales disponibles para este servicio. Consultá con la tienda.</p>}
          <p className="text-xs text-muted-foreground">Solo se ofrecen horarios donde el profesional esté libre durante todo el servicio y su tiempo de preparación.</p>
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
          {date && visibleSlots !== null && !slotsError && selectedProfessional && <p role="status" className="rounded-xl bg-primary/5 p-3 text-sm">{selectedProfessional.name} tiene {visibleSlots.length} {visibleSlots.length===1?'horario disponible':'horarios disponibles'} para este día.</p>}
          {date && blockedSlots.length>0 && !slotsError && <p className="text-xs text-muted-foreground">Los horarios tachados no están disponibles para el servicio completo. Pueden corresponder a otro turno, una pausa o una ausencia.</p>}
          {date && (
            slotsError ? <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 p-3 text-sm"><p>{slotsError}</p><Button variant="outline" onClick={() => { setSlots(null); setRefresh(value => value + 1) }}>Reintentar horarios</Button></div> : visibleSlots === null ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horarios…</p>
              : visibleSlots.length === 0 && blockedSlots.length === 0 ? <p className="text-sm text-muted-foreground">No quedan horarios libres ese día. Probá con otro.</p>
                : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {displaySlots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={slot.unavailable}
                        aria-label={slot.unavailable ? slot.time + ' · No disponible' : slot.time}
                        title={slot.unavailable ? (selectedProfessional ? 'No disponible con ' + selectedProfessional.name : 'No hay profesionales disponibles para este horario') : 'Disponible'}
                        aria-pressed={!slot.unavailable && startsAt === slot.startsAt}
                        onClick={() => { if (!slot.unavailable) { setError(null); setStartsAt(slot.startsAt) } }}
                        className={cn('min-h-11 rounded-lg border py-2 text-base font-medium tabular-nums', slot.unavailable && 'cursor-not-allowed border-dashed border-rose-300 bg-rose-50 text-rose-700 disabled:opacity-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300', !slot.unavailable && startsAt === slot.startsAt ? 'border-primary bg-primary text-primary-foreground' : !slot.unavailable ? 'hover:bg-muted/50' : '')}
                      >
                        <span className={slot.unavailable ? 'line-through' : undefined}>{slot.time}</span>{slot.unavailable && <span className="block text-[9px] font-normal no-underline">No disponible</span>}
                      </button>
                    ))}
                  </div>
                )
          )}
        </Step>
      )}

      {startsAt && service && (
        <Step number={showProfessionals ? 4 : 3} title="Revisá tu reserva y completá tus datos">
          {selectedSlotProfessionals.length>0 && <p className="text-sm text-muted-foreground">Disponibles para este horario: {selectedSlotProfessionals.join(', ')}. El profesional asignado se confirma en el resumen.</p>}
          {info.professionalBookingAvailable && (quoted.loading ? <p role="status">Confirmando tarifa y disponibilidad…</p> : quoted.quote ?
            <BookingQuoteSummary serviceName={service.name} timeZone={info.timeZone} quote={quoted.quote} currency={info.currency} accepted={quoted.accepted} onAccept={quoted.accept} expired={quoted.expired} /> : <p role="alert">{quoted.error}</p>)}
          {quoted.unavailable && <div className="space-y-2 rounded-xl border border-amber-300 p-3 text-sm"><p>No hay disponibilidad para esta selección. El profesional puede tener otro turno o una pausa. Elegí otro horario o cambiá de profesional. Tus datos se conservan.</p><Button variant="outline" onClick={() => { setStartsAt(null); setSlots(null); setRefresh(value=>value+1) }}>Ver horarios disponibles</Button></div>}
          {info.professionalBookingAvailable && !quoted.unavailable && (quoted.error || quoted.expired) && <Button variant="outline" onClick={()=>setRefresh(value=>value+1)}>Actualizar cotización</Button>}
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
            <Label htmlFor="booking-notes">Detalles o motivo de la visita (opcional)</Label>
            <Textarea id="booking-notes" rows={2} placeholder="Ej: el estilo de corte que buscás o alguna indicación para tu visita." value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {/* Trampa para bots: invisible para las personas. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(event) => setWebsite(event.target.value)} />

          <Button className="min-h-11 w-full" size="lg" onClick={() => void book()} disabled={sending || Boolean(slotsError) || !visibleSlots?.some(slot => slot.startsAt === startsAt) || name.trim().length < 2 || phone.replace(/\D/g, '').length < 6 || (info.professionalBookingAvailable && !quoted.accepted)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
            {info.requireConfirmation ? 'Pedir el turno' : 'Reservar el turno'}
          </Button>
          {info.requireConfirmation && <p className="text-center text-xs text-muted-foreground">La tienda te confirma por WhatsApp.</p>}
        </Step>
      )}
      </fieldset>
    </div>
  )
}

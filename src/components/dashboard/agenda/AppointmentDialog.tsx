'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Ban, Bell, CalendarCheck, Check, Loader2, MessageCircle, Pencil, RotateCcw, ShoppingCart, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { siteUrl } from '@/lib/site-url'
import { APPOINTMENT_STATUS_LABELS, appointmentCode } from '@/lib/agenda/agenda-api'
import { appointmentWhen, buildAppointmentWhatsApp } from '@/lib/agenda/messages'
import { utcToZoned, zonedToUtc } from '@/lib/agenda/time'
import { whatsappNumber } from '@/lib/quotes/quote-math'
import { editorServiceTerms } from '@/lib/agenda/editor-terms'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'

const FREE = '__free__'
const NONE = '__none__'

export const STATUS_COLORS: Record<Appointment['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}

export type DialogState =
  | { mode: 'create'; date: string; time: string; professionalId: string | null }
  | { mode: 'view'; appointment: Appointment }
  | { mode: 'edit'; appointment: Appointment }

type Form = {
  customer_id: string | null
  customer_name: string
  customer_phone: string
  service: string
  service_name: string
  professional: string
  date: string
  time: string
  duration: number
  price: number
  notes: string
  pending: boolean
  buffer: number
  acceptNewTerms: boolean
  allowOutsideHours: boolean
}

function formFrom(state: DialogState, data: AgendaData): Form {
  if (state.mode === 'create') {
    return {
      customer_id: null, customer_name: '', customer_phone: '', service: FREE, service_name: '',
      professional: state.professionalId ?? (data.professionals.filter((p) => p.is_active).length ? '' : NONE),
      date: state.date, time: state.time, duration: data.settings.slot_minutes, price: 0, notes: '', pending: false, buffer:0,acceptNewTerms:false,allowOutsideHours:false,
    }
  }
  const a = state.appointment
  const local = utcToZoned(a.starts_at, data.timeZone)
  return {
    customer_id: a.customer_id, customer_name: a.customer_name, customer_phone: a.customer_phone ?? '',
    service: a.service_product_id ?? FREE, service_name: a.service_name,
    professional: a.professional_id ?? NONE, date: local.date, time: local.time,
    duration: Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000),
    price: Number(a.price), notes: a.notes ?? '', pending: a.status === 'pending',buffer:a.buffer_minutes??0,acceptNewTerms:false,allowOutsideHours:false,
  }
}

function CustomerSearch({ form, setForm }: { form: Form; setForm: (form: Form) => void }) {
  const [results, setResults] = useState<{ term: string; rows: Array<{ id: string; name: string; phone: string | null; whatsapp: string | null }> }>({ term: '', rows: [] })
  const [focused, setFocused] = useState(false)
  const term = form.customer_name.trim()
  const active = !form.customer_id && term.length >= 2

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => {
      fetch(`/api/agenda/lookup?q=${encodeURIComponent(term)}`)
        .then((response) => response.json())
        .then((body) => setResults({ term, rows: Array.isArray(body.results) ? body.results : [] }))
        .catch(() => undefined)
    }, 250)
    return () => clearTimeout(timer)
  }, [active, term])

  const rows = active && results.term === term ? results.rows : []
  return (
    <div className="relative space-y-1">
      <Label htmlFor="appt-customer" className="text-xs">Cliente</Label>
      <Input
        id="appt-customer"
        value={form.customer_name}
        placeholder="Nombre (buscá un cliente o escribí uno nuevo)"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(event) => setForm({ ...form, customer_id: null, customer_name: event.target.value })}
      />
      {form.customer_id && <p className="text-xs text-emerald-700 dark:text-emerald-400">Cliente registrado</p>}
      {focused && rows.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full rounded-xl border bg-popover p-1 shadow-lg">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setForm({ ...form, customer_id: row.id, customer_name: row.name, customer_phone: row.whatsapp || row.phone || form.customer_phone })}
              >
                {row.name} <span className="text-xs text-muted-foreground">{row.whatsapp || row.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AppointmentDialog({
  state,
  data,
  onClose,
  onSaved,
  onEdit,
}: {
  state: DialogState | null
  data: AgendaData
  onClose: () => void
  onSaved: (appointment: Appointment) => void
  onEdit: (appointment: Appointment) => void
}) {
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const formKey = state ? (state.mode === 'create' ? `create-${state.date}-${state.time}-${state.professionalId}` : `${state.mode}-${state.appointment.id}`) : ''
  const [loadedKey, setLoadedKey] = useState('')
  // El formulario se arma al abrir el diálogo (sin efecto: se compara la llave durante el render).
  if (state && state.mode !== 'view' && formKey !== loadedKey) {
    setLoadedKey(formKey)
    setForm(formFrom(state, data))
  }

  const activeProfessionals = data.professionals.filter((professional) => professional.is_active)
  const professionalName = (id: string | null) => data.professionals.find((professional) => professional.id === id)?.name ?? null
  const money = (amount: number) => formatCurrency(amount, { currency: data.currency })
  const advanced=Boolean(data.capabilities?.professionalBooking)
  const changedTerms=advanced&&state?.mode==='edit'&&form&&(form.service!==(state.appointment.service_product_id??FREE)||form.professional!==(state.appointment.professional_id??NONE))
  const applyTerms=(serviceId:string,professional:string)=>{
    if (!form) return
    const service=data.services.find(row=>row.product_id===serviceId)
    if (!service) {setForm({...form,service:serviceId,professional,acceptNewTerms:false});return}
    const terms=advanced?editorServiceTerms(service,professional===NONE?null:professional,data.professionalRates??[],state?.mode==='edit'?state.appointment:null):{price:service.price,durationMinutes:service.duration_minutes,bufferMinutes:0}
    setForm({...form,service:serviceId,professional,service_name:service.name,price:terms.price,duration:terms.durationMinutes,buffer:terms.bufferMinutes,acceptNewTerms:false})
  }

  const chooseService = (value: string) => {
    if (!form) return
    if (value === FREE) {
      setForm({ ...form, service: FREE })
      return
    }
    applyTerms(value,form.professional)
  }

  const save = async () => {
    if (!form || !state || state.mode === 'view') return
    if (!form.customer_name.trim()) return toast.error('Poné el nombre del cliente')
    if (!form.service_name.trim()) return toast.error('Elegí o escribí el servicio')
    if (activeProfessionals.length > 0 && !form.professional) return toast.error('Elegí quién atiende')
    if (changedTerms&&!form.acceptNewTerms) return toast.error('Aceptá las nuevas condiciones del servicio y profesional')
    const payload = {
      customer_id: form.customer_id,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      service_product_id: form.service === FREE ? null : form.service,
      service_name: form.service_name.trim(),
      professional_id: form.professional && form.professional !== NONE ? form.professional : null,
      price: Math.max(0, Number(form.price) || 0),
      starts_at: new Date(zonedToUtc(form.date, form.time, data.timeZone)).toISOString(),
      duration_minutes: Math.max(5, Math.trunc(Number(form.duration) || data.settings.slot_minutes)),
      notes: form.notes.trim() || null,
      ...(advanced?{accept_new_terms:form.acceptNewTerms,accepted_terms:{price:Number(form.price),duration_minutes:Number(form.duration),buffer_minutes:form.buffer},allow_outside_hours:data.canConfigure&&form.allowOutsideHours}:{}),
      ...(state.mode === 'create' ? { status: form.pending ? 'pending' : 'confirmed' } : {}),
    }
    setSaving(true)
    try {
      const response = state.mode === 'create'
        ? await fetch('/api/agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/agenda/${state.appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', appointment: payload }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar el turno')
        return
      }
      toast.success(state.mode === 'create' ? 'Turno agendado' : 'Turno actualizado')
      onSaved(body.appointment)
    } catch {
      toast.error('No se pudo guardar. Revisá la conexión y la agenda antes de reintentar.')
    } finally {
      setSaving(false)
    }
  }

  const act = async (appointment: Appointment, action: string, success: string, extra: Record<string, unknown> = {}) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/agenda/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo actualizar el turno')
        return null
      }
      if (success) toast.success(success)
      onSaved(body.appointment)
      return body.appointment as Appointment
    } finally {
      setSaving(false)
    }
  }

  const whatsapp = async (appointment: Appointment, kind: 'confirm' | 'reminder') => {
    const message = buildAppointmentWhatsApp(kind, {
      storeName: data.storeName,
      customerName: appointment.customer_name,
      serviceName: appointment.service_name,
      startsAt: appointment.starts_at,
      timeZone: data.timeZone,
      professionalName: professionalName(appointment.professional_id),
      url: siteUrl(`/turno/${appointment.public_token}`),
    })
    window.open(`https://wa.me/${whatsappNumber(appointment.customer_phone) ?? ''}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    if (kind === 'confirm' && appointment.status === 'pending') await act(appointment, 'confirm', 'Turno confirmado')
    if (kind === 'reminder') await act(appointment, 'reminder_sent', '')
  }

  const view = state?.mode === 'view' ? state.appointment : null
  const durationPreview = useMemo(() => {
    if (!form) return null
    const start = zonedToUtc(form.date, form.time, data.timeZone)
    return utcToZoned(start + (Number(form.duration) || 0) * 60_000, data.timeZone).time
  }, [form, data.timeZone])

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg [&_input]:min-h-11 [&_input]:text-base [&_textarea]:text-base [&_[role=combobox]]:min-h-11">
        {view ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {view.customer_name}
                <Badge variant="secondary" className={STATUS_COLORS[view.status]}>{APPOINTMENT_STATUS_LABELS[view.status]}</Badge>
              </DialogTitle>
              <DialogDescription>
                {appointmentCode(view.number)} · {view.source === 'online' ? 'Reservado online' : 'Cargado en el panel'}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Cuándo</dt><dd className="font-medium">{appointmentWhen(view.starts_at, data.timeZone)} — {utcToZoned(view.ends_at, data.timeZone).time}</dd>
              <dt className="text-muted-foreground">Servicio</dt><dd>{view.service_name} · {Number(view.price)===0?'Sin costo':money(Number(view.price))}</dd>
              {Boolean(view.buffer_minutes)&&<><dt className="text-muted-foreground">Margen</dt><dd>{view.buffer_minutes} min adicionales sin otro turno</dd></>}
              {professionalName(view.professional_id) && (<><dt className="text-muted-foreground">Atiende</dt><dd>{professionalName(view.professional_id)}</dd></>)}
              <dt className="text-muted-foreground">Teléfono</dt><dd>{view.customer_phone || '—'}</dd>
              {view.notes && (<><dt className="text-muted-foreground">Notas</dt><dd className="whitespace-pre-line">{view.notes}</dd></>)}
              {view.cancel_reason && (<><dt className="text-muted-foreground">Motivo</dt><dd>{view.cancel_reason}</dd></>)}
              {view.reminder_sent_at && (<><dt className="text-muted-foreground">Recordatorio</dt><dd>Enviado</dd></>)}
            </dl>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {(view.status === 'pending' || view.status === 'confirmed') && (
                <>
                  {view.status === 'pending' ? (
                    <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5a]" disabled={saving} onClick={() => void whatsapp(view, 'confirm')}><MessageCircle className="h-4 w-4" /> Confirmar por WhatsApp</Button>
                  ) : (
                    <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5a]" disabled={saving} onClick={() => void whatsapp(view, 'reminder')}><Bell className="h-4 w-4" /> Recordar por WhatsApp</Button>
                  )}
                  {view.status === 'pending' && <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(view, 'confirm', 'Turno confirmado')}><Check className="h-4 w-4" /> Confirmar</Button>}
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(view, 'complete', 'Marcado como atendido')}><CalendarCheck className="h-4 w-4" /> Atendido</Button>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(view, 'no_show', 'Marcado como ausente')}><UserX className="h-4 w-4" /> No vino</Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(view)}><Pencil className="h-4 w-4" /> Editar</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={saving}
                    onClick={() => {
                      const reason = window.prompt('Motivo de la cancelación (opcional)')
                      if (reason !== null) void act(view, 'cancel', 'Turno cancelado', { reason })
                    }}
                  >
                    <Ban className="h-4 w-4" /> Cancelar
                  </Button>
                </>
              )}
              {['cancelled', 'no_show', 'completed'].includes(view.status) && !view.sale_id && (
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(view, 'reopen', 'Turno reabierto')}><RotateCcw className="h-4 w-4" /> Reabrir</Button>
              )}
              {!view.sale_id && ['pending', 'confirmed', 'completed'].includes(view.status) && (
                <Button size="sm" asChild><Link href={`/dashboard/pos?appointmentId=${view.id}`}><ShoppingCart className="h-4 w-4" /> Cobrar en el POS</Link></Button>
              )}
              {view.sale_id && <p className="text-sm text-emerald-700 dark:text-emerald-400">Cobrado en el POS.</p>}
            </div>
          </>
        ) : form && state ? (
          <>
            <DialogHeader>
              <DialogTitle>{state.mode === 'create' ? 'Nuevo turno' : 'Editar turno'}</DialogTitle>
              <DialogDescription>El horario se controla: no se pueden pisar dos turnos del mismo profesional.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <CustomerSearch form={form} setForm={setForm} />
              <div className="space-y-1">
                <Label htmlFor="appt-phone" className="text-xs">WhatsApp / teléfono</Label>
                <Input id="appt-phone" inputMode="tel" value={form.customer_phone} placeholder="0981 123 456" onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Servicio</Label>
                  <Select value={form.service} onValueChange={chooseService}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {data.services.map((service) => <SelectItem key={service.product_id} value={service.product_id}>{service.name} · {service.duration_minutes} min</SelectItem>)}
                      <SelectItem value={FREE}>Otro (escribir)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.service === FREE && (
                  <div className="space-y-1">
                    <Label htmlFor="appt-service" className="text-xs">Qué se hace</Label>
                    <Input id="appt-service" value={form.service_name} onChange={(event) => setForm({ ...form, service_name: event.target.value })} />
                  </div>
                )}
                {(activeProfessionals.length > 0 || form.professional !== NONE) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Atiende</Label>
                    <Select value={form.professional || undefined} onValueChange={(value) => applyTerms(form.service,value)}>
                      <SelectTrigger><SelectValue placeholder="Elegí quién atiende" /></SelectTrigger>
                      <SelectContent>
                        {activeProfessionals.map((professional) => <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>)}
                        {activeProfessionals.length === 0 && <SelectItem value={NONE}>Agenda única</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="appt-date" className="text-xs">Día</Label>
                  <Input id="appt-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="appt-time" className="text-xs">Hora</Label>
                  <Input id="appt-time" type="time" step={300} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="appt-duration" className="text-xs">Minutos</Label>
                  <Input id="appt-duration" disabled={advanced&&(form.service!==FREE||state.mode==='edit')} type="number" min={5} step={5} value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} />
                </div>
              </div>
              {durationPreview && <p className="-mt-1 text-xs text-muted-foreground">Termina a las {durationPreview}</p>}
              {advanced&&<p className="text-sm text-muted-foreground">Atención: {form.duration} min · Margen sin otro turno: {form.buffer} min. Al mover el mismo servicio y profesional se conserva la tarifa acordada.</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="appt-price" className="text-xs">Precio</Label>
                  <Input id="appt-price" disabled={advanced&&(form.service!==FREE||state.mode==='edit')} type="number" min={0} value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
                </div>
                {state.mode === 'create' && (
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={form.pending} onChange={(event) => setForm({ ...form, pending: event.target.checked })} />
                    Falta que el cliente confirme
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="appt-notes" className="text-xs">Notas</Label>
                {changedTerms&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.acceptNewTerms} onChange={event=>setForm({...form,acceptNewTerms:event.target.checked})}/>Acepto el nuevo profesional, precio {money(form.price)} y duración {form.duration} min.</label>}
                {advanced&&data.canConfigure&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.allowOutsideHours} onChange={event=>setForm({...form,allowOutsideHours:event.target.checked})}/>Autorizar fuera del horario como administrador. No permite superponer turnos ni ausencias.</label>}
                <Textarea id="appt-notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
              <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar turno</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

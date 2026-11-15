'use client'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { homeVisitDetails, homeVisitIssue, type HomeVisitFields } from '@/lib/agenda/home-visit'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  Ban,
  Bell,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Scissors,
  ShoppingCart,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { siteUrl } from '@/lib/site-url'
import { cn } from '@/lib/utils'
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

type Form = HomeVisitFields & {
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
    const profId = state.professionalId ?? (data.professionals.filter((p) => p.is_active).length ? '' : NONE)
    const selectedProf = profId && profId !== NONE ? data.professionals.find((p) => p.id === profId) : null
    const initialService = (selectedProf?.service_ids?.length
      ? data.services.find((s) => selectedProf.service_ids.includes(s.product_id))
      : null) ?? (data.services[0] ?? null)

    const initialServiceId = initialService?.product_id ?? FREE
    const initialServiceName = initialService?.name ?? ''
    const initialDuration = initialService?.duration_minutes ?? data.settings.slot_minutes
    const initialPrice = initialService?.price ?? 0
    const initialBuffer = initialService?.buffer_minutes ?? 0

    return {
      ...homeVisitDetails({attention_mode:data.capabilities?.homeAppointments&&data.attentionMode==='home'?'home':'local'}),
      customer_id: null,
      customer_name: '',
      customer_phone: '',
      service: initialServiceId,
      service_name: initialServiceName,
      professional: profId,
      date: state.date,
      time: state.time,
      duration: initialDuration,
      price: initialPrice,
      notes: '',
      pending: false,
      buffer: initialBuffer,
      acceptNewTerms: false,
      allowOutsideHours: false,
    }
  }
  const a = state.appointment
  const local = utcToZoned(a.starts_at, data.timeZone)
  return {
    ...homeVisitDetails(a),
    customer_id: a.customer_id, customer_name: a.customer_name, customer_phone: a.customer_phone ?? '',
    service: a.service_product_id ?? FREE, service_name: a.service_name,
    professional: a.professional_id ?? NONE, date: local.date, time: local.time,
    duration: Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000),
    price: Number(a.price), notes: a.notes ?? '', pending: a.status === 'pending',buffer:a.buffer_minutes??0,acceptNewTerms:false,allowOutsideHours:false,
  }
}

function CustomerSearch({ form, setForm }: { form: Form; setForm: (form: Form) => void }) {
  const [results, setResults] = useState<{
    term: string
    rows: Array<{
      id: string
      name: string
      phone: string | null
      whatsapp: string | null
      ruc?: string | null
      notes?: string | null
    }>
  }>({ term: '', rows: [] })
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
      <div className="flex items-center justify-between">
        <Label htmlFor="appt-customer" className="text-xs font-semibold">Cliente</Label>
        {form.customer_id && (
          <button
            type="button"
            onClick={() => setForm({ ...form, customer_id: null, customer_name: '', customer_phone: '' })}
            className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            ✕ Cambiar cliente
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id="appt-customer"
          value={form.customer_name}
          placeholder="Nombre (buscá un cliente o escribí uno nuevo)"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onChange={(event) => setForm({ ...form, customer_id: null, customer_name: event.target.value })}
          className={cn(
            'transition-all',
            form.customer_id ? 'border-emerald-500/50 bg-emerald-500/5 font-semibold text-foreground' : ''
          )}
        />
        {form.customer_id && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
        )}
      </div>
      {form.customer_id && <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">✓ Cliente registrado en la base de datos</p>}
      {focused && rows.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl space-y-1">
          {rows.map((row) => {
            const initials = (row.name || 'CL').slice(0, 2).toUpperCase()
            const isHistoryOnly = row.id.startsWith('history-')
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/80"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const phoneVal = row.whatsapp || row.phone || form.customer_phone
                    setForm({
                      ...form,
                      customer_id: isHistoryOnly ? null : row.id,
                      customer_name: row.name,
                      customer_phone: phoneVal,
                    })
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {initials}
                    </span>
                    <div>
                      <p className="font-semibold text-xs text-foreground leading-tight">
                        {row.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{row.whatsapp || row.phone || 'Sin teléfono guardado'}</span>
                        {row.ruc && <span className="font-mono text-primary font-medium">· CI: {row.ruc}</span>}
                        {row.notes && <span className="italic truncate max-w-40">· {row.notes}</span>}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[9px] font-bold', isHistoryOnly ? 'border-blue-500/40 text-blue-600' : 'border-emerald-500/40 text-emerald-600')}>
                    {isHistoryOnly ? 'Turno previo' : 'Registrado'}
                  </Badge>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type CustomerLookupStats = {
  customer?: {
    id: string
    name: string
    phone: string | null
    whatsapp: string | null
    ruc?: string | null
    notes?: string | null
  }
  totalVisits: number
  completedVisits: number
  lastAppointment: {
    id: string
    service_name: string
    service_product_id: string | null
    professional_id: string | null
    price: number
    notes: string | null
    starts_at: string
    status: string
  } | null
  history: Array<{
    id: string
    service_name: string
    professional_id: string | null
    price: number
    starts_at: string
    status: string
    notes: string | null
  }>
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
  const isBarber = useSubscriptionStatus().businessVertical==='barbershop'
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true)
  const [customerStats, setCustomerStats] = useState<CustomerLookupStats | null>(null)
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [customerRuc, setCustomerRuc] = useState('')
  const [customerNickname, setCustomerNickname] = useState('')
  const [showHabitualForm, setShowHabitualForm] = useState(false)
  const [homonymsList, setHomonymsList] = useState<
    Array<{
      id: string
      name: string
      phone: string | null
      whatsapp: string | null
      ruc?: string | null
      notes?: string | null
    }>
  >([])
  const [phoneMatch, setPhoneMatch] = useState<{
    name: string
    id?: string
    visits: number
    stats?: CustomerLookupStats
  } | null>(null)
  const formKey = state ? (state.mode === 'create' ? `create-${state.date}-${state.time}-${state.professionalId}` : `${state.mode}-${state.appointment.id}`) : ''
  const [loadedKey, setLoadedKey] = useState('')
  // El formulario se arma al abrir el diálogo (sin efecto: se compara la llave durante el render).
  if (state && state.mode !== 'view' && formKey !== loadedKey) {
    setLoadedKey(formKey)
    setForm(formFrom(state, data))
  }

  // Detección automática de cliente por número de teléfono
  useEffect(() => {
    if (form?.customer_id || !form?.customer_phone) {
      setPhoneMatch(null)
      return
    }
    const clean = form.customer_phone.replace(/\D/g, '')
    if (clean.length < 6) {
      setPhoneMatch(null)
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/agenda/lookup?phone=${clean}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.found) {
            if (body.matchType === 'customer' && body.customer) {
              setPhoneMatch({
                name: body.customer.name,
                id: body.customer.id,
                visits: body.stats?.totalVisits ?? 1,
                stats: body.stats ? { ...body.stats, customer: body.customer } : undefined,
              })
            } else if (body.matchType === 'history_only' && body.suggestedCustomer) {
              setPhoneMatch({
                name: body.suggestedCustomer.name,
                visits: body.stats?.totalVisits ?? 1,
                stats: body.stats ?? null,
              })
            }
          } else {
            setPhoneMatch(null)
          }
        })
        .catch(() => undefined)
    }, 350)
    return () => clearTimeout(timer)
  }, [form?.customer_phone, form?.customer_id])

  // Detección de homónimos / clientes con nombre similar (para evitar confusiones con "Juan, Juan...")
  useEffect(() => {
    if (form?.customer_id || !form?.customer_name) {
      setHomonymsList([])
      return
    }
    const clean = form.customer_name.trim()
    if (clean.length < 3) {
      setHomonymsList([])
      return
    }

    const timer = setTimeout(() => {
      fetch(`/api/agenda/lookup?checkHomonyms=true&name=${encodeURIComponent(clean)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.success && Array.isArray(body.homonyms)) {
            setHomonymsList(body.homonyms)
          } else {
            setHomonymsList([])
          }
        })
        .catch(() => undefined)
    }, 350)

    return () => clearTimeout(timer)
  }, [form?.customer_name, form?.customer_id])

  // Cargar estadísticas e historial del cliente habitual
  useEffect(() => {
    if (!form?.customer_id) {
      setCustomerStats(null)
      setShowFullHistory(false)
      return
    }
    let cancelled = false
    fetch(`/api/agenda/lookup?customerId=${form.customer_id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { success?: boolean; customer?: CustomerLookupStats['customer']; stats?: CustomerLookupStats } | null) => {
        if (cancelled) return
        if (body?.stats) {
          setCustomerStats({ ...body.stats, customer: body.customer })
        } else {
          setCustomerStats(null)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [form?.customer_id])

  const activeProfessionals = data.professionals.filter((professional) => professional.is_active)
  const professionalName = useCallback((id: string | null) => data.professionals.find((professional) => professional.id === id)?.name ?? null,[data.professionals])
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

  const handleSaveAsRegularCustomer = async (explicitRuc?: string, explicitNotes?: string) => {
    if (!form || !form.customer_name.trim()) return
    const trimmedName = form.customer_name.trim()
    const rucVal = (explicitRuc !== undefined ? explicitRuc : customerRuc).trim()
    const notesVal = (explicitNotes !== undefined ? explicitNotes : customerNickname).trim()

    setSavingCustomer(true)
    try {
      const payload: { name: string; phone: string | null; ruc?: string; notes?: string } = {
        name: trimmedName,
        phone: form.customer_phone.trim() || null,
      }
      if (rucVal) payload.ruc = rucVal
      if (notesVal) payload.notes = notesVal

      const res = await fetch('/api/agenda/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.customer?.id) {
        setForm({
          ...form,
          customer_id: body.customer.id,
          customer_phone: body.customer.phone || form.customer_phone,
        })
        setShowHabitualForm(false)
        setHomonymsList([])
        if (body.created) {
          toast.success(`${trimmedName} registrado como cliente habitual`)
        } else {
          toast.info(`Cliente encontrado y vinculado (${body.customer.name})`)
        }
      } else {
        toast.error(body?.error || 'No se pudo guardar el cliente')
      }
    } catch {
      toast.error('Error al guardar el cliente')
    } finally {
      setSavingCustomer(false)
    }
  }

  const applyLastAppointmentPreferences = () => {
    if (!form || !customerStats?.lastAppointment) return
    const last = customerStats.lastAppointment
    const targetServiceId = last.service_product_id || FREE
    const targetProfessional = last.professional_id || form.professional

    if (targetServiceId !== FREE) {
      applyTerms(targetServiceId, targetProfessional)
    } else {
      setForm({
        ...form,
        service: FREE,
        service_name: last.service_name,
        professional: targetProfessional,
        price: last.price,
        notes: last.notes ? (form.notes ? `${form.notes}\n${last.notes}` : last.notes) : form.notes,
      })
    }
    toast.success('Preferencias del último servicio aplicadas')
  }

  const save = async () => {
    if (!form || !state || state.mode === 'view') return
    if (!form.customer_name.trim()) return toast.error('Poné el nombre del cliente')
    if (!form.service_name.trim()) return toast.error('Elegí o escribí el servicio')
    const visitIssue = homeVisitIssue(form)
    if(visitIssue)return toast.error(visitIssue)
    if (activeProfessionals.length > 0 && !form.professional) return toast.error('Elegí quién atiende')
    if (changedTerms&&!form.acceptNewTerms) return toast.error('Aceptá las nuevas condiciones del servicio y profesional')
    const payload = {
      ...(data.capabilities?.homeAppointments ? homeVisitDetails(form) : {}),
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
      window.dispatchEvent(new Event('agenda:changed'));
      onSaved(body.appointment)
      if (state.mode === 'create' && notifyWhatsApp && form.customer_phone.trim()) {
        const appointment = body.appointment as Appointment
        const message = buildAppointmentWhatsApp('confirm', {
          storeName: data.storeName,
          customerName: appointment.customer_name,
          serviceName: appointment.service_name,
          startsAt: appointment.starts_at,
          timeZone: data.timeZone,
          professionalName: professionalName(appointment.professional_id),
          url: siteUrl(`/turno/${appointment.public_token}`),
        })
        const phone = whatsappNumber(form.customer_phone) ?? ''
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      }
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
      window.dispatchEvent(new Event('agenda:changed'));
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

  const availability = useMemo(() => {
    if (!form?.date || !form?.time) return null
    const startUtc = new Date(zonedToUtc(form.date, form.time, data.timeZone)).getTime()
    const duration = Math.max(5, Number(form.duration) || data.settings.slot_minutes)
    const before=form.attention_mode==='home'?form.travel_before_minutes??0:0, after=form.attention_mode==='home'?form.travel_after_minutes??0:0
    const occupiedStartUtc=startUtc-before*60_000
    const endUtc = startUtc + (duration+(form.buffer??0)+after) * 60_000

    const profId = form.professional && form.professional !== NONE ? form.professional : null
    const profName = professionalName(profId) || 'Profesional asignado'

    // Filtrar citas del mismo día (en la zona horaria del negocio)
    const dayAppointments = data.appointments.filter((a) => {
      if (state?.mode === 'edit' && a.id === state.appointment.id) return false
      if (a.status === 'cancelled' || a.status === 'no_show') return false
      const apptLocal = utcToZoned(a.starts_at, data.timeZone)
      return apptLocal.date === form.date
    })

    // Buscar si hay superposición con el profesional seleccionado
    const conflict = dayAppointments.find((a) => {
      if (profId && a.professional_id && a.professional_id !== profId) {
        return false
      }
      const aStart = new Date(a.starts_at).getTime()-(a.travel_before_minutes??0)*60_000
      const aEnd = new Date(a.ends_at).getTime() + ((a.buffer_minutes || 0)+(a.travel_after_minutes??0)) * 60_000
      return aStart < endUtc && aEnd > occupiedStartUtc
    })

    if (conflict) {
      const conflictStart = utcToZoned(conflict.starts_at, data.timeZone)
      const conflictEnd = utcToZoned(conflict.ends_at, data.timeZone)

      // Sugerir hasta 3 o 4 huecos libres cercanos de ese profesional para el mismo día
      const freeSlots: string[] = []
      const step = Math.min(30, Math.max(15, data.settings.slot_minutes))
      const [currH, currM] = (form.time || '12:00').split(':').map((n) => parseInt(n, 10))
      const currentMinutes = (currH || 0) * 60 + (currM || 0)

      // 1. Buscar slots hacia adelante desde la hora seleccionada
      for (let offset = step; offset <= 240; offset += step) {
        const nextMin = currentMinutes + offset
        if (nextMin > 21 * 60) break
        const h = Math.floor(nextMin / 60)
        const m = nextMin % 60
        const tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

        const sStart = new Date(zonedToUtc(form.date, tStr, data.timeZone)).getTime()
        const sEnd = sStart + (duration+(form.buffer??0)+after) * 60_000

        const hasOverlap = dayAppointments.some((a) => {
          if (profId && a.professional_id && a.professional_id !== profId) return false
          const aStart = new Date(a.starts_at).getTime()-(a.travel_before_minutes??0)*60_000
          const aEnd = new Date(a.ends_at).getTime() + ((a.buffer_minutes || 0)+(a.travel_after_minutes??0)) * 60_000
          return aStart < sEnd && aEnd > sStart-before*60_000
        })

        if (!hasOverlap) {
          freeSlots.push(tStr)
          if (freeSlots.length >= 4) break
        }
      }

      // 2. Si hay pocos hacia adelante, buscar también hacia atrás
      if (freeSlots.length < 3) {
        for (let offset = step; offset <= 180; offset += step) {
          const prevMin = currentMinutes - offset
          if (prevMin < 8 * 60) break
          const h = Math.floor(prevMin / 60)
          const m = prevMin % 60
          const tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

          const sStart = new Date(zonedToUtc(form.date, tStr, data.timeZone)).getTime()
          const sEnd = sStart + (duration+(form.buffer??0)+after) * 60_000

          const hasOverlap = dayAppointments.some((a) => {
            if (profId && a.professional_id && a.professional_id !== profId) return false
            const aStart = new Date(a.starts_at).getTime()-(a.travel_before_minutes??0)*60_000
            const aEnd = new Date(a.ends_at).getTime() + ((a.buffer_minutes || 0)+(a.travel_after_minutes??0)) * 60_000
            return aStart < sEnd && aEnd > sStart-before*60_000
          })

          if (!hasOverlap && !freeSlots.includes(tStr)) {
            freeSlots.unshift(tStr)
            if (freeSlots.length >= 4) break
          }
        }
      }

      return {
        isAvailable: false,
        conflict: {
          customer: conflict.customer_name,
          service: conflict.service_name,
          time: `${conflictStart.time} a ${conflictEnd.time}`,
          professional: profName,
        },
        suggestedSlots: freeSlots,
      }
    }

    return {
      isAvailable: true,
      professional: profName,
      timeRange: `${form.time} a ${durationPreview || ''} hs`,
    }
  }, [
    form?.date,
    form?.time,
    form?.duration,
    form?.attention_mode,
    form?.travel_before_minutes,
    form?.travel_after_minutes,
    form?.buffer,
    professionalName,
    form?.professional,
    data.appointments,
    data.timeZone,
    data.settings.slot_minutes,
    state,
    durationPreview,
  ])

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl [&_input]:min-h-10 [&_input]:text-sm [&_textarea]:text-sm [&_[role=combobox]]:min-h-10">        {view ? (
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
              {view.attention_mode==='home' && <><dt className="text-muted-foreground">A domicilio</dt><dd>{view.service_address}<br/>{view.arrival_instructions}<br/>Traslados: {view.travel_before_minutes??0} min ida · {view.travel_after_minutes??0} min vuelta</dd></>}
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
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Scissors className="h-4 w-4" />
                  </span>
                  <div>
                    <DialogTitle className="text-lg font-bold">
                      {state.mode === 'create' ? 'Nuevo turno' : 'Editar turno'}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {state.mode === 'create'
                        ? 'Agendá una cita con detección automática de cliente y preferencias.'
                        : 'Modificá los detalles del turno.'}
                    </DialogDescription>
                  </div>
                </div>
                <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary shrink-0 hidden sm:inline-flex">
                  {form.date} · {form.time} hs
                </Badge>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-3.5 pt-1">
              {/* ——— COLUMNA IZQUIERDA: Cliente, Teléfono, alertas ——— */}
              <div className="space-y-3">
                {/* Sección: Cliente */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    👤 Cliente
                  </p>
                  <CustomerSearch form={form} setForm={setForm} />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="appt-phone" className="text-xs font-semibold">WhatsApp / Teléfono</Label>
                      <span className="text-[10px] text-muted-foreground">Para confirmación y recordatorio</span>
                    </div>
                    <Input id="appt-phone" inputMode="tel" value={form.customer_phone} placeholder="0981 123 456" onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} />
                  </div>
                </div>

                {/* Alerta: teléfono reconocido */}
                {phoneMatch && !form.customer_id && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-xs animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-foreground">
                        Teléfono reconocido: <b>{phoneMatch.name}</b> ({phoneMatch.visits} visita{phoneMatch.visits === 1 ? '' : 's'})
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm({
                          ...form,
                          customer_id: phoneMatch.id || null,
                          customer_name: phoneMatch.name,
                        })
                        if (phoneMatch.stats) {
                          setCustomerStats(phoneMatch.stats)
                        }
                        setPhoneMatch(null)
                        toast.success(`Datos de ${phoneMatch.name} cargados`)
                      }}
                      className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                    >
                      ⚡ Cargar datos
                    </Button>
                  </div>
                )}

                {/* Alerta: homónimos */}
                {homonymsList.length > 0 && !form.customer_id && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-950 dark:text-blue-200 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Clientes parecidos encontrados en tu base de datos:</span>
                    </div>
                    <p className="text-[11px] text-blue-900 dark:text-blue-300">
                      ¿El turno es para alguno de ellos? Vinculalo para evitar duplicados.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {homonymsList.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              customer_id: h.id,
                              customer_name: h.name,
                              customer_phone: h.whatsapp || h.phone || form.customer_phone,
                            })
                            setHomonymsList([])
                            toast.success(`Cliente ${h.name} seleccionado`)
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-blue-500/10 transition-all shadow-2xs cursor-pointer"
                        >
                          <span>👤 {h.name}</span>
                          {(h.ruc || h.phone) && (
                            <span className="text-[10px] text-muted-foreground">
                              ({h.ruc ? `CI: ${h.ruc}` : h.phone})
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">⚡ Elegir</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ficha de Cliente Habitual */}
                {form.customer_id && customerStats ? (
                  <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>Cliente Habitual</span>
                        <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary">
                          {customerStats.totalVisits} turno{customerStats.totalVisits === 1 ? '' : 's'}
                        </Badge>
                        {customerStats.customer?.ruc && (
                          <Badge variant="outline" className="font-mono text-[9px] border-primary/30">
                            CI: {customerStats.customer.ruc}
                          </Badge>
                        )}
                      </div>
                      {customerStats.lastAppointment && (
                        <span className="text-[10px] text-muted-foreground">
                          Último: {appointmentWhen(customerStats.lastAppointment.starts_at, data.timeZone).split(' a las')[0]}
                        </span>
                      )}
                    </div>

                    {customerStats.customer?.notes && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Nota: «{customerStats.customer.notes}»
                      </p>
                    )}

                    {customerStats.lastAppointment && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-background/90 border p-2 text-xs shadow-2xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">
                            {customerStats.lastAppointment.service_name}
                            {customerStats.lastAppointment.professional_id && ` · con ${professionalName(customerStats.lastAppointment.professional_id)}`}
                          </p>
                          {customerStats.lastAppointment.notes && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-60 italic">
                              «{customerStats.lastAppointment.notes}»
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={applyLastAppointmentPreferences}
                          className="h-7 text-[11px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Repetir último servicio
                        </Button>
                      </div>
                    )}

                    {customerStats.history.length > 1 && (
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowFullHistory(!showFullHistory)}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {showFullHistory ? 'Ocultar historial' : `Ver historial (${customerStats.history.length} visitas)`}
                        </button>

                        {showFullHistory && (
                          <div className="mt-1.5 max-h-28 overflow-y-auto space-y-1 divide-y rounded-lg border bg-background p-2">
                            {customerStats.history.map((h) => (
                              <div key={h.id} className="pt-1 first:pt-0 flex items-center justify-between text-[11px]">
                                <span>
                                  {appointmentWhen(h.starts_at, data.timeZone).split(' a las')[0]} · <b>{h.service_name}</b>
                                </span>
                                <span className="font-medium text-muted-foreground">
                                  {money(h.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : !form.customer_id && form.customer_name.trim().length >= 2 && (
                  showHabitualForm ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5 text-xs animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <UserCheck className="h-4 w-4 text-primary" />
                          <span>Registrar como cliente habitual</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowHabitualForm(false)}
                          className="text-[11px] text-muted-foreground hover:text-foreground font-semibold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Cédula de Identidad (opcional)
                          </Label>
                          <Input
                            value={customerRuc}
                            placeholder="ej: 4.567.890"
                            onChange={(e) => setCustomerRuc(e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Apodo / Nota distintiva (opcional)
                          </Label>
                          <Input
                            value={customerNickname}
                            placeholder="ej: Juancho - Mecánico"
                            onChange={(e) => setCustomerNickname(e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground">
                          <b>{form.customer_name}</b>{form.customer_phone ? ` · ${form.customer_phone}` : ''}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingCustomer}
                          onClick={() => void handleSaveAsRegularCustomer()}
                          className="h-7 text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {savingCustomer ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          Guardar como cliente habitual
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">¿Es un cliente nuevo que querés fidelizar?</span>
                        <p className="text-[10px] text-muted-foreground">
                          Guardalo con C.I. o apodo para distinguirlo de otros llamados igual.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowHabitualForm(true)}
                          className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground border rounded-lg bg-card"
                        >
                          + Cédula / Apodo
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={savingCustomer}
                          onClick={() => void handleSaveAsRegularCustomer()}
                          className="h-7 text-[11px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          {savingCustomer ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          Guardar como cliente habitual
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* ——— COLUMNA DERECHA: Servicio, Barbero, Fecha/Hora, Precio, Notas ——— */}
              <div className="space-y-3">
                {/* Sección: Servicio */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">✂️ Servicio</p>
                    {data.services.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {data.services.length} disponible{data.services.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {data.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pb-0.5">
                      {data.services.map((service) => {
                        const isSelected = form.service === service.product_id
                        return (
                          <button
                            key={service.product_id}
                            type="button"
                            onClick={() => chooseService(service.product_id)}
                            className={cn(
                              'flex flex-col items-start rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all shadow-2xs',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground font-bold ring-1 ring-primary/50'
                                : 'border-border bg-card text-foreground hover:bg-muted/70 hover:border-primary/40'
                            )}
                          >
                            <span className="font-semibold leading-tight">{service.name}</span>
                            <span className={cn('text-[10px] mt-0.5', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                              {money(service.price)} · {service.duration_minutes}min
                            </span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => chooseService(FREE)}
                        className={cn(
                          'flex flex-col items-start rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all shadow-2xs',
                          form.service === FREE
                            ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/40'
                            : 'border-dashed border-border/70 bg-background text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="font-semibold">✏️ Otro</span>
                        <span className="text-[10px] mt-0.5 text-muted-foreground">Escribir a mano</span>
                      </button>
                    </div>
                  )}

                  {form.service === FREE && (
                    <div className="space-y-1">
                      <Label htmlFor="appt-service" className="text-xs font-semibold">¿Qué se hace?</Label>
                      <Input
                        id="appt-service"
                        placeholder={isBarber?'Ej.: Corte de cabello o arreglo de barba':'Ej.: Consulta, mantenimiento o visita a domicilio'}
                        value={form.service_name}
                        onChange={(event) => setForm({ ...form, service_name: event.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* Sección: Barbero */}
                {(activeProfessionals.length > 0 || form.professional !== NONE) && (
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">💈 Atiende</p>
                    {activeProfessionals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activeProfessionals.map((prof) => (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() => applyTerms(form.service, prof.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all shadow-2xs',
                              form.professional === prof.id
                                ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/40'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                            )}
                          >
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: prof.color || '#6366f1' }} />
                            <span>{prof.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sección: Fecha, Hora, Duración */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">📅 Fecha y horario</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 space-y-1">
                      <Label htmlFor="appt-date" className="text-xs font-semibold">Día</Label>
                      <Input id="appt-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="text-sm" />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label htmlFor="appt-time" className="text-xs font-semibold">Hora</Label>
                      <Input id="appt-time" type="time" step={300} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="text-sm" />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="appt-duration" className="text-xs font-semibold">Min.</Label>
                        <div className="flex gap-0.5">
                          {[30, 45, 60].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              disabled={advanced && (form.service !== FREE || state.mode === 'edit')}
                              onClick={() => setForm({ ...form, duration: mins })}
                              className={cn(
                                'rounded px-1 text-[9px] font-bold transition-colors disabled:opacity-40',
                                form.duration === mins
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {mins}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input id="appt-duration" disabled={advanced&&(form.service!==FREE||state.mode==='edit')} type="number" min={5} step={5} value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} className="text-sm" />
                    </div>
                  </div>
                </div>

                {/* Indicador de disponibilidad */}
                {availability && (
                  availability.isAvailable ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-950 dark:text-emerald-200 shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold">Sin cruces en turnos cargados · {availability.professional}</span>
                          <span className="block text-[11px] text-emerald-800 dark:text-emerald-300">
                            {availability.timeRange} · {form.duration} min. Validamos horarios, ausencias y traslados al guardar.
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/40 bg-card font-bold text-[10px] text-emerald-700 dark:text-emerald-300 shrink-0">
                        ✓ Sin cruces
                      </Badge>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2 text-amber-950 dark:text-amber-200 shadow-2xs animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950 dark:text-amber-200">
                            Horario ocupado con {availability.conflict.professional}
                          </p>
                          <p className="text-[11px] text-amber-900 dark:text-amber-300">
                            Turno con <b>{availability.conflict.customer}</b> ({availability.conflict.time} hs · {availability.conflict.service})
                          </p>
                        </div>
                      </div>
                      {availability.suggestedSlots.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-500/25">
                          <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
                            ⚡ Horarios libres sugeridos hoy:
                          </span>
                          {availability.suggestedSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setForm({ ...form, time: slot })}
                              className="rounded-lg border border-amber-500/40 bg-card px-2.5 py-1 text-[11px] font-bold text-amber-950 dark:text-amber-200 shadow-2xs hover:bg-amber-500/20 transition-all cursor-pointer"
                            >
                              ⚡ {slot} hs
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Precio + Pendiente */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="appt-price" className="text-xs font-semibold">Precio ({data.currency})</Label>
                    <Input id="appt-price" disabled={advanced&&(form.service!==FREE||state.mode==='edit')} type="number" min={0} value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
                  </div>
                  {state.mode === 'create' && (
                    <label className="flex items-end gap-2 pb-2 text-xs font-medium text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={form.pending} onChange={(event) => setForm({ ...form, pending: event.target.checked })} />
                      Pendiente de confirmar
                    </label>
                  )}
                </div>

                {data.capabilities?.homeAppointments && <fieldset className="space-y-3 rounded-xl border p-3">
                  <legend className="px-1 text-sm font-semibold">Lugar de atención</legend>
                  <select aria-label="Lugar de atención" value={form.attention_mode??'local'} onChange={event=>setForm({...form,attention_mode:event.target.value as 'local'|'home',...(event.target.value==='local'?homeVisitDetails():{})})} className="h-11 w-full rounded-md border bg-background px-3 text-base"><option value="local">En el local</option><option value="home">A domicilio</option></select>
                  {form.attention_mode==='home'&&<>
                    <Label htmlFor="home-address">Dirección del cliente</Label><Input id="home-address" value={form.service_address??''} maxLength={500} onChange={event=>setForm({...form,service_address:event.target.value})} placeholder="Calle, número y ciudad" />
                    <Label htmlFor="home-instructions">Indicaciones para llegar</Label><Textarea id="home-instructions" value={form.arrival_instructions??''} maxLength={1000} onChange={event=>setForm({...form,arrival_instructions:event.target.value})}/>
                    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="travel-before">Traslado de ida (min)</Label><Input id="travel-before" type="number" min={0} max={180} value={form.travel_before_minutes??0} onChange={event=>setForm({...form,travel_before_minutes:Number(event.target.value)})}/></div><div><Label htmlFor="travel-after">Traslado de vuelta (min)</Label><Input id="travel-after" type="number" min={0} max={180} value={form.travel_after_minutes??0} onChange={event=>setForm({...form,travel_after_minutes:Number(event.target.value)})}/></div></div>
                    <p className="text-xs text-muted-foreground">Los traslados bloquean la agenda antes y después del servicio y deben quedar dentro del horario de atención. No cambian el precio.</p>
                  </>}
                </fieldset>}
                {/* Notas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="appt-notes" className="text-xs font-semibold">Notas del turno</Label>
                    <span className="text-[10px] text-muted-foreground">Atajos rápidos:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pb-0.5">
                    {(isBarber?[
                      '💈 Cliente habitual',
                      '⭐ Primera vez',
                      '✂️ Degradé navaja',
                      '🧔 Perfilado barba',
                      '⚠️ Piel sensible',
                      '🧴 Pomada mate',
                    ]:['Cliente habitual','Primera visita','Requiere preparación','Preferencias del cliente']).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = form.notes.trim()
                          const next = current ? (current.includes(tag) ? current : `${current}\n${tag}`) : tag
                          setForm({ ...form, notes: next })
                        }}
                        className="rounded-md border border-dashed border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  {changedTerms&&<label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={form.acceptNewTerms} onChange={event=>setForm({...form,acceptNewTerms:event.target.checked})}/>Acepto el nuevo profesional, precio {money(form.price)} y duración {form.duration} min.</label>}
                  {advanced&&data.canConfigure&&form.attention_mode!=='home'&&<label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={form.allowOutsideHours} onChange={event=>setForm({...form,allowOutsideHours:event.target.checked})}/>Autorizar fuera del horario como administrador.</label>}
                  <Textarea id="appt-notes" rows={2} placeholder="Preferencias del cliente o indicaciones para el servicio" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </div>
              </div>
            </div>

            {/* Fila inferior: WhatsApp + Resumen + Botones */}
            <div className="space-y-2.5 border-t pt-3 mt-1">
              {state.mode === 'create' && form.customer_phone.trim() && (
                <label className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyWhatsApp}
                    onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Enviar confirmación por WhatsApp al agendar
                </label>
              )}

              {form.customer_name.trim() && form.service_name.trim() && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 p-2.5 text-xs animate-in fade-in">
                  <div className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
                    <span className="font-bold text-foreground">👤 {form.customer_name}</span>
                    <span>·</span>
                    <span className="font-medium text-foreground">✂️ {form.service_name} ({form.duration}m)</span>
                    {form.professional && form.professional !== NONE && (
                      <>
                        <span>·</span>
                        <span>💈 {professionalName(form.professional) || 'Profesional'}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{form.date} {form.time} hs</span>
                  </div>
                  <div className="font-black text-foreground tabular-nums">
                    Total: {money(form.price)}
                  </div>
                </div>
              )}

              {advanced&&<p className="text-xs text-muted-foreground">Atención: {form.duration} min · Margen sin otro turno: {form.buffer} min.</p>}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
                <Button onClick={() => void save()} disabled={saving} className="font-bold px-6">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {state.mode === 'create' ? 'Agendar turno' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

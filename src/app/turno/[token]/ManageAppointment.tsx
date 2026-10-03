'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CalendarPlus, Loader2, X } from 'lucide-react'
import { addDays, weekdayOf } from '@/lib/agenda/time'
import { appointmentIcs } from '@/lib/agenda/ics'
import { cn } from '@/lib/utils'

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
/** Días que se ofrecen para mover el turno: dos semanas alcanzan y la tira entra en un celular. */
const RESCHEDULE_DAYS = 14

type Availability = { today: string; maxDaysAhead: number; openDays: number[] }

/**
 * Lo que el cliente puede hacer con su turno: agregarlo al calendario,
 * cambiar día u horario, o cancelarlo. Cambiar y cancelar solo antes de que
 * empiece; la API vuelve a validarlo.
 */
export function ManageAppointment({
  token,
  changeable,
  calendar,
}: {
  token: string
  changeable: boolean
  calendar: { startsAt: string; endsAt: string; title: string; location: string | null; url: string } | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'cancel'>('idle')
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Array<{ startsAt: string; time: string }> | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const downloadIcs = () => {
    if (!calendar) return
    const blob = new Blob([appointmentIcs({ uid: token, ...calendar })], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'turno.ics'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const openReschedule = async () => {
    setMode('reschedule')
    setError(null)
    if (availability) return
    const response = await fetch(`/api/public/appointment/${token}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) setError(body.error || 'No se pueden ver los horarios ahora.')
    else setAvailability(body as Availability)
  }

  const pickDate = async (day: string) => {
    setDate(day)
    setChosen(null)
    setSlots(null)
    const response = await fetch(`/api/public/appointment/${token}?date=${day}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(body.error || 'No se pudieron cargar los horarios.')
      setSlots([])
      return
    }
    setSlots(body.slots ?? [])
  }

  const send = async (payload: Record<string, unknown>, success: string) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/appointment/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'No se pudo hacer el cambio.')
        return
      }
      setDone(success)
      setMode('idle')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const days = availability
    ? Array.from({ length: Math.min(RESCHEDULE_DAYS, availability.maxDaysAhead + 1) }, (_, index) => addDays(availability.today, index))
        .filter((day) => availability.openDays.includes(weekdayOf(day)))
    : []

  return (
    <div className="space-y-3">
      {done && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{done}</p>}

      {calendar && (
        <button type="button" onClick={downloadIcs} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted/50">
          <CalendarPlus aria-hidden="true" className="h-4 w-4" />
          Agregar a mi calendario
        </button>
      )}

      {changeable && mode === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void openReschedule()} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <CalendarClock aria-hidden="true" className="h-4 w-4" />
            Cambiar horario
          </button>
          <button type="button" onClick={() => { setMode('cancel'); setError(null) }} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
            Cancelar turno
          </button>
        </div>
      )}

      {mode === 'reschedule' && (
        <section aria-label="Cambiar el horario" className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">¿Qué día te queda mejor?</p>
            <button type="button" onClick={() => setMode('idle')} aria-label="Cerrar" className="rounded-md p-1 hover:bg-muted"><X aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          {!availability && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Cargando días…</p>}
          {availability && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={date === day}
                  onClick={() => void pickDate(day)}
                  className={cn('flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-xs', date === day ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50')}
                >
                  <span>{SHORT_DAYS[weekdayOf(day)]}</span>
                  <span className="text-lg font-semibold">{Number(day.slice(8))}</span>
                </button>
              ))}
            </div>
          )}
          {date && slots === null && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Buscando horarios…</p>}
          {date && slots?.length === 0 && <p className="text-sm text-muted-foreground">No quedan horarios ese día. Probá con otro.</p>}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  aria-pressed={chosen === slot.startsAt}
                  onClick={() => setChosen(slot.startsAt)}
                  className={cn('rounded-lg border py-2 text-sm', chosen === slot.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50')}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={!chosen || busy}
            onClick={() => void send({ action: 'reschedule', starts_at: chosen }, 'Listo, cambiamos tu turno.')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            Confirmar nuevo horario
          </button>
        </section>
      )}

      {mode === 'cancel' && (
        <section aria-label="Cancelar el turno" className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm">¿Seguro que querés cancelar? El horario queda libre para otra persona.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('idle')} className="rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold">Volver</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send({ action: 'cancel' }, 'Cancelamos tu turno.')}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Sí, cancelar
            </button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Bell, CalendarCheck2, CalendarClock, CalendarX2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { describeAppointmentEvent, type AppointmentEventKind } from '@/lib/agenda/messages'
import { cn } from '@/lib/utils'

type AppointmentEvent = {
  id: string
  kind: AppointmentEventKind
  customer_name: string
  service_name: string
  starts_at: string
  previous_starts_at: string | null
  seen_at: string | null
  created_at: string
}

type EventsResponse = { events: AppointmentEvent[]; unseen: number; available: boolean }

const ICONS: Record<AppointmentEventKind, typeof Bell> = { booked: CalendarCheck2, rescheduled: CalendarClock, cancelled: CalendarX2 }
const TONES: Record<AppointmentEventKind, string> = {
  booked: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  rescheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const fetchEvents = async (url: string): Promise<EventsResponse> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return { events: [], unseen: 0, available: false }
  return response.json()
}

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

/**
 * Lo que hicieron los clientes desde la tienda: reservas online, cambios de
 * horario y cancelaciones. Se revisa cada minuto; si llega algo nuevo con la
 * Agenda abierta, avisa y recarga el tablero.
 */
export function AppointmentEventsBell({ timeZone, onNew }: { timeZone: string; onNew?: () => void }) {
  const { data, mutate } = useSWR('/api/agenda/events', fetchEvents, { refreshInterval: 60_000, revalidateOnFocus: true })
  const lastSeenTop = useRef<string | null>(null)

  useEffect(() => {
    const top = data?.events[0]
    if (!top) return
    // La primera carga no avisa: solo lo que llega mientras la Agenda está abierta.
    if (lastSeenTop.current && top.id !== lastSeenTop.current && !top.seen_at) {
      toast.info(describeAppointmentEvent({ kind: top.kind, customerName: top.customer_name, serviceName: top.service_name, startsAt: top.starts_at, previousStartsAt: top.previous_starts_at }, timeZone))
      onNew?.()
    }
    lastSeenTop.current = top.id
  }, [data, timeZone, onNew])

  if (!data?.available) return null
  const unseen = data.unseen

  const markSeen = async () => {
    await fetch('/api/agenda/events', { method: 'PATCH' })
    await mutate()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5" aria-label={unseen ? `Novedades de clientes: ${unseen} sin ver` : 'Novedades de clientes'}>
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Novedades</span>
          {unseen > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Novedades de clientes</p>
          {unseen > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markSeen()}>
              Marcar como vistas
            </Button>
          )}
        </div>
        {data.events.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Cuando un cliente reserve, cambie o cancele su turno desde la tienda, lo vas a ver acá.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {data.events.map((event) => {
              const Icon = ICONS[event.kind]
              return (
                <li key={event.id} className={cn('flex gap-3 px-4 py-3', !event.seen_at && 'bg-primary/5')}>
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONES[event.kind])}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      {describeAppointmentEvent({ kind: event.kind, customerName: event.customer_name, serviceName: event.service_name, startsAt: event.starts_at, previousStartsAt: event.previous_starts_at }, timeZone)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ago(event.created_at)}
                      {!event.seen_at && <span className="ml-2 font-semibold text-primary">Nueva</span>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

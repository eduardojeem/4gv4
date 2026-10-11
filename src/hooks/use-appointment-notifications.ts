'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import type { Notification } from '@/components/dashboard/notification-system'
import { describeAppointmentEvent, type AppointmentEventKind } from '@/lib/agenda/messages'

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

type EventsResponse = { events: AppointmentEvent[]; unseen: number; available: boolean; timeZone?: string }

const EVENTS_URL = '/api/agenda/events'
const PREFIX = 'agenda:'
const TITLES: Record<AppointmentEventKind, string> = {
  booked: 'Nueva reserva',
  rescheduled: 'Turno cambiado',
  cancelled: 'Turno cancelado',
}
const TYPES: Record<AppointmentEventKind, Notification['type']> = { booked: 'success', rescheduled: 'info', cancelled: 'warning' }

const fetchEvents = async (url: string): Promise<EventsResponse> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return { events: [], unseen: 0, available: false }
  return response.json()
}

export const isAppointmentNotification = (id: string) => id.startsWith(PREFIX)

/** Las reservas, cambios y cancelaciones de clientes como notificaciones del panel. */
export function appointmentEventsToNotifications(events: AppointmentEvent[], timeZone: string, onOpen: () => void): Notification[] {
  return events.map((event) => ({
    id: `${PREFIX}${event.id}`,
    type: TYPES[event.kind],
    category: 'agenda',
    title: TITLES[event.kind],
    message: describeAppointmentEvent({ kind: event.kind, customerName: event.customer_name, serviceName: event.service_name, startsAt: event.starts_at, previousStartsAt: event.previous_starts_at }, timeZone),
    timestamp: new Date(event.created_at),
    read: Boolean(event.seen_at),
    actionable: true,
    action: { label: 'Ver agenda', onClick: onOpen },
  }))
}

/**
 * Lo que hacen los clientes con sus turnos, en la campanita general del panel.
 * Antes solo se veía dentro de la Agenda: con otra pantalla abierta, una
 * reserva nueva pasaba desapercibida. Comparte la consulta con la campanita de
 * la Agenda (misma clave), así no se pide dos veces.
 */
export function useAppointmentNotifications(enabled: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const { data, mutate } = useSWR(enabled ? EVENTS_URL : null, fetchEvents, { refreshInterval: 60_000, revalidateOnFocus: true })
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const lastTop = useRef<string | null>(null)
  const timeZone = data?.timeZone || 'America/Asuncion'
  const onAgenda = pathname?.startsWith('/dashboard/agenda') ?? false

  const openAgenda = useCallback(() => router.push('/dashboard/agenda'), [router])

  // Aviso al llegar algo nuevo. En la Agenda ya avisa su propia campanita.
  useEffect(() => {
    const top = data?.events[0]
    if (!top) return
    if (lastTop.current && top.id !== lastTop.current && !top.seen_at && !onAgenda) {
      toast.info(TITLES[top.kind], {
        description: describeAppointmentEvent({ kind: top.kind, customerName: top.customer_name, serviceName: top.service_name, startsAt: top.starts_at, previousStartsAt: top.previous_starts_at }, timeZone),
        action: { label: 'Ver agenda', onClick: openAgenda },
      })
    }
    lastTop.current = top.id
  }, [data, onAgenda, timeZone, openAgenda])

  const items = useMemo(
    () => (data?.available ? appointmentEventsToNotifications(data.events.slice(0, 15), timeZone, openAgenda).filter((item) => !hidden.has(item.id)) : []),
    [data, timeZone, openAgenda, hidden],
  )

  const markSeen = useCallback(async (rawId?: string) => {
    const now = new Date().toISOString()
    await mutate(
      async (current) => {
        await fetch(EVENTS_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rawId ? { id: rawId } : {}) }).catch(() => undefined)
        return current
      },
      {
        optimisticData: (current) => current
          ? { ...current, unseen: rawId ? Math.max(0, current.unseen - 1) : 0, events: current.events.map((event) => (!rawId || event.id === rawId) && !event.seen_at ? { ...event, seen_at: now } : event) }
          : { events: [], unseen: 0, available: false },
        revalidate: true,
        rollbackOnError: true,
      },
    )
  }, [mutate])

  const markAsRead = useCallback((id: string) => void markSeen(id.slice(PREFIX.length)), [markSeen])
  const markAllAsRead = useCallback(() => void markSeen(), [markSeen])
  // No hay borrado de novedades: se marcan como vistas y se ocultan de la lista.
  const dismiss = useCallback((id: string) => {
    setHidden((current) => new Set(current).add(id))
    void markSeen(id.slice(PREFIX.length))
  }, [markSeen])
  const clearAll = useCallback(() => {
    setHidden((current) => new Set([...current, ...items.map((item) => item.id)]))
    void markSeen()
  }, [items, markSeen])

  return { items, markAsRead, markAllAsRead, dismiss, clearAll }
}

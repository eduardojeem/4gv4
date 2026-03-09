'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, CheckCircle2, Clock3, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface PublicRepairReadyNotificationsProps {
  userId: string
}

type NotificationRepairStatus = 'listo' | 'entregado'
type NotificationFilter = 'all' | 'unread' | NotificationRepairStatus

interface RepairStatusNotification {
  id: string
  ticketNumber: string | null
  deviceLabel: string
  updatedAt: string
  status: NotificationRepairStatus
  eventKey: string
}

const NOTIFICATION_STATUSES: NotificationRepairStatus[] = ['listo', 'entregado']
const NOTIFICATION_STATUS_SET = new Set<string>(NOTIFICATION_STATUSES)
const STORAGE_PREFIX = 'public:repair-ready:seen'
const HIDE_READ_STORAGE_PREFIX = 'public:repair-ready:hide-read'
const MAX_NOTIFICATIONS = 30
const POLL_INTERVAL_MS = 45000

const STATUS_META: Record<
  NotificationRepairStatus,
  {
    label: string
    message: (deviceLabel: string) => string
    iconClassName: string
    dotClassName: string
  }
> = {
  listo: {
    label: 'Listo para retirar',
    message: (deviceLabel) => `${deviceLabel} listo para retirar`,
    iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClassName: 'bg-emerald-500',
  },
  entregado: {
    label: 'Equipo entregado',
    message: (deviceLabel) => `${deviceLabel} fue entregado`,
    iconClassName: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    dotClassName: 'bg-sky-500',
  },
}

function parseSeenIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function formatRelativeTime(date: string): string {
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return 'Hace un momento'

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `Hace ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days}d`
  return new Date(timestamp).toLocaleDateString('es-PY', { dateStyle: 'medium' })
}

export function PublicRepairReadyNotifications({ userId }: PublicRepairReadyNotificationsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<RepairStatusNotification[]>([])
  const [seenIds, setSeenIds] = useState<string[]>([])
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [hideRead, setHideRead] = useState(true)
  const [storageReady, setStorageReady] = useState(false)
  const knownKeysRef = useRef<Set<string>>(new Set())
  const bootstrappedToastRef = useRef(false)
  const seenIdsRef = useRef<string[]>([])

  const storageKey = `${STORAGE_PREFIX}:${userId}`
  const hideReadStorageKey = `${HIDE_READ_STORAGE_PREFIX}:${userId}`

  const unreadSet = useMemo(() => new Set(seenIds), [seenIds])

  const unreadCount = useMemo(() => {
    if (notifications.length === 0) return 0
    return notifications.reduce(
      (acc, notification) => acc + (unreadSet.has(notification.eventKey) ? 0 : 1),
      0
    )
  }, [notifications, unreadSet])

  const counts = useMemo(() => {
    let ready = 0
    let delivered = 0
    let unread = 0

    for (const notification of notifications) {
      if (notification.status === 'listo') ready += 1
      if (notification.status === 'entregado') delivered += 1
      if (!unreadSet.has(notification.eventKey)) unread += 1
    }

    return {
      total: notifications.length,
      ready,
      delivered,
      unread,
    }
  }, [notifications, unreadSet])

  const filteredNotifications = useMemo(() => {
    let base: RepairStatusNotification[]

    if (filter === 'all') {
      base = notifications
    } else if (filter === 'unread') {
      base = notifications.filter((notification) => !unreadSet.has(notification.eventKey))
    } else {
      base = notifications.filter((notification) => notification.status === filter)
    }

    if (hideRead && filter !== 'unread') {
      return base.filter((notification) => !unreadSet.has(notification.eventKey))
    }

    return base
  }, [filter, hideRead, notifications, unreadSet])

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'Todas', count: counts.total },
      { key: 'unread' as const, label: 'Sin leer', count: counts.unread },
      { key: 'listo' as const, label: 'Listo', count: counts.ready },
      { key: 'entregado' as const, label: 'Entregado', count: counts.delivered },
    ],
    [counts]
  )

  const persistSeenIds = useCallback((next: string[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {}
  }, [storageKey])

  const applySeenIds = useCallback((next: string[]) => {
    seenIdsRef.current = next
    setSeenIds(next)
    persistSeenIds(next)
  }, [persistSeenIds])

  const markAsRead = useCallback((eventKey: string) => {
    const current = new Set(seenIdsRef.current)
    if (current.has(eventKey)) return
    current.add(eventKey)
    applySeenIds(Array.from(current))
  }, [applySeenIds])

  const markAsUnread = useCallback((eventKey: string) => {
    if (!seenIdsRef.current.includes(eventKey)) return
    const next = seenIdsRef.current.filter((value) => value !== eventKey)
    applySeenIds(next)
  }, [applySeenIds])

  const markAllAsRead = useCallback(() => {
    const merged = new Set(seenIdsRef.current)
    for (const notification of notifications) {
      merged.add(notification.eventKey)
    }
    const next = Array.from(merged)
    if (next.length === seenIdsRef.current.length) return
    applySeenIds(next)
  }, [applySeenIds, notifications])

  const restoreUnreadKeys = useCallback((eventKeys: string[]) => {
    if (!eventKeys.length) return

    const keySet = new Set(eventKeys)
    const next = seenIdsRef.current.filter((value) => !keySet.has(value))
    if (next.length === seenIdsRef.current.length) return
    applySeenIds(next)
  }, [applySeenIds])

  const fetchRepairNotifications = useCallback(async (targetCustomerId: string) => {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, ticket_number, device_brand, device_model, updated_at, created_at, status')
      .eq('customer_id', targetCustomerId)
      .in('status', NOTIFICATION_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    const mapped = (data || []).map((repair: any) => {
      const brand = String(repair?.device_brand || '').trim()
      const model = String(repair?.device_model || '').trim()
      const deviceLabel = [brand, model].filter(Boolean).join(' ') || 'Equipo'
      const rawStatus = String(repair?.status || '').trim().toLowerCase()
      if (!NOTIFICATION_STATUS_SET.has(rawStatus)) {
        return null
      }
      const status = rawStatus as NotificationRepairStatus
      const eventKey = `${String(repair.id)}:${status}`

      return {
        id: String(repair.id),
        ticketNumber: repair.ticket_number ? String(repair.ticket_number) : null,
        deviceLabel,
        updatedAt: String(repair.updated_at || repair.created_at || new Date().toISOString()),
        status,
        eventKey,
      } as RepairStatusNotification
    }).filter((item): item is RepairStatusNotification => Boolean(item))

    mapped.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    setNotifications(mapped.slice(0, MAX_NOTIFICATIONS))
  }, [supabase])

  useEffect(() => {
    if (!userId) {
      setCustomerId(null)
      setNotifications([])
      setLoading(false)
      return
    }

    let cancelled = false

    const loadCustomer = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to resolve customer for public notifications:', error)
        setCustomerId(null)
        setNotifications([])
        setLoading(false)
        return
      }

      setCustomerId(data?.id ? String(data.id) : null)
      if (!data?.id) {
        setNotifications([])
        setLoading(false)
      }
    }

    loadCustomer()

    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  useEffect(() => {
    try {
      const initial = parseSeenIds(localStorage.getItem(storageKey))
      seenIdsRef.current = initial
      setSeenIds(initial)
    } catch {
      seenIdsRef.current = []
      setSeenIds([])
    } finally {
      setStorageReady(true)
    }
  }, [storageKey])

  useEffect(() => {
    seenIdsRef.current = seenIds
  }, [seenIds])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(hideReadStorageKey)
      setHideRead(raw === null ? true : raw === '1')
    } catch {
      setHideRead(true)
    }
  }, [hideReadStorageKey])

  useEffect(() => {
    if (!storageReady) return
    try {
      localStorage.setItem(hideReadStorageKey, hideRead ? '1' : '0')
    } catch {}
  }, [hideRead, hideReadStorageKey, storageReady])

  useEffect(() => {
    if (!storageReady) return
    if (seenIdsRef.current.length === 0 || notifications.length === 0) return
    const allowed = new Set(notifications.map((notification) => notification.eventKey))
    const next = seenIdsRef.current.filter((value) => allowed.has(value))
    if (next.length === seenIdsRef.current.length) return
    applySeenIds(next)
  }, [applySeenIds, notifications, storageReady])

  useEffect(() => {
    if (!customerId) return

    let cancelled = false

    const load = async () => {
      try {
        await fetchRepairNotifications(customerId)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load repair notifications:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    const interval = window.setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)

    const channel = supabase
      .channel(`public-repair-status-notifications-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string } | null)?.status
          const prevStatus = (payload.old as { status?: string } | null)?.status
          if (
            (typeof nextStatus === 'string' && NOTIFICATION_STATUS_SET.has(nextStatus.toLowerCase())) ||
            (typeof prevStatus === 'string' && NOTIFICATION_STATUS_SET.has(prevStatus.toLowerCase()))
          ) {
            void load()
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [customerId, fetchRepairNotifications, supabase])

  useEffect(() => {
    if (!storageReady || loading) return

    const currentKeys = new Set(notifications.map((notification) => notification.eventKey))
    if (!bootstrappedToastRef.current) {
      knownKeysRef.current = currentKeys
      bootstrappedToastRef.current = true
      return
    }

    const known = knownKeysRef.current
    const unseen = new Set(seenIds)
    const freshNotifications = notifications.filter(
      (notification) => !known.has(notification.eventKey) && !unseen.has(notification.eventKey)
    )

    if (freshNotifications.length === 1) {
      const fresh = freshNotifications[0]
      const statusLabel = STATUS_META[fresh.status].label
      toast.info(`Actualizacion: ${statusLabel}`, {
        description: `Reparacion ${fresh.ticketNumber || fresh.id.slice(0, 8).toUpperCase()}`,
      })
    } else if (freshNotifications.length > 1) {
      toast.info(`Tienes ${freshNotifications.length} notificaciones nuevas`)
    }

    knownKeysRef.current = currentKeys
  }, [loading, notifications, seenIds, storageReady])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full p-0 ring-2 ring-transparent transition-all hover:ring-border"
          aria-label={
            unreadCount > 0
              ? `Notificaciones de reparacion, ${unreadCount} nuevas`
              : 'Notificaciones de reparacion'
          }
        >
          <Bell className={cn('h-4 w-4', unreadCount > 0 && 'text-emerald-600 dark:text-emerald-400')} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-emerald-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[23rem]">
        <div className="px-2 py-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Notificaciones</p>
              <Badge variant="secondary" className="text-[11px]">
                {counts.unread} sin leer
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Listo: {counts.ready}</span>
              <span>Entregado: {counts.delivered}</span>
            </div>
          </div>
        </div>

        <div className="px-2 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                variant={filter === option.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() => setFilter(option.key)}
              >
                {option.label}
                <span className="ml-1 text-[10px] opacity-80">{option.count}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs text-muted-foreground">
            {filter === 'all' ? 'Ultimos eventos' : `Filtro: ${filterOptions.find((f) => f.key === filter)?.label}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant={hideRead ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setHideRead((prev) => !prev)}
            >
              {hideRead ? 'Mostrando pendientes' : 'Mostrar leidas'}
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const unreadKeys = notifications
                    .filter((notification) => !unreadSet.has(notification.eventKey))
                    .map((notification) => notification.eventKey)

                  if (!unreadKeys.length) return

                  markAllAsRead()
                  toast.success(
                    unreadKeys.length === 1
                      ? '1 notificacion marcada como leida'
                      : `${unreadKeys.length} notificaciones marcadas como leidas`,
                    {
                      action: {
                        label: 'Deshacer',
                        onClick: () => restoreUnreadKeys(unreadKeys),
                      },
                    }
                  )
                }}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Marcar leidas
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-96 overflow-y-auto px-2 pb-2">
          {loading && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Cargando notificaciones...</p>
          )}

          {!loading && notifications.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">No hay notificaciones de estado.</p>
          )}

          {!loading && filteredNotifications.length === 0 && notifications.length > 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {counts.unread === 0 && (filter === 'all' || filter === 'unread')
                ? 'No tienes notificaciones pendientes.'
                : 'No hay resultados para este filtro.'}
            </p>
          )}

          {!loading &&
            filteredNotifications.map((notification) => {
              const unread = !unreadSet.has(notification.eventKey)
              const ticket = notification.ticketNumber || notification.id.slice(0, 8).toUpperCase()
              const meta = STATUS_META[notification.status]
              const href = notification.ticketNumber
                ? `/mis-reparaciones/${encodeURIComponent(notification.ticketNumber)}`
                : '/mis-reparaciones'

              return (
                <div
                  key={notification.eventKey}
                  className={cn(
                    'mb-1.5 rounded-lg border p-2.5 transition-colors',
                    unread
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10'
                      : 'border-border/70 bg-background'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn('mt-0.5 rounded-md p-1.5', meta.iconClassName)}>
                      {notification.status === 'listo' ? (
                        <Wrench className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">Reparacion {ticket}</p>
                        {unread && <span className={cn('mt-1 h-2 w-2 rounded-full', meta.dotClassName)} />}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{meta.message(notification.deviceLabel)}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          <span>{formatRelativeTime(notification.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              if (unread) {
                                markAsRead(notification.eventKey)
                                toast.success('Marcada como leida', {
                                  action: {
                                    label: 'Deshacer',
                                    onClick: () => markAsUnread(notification.eventKey),
                                  },
                                })
                                return
                              }

                              markAsUnread(notification.eventKey)
                            }}
                          >
                            {unread ? 'Marcar leida' : 'No leida'}
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                          >
                            <Link href={href} onClick={() => markAsRead(notification.eventKey)}>
                              Ver
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/mis-reparaciones">Ver mis reparaciones</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

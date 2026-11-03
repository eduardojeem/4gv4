import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { Alert, AppState } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { apiFetch } from './api'
import { getPushPermissionStatus, requestNativePushPermission, registerDeviceForPush, resolveNotificationRoute } from './push-notifications'
import { getPrivateCacheContext, subscribePrivateCacheContext } from './private-cache-context'
import { NotificationPermissionModal } from '../components/NotificationPermissionModal'

type Permission = 'granted' | 'denied' | 'undetermined'
type Payload = { notificationId?: string; organizationId?: string; type?: string; resourceType?: string; resourceId?: string }
interface ContextValue { unreadCount: number; feedVersion: number; refreshUnreadCount: () => Promise<void>; permissionStatus: Permission; promptForPermission: () => Promise<void> }
const Context = createContext<ContextValue | null>(null)
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [feedVersion, setFeedVersion] = useState(0)
  const [permissionStatus, setPermissionStatus] = useState<Permission>('undetermined')
  const [showPrompt, setShowPrompt] = useState(false)
  const pending = useRef<Notifications.NotificationResponse | null>(null)
  const handled = useRef(new Set<string>())
  const countRequest = useRef(0)
  const refreshUnreadCount = useCallback(async () => {
    const scope = getPrivateCacheContext(), generation = ++countRequest.current
    if (!scope.userId || !scope.organizationId) { setUnreadCount(0); return }
    try {
      const result = await apiFetch<{ count: number }>('/api/notifications/unread-count')
      if (scope.epoch !== getPrivateCacheContext().epoch || generation !== countRequest.current) return
      setUnreadCount(result.count)
      void Notifications.setBadgeCountAsync(result.count).catch(() => undefined)
    } catch { /* Conservar el último conteo confirmado si no hay red. */ }
  }, [])
  const handleResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const scope = getPrivateCacheContext()
    if (!scope.userId || !scope.organizationId) { pending.current = response; return }
    const key = response.notification.request.identifier
    if (handled.current.has(key)) return
    handled.current.add(key); pending.current = null
    const data = response.notification.request.content.data as Payload
    Notifications.clearLastNotificationResponse()
    if (data.organizationId && data.organizationId !== scope.organizationId) {
      router.push('/panel/notifications'); return
    }
    if (typeof data.notificationId === 'string') {
      try { await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ notificationId: data.notificationId }) }) }
      catch { Alert.alert('No se guardó la lectura', 'Podés reintentar desde la bandeja de notificaciones.') }
    }
    if (scope.epoch !== getPrivateCacheContext().epoch) return
    router.push(resolveNotificationRoute(data) as never)
    setFeedVersion(v => v + 1); void refreshUnreadCount()
  }, [refreshUnreadCount])
  useEffect(() => {
    let active = true
    const synchronize = async () => {
      const status = await getPushPermissionStatus()
      if (!active) return
      setPermissionStatus(status)
      const scope = getPrivateCacheContext()
      if (status === 'granted' && scope.userId && scope.organizationId) await registerDeviceForPush()
      if (active) { void refreshUnreadCount(); setFeedVersion(v => v + 1) }
      if (pending.current) void handleResponse(pending.current)
    }
    void synchronize()
    const app = AppState.addEventListener('change', state => { if (state === 'active') void synchronize() })
    const scope = subscribePrivateCacheContext(() => { countRequest.current++; setUnreadCount(0); void Notifications.setBadgeCountAsync(0).catch(() => undefined); void synchronize() })
    const receive = Notifications.addNotificationReceivedListener(() => { void refreshUnreadCount(); setFeedVersion(v => v + 1) })
    const response = Notifications.addNotificationResponseReceivedListener(value => { void handleResponse(value) })
    const initial = Notifications.getLastNotificationResponse()
    if (initial) queueMicrotask(() => { if (active) void handleResponse(initial) })
    return () => { active = false; app.remove(); scope(); receive.remove(); response.remove() }
  }, [refreshUnreadCount, handleResponse])
  const promptForPermission = async () => { setShowPrompt(true) }
  const accept = async () => {
    setShowPrompt(false)
    const status = await requestNativePushPermission(); setPermissionStatus(status)
    if (status === 'granted') { await registerDeviceForPush(); await refreshUnreadCount() }
  }
  return <Context.Provider value={{ unreadCount, feedVersion, refreshUnreadCount, permissionStatus, promptForPermission }}>{children}<NotificationPermissionModal visible={showPrompt} onAccept={() => void accept()} onDismiss={() => setShowPrompt(false)} /></Context.Provider>
}
export function useNotifications() { const context = useContext(Context); if (!context) throw new Error('Falta NotificationsProvider'); return context }

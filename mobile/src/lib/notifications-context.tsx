import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { apiFetch } from './api'
import { secureStorage } from './secure-storage'
import {
  getPushPermissionStatus,
  requestNativePushPermission,
  registerDeviceForPush,
  resolveNotificationRoute,
  PRE_PERMISSION_DISMISSED_KEY,
} from './push-notifications'
import {
  getPrivateCacheContext,
  subscribePrivateCacheContext,
  type PrivateCacheContext,
} from './private-cache-context'
import { NotificationPermissionModal } from '../components/NotificationPermissionModal'

interface NotificationsContextValue {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  permissionStatus: 'granted' | 'denied' | 'undetermined'
  promptForPermission: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined')
  const [showPrePermissionModal, setShowPrePermissionModal] = useState<boolean>(false)

  const initialResponseHandled = useRef<boolean>(false)
  const lastRegisteredOrg = useRef<string | null>(null)

  const refreshUnreadCount = useCallback(async () => {
    const scope = getPrivateCacheContext()
    if (!scope.userId || !scope.organizationId) return

    try {
      const data = await apiFetch<{ count: number }>('/api/notifications/unread-count')
      if (typeof data?.count === 'number') {
        setUnreadCount(data.count)
      }
    } catch {
      // Ignorar fallos de red al refrescar el contador
    }
  }, [])

  // 1. Consultar estado inicial de permisos y conteo al montar
  useEffect(() => {
    let mounted = true

    async function init() {
      const status = await getPushPermissionStatus()
      if (!mounted) return
      setPermissionStatus(status)

      // Si está otorgado, registrar el token para el usuario y comercio actual
      if (status === 'granted') {
        const scope = getPrivateCacheContext()
        if (scope.userId && scope.organizationId) {
          lastRegisteredOrg.current = scope.organizationId
          await registerDeviceForPush()
        }
      } else if (status === 'undetermined') {
        // Verificar si el usuario ya descartó el pre-permiso previamente
        const dismissed = await secureStorage.getItem(PRE_PERMISSION_DISMISSED_KEY)
        if (!dismissed && mounted) {
          setShowPrePermissionModal(true)
        }
      }

      await refreshUnreadCount()
    }

    init()

    return () => {
      mounted = false
    }
  }, [refreshUnreadCount])

  // 2. Reaccionar al cambio de organización (Organization Switching)
  useEffect(() => {
    const unsubscribe = subscribePrivateCacheContext(async (next: PrivateCacheContext, previous: PrivateCacheContext) => {
      if (!next.userId || !next.organizationId) return

      // Si cambió la organización activa
      if (next.organizationId !== previous.organizationId || next.organizationId !== lastRegisteredOrg.current) {
        lastRegisteredOrg.current = next.organizationId

        const status = await getPushPermissionStatus()
        if (status === 'granted') {
          await registerDeviceForPush()
        }
        await refreshUnreadCount()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [refreshUnreadCount])

  // 3. Listener de Notificaciones en Primer Plano (Foreground)
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Al recibir una notificación en foreground, refrescar el conteo de no leídas
      refreshUnreadCount()
    })

    return () => {
      subscription.remove()
    }
  }, [refreshUnreadCount])

  // 4. Listener de Toque / Respuesta de Notificación (Tap / Background)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string
        resourceType?: string
        resourceId?: string
      }

      if (data) {
        const route = resolveNotificationRoute(data)
        router.push(route as any)
        refreshUnreadCount()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [refreshUnreadCount])

  // 5. Gestión de Cold Start (arranque de la app desde una notificación cerrada)
  useEffect(() => {
    if (initialResponseHandled.current) return
    initialResponseHandled.current = true

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      const data = response.notification.request.content.data as {
        type?: string
        resourceType?: string
        resourceId?: string
      }
      if (data) {
        const route = resolveNotificationRoute(data)
        // Pequeño timeout para permitir que la jerarquía de rutas esté montada
        setTimeout(() => {
          router.push(route as any)
          refreshUnreadCount()
        }, 300)
      }
    })
  }, [refreshUnreadCount])

  // Acción al aceptar el modal de pre-permiso
  const handleAcceptPrePermission = async () => {
    setShowPrePermissionModal(false)
    const newStatus = await requestNativePushPermission()
    setPermissionStatus(newStatus)

    if (newStatus === 'granted') {
      const scope = getPrivateCacheContext()
      if (scope.userId && scope.organizationId) {
        lastRegisteredOrg.current = scope.organizationId
        await registerDeviceForPush()
      }
      await refreshUnreadCount()
    }
  }

  // Acción al descartar ("Ahora no")
  const handleDismissPrePermission = async () => {
    setShowPrePermissionModal(false)
    try {
      await secureStorage.setItem(PRE_PERMISSION_DISMISSED_KEY, 'true')
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  const promptForPermission = async () => {
    setShowPrePermissionModal(true)
  }

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        permissionStatus,
        promptForPermission,
      }}>
      {children}
      <NotificationPermissionModal
        visible={showPrePermissionModal}
        onAccept={handleAcceptPrePermission}
        onDismiss={handleDismissPrePermission}
      />
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de un NotificationsProvider')
  }
  return context
}

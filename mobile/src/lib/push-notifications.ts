import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiFetch } from './api'
import { secureStorage } from './secure-storage'

const DEVICE_ID_STORAGE_KEY = 'mt_push_device_id'
const PRE_PERMISSION_DISMISSED_KEY = 'mt_push_pre_permission_dismissed'

let memoryDeviceId: string | null = null

/**
 * Obtiene o genera de forma persistente un identificador único seguro de instalación.
 * Mismo dispositivo e instalación -> mismo deviceId.
 * No utiliza identificadores de hardware invasivos.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (memoryDeviceId) return memoryDeviceId

  try {
    const existing = await secureStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (existing && existing.trim().length > 0) {
      memoryDeviceId = existing.trim()
      return memoryDeviceId
    }
  } catch {
    // Si falla la lectura en secure storage, se genera uno nuevo
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`

  memoryDeviceId = generated
  try {
    await secureStorage.setItem(DEVICE_ID_STORAGE_KEY, generated)
  } catch (err) {
    console.warn('[push-notifications] No se pudo persistir deviceId en secure storage', err)
  }

  return generated
}

/**
 * Resuelve el EAS Project ID configurado en el proyecto.
 */
export function getEasProjectId(): string | null {
  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined) ??
    null
  return projectId && projectId.trim().length > 0 ? projectId.trim() : null
}

/**
 * Verifica el estado actual de permisos de notificación del sistema operativo.
 */
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied'
  try {
    const settings = await Notifications.getPermissionsAsync()
    if (settings.granted || settings.status === 'granted') return 'granted'
    if (settings.canAskAgain) return 'undetermined'
    return 'denied'
  } catch (err) {
    console.warn('[push-notifications] Error al consultar permisos:', err)
    return 'undetermined'
  }
}

/**
 * Solicita los permisos nativos al sistema operativo (iOS / Android).
 */
export async function requestNativePushPermission(): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'web') return 'denied'
  try {
    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    })
    return settings.granted || settings.status === 'granted' ? 'granted' : 'denied'
  } catch (err) {
    console.warn('[push-notifications] Error al solicitar permisos nativos:', err)
    return 'denied'
  }
}

/**
 * Registra los canales de notificación necesarios en Android.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones del negocio',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#111827',
      sound: 'default',
    })
  }
}

/**
 * Registra el dispositivo actual en el backend para la organización activa.
 */
export async function registerDeviceForPush(): Promise<{ success: boolean; token?: string; error?: string }> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Push no soportado en plataforma web' }
  }

  const permission = await getPushPermissionStatus()
  if (permission !== 'granted') {
    return { success: false, error: 'Permisos de notificación no otorgados' }
  }

  const projectId = getEasProjectId()
  if (!projectId) {
    return { success: false, error: 'extra.eas.projectId no configurado en la aplicación' }
  }

  try {
    await setupNotificationChannels()

    const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    const pushToken = pushTokenData.data
    const deviceId = await getOrCreateDeviceId()
    const appVersion = Constants.expoConfig?.version ?? '1.0.0'
    const platform = Platform.OS === 'ios' ? 'ios' : 'android'

    await apiFetch('/api/mobile/push/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        platform,
        pushToken,
        appVersion,
      }),
    })

    return { success: true, token: pushToken }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar token de notificación'
    console.warn('[push-notifications] Fallo al registrar dispositivo push:', message)
    return { success: false, error: message }
  }
}

/**
 * Desregistra el dispositivo push en el backend al cerrar sesión.
 * Si ocurre un fallo de red o del servidor, NUNCA debe bloquear el cierre de sesión.
 */
export async function unregisterDeviceFromPush(): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const deviceId = await getOrCreateDeviceId()
    await apiFetch('/api/mobile/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    })
  } catch (err) {
    console.warn('[push-notifications] Error no fatal al desregistrar dispositivo al cerrar sesión:', err)
  }
}

export { resolveNotificationRoute } from '../../../src/lib/notifications/routes'

/**
 * Configuración global del handler de notificaciones en primer plano.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export { PRE_PERMISSION_DISMISSED_KEY }

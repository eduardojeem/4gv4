import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
}

export interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded' | string
    [key: string]: unknown
  }
}

export interface ExpoPushSendResult {
  attempted: number
  delivered: number
  failed: number
  invalidTokens: string[]
  errors: string[]
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const DEFAULT_TIMEOUT_MS = 8000
const MAX_BATCH_SIZE = 100

/**
 * Valida si un string cumple el formato oficial de token de Expo Push:
 * `ExponentPushToken[...]` o `ExpoPushToken[...]` con contenido alfanumérico válido.
 */
export function isValidExpoPushToken(token: unknown): token is string {
  if (typeof token !== 'string') return false
  const trimmed = token.trim()
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$/.test(trimmed)
}

/**
 * Divide un array en lotes más pequeños.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Envía un lote de notificaciones push a través de la API oficial de Expo Push.
 * Esta función es completamente segura y a prueba de fallos: nunca lanza excepciones hacia
 * la transacción de negocio ni interrumpe la persistencia in-app.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
  options: { timeoutMs?: number } = {}
): Promise<ExpoPushSendResult> {
  const result: ExpoPushSendResult = {
    attempted: messages.length,
    delivered: 0,
    failed: 0,
    invalidTokens: [],
    errors: [],
  }

  if (messages.length === 0) {
    return result
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const validMessages: ExpoPushMessage[] = []

  for (const msg of messages) {
    if (isValidExpoPushToken(msg.to)) {
      validMessages.push({
        ...msg,
        sound: msg.sound ?? 'default',
        channelId: msg.channelId ?? 'default',
        priority: msg.priority ?? 'high',
      })
    } else {
      result.failed++
      result.invalidTokens.push(String(msg.to))
      result.errors.push(`Token de Expo inválido: ${String(msg.to)}`)
    }
  }

  if (validMessages.length === 0) {
    return result
  }

  const batches = chunkArray(validMessages, MAX_BATCH_SIZE)
  const tokensToDeactivate: string[] = []

  for (const batch of batches) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        logger.warn('Expo push API HTTP error', { status: response.status, errorText })
        result.failed += batch.length
        result.errors.push(`Expo HTTP ${response.status}: ${errorText.slice(0, 100)}`)
        continue
      }

      const body = (await response.json().catch(() => ({}))) as { data?: ExpoPushTicket[] }
      const tickets = Array.isArray(body?.data) ? body.data : []

      if (tickets.length === 0) {
        result.failed += batch.length
        result.errors.push('Respuesta vacía o inesperada de Expo Push API.')
        continue
      }

      for (let i = 0; i < batch.length; i++) {
        const ticket = tickets[i]
        const originalMessage = batch[i]

        if (!ticket || ticket.status === 'ok') {
          result.delivered++
        } else {
          result.failed++
          const errorType = ticket.details?.error ?? ticket.message ?? 'UnknownError'
          result.errors.push(`Ticket error para token: ${errorType}`)

          // Token inválido o desinstalado reportado por Expo: marcar push_device.enabled = false
          if (ticket.details?.error === 'DeviceNotRegistered') {
            tokensToDeactivate.push(originalMessage.to)
          }
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer)
      const message = err instanceof Error ? err.message : 'Error desconocido al invocar Expo Push'
      logger.warn('Fallo no fatal al despachar Expo Push', { error: message })
      result.failed += batch.length
      result.errors.push(message)
    }
  }

  // Desactivar tokens obsoletos detectados de forma asíncrona pero segura
  if (tokensToDeactivate.length > 0) {
    try {
      const admin = createAdminSupabase()
      await admin
        .from('push_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in('push_token', tokensToDeactivate)

      logger.info('Tokens obsoletos desactivados en push_devices', { count: tokensToDeactivate.length })
    } catch (err) {
      logger.warn('Error al desactivar tokens obsoletos en push_devices', { err })
    }
  }

  return result
}

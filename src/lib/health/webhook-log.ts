import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export type WebhookOutcome = 'processed' | 'ignored' | 'rejected' | 'error'

/** Código corto y estable para el panel; nunca el mensaje crudo del error. */
export function webhookErrorCode(status: number, message?: string | null): string | null {
  if (status < 400) return null
  const normalized = (message ?? '').toLowerCase()
  if (normalized.includes('token')) return 'invalid_token'
  if (normalized.includes('amount')) return 'invalid_amount'
  if (normalized.includes('payload')) return 'invalid_payload'
  if (normalized.includes('not found')) return 'payment_not_found'
  if (normalized.includes('not applied')) return 'payment_not_applied'
  return status >= 500 ? 'processing_error' : `http_${status}`
}

export function webhookOutcome(status: number): WebhookOutcome {
  if (status < 300) return 'processed'
  if (status < 500) return 'rejected'
  return 'error'
}

/**
 * Registra una notificación recibida para /superadmin/system-health.
 * Nunca lanza: un fallo de registro no puede afectar el procesamiento del pago.
 * Nunca guarda payload, tokens, hashes de pedido ni firmas.
 */
export async function recordWebhookEvent(event: {
  provider: string
  endpoint: string
  status: number
  errorMessage?: string | null
}): Promise<void> {
  try {
    const admin = createAdminSupabase()
    const { error } = await admin.from('payment_webhook_events').insert({
      provider: event.provider,
      endpoint: event.endpoint,
      outcome: webhookOutcome(event.status),
      http_status: event.status,
      error_code: webhookErrorCode(event.status, event.errorMessage),
    })
    if (error) logger.warn('[webhook-log] no se pudo registrar el evento', error.code)
  } catch (error) {
    logger.warn('[webhook-log] no se pudo registrar el evento', error instanceof Error ? error.name : 'unknown')
  }
}

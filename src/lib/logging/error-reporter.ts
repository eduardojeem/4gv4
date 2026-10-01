/**
 * Utilidad de Monitoreo y Reporte de Errores
 * Guarda errores en Supabase (tabla system_error_logs) y despacha alertas a Telegram si está configurado.
 */

export interface ErrorReportPayload {
  name: string
  message: string
  stack?: string | null
  digest?: string | null
  url?: string | null
  source?: 'client' | 'server' | 'boundary' | 'edge'
  severity?: 'error' | 'fatal' | 'warn'
  userId?: string | null
  organizationId?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

// Throttle en memoria: previene inundación ante bucles infinitos de render
const throttleMap = new Map<string, number>()
const THROTTLE_MS = 30_000 // 30 segundos por firma de error idéntico

function isThrottled(signature: string): boolean {
  const now = Date.now()
  const lastTime = throttleMap.get(signature)
  if (lastTime && now - lastTime < THROTTLE_MS) {
    return true
  }
  throttleMap.set(signature, now)
  // Limpiar firmas viejas para evitar fugas de memoria
  if (throttleMap.size > 200) {
    for (const [key, timestamp] of throttleMap.entries()) {
      if (now - timestamp > THROTTLE_MS * 2) {
        throttleMap.delete(key)
      }
    }
  }
  return false
}

/**
 * Envía una notificación instantánea a Telegram si están configuradas las variables:
 * TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
 */
export async function sendTelegramAlert(payload: ErrorReportPayload): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    return false
  }

  try {
    const timeStr = new Date().toLocaleString('es-PY', {
      timeZone: 'America/Asuncion',
      dateStyle: 'short',
      timeStyle: 'medium',
    })

    const severityIcon = payload.severity === 'fatal' ? '🔥' : payload.severity === 'warn' ? '⚠️' : '🚨'
    const safeMsg = (payload.message || 'Error desconocido').slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safeName = (payload.name || 'Error').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safeUrl = (payload.url || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const text = [
      `${severityIcon} <b>Incidencia en Producción (4G POS)</b>`,
      ``,
      `<b>Tipo:</b> <code>${safeName}</code>`,
      `<b>Mensaje:</b> ${safeMsg}`,
      `<b>Origen:</b> ${payload.source || 'app'}`,
      `<b>Ruta:</b> ${safeUrl}`,
      payload.digest ? `<b>Digest:</b> <code>${payload.digest}</code>` : null,
      `<b>Fecha:</b> ${timeStr}`,
    ]
      .filter(Boolean)
      .join('\n')

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    return res.ok
  } catch {
    return false
  }
}

/**
 * Registra el error en la base de datos de Supabase y notifica a Telegram en servidor.
 */
export async function recordServerError(payload: ErrorReportPayload): Promise<void> {
  const signature = `${payload.source}:${payload.name}:${payload.message}`
  if (isThrottled(signature)) {
    return
  }

  try {
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const admin = createAdminSupabase()
    await admin.from('system_error_logs').insert({
      source: payload.source ?? 'server',
      severity: payload.severity ?? 'error',
      error_name: (payload.name || 'Error').slice(0, 150),
      error_message: (payload.message || 'Error desconocido').slice(0, 2000),
      error_stack: payload.stack ? payload.stack.slice(0, 5000) : null,
      digest: payload.digest ?? null,
      url: payload.url ? payload.url.slice(0, 500) : null,
      user_id: payload.userId ?? null,
      organization_id: payload.organizationId ?? null,
      user_agent: payload.userAgent ? payload.userAgent.slice(0, 300) : null,
      metadata: payload.metadata ?? {},
    })
  } catch {
    // Si la tabla aún no existe o hay fallo de red, silenciar para no interrumpir el flujo principal
  }

  // Despacho no bloqueante a Telegram
  void sendTelegramAlert(payload)
}

/**
 * Despacha un reporte de error desde el cliente hacia el endpoint de la API.
 */
export function recordClientError(payload: ErrorReportPayload): void {
  if (typeof window === 'undefined') return

  const signature = `${payload.source}:${payload.name}:${payload.message}`
  if (isThrottled(signature)) {
    return
  }

  const enriched: ErrorReportPayload = {
    ...payload,
    source: payload.source ?? 'client',
    url: payload.url ?? (typeof window !== 'undefined' ? window.location.href : null),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }

  try {
    const body = JSON.stringify(enriched)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/system/log-error', blob)
    } else {
      void fetch('/api/system/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
    }
  } catch {
    // Silencioso en cliente
  }
}

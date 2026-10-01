import { createHash } from 'node:crypto'
import { logger } from '@/lib/logger'

/**
 * Llamadas a la API de Telegram. Todo lo que el bot manda pasa por acá: un
 * fallo de red o de Telegram se registra y devuelve `false`, nunca corta el
 * webhook (Telegram reintenta lo que no recibe 200 y repetiría el mensaje).
 */

export type InlineButton = { text: string; url?: string; callback_data?: string }
export type InlineKeyboard = { inline_keyboard: InlineButton[][] }

function apiBase(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  return token ? `https://api.telegram.org/bot${token}` : null
}

async function call(method: string, body: Record<string, unknown>): Promise<boolean> {
  const api = apiBase()
  if (!api) {
    logger.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado')
    return false
  }
  try {
    const res = await fetch(`${api}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) logger.warn(`[telegram] ${method} falló`, { status: res.status, body: (await res.text()).slice(0, 300) })
    return res.ok
  } catch (error) {
    logger.warn(`[telegram] ${method} sin respuesta`, { error })
    return false
  }
}

export function sendMessage(chatId: number | string, text: string, keyboard?: InlineKeyboard) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  })
}

/** Foto con texto. Si Telegram no puede bajar la imagen, se manda solo el texto. */
export async function sendPhoto(chatId: number | string, photoUrl: string, caption: string, keyboard?: InlineKeyboard) {
  const sent = await call('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  })
  return sent || sendMessage(chatId, caption, keyboard)
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) })
}

/**
 * El token que Telegram manda en `X-Telegram-Bot-Api-Secret-Token` y el
 * webhook exige. Si no hay TELEGRAM_WEBHOOK_SECRET se deriva del token del
 * bot, que sólo conoce el servidor.
 */
export function webhookSecret(): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (explicit) return explicit
  const token = process.env.TELEGRAM_BOT_TOKEN
  return token ? createHash('sha256').update(`telegram-webhook:${token}`).digest('hex') : null
}

/** El menú «/» que Telegram muestra en el chat. */
export const BOT_COMMANDS = [
  { command: 'buscar', description: 'Buscar un producto por nombre o código' },
  { command: 'categorias', description: 'Ver las categorías' },
  { command: 'ofertas', description: 'Productos en oferta' },
  { command: 'tienda', description: 'Ver o cambiar de tienda' },
  { command: 'contacto', description: 'WhatsApp y dirección de la tienda' },
  { command: 'ayuda', description: 'Cómo usar el asistente' },
] as const

/**
 * Registra el webhook con su token secreto (Telegram lo manda en cada pedido
 * y el endpoint rechaza lo que no lo trae) y el menú de comandos.
 */
export async function registerWebhook(webhookUrl: string, secret: string | null) {
  const api = apiBase()
  if (!api) return { ok: false as const, error: 'TELEGRAM_BOT_TOKEN no configurado' }
  const webhook = await fetch(`${api}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  }).then((res) => res.json()).catch((error) => ({ ok: false, description: String(error) }))
  const commands = await call('setMyCommands', { commands: BOT_COMMANDS })
  return { ok: Boolean(webhook?.ok) as boolean, webhook, commands }
}

export async function getWebhookInfo() {
  const api = apiBase()
  if (!api) return { ok: false as const, error: 'TELEGRAM_BOT_TOKEN no configurado' }
  return fetch(`${api}/getWebhookInfo`).then((res) => res.json()).catch((error) => ({ ok: false, description: String(error) }))
}

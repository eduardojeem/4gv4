import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processTelegramUpdate, type TelegramUpdate } from '@/lib/telegram/bot-service'
import { getWebhookInfo, registerWebhook, webhookSecret } from '@/lib/telegram/telegram-api'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { siteUrl } from '@/lib/site-url'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function sameSecret(received: string | null, expected: string): boolean {
  if (!received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Sin el token secreto, cualquiera que conozca la URL podía hacerse pasar por Telegram. */
export async function POST(req: Request) {
  const secret = webhookSecret()
  if (!secret || !sameSecret(req.headers.get('x-telegram-bot-api-secret-token'), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid update payload' }, { status: 400 })
  }
  if (!update || typeof update !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid update payload' }, { status: 400 })
  }

  try {
    // Se espera la respuesta entera: en serverless la función se congela al responder.
    await processTelegramUpdate(update)
  } catch (error) {
    logger.error('Error en webhook de Telegram:', error)
  }
  // 200 siempre: Telegram reintenta lo que falla y el cliente recibiría el mensaje repetido.
  return NextResponse.json({ ok: true })
}

/**
 * Estado del webhook, o `?setup=true` para registrarlo con su token secreto y
 * el menú de comandos. Sólo superadmin: antes cualquiera podía re-registrarlo.
 */
export async function GET(req: Request) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 })
  }

  if (new URL(req.url).searchParams.get('setup') === 'true') {
    // El dominio canónico, no el host del pedido: un preview no debe robarse el bot.
    const webhookUrl = siteUrl('/api/telegram/webhook')
    const result = await registerWebhook(webhookUrl, webhookSecret())
    return NextResponse.json({ ...result, webhookUrl }, { status: result.ok ? 200 : 502 })
  }

  return NextResponse.json({ ok: true, webhookInfo: await getWebhookInfo() })
}

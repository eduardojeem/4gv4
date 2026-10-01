import { NextResponse } from 'next/server'
import { processTelegramUpdate, type TelegramUpdate } from '@/lib/telegram/bot-service'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de Webhook para Telegram Bot
 * Recibe eventos de mensajes y botones interactivos de clientes y responde en tiempo real.
 */
export async function POST(req: Request) {
  try {
    const update = (await req.json()) as TelegramUpdate
    if (!update || typeof update !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid update payload' }, { status: 400 })
    }

    // Esperar la resolución completa antes de responder para que la función Serverless de Vercel no se congele antes de enviar el mensaje
    await processTelegramUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error en webhook de Telegram:', error)
    return NextResponse.json({ ok: true }) // Devolver 200 para evitar reintentos infinitos
  }
}

/**
 * Consulta de estado del webhook o registro automático de URL en Telegram
 */
export async function GET(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const shouldSet = searchParams.get('setup') === 'true'

  if (shouldSet) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    const webhookUrl = `${origin}/api/telegram/webhook`

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
      const data = await res.json()
      return NextResponse.json({ ok: true, webhookUrl, telegram: data })
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
  }

  // Obtener info actual del webhook desde Telegram
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await res.json()
    return NextResponse.json({ ok: true, webhookInfo: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

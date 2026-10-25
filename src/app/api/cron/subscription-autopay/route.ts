import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { runSubscriptionAutopay } from '@/lib/saas/subscription-autopay'

/**
 * Cobro diario del débito automático de las suscripciones (tarjeta guardada en
 * uPay). Conviene ejecutarlo una vez por día; correrlo más seguido no duplica
 * cobros porque cada organización se toma con un bloqueo y se reintenta según
 * su propio calendario.
 *
 * Protegido por `CRON_SECRET`, igual que el resto de los cron.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    logger.error('[cron/autopay] CRON_SECRET no configurado; cobro deshabilitado')
    return NextResponse.json(
      { success: false, error: 'El cobro programado no está configurado.' },
      { status: 503 }
    )
  }

  const authorization = request.headers.get('authorization') || ''
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const result = await runSubscriptionAutopay()
    logger.info('[cron/autopay] Débitos procesados', result)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('[cron/autopay] Falló el cobro automático', { error, message })
    return NextResponse.json(
      { success: false, error: `No se pudo procesar el débito automático: ${message}` },
      { status: 500 }
    )
  }
}

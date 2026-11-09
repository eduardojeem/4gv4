import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { reconcilePendingBancardPayments } from '@/lib/saas/bancard-subscription-status'

/**
 * Concilia los pagos de suscripción de Bancard que siguen pendientes, por si
 * se perdió la confirmación del webhook. Se puede correr cada hora: solo
 * consulta pagos de los últimos 2 días y aplicar un pago dos veces no tiene
 * efecto.
 *
 * Protegido por `CRON_SECRET`, igual que el resto de los cron.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    logger.error('[cron/bancard-reconcile] CRON_SECRET no configurado; conciliación deshabilitada')
    return NextResponse.json(
      { success: false, error: 'La conciliación programada no está configurada.' },
      { status: 503 }
    )
  }

  const authorization = request.headers.get('authorization') || ''
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const result = await reconcilePendingBancardPayments()
    logger.info('[cron/bancard-reconcile] Pagos conciliados', result)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('[cron/bancard-reconcile] Falló la conciliación', { error, message })
    return NextResponse.json(
      { success: false, error: `No se pudo conciliar los pagos de Bancard: ${message}` },
      { status: 500 }
    )
  }
}

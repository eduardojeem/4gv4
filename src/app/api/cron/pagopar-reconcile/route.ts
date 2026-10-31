import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { reconcilePendingPagoparPayments } from '@/lib/saas/pagopar-reconciliation'

/**
 * Concilia los pagos de suscripción de Pagopar que siguen pendientes, por si
 * se perdió la notificación del webhook. Se puede correr cada hora: solo
 * consulta pedidos de los últimos 4 días y aplicar un pago dos veces no tiene
 * efecto.
 *
 * Protegido por `CRON_SECRET`, igual que el resto de los cron.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    logger.error('[cron/pagopar-reconcile] CRON_SECRET no configurado; conciliación deshabilitada')
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
    const result = await reconcilePendingPagoparPayments()
    logger.info('[cron/pagopar-reconcile] Pagos conciliados', result)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('[cron/pagopar-reconcile] Falló la conciliación', { error, message })
    return NextResponse.json(
      { success: false, error: `No se pudo conciliar los pagos de Pagopar: ${message}` },
      { status: 500 }
    )
  }
}

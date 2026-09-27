import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { sendPlanGraceNotifications } from '@/lib/saas/plan-grace-notifications'

/**
 * Envio diario de los avisos del ciclo de regularizacion por baja de plan.
 *
 * El vencimiento de los plazos lo ejecuta pg_cron dentro de la base
 * (`process_plan_downgrade_grace`); los emails salen desde acá porque el envio
 * vive en la aplicacion, no en Postgres.
 *
 * Protegido por `CRON_SECRET`: sin ese secreto configurado el endpoint no
 * responde, para que nadie pueda disparar correos a los clientes.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    logger.error('[cron/plan-grace] CRON_SECRET no configurado; envío deshabilitado')
    return NextResponse.json(
      { success: false, error: 'El envío programado no está configurado.' },
      { status: 503 }
    )
  }

  const authorization = request.headers.get('authorization') || ''
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const result = await sendPlanGraceNotifications()
    logger.info('[cron/plan-grace] Avisos procesados', result)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('[cron/plan-grace] Falló el envío de avisos', { error, message })
    return NextResponse.json(
      { success: false, error: `No se pudieron enviar los avisos: ${message}` },
      { status: 500 }
    )
  }
}

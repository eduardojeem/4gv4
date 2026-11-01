import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { runDailyBillingTasks } from '@/lib/saas/daily-billing-tasks'

export const maxDuration = 300

/**
 * Tareas diarias de cobro: conciliación de Pagopar, débito automático y avisos
 * del plazo de productos. La llama el cron de Vercel (vercel.json) con
 * `Authorization: Bearer $CRON_SECRET`; también acepta POST para un scheduler
 * externo o para correrla a mano.
 *
 * Sin CRON_SECRET configurado no hace nada, para que nadie dispare cobros.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    logger.error('[cron/daily] CRON_SECRET no configurado; tareas deshabilitadas')
    return NextResponse.json({ success: false, error: 'Las tareas programadas no están configuradas.' }, { status: 503 })
  }
  if ((request.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  const results = await runDailyBillingTasks()
  const failed = Object.entries(results).filter(([, result]) => !result.ok).map(([name]) => name)
  if (failed.length > 0) logger.error('[cron/daily] Tareas con error', { failed, results })
  else logger.info('[cron/daily] Tareas completadas', results)

  return NextResponse.json({ success: failed.length === 0, results }, { status: failed.length === 0 ? 200 : 500 })
}

export const GET = handle
export const POST = handle

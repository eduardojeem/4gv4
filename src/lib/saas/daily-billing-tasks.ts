import 'server-only'
import { reconcilePendingPagoparPayments } from '@/lib/saas/pagopar-reconciliation'
import { sendPlanGraceNotifications } from '@/lib/saas/plan-grace-notifications'
import { runSubscriptionAutopay } from '@/lib/saas/subscription-autopay'

/**
 * Las tareas de cobro que viven en la aplicación (no en pg_cron). Corren una
 * vez por día desde el cron de Vercel; antes eran tres endpoints POST que nada
 * llamaba. Cada tarea es independiente: si una falla, las demás corren igual.
 */
export type DailyTaskResult = { ok: true; data: unknown } | { ok: false; error: string }

export const DAILY_BILLING_TASKS: Record<string, () => Promise<unknown>> = {
  pagoparReconcile: () => reconcilePendingPagoparPayments(),
  subscriptionAutopay: () => runSubscriptionAutopay(),
  planGraceNotifications: () => sendPlanGraceNotifications(),
}

export async function runDailyBillingTasks(
  tasks: Record<string, () => Promise<unknown>> = DAILY_BILLING_TASKS,
): Promise<Record<string, DailyTaskResult>> {
  const results: Record<string, DailyTaskResult> = {}
  for (const [name, task] of Object.entries(tasks)) {
    try {
      results[name] = { ok: true, data: await task() }
    } catch (error) {
      results[name] = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  return results
}

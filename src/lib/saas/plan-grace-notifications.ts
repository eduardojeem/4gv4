import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import {
  renderPlanGraceWarningEmail,
  renderPlanDeactivatedEmail,
} from '@/lib/email/templates'

/**
 * Avisos del ciclo de regularizacion por baja de plan.
 *
 * Se manda uno por dia como maximo por organizacion: el plazo es de 7 y 30 dias,
 * asi que un aviso diario alcanza para que nadie se entere tarde sin volverse
 * spam —que ademas termina en la carpeta de correo no deseado y deja de servir—.
 */

const NOTIFICATION_INTERVAL_HOURS = 24

export type GraceNotificationResult = {
  processed: number
  sent: number
  skipped: number
  failed: number
}

type GraceRow = {
  organization_id: string
  product_limit: number
  active_products_at_start: number
  stage: string
  grace_ends_at: string
  archive_deadline_at: string | null
  last_notified_at: string | null
}

function daysUntil(target: string | null): number {
  if (!target) return 0
  const diff = new Date(target).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function shouldNotify(lastNotifiedAt: string | null): boolean {
  if (!lastNotifiedAt) return true
  const elapsedHours = (Date.now() - new Date(lastNotifiedAt).getTime()) / 3_600_000
  return elapsedHours >= NOTIFICATION_INTERVAL_HOURS
}

/**
 * Recorre los ciclos abiertos y avisa a quien corresponda.
 *
 * Un fallo de envio no corta el barrido ni marca la fila como notificada: se
 * reintenta en la corrida siguiente en vez de perderse el aviso.
 */
export async function sendPlanGraceNotifications(
  appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
): Promise<GraceNotificationResult> {
  const supabase = createAdminSupabase()
  const result: GraceNotificationResult = { processed: 0, sent: 0, skipped: 0, failed: 0 }

  const { data, error } = await supabase
    .from('plan_downgrade_grace')
    .select('organization_id, product_limit, active_products_at_start, stage, grace_ends_at, archive_deadline_at, last_notified_at')
    .in('stage', ['grace', 'deactivated'])

  if (error) {
    console.error('[plan-grace] No se pudieron leer los ciclos abiertos', { error })
    throw new Error(`No se pudieron leer los ciclos de regularización: ${error.message}`)
  }

  const rows = (data ?? []) as GraceRow[]
  result.processed = rows.length
  if (rows.length === 0) return result

  const organizationIds = rows.map((row) => row.organization_id)
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, email, logo_url')
    .in('id', organizationIds)

  const orgById = new Map(
    (organizations ?? []).map((org) => [String(org.id), org as { id: string; name: string; email: string | null; logo_url: string | null }])
  )

  for (const row of rows) {
    if (!shouldNotify(row.last_notified_at)) {
      result.skipped += 1
      continue
    }

    const organization = orgById.get(row.organization_id)
    // Sin correo no hay a quien avisar; se registra para que no pase inadvertido.
    if (!organization?.email) {
      console.warn('[plan-grace] Organización sin email de contacto, no se pudo avisar', {
        organizationId: row.organization_id,
      })
      result.skipped += 1
      continue
    }

    const brand = { name: organization.name, logoUrl: organization.logo_url ?? undefined }
    const upgradeUrl = `${appUrl}/admin/subscriptions`

    const html = row.stage === 'grace'
      ? renderPlanGraceWarningEmail({
          companyName: organization.name,
          activeProducts: row.active_products_at_start,
          productLimit: row.product_limit,
          daysLeft: daysUntil(row.grace_ends_at),
          upgradeUrl,
          brand,
        })
      : renderPlanDeactivatedEmail({
          companyName: organization.name,
          deactivatedProducts: Math.max(0, row.active_products_at_start - row.product_limit),
          productLimit: row.product_limit,
          daysLeft: daysUntil(row.archive_deadline_at),
          upgradeUrl,
          brand,
        })

    const sendResult = await sendEmail({
      to: organization.email,
      subject: row.stage === 'grace'
        ? 'Actualizá tu plan para mantener todos tus productos'
        : 'Tenés productos desactivados por el límite de tu plan',
      html,
    })

    if (!sendResult.ok && !sendResult.skipped) {
      console.error('[plan-grace] No se pudo enviar el aviso', {
        organizationId: row.organization_id,
        error: sendResult.error,
      })
      result.failed += 1
      continue
    }

    // Solo se marca cuando el envio salio: si fallo, la proxima corrida reintenta.
    await supabase
      .from('plan_downgrade_grace')
      .update({ last_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('organization_id', row.organization_id)

    result.sent += 1
  }

  return result
}

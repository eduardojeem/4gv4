import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderTransferReceiptSubmittedEmail, renderTransferReviewedEmail } from '@/lib/email/templates'
import type { BankTransferRequest } from '@/lib/saas/bank-transfer-contract'

/**
 * Avisos por correo del pago por transferencia. Se llaman después de responder
 * (con after()), así que un fallo de envío nunca deshace ni frena la operación.
 */

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || ''
}

async function organizationContact(organizationId: string) {
  const admin = createAdminSupabase()
  const [{ data: organization }, { data: billing }] = await Promise.all([
    admin.from('organizations').select('name, email, logo_url').eq('id', organizationId).maybeSingle(),
    admin.from('billing_profiles').select('billing_email').eq('organization_id', organizationId).maybeSingle(),
  ])
  return {
    name: organization?.name || 'tu comercio',
    email: billing?.billing_email || organization?.email || null,
    logoUrl: organization?.logo_url ?? undefined,
  }
}

export async function notifyTransferReceiptSubmitted(request: BankTransferRequest) {
  try {
    const admin = createAdminSupabase()
    const [{ data: superAdmins }, contact] = await Promise.all([
      admin.from('profiles').select('email').eq('role', 'super_admin').neq('status', 'inactive'),
      organizationContact(request.organization_id),
    ])
    const to = (superAdmins ?? []).map((row) => row.email).filter((email): email is string => Boolean(email))
    if (to.length === 0) {
      console.warn('[transfer] No hay superadmin con email para avisar el comprobante', { requestId: request.id })
      return
    }

    const result = await sendEmail({
      to,
      subject: `Comprobante de transferencia de ${contact.name}`,
      html: renderTransferReceiptSubmittedEmail({
        companyName: contact.name,
        planName: request.plan_name,
        amountPyg: Number(request.amount),
        reference: request.reference,
        operationReference: request.operation_reference,
        reviewUrl: `${appUrl()}/superadmin/billing/transfers`,
      }),
    })
    if (!result.ok && !result.skipped) {
      console.error('[transfer] No se pudo avisar el comprobante', { requestId: request.id, error: result.error })
    }
  } catch (error) {
    console.error('[transfer] Falló el aviso del comprobante', { requestId: request.id, error })
  }
}

export async function notifyTransferReviewed(request: BankTransferRequest) {
  if (request.status !== 'approved' && request.status !== 'rejected') return
  try {
    const contact = await organizationContact(request.organization_id)
    if (!contact.email) {
      console.warn('[transfer] Organización sin email para avisar la revisión', { requestId: request.id })
      return
    }

    const approved = request.status === 'approved'
    const result = await sendEmail({
      to: contact.email,
      subject: approved ? 'Aprobamos tu transferencia' : 'No pudimos aprobar tu transferencia',
      html: renderTransferReviewedEmail({
        companyName: contact.name,
        planName: request.plan_name,
        amountPyg: Number(request.amount),
        approved,
        periodEndsAt: request.period_ends_at,
        reason: request.rejection_reason,
        manageUrl: `${appUrl()}/admin/subscriptions${approved ? '' : '#pay-transfer'}`,
        brand: { name: contact.name, logoUrl: contact.logoUrl },
      }),
      log: { organizationId: request.organization_id },
    })
    if (!result.ok && !result.skipped) {
      console.error('[transfer] No se pudo avisar la revisión', { requestId: request.id, error: result.error })
    }
  } catch (error) {
    console.error('[transfer] Falló el aviso de la revisión', { requestId: request.id, error })
  }
}

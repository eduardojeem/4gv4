import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email/resend'
import { renderPaymentReminderEmail } from '@/lib/email/templates'
import { z } from 'zod'
import { readAllCreditRows } from '@/lib/credits/portfolio'
import { creditReminderDebt } from '@/lib/credits/reminder'
import { formatDateOnlyDisplay } from '@/lib/date-only'

const reminderSchema = z.object({ creditId: z.string().uuid().optional(), customerId: z.string().uuid().optional() })
  .strict().refine(value => Boolean(value.creditId) !== Boolean(value.customerId), 'Elegí un crédito o un cliente.')

/**
 * POST /api/credits/send-reminder
 * Send a payment reminder email to a customer with overdue credit.
 * Body: { creditId: string } or { customerId: string }
 */
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, { organization }) => {
  try {
    const parsed = reminderSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Elegí un crédito o cliente válido.' }, { status: 400 })
    const { creditId, customerId } = parsed.data

    const supabase = await createClient()

    // Find the overdue credit
    const settings = await supabase.from('organization_settings').select('timezone').eq('organization_id', organization.id).maybeSingle()
    if (settings.error) throw settings.error
    const timeZone = settings.data?.timezone || 'America/Asuncion'
    const now = new Date()
    const credits = await readAllCreditRows((from, to) => {
      let query = supabase.from('customer_credits')
        .select('id, customer_id, status, customers(name, email), credit_installments(amount, amount_paid, status, due_date)')
        .eq('organization_id', organization.id).in('status', ['active', 'defaulted'])
      query = creditId ? query.eq('id', creditId) : query.eq('customer_id', customerId!)
      return query.order('id').range(from, to)
    })
    if (!credits || credits.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron créditos pendientes' }, { status: 404 })
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const credit of credits) {
      const customer = credit.customers as { name?: string | null; email?: string | null } | null
      const email = customer?.email
      const debt = creditReminderDebt(credit.credit_installments || [], timeZone, now)

      if (!email || !debt) {
        skipped++
        continue
      }

      const result = await sendEmail({
        to: email,
        subject: `Recordatorio de pago — ${organization.name}`,
        html: renderPaymentReminderEmail({
          customerName: customer?.name || 'Cliente',
          amount: debt.amount,
          dueDate: formatDateOnlyDisplay(debt.dueDate),
          daysOverdue: debt.daysOverdue,
          creditCode: credit.id.slice(0, 8),
          brand: { name: organization.name },
        }),
        log: {
          organizationId: organization.id,
          customerId: credit.customer_id,
          customerName: customer?.name || undefined,
        },
      })

      if (result.ok) {
        sent++
      } else if (result.skipped) {
        skipped++
      } else {
        failed++
      }
    }

    return NextResponse.json({
      success: failed === 0,
      data: { sent, skipped, failed, total: credits.length },
    })
  } catch (error) {
    logger.error('Send payment reminder error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo enviar el recordatorio.' }, { status: 500 })
  }
})

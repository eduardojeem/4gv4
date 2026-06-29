import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email/resend'
import { renderPaymentReminderEmail } from '@/lib/email/templates'

/**
 * POST /api/credits/send-reminder
 * Send a payment reminder email to a customer with overdue credit.
 * Body: { creditId: string } or { customerId: string }
 */
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }) => {
  try {
    const body = await request.json()
    const { creditId, customerId } = body as { creditId?: string; customerId?: string }

    if (!creditId && !customerId) {
      return NextResponse.json({ success: false, error: 'creditId o customerId es requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    // Find the overdue credit
    let query = supabase
      .from('customer_credits')
      .select('id, customer_id, total_amount, remaining_amount, due_date, status, customers(name, email, phone)')
      .eq('organization_id', organization.id)

    if (creditId) {
      query = query.eq('id', creditId)
    } else {
      query = query.eq('customer_id', customerId!).in('status', ['active', 'overdue'])
    }

    const { data: credits, error } = await query.limit(5)

    if (error) throw error
    if (!credits || credits.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron créditos pendientes' }, { status: 404 })
    }

    let sent = 0
    let skipped = 0

    for (const credit of credits) {
      const customer = credit.customers as any
      const email = customer?.email

      if (!email) {
        skipped++
        continue
      }

      const dueDate = new Date(credit.due_date)
      const now = new Date()
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

      const result = await sendEmail({
        to: email,
        subject: `Recordatorio de pago — ${organization.name}`,
        html: renderPaymentReminderEmail({
          customerName: customer?.name || 'Cliente',
          amount: Number(credit.remaining_amount || credit.total_amount),
          dueDate: dueDate.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' }),
          daysOverdue,
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
      }
    }

    return NextResponse.json({
      success: true,
      data: { sent, skipped, total: credits.length },
    })
  } catch (error) {
    logger.error('Send payment reminder error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo enviar el recordatorio.' }, { status: 500 })
  }
})

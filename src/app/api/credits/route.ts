import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (_request, { organization }) => {
  try {
    const supabase = createAdminSupabase()
    const { data: credits, error: creditsError } = await supabase
      .from('credit_details')
      .select('*')
      .eq('organization_id', organization.id)

    if (creditsError) {
      // View or table may not exist yet — return empty data instead of crashing
      if (creditsError.code === '42P01' || creditsError.message?.includes('does not exist')) {
        logger.warn('Credits view not found, returning empty data', { error: creditsError.message })
        return NextResponse.json({
          success: true,
          data: {
            credits: [],
            installments: [],
            payments: [],
            summary: [],
            installmentsProgress: [],
            customers: [],
          },
        })
      }
      throw creditsError
    }

    const creditRows = credits ?? []
    const creditIds = creditRows.map((credit) => String(credit.id)).filter(Boolean)
    const customerIds = [...new Set(creditRows.map((credit) => String(credit.customer_id)).filter(Boolean))]

    if (creditIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          credits: [],
          installments: [],
          payments: [],
          summary: [],
          installmentsProgress: [],
          customers: [],
        },
      })
    }

    const [installmentsResult, paymentsResult, summaryResult, progressResult, customersResult] = await Promise.all([
      supabase
        .from('credit_installments')
        .select('*')
        .in('credit_id', creditIds)
        .order('due_date', { ascending: true })
        .order('installment_number', { ascending: true })
        .limit(1000),
      supabase
        .from('credit_payments')
        .select('*')
        .in('credit_id', creditIds)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('credit_summary')
        .select('*')
        .in('credit_id', creditIds),
      supabase
        .from('credit_installments_progress')
        .select('*')
        .in('credit_id', creditIds)
        .limit(1000),
      supabase
        .from('customers')
        .select('id, customer_code')
        .eq('organization_id', organization.id)
        .in('id', customerIds),
    ])

    const firstError =
      installmentsResult.error ||
      paymentsResult.error ||
      summaryResult.error ||
      progressResult.error ||
      customersResult.error

    if (firstError) {
      // View or table may not exist yet — return partial data gracefully
      if (firstError.code === '42P01' || firstError.message?.includes('does not exist')) {
        logger.warn('Credits related view not found, returning partial data', { error: firstError.message })
        return NextResponse.json({
          success: true,
          data: {
            credits: creditRows,
            installments: installmentsResult.data ?? [],
            payments: paymentsResult.data ?? [],
            summary: summaryResult.data ?? [],
            installmentsProgress: progressResult.data ?? [],
            customers: customersResult.data ?? [],
          },
        })
      }
      throw firstError
    }

    return NextResponse.json({
      success: true,
      data: {
        credits: creditRows,
        installments: installmentsResult.data ?? [],
        payments: paymentsResult.data ?? [],
        summary: summaryResult.data ?? [],
        installmentsProgress: progressResult.data ?? [],
        customers: customersResult.data ?? [],
      },
    })
  } catch (error) {
    logger.error('Credits API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los creditos.' }, { status: 500 })
  }
})

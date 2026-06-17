import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  buildCreditInstallmentPlan,
  normalizeCreditFrequency,
  normalizeInstallmentCount,
} from '@/lib/credits/installments'

type CreateCreditSaleBody = {
  customerId?: unknown
  amount?: unknown
  interestRate?: unknown
  dueDate?: unknown
  saleId?: unknown
  installments?: {
    count?: unknown
    frequency?: unknown
  }
}

type SaleRow = {
  id: string
  code: string | null
  customer_id: string | null
}

type CustomerRow = {
  id: string
  credit_limit: number | string | null
}

type InstallmentRow = {
  installment_number: number
  amount?: number | string | null
  status?: string | null
  amount_paid?: number | string | null
}

function normalizePositiveAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function buildCreditCode() {
  return `CR-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    if (staffAuth.role === 'tecnico') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para crear ventas a crédito.' },
        { status: 403 }
      )
    }
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Organizacion requerida' }, { status: 403 })
    }

    const body = await request.json() as CreateCreditSaleBody
    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : ''
    const amount = normalizePositiveAmount(body.amount)
    const interestRate = Number.isFinite(Number(body.interestRate)) ? Number(body.interestRate) : 0
    const installmentCount = normalizeInstallmentCount(body.installments?.count)
    const frequency = normalizeCreditFrequency(body.installments?.frequency)
    const saleId = typeof body.saleId === 'string' && body.saleId.trim() ? body.saleId.trim() : null

    if (!customerId) {
      return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })
    }

    if (amount === null) {
      return NextResponse.json({ error: 'Monto inválido para la venta a crédito.' }, { status: 400 })
    }

    let providedDueDate: Date | null = null
    if (typeof body.dueDate === 'string' && body.dueDate.trim()) {
      const parsedDate = new Date(body.dueDate)
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'La fecha de vencimiento no es válida.' }, { status: 400 })
      }
      providedDueDate = parsedDate
    }

    const supabase = createAdminSupabase()
    const { data: customerRow, error: customerError } = await supabase
      .from('customers')
      .select('id, credit_limit')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customerError) {
      console.error('[credits/sale] Error fetching customer:', customerError)
      return NextResponse.json({ error: 'No se pudo validar el cliente de la venta a crédito.' }, { status: 500 })
    }

    if (!customerRow) {
      return NextResponse.json({ error: 'El cliente seleccionado no existe.' }, { status: 404 })
    }

    const creditLimit = Math.max(0, Number((customerRow as CustomerRow).credit_limit || 0))
    if (creditLimit <= 0) {
      return NextResponse.json({ error: 'El cliente no tiene límite de crédito habilitado.' }, { status: 400 })
    }

    let saleRow: SaleRow | null = null
    if (saleId) {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select('id, code, customer_id')
        .eq('id', saleId)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (saleError) {
        console.error('[credits/sale] Error fetching sale:', saleError)
        return NextResponse.json({ error: 'No se pudo validar la venta asociada al crédito.' }, { status: 500 })
      }

      if (!saleData) {
        return NextResponse.json({ error: 'La venta asociada no existe.' }, { status: 404 })
      }

      saleRow = saleData as SaleRow

      if (saleRow.customer_id && saleRow.customer_id !== customerId) {
        return NextResponse.json({ error: 'La venta seleccionada pertenece a otro cliente.' }, { status: 400 })
      }

      const { data: duplicatedCredit, error: duplicatedCreditError } = await supabase
        .from('customer_credits')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('sale_id', saleId)
        .maybeSingle()

      if (duplicatedCreditError) {
        console.error('[credits/sale] Error checking duplicated sale credit:', duplicatedCreditError)
        return NextResponse.json({ error: 'No se pudo validar si la venta ya tiene un crédito asociado.' }, { status: 500 })
      }

      if (duplicatedCredit?.id) {
        return NextResponse.json({ error: 'La venta seleccionada ya tiene un crédito asociado.' }, { status: 409 })
      }
    }

    const { data: existingCredits, error: existingCreditsError } = await supabase
      .from('customer_credits')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('customer_id', customerId)

    if (existingCreditsError) {
      console.error('[credits/sale] Error fetching customer credits:', existingCreditsError)
      return NextResponse.json({ error: 'No se pudo validar el historial de créditos del cliente.' }, { status: 500 })
    }

    const existingCreditIds = (existingCredits ?? []).map(row => row.id as string).filter(Boolean)
    const { data: existingInstallments, error: existingInstallmentsError } = existingCreditIds.length > 0
      ? await supabase
          .from('credit_installments')
          .select('installment_number, amount, status, amount_paid')
          .in('credit_id', existingCreditIds)
      : { data: [], error: null }

    if (existingInstallmentsError) {
      console.error('[credits/sale] Error fetching credit installments:', existingInstallmentsError)
      return NextResponse.json({ error: 'No se pudo preparar el plan de crédito del cliente.' }, { status: 500 })
    }

    const installmentRows = (existingInstallments as InstallmentRow[] | null) ?? []
    const creditPlan = buildCreditInstallmentPlan({
      principalAmount: amount,
      interestRate,
      installmentCount,
      frequency,
      firstDueDate: providedDueDate,
      startInstallmentNumber: 1,
    })
    const currentBalance = installmentRows.reduce((sum, installment) => {
      if (installment.status !== 'pending' && installment.status !== 'late') return sum

      const amountValue = Math.max(0, Number(installment.amount || 0))
      const paidValue = Math.min(amountValue, Math.max(0, Number(installment.amount_paid || 0)))
      return sum + Math.max(0, amountValue - paidValue)
    }, 0)

    const availableCredit = creditLimit - currentBalance
    if (availableCredit < creditPlan.financedTotal) {
      return NextResponse.json(
        {
          error: `El cliente no tiene crédito disponible suficiente. Disponible: ${availableCredit.toFixed(2)}.`,
        },
        { status: 400 }
      )
    }

    const { data: creditRow, error: createCreditError } = await supabase
      .from('customer_credits')
      .insert({
        customer_id: customerId,
        organization_id: organization.id,
        sale_id: saleId,
        principal: creditPlan.financedTotal,
        interest_rate: interestRate,
        term_months: installmentCount,
        start_date: new Date().toISOString(),
        status: 'active',
        credit_code: buildCreditCode(),
        credit_type: saleId ? 'product_financing' : 'manual',
        origin_type: saleId ? 'sale' : 'manual',
        label: saleRow?.code ? `Venta ${saleRow.code}` : 'Credito manual',
      })
      .select('id')
      .single()

    if (createCreditError || !creditRow?.id) {
      console.error('[credits/sale] Error creating credit header:', createCreditError)
      return NextResponse.json({ error: 'No se pudo crear la cuenta de crédito del cliente.' }, { status: 500 })
    }

    const creditId = creditRow.id as string

    const installmentsToInsert = creditPlan.installments.map(installment => ({
      credit_id: creditId,
      sale_id: saleId,
      installment_number: installment.installmentNumber,
      due_date: installment.dueDate.toISOString(),
      amount: installment.amount,
      principal_component: installment.principalComponent,
      interest_component: installment.interestComponent,
      status: 'pending',
    }))

    const { error: installmentsError } = await supabase
      .from('credit_installments')
      .insert(installmentsToInsert)

    if (installmentsError) {
      console.error('[credits/sale] Error creating installments:', installmentsError)
      await supabase.from('customer_credits').delete().eq('id', creditId).eq('organization_id', organization.id)

      return NextResponse.json({ error: 'No se pudieron generar las cuotas de la venta a crédito.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      creditId,
      installmentCount,
      financedTotal: creditPlan.financedTotal,
      interestAmount: creditPlan.interestAmount,
    })
  } catch (error) {
    console.error('[credits/sale] Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

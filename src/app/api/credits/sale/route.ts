import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  normalizeCreditFrequency,
  normalizeInstallmentCount,
} from '@/lib/credits/installments'
import { createCreditAccount, CreditAccountError } from '@/lib/credits/create-credit-account'

type CreateCreditSaleBody = {
  customerId?: unknown
  amount?: unknown
  interestRate?: unknown
  dueDate?: unknown
  firstInstallmentTiming?: unknown
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

function normalizePositiveAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
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
    const timing = body.firstInstallmentTiming ?? 'at_start'
    if (timing !== 'at_start' && timing !== 'next_cycle') {
      return NextResponse.json({ error: 'La opción de inicio de cuotas no es válida.' }, { status: 400 })
    }
    if (body.dueDate && body.firstInstallmentTiming !== undefined) {
      return NextResponse.json({ error: 'Elegí una modalidad de inicio o una fecha personalizada, no ambas.' }, { status: 400 })
    }
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

    const result = await createCreditAccount({
      supabase,
      organizationId: organization.id,
      customerId,
      creditLimit,
      amount,
      interestRate,
      installmentCount,
      frequency,
      dueDate: providedDueDate,
      firstInstallmentTiming: timing,
      saleId,
      label: saleRow?.code ? `Venta ${saleRow.code}` : 'Credito manual',
      creditType: saleId ? 'product_financing' : 'manual',
      originType: saleId ? 'sale' : 'manual',
    })

    return NextResponse.json({
      success: true,
      creditId: result.creditId,
      installmentCount: result.installmentCount,
      financedTotal: result.financedTotal,
      interestAmount: result.interestAmount,
    })
  } catch (error) {
    if (error instanceof CreditAccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[credits/sale] Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

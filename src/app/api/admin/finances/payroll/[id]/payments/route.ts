import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { payrollPaymentInputSchema } from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  payPayrollEntry,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const payrollEntryIdSchema = z.uuid()
const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((key) => !key.toLowerCase().startsWith('payroll-system:'))
const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )

async function postHandler(request: NextRequest, context: AdminAuthContext, params: Promise<{ id: string }>) {
  const payrollEntryId = payrollEntryIdSchema.safeParse((await params).id)
  const body = payrollPaymentInputSchema.safeParse(await request.json().catch(() => null))
  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('x-idempotency-key'))
  const selection = organizationSelectionSchema.safeParse({ organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined, organizationHeader: request.headers.get('x-organization-id') ?? undefined })
  if (!payrollEntryId.success || !body.success || !idempotencyKey.success || !selection.success) {
    return NextResponse.json({ error: 'Pago de nómina inválido o sin clave de idempotencia válida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    await assertFinanceBranchAccess({ context, organizationId, branchId: body.data.branchId })
    const payment = await payPayrollEntry({
      rpcName: 'pay_payroll_entry_atomic',
      organizationId,
      payrollEntryId: payrollEntryId.data,
      input: body.data,
      idempotencyKey: idempotencyKey.data,
    })
    return NextResponse.json(payment)
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
  }
}

export function POST(request: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
  return withAdminAuth((req, authContext) => postHandler(req, authContext, routeContext.params))(request)
}

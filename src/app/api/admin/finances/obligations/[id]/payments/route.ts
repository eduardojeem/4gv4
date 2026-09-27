import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { paymentInputSchema } from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  payObligation,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const obligationIdSchema = z.uuid()
const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((key) => !key.toLowerCase().startsWith('finance-system:'))
const organizationSelectionSchema = z
  .object({
    organizationId: z.uuid().optional(),
    organizationHeader: z.uuid().optional(),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )

async function postHandler(
  request: NextRequest,
  context: AdminAuthContext,
  params: Promise<{ id: string }>,
) {
  const obligationIdResult = obligationIdSchema.safeParse((await params).id)
  const idempotencyKeyResult = idempotencyKeySchema.safeParse(
    request.headers.get('x-idempotency-key'),
  )
  const organizationResult = organizationSelectionSchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  })
  const bodyResult = paymentInputSchema.safeParse(
    await request.json().catch(() => null),
  )

  if (
    !obligationIdResult.success ||
    !idempotencyKeyResult.success ||
    !organizationResult.success ||
    !bodyResult.success
  ) {
    return NextResponse.json(
      { error: 'Pago invalido o sin clave de idempotencia valida.' },
      { status: 422 },
    )
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      organizationResult.data.organizationHeader ??
        organizationResult.data.organizationId,
    )
    await assertFinanceBranchAccess({
      context,
      organizationId,
      branchId: bodyResult.data.branchId,
    })
    const result = await payObligation({
      rpcName: 'pay_finance_obligation_atomic',
      rpcArgs: {
        p_organization_id: organizationId,
        p_branch_id: bodyResult.data.branchId,
        p_obligation_id: obligationIdResult.data,
        p_amount: bodyResult.data.amount,
        p_payment_method: bodyResult.data.paymentMethod,
        p_payment_date: bodyResult.data.paymentDate,
        p_idempotency_key: idempotencyKeyResult.data,
        p_cash_session_id: bodyResult.data.cashSessionId ?? null,
        p_reference: bodyResult.data.reference ?? null,
        p_notes: bodyResult.data.notes ?? null,
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export function POST(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> },
) {
  return withAdminAuth((req, authContext) =>
    postHandler(req, authContext, routeContext.params),
  )(request)
}

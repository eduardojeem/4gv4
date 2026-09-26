import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { expenseInputSchema } from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  resolveFinanceOrganizationId,
  toFinanceApiError,
  updateUnpaidObligation,
  voidObligation,
} from '@/lib/finance/server'

const obligationIdSchema = z.uuid()
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
const expenseUpdateSchema = expenseInputSchema
  .omit({ recurrence: true })
  .partial()
  .extend({
    branchId: z.uuid(),
    dueDate: z.iso.date().nullable().optional(),
    vendor: z.string().trim().min(1).max(200).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== 'branchId'), {
    message: 'Incluye al menos un campo para actualizar.',
  })
const voidObligationSchema = z.object({
  branchId: z.uuid(),
  reason: z.string().trim().min(1).max(1_000),
  cashSessionId: z.uuid().optional(),
})

function parseOrganization(request: NextRequest) {
  return organizationSelectionSchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  })
}

function errorResponse(error: unknown) {
  const financeError = toFinanceApiError(error)
  return NextResponse.json(
    { error: financeError.message, code: financeError.code },
    { status: financeError.status },
  )
}

async function patchHandler(
  request: NextRequest,
  context: AdminAuthContext,
  params: Promise<{ id: string }>,
) {
  const obligationIdResult = obligationIdSchema.safeParse((await params).id)
  const organizationResult = parseOrganization(request)
  const bodyResult = expenseUpdateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (
    !obligationIdResult.success ||
    !organizationResult.success ||
    !bodyResult.success
  ) {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 422 })
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
    const obligation = await updateUnpaidObligation({
      organizationId,
      obligationId: obligationIdResult.data,
      userId: context.user.id,
      input: bodyResult.data,
    })
    return NextResponse.json({ obligation })
  } catch (error) {
    return errorResponse(error)
  }
}

async function deleteHandler(
  request: NextRequest,
  context: AdminAuthContext,
  params: Promise<{ id: string }>,
) {
  const obligationIdResult = obligationIdSchema.safeParse((await params).id)
  const organizationResult = parseOrganization(request)
  const bodyResult = voidObligationSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (
    !obligationIdResult.success ||
    !organizationResult.success ||
    !bodyResult.success
  ) {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 422 })
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
    const obligation = await voidObligation({
      organizationId,
      obligationId: obligationIdResult.data,
      branchId: bodyResult.data.branchId,
      reason: bodyResult.data.reason,
      cashSessionId: bodyResult.data.cashSessionId,
    })
    return NextResponse.json({ obligation })
  } catch (error) {
    return errorResponse(error)
  }
}

export function PATCH(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> },
) {
  return withAdminAuth((req, authContext) =>
    patchHandler(req, authContext, routeContext.params),
  )(request)
}

export function DELETE(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> },
) {
  return withAdminAuth((req, authContext) =>
    deleteHandler(req, authContext, routeContext.params),
  )(request)
}

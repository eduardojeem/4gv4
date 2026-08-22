import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { expenseInputSchema } from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  createObligation,
  listObligations,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((key) => !key.toLowerCase().startsWith('finance-system:'))
const obligationQuerySchema = z
  .object({
    organizationId: z.uuid().optional(),
    organizationHeader: z.uuid().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    branchId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    status: z
      .enum(['draft', 'pending', 'partially_paid', 'paid', 'overdue', 'voided'])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )
  .refine(
    (input) => !input.startDate || !input.endDate || input.startDate <= input.endDate,
    { message: 'El rango de fechas es invalido.' },
  )

function parseQuery(request: NextRequest) {
  return obligationQuerySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    startDate: request.nextUrl.searchParams.get('startDate') ?? undefined,
    endDate: request.nextUrl.searchParams.get('endDate') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
    categoryId: request.nextUrl.searchParams.get('categoryId') ?? undefined,
    status: request.nextUrl.searchParams.get('status') ?? undefined,
    page: request.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: request.nextUrl.searchParams.get('pageSize') ?? undefined,
  })
}

function errorResponse(error: unknown) {
  const financeError = toFinanceApiError(error)
  return NextResponse.json(
    { error: financeError.message, code: financeError.code },
    { status: financeError.status },
  )
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const queryResult = parseQuery(request)
  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Consulta invalida.', details: queryResult.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      queryResult.data.organizationHeader ?? queryResult.data.organizationId,
    )
    if (queryResult.data.branchId) {
      await assertFinanceBranchAccess({
        context,
        organizationId,
        branchId: queryResult.data.branchId,
      })
    }

    const result = await listObligations(organizationId, queryResult.data)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}

async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const queryResult = parseQuery(request)
  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Consulta invalida.', details: queryResult.error.flatten() },
      { status: 422 },
    )
  }

  const body = await request.json().catch(() => null)
  const bodyResult = expenseInputSchema.safeParse(body)
  const idempotencyKeyResult = idempotencyKeySchema.safeParse(
    request.headers.get('x-idempotency-key'),
  )
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Gasto invalido.', details: bodyResult.error.flatten() },
      { status: 422 },
    )
  }
  if (bodyResult.data.recurrence && !idempotencyKeyResult.success) {
    return NextResponse.json(
      { error: 'Los gastos recurrentes requieren una clave de idempotencia valida.' },
      { status: 422 },
    )
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      queryResult.data.organizationHeader ?? queryResult.data.organizationId,
    )
    await assertFinanceBranchAccess({
      context,
      organizationId,
      branchId: bodyResult.data.branchId,
    })
    const obligation = await createObligation({
      organizationId,
      userId: context.user.id,
      input: bodyResult.data,
      idempotencyKey: idempotencyKeyResult.success
        ? idempotencyKeyResult.data
        : undefined,
    })

    return NextResponse.json({ obligation }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)

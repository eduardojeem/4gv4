import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  assertFinanceBranchAccess,
  listOpenCashSessions,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const querySchema = z
  .object({
    organizationId: z.uuid().optional(),
    organizationHeader: z.uuid().optional(),
    branchId: z.uuid(),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const queryResult = querySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
  })
  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Selecciona una sucursal valida para ver sus cajas abiertas.', details: queryResult.error.flatten() },
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
      branchId: queryResult.data.branchId,
    })
    const sessions = await listOpenCashSessions(organizationId, queryResult.data.branchId)
    return NextResponse.json({ sessions })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const GET = withAdminAuth(getHandler)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  assertFinanceBranchAccess,
  financeSummaryQuerySchema,
  getFinanceProfitability,
  resolveFinanceOrganizationId,
  toFinanceApiError,
  type FinanceProfitabilityGroup,
} from '@/lib/finance/server'

const profitabilityGroupSchema = z.enum([
  'sale',
  'repair',
  'product',
  'employee',
  'branch',
])

function parseQuery(request: NextRequest) {
  return financeSummaryQuerySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    startDate: request.nextUrl.searchParams.get('startDate') ?? undefined,
    endDate: request.nextUrl.searchParams.get('endDate') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
  })
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const query = parseQuery(request)
  const group = profitabilityGroupSchema.safeParse(
    request.nextUrl.searchParams.get('group') ?? 'sale',
  )
  if (!query.success || !group.success) {
    return NextResponse.json(
      { error: 'Consulta de rentabilidad invalida.' },
      { status: 422 },
    )
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      query.data.organizationHeader ?? query.data.organizationId,
    )
    if (query.data.branchId) {
      await assertFinanceBranchAccess({
        context,
        organizationId,
        branchId: query.data.branchId,
      })
    }
    const rows = await getFinanceProfitability(
      organizationId,
      query.data,
      group.data as FinanceProfitabilityGroup,
    )
    return NextResponse.json({ group: group.data, rows })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const GET = withAdminAuth(getHandler)

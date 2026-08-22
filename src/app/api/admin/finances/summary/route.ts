import { NextRequest, NextResponse } from 'next/server'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  assertFinanceBranchAccess,
  financeSummaryQuerySchema,
  getFinanceSummary,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

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
  if (!query.success) {
    return NextResponse.json(
      { error: 'Consulta financiera invalida.', details: query.error.flatten() },
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
    const summary = await getFinanceSummary(organizationId, query.data)
    return NextResponse.json(summary)
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const GET = withAdminAuth(getHandler)

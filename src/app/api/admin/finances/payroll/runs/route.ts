import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { assertFinanceBranchAccess, listPayrollRuns, resolveFinanceOrganizationId, toFinanceApiError } from '@/lib/finance/server'

const querySchema = z.object({
  organizationId: z.uuid().optional(),
  organizationHeader: z.uuid().optional(),
  branchId: z.uuid().optional(),
  periodFrom: z.iso.date().optional(),
  periodTo: z.iso.date().optional(),
}).refine((input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader)

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const query = querySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
    periodFrom: request.nextUrl.searchParams.get('periodFrom') ?? undefined,
    periodTo: request.nextUrl.searchParams.get('periodTo') ?? undefined,
  })
  if (!query.success) return NextResponse.json({ error: 'Consulta de nómina inválida.' }, { status: 422 })
  try {
    const organizationId = await resolveFinanceOrganizationId(context, query.data.organizationHeader ?? query.data.organizationId)
    if (query.data.branchId) await assertFinanceBranchAccess({ context, organizationId, branchId: query.data.branchId })
    return NextResponse.json({ runs: await listPayrollRuns(organizationId, query.data) })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
  }
}

export const GET = withAdminAuth(getHandler)
